"use client";

import { Box, Text, VStack, Input, Button, HStack, Badge, Card } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { CharacterAvatar, getExpressionForMessage, type Expression } from "@/components/CharacterAvatar";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@chakra-ui/react";
import { chatWithAISeamless, AIProvider } from "@/lib/ai-service";
import { getTaskTreeAsync, saveTaskTreeAsync, serializeTreeForAI, addNodeToTree, generateNodeId } from "@/lib/task-tree-storage";
import { TaskNode } from "@/types/task-tree";
import { getHearingPrompt, getHearingCompletePrompt, getTaskOutputPrompt, getInterestStagePrompt } from "@/lib/prompts";
import { useAuth } from "@/contexts/AuthContext";
import { getChatMessages, saveChatMessage, getUserProfile, createUserProfile, updateUserProfile, getUserUsage, incrementUsage, checkUsageLimit, updateLoginStreak, createConversation, getConversations, getConversationMessages, addMessageToConversation, updateConversationTitle, updateConversationHearingState, deleteConversation, type UsageData } from "@/lib/firebase/firestore";
import { USAGE_LIMITS, getLimitReachedMessage } from "@/lib/usage-config";
import { signOut as firebaseSignOut } from "@/lib/firebase/auth";
import { parseTaskTreeFromMessage, hasTaskTreeStructure } from "@/lib/task-tree-parser";
import { ProfileSetupModal } from "@/components/ProfileSetupModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { FiSettings, FiMenu } from "react-icons/fi";
import type { UserProfile, Conversation } from "@/lib/firebase/firestore-types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ヒアリング進捗を追跡する型
interface HearingProgress {
  why: boolean;       // なぜやりたいか
  current: boolean;   // 現状
  target: boolean;    // 目標の詳細
  timeline: boolean;  // いつまでに
}

const HEARING_ITEMS = [
  { key: "why", label: "Why（動機）", question: "なんでそれやりたいの？きっかけは？" },
  { key: "current", label: "現状", question: "今はどんな状況？これまでやったことある？" },
  { key: "target", label: "ゴール", question: "具体的にどうなりたい？どこまで目指してる？" },
  { key: "timeline", label: "期限", question: "いつまでに達成したい？" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [characterMessage, setCharacterMessage] = useState("今日はどのタスクから行く？");
  const [characterExpression, setCharacterExpression] = useState<Expression>("normal"); // 初期はノーマル
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false); // 会話履歴モーダル
  const [provider] = useState<AIProvider>("gemini");
  // ステージ: normal → hearing → proposal → output
  const [taskBreakdownStage, setTaskBreakdownStage] = useState<
    "normal" | "hearing" | "proposal" | "output"
  >("normal");
  const [taskTree, setTaskTree] = useState<TaskNode[]>([]);
  const [goalContext, setGoalContext] = useState<string>(""); // 最初の目標

  // ヒアリングで収集した情報
  const [hearingSummary, setHearingSummary] = useState({
    goal: "",
    why: "",
    current: "",
    target: "",
    timeline: "",
  });
  const expressionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ヒアリング進捗追跡
  const [hearingProgress, setHearingProgress] = useState<HearingProgress>({
    why: false,
    current: false,
    target: false,
    timeline: false,
  });

  // プロフィール関連
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // 利用制限関連
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);

  // 会話履歴サイドバー関連
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // ヒアリング進捗率を計算
  const hearingPercentage = Math.round(
    (Object.values(hearingProgress).filter(Boolean).length / 4) * 100
  );

  // 次に聞くべき項目を取得
  const getNextHearingItem = () => {
    for (const item of HEARING_ITEMS) {
      if (!hearingProgress[item.key as keyof HearingProgress]) {
        return item;
      }
    }
    return null;
  };

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // プロフィールを読み込み
  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setUserProfile(profile);
          // プロフィール未完了なら設定モーダルを表示
          if (!profile.profileCompleted) {
            setShowProfileSetup(true);
          }
        } else {
          // プロフィールが存在しない場合は初回設定モーダルを表示
          setShowProfileSetup(true);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // タスクツリーを読み込み
  useEffect(() => {
    if (!user) return;

    const loadTaskTree = async () => {
      const tree = await getTaskTreeAsync(user.uid);
      setTaskTree(tree);
    };

    loadTaskTree();
  }, [user]);

  // 会話履歴をFirestoreから読み込み
  useEffect(() => {
    if (!user) return;

    const loadChatHistory = async () => {
      try {
        const chatMessages = await getChatMessages(user.uid);
        const formattedMessages: Message[] = chatMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        setMessages(formattedMessages);

        // 最後のアシスタントメッセージを表示
        const lastAssistant = formattedMessages.filter((m: Message) => m.role === "assistant").pop();
        if (lastAssistant) {
          setCharacterMessage(lastAssistant.content);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    loadChatHistory();
  }, [user]);

  // 利用制限状況を読み込み + ログイン連続日数を更新
  useEffect(() => {
    if (!user) return;

    const loadUsageAndUpdateStreak = async () => {
      try {
        // 利用制限チェック
        const { isLimitReached: limitReached, usage } = await checkUsageLimit(user.uid);
        setUsageData(usage);
        setIsLimitReached(limitReached);

        // ログイン連続日数を更新
        await updateLoginStreak(user.uid);
      } catch (error) {
        console.error("Failed to load usage or update streak:", error);
      }
    };

    loadUsageAndUpdateStreak();
  }, [user]);

  // 会話一覧を読み込み
  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      try {
        const convs = await getConversations(user.uid);
        setConversations(convs);
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };

    loadConversations();
  }, [user]);

  // ヒアリング状態をFirestoreに保存
  useEffect(() => {
    if (!currentConversationId) return;

    const saveHearingState = async () => {
      try {
        await updateConversationHearingState(currentConversationId, {
          taskBreakdownStage,
          hearingProgress,
          hearingSummary,
        });
        // 会話一覧も更新（状態が反映されるように）
        if (user) {
          const convs = await getConversations(user.uid);
          setConversations(convs);
        }
      } catch (error) {
        console.error("Failed to save hearing state:", error);
      }
    };

    // デバウンス: 状態変更から500ms後に保存
    const timer = setTimeout(saveHearingState, 500);
    return () => clearTimeout(timer);
  }, [currentConversationId, taskBreakdownStage, hearingProgress, hearingSummary, user]);

  // 表情を5秒後にノーマルに戻すヘルパー関数
  const setExpressionWithAutoReset = (expression: Expression) => {
    // 既存のタイマーをクリア
    if (expressionTimerRef.current) {
      clearTimeout(expressionTimerRef.current);
    }

    // 表情を設定
    setCharacterExpression(expression);

    // normalでない場合のみ5秒後にnormalに戻す
    if (expression !== "normal") {
      expressionTimerRef.current = setTimeout(() => {
        setCharacterExpression("normal");
      }, 5000); // 5秒
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (expressionTimerRef.current) {
        clearTimeout(expressionTimerRef.current);
      }
    };
  }, []);

  // === 会話管理ハンドラー ===

  // 新規会話を作成
  const handleNewConversation = async () => {
    if (!user) return;

    try {
      const newConvId = await createConversation(user.uid, '新しい会話');
      setCurrentConversationId(newConvId);
      setMessages([]);
      setCharacterMessage("今日はどのタスクから行く？");
      setTaskBreakdownStage("normal");
      setGoalContext("");
      setHearingProgress({ why: false, current: false, target: false, timeline: false });
      setHearingSummary({ goal: "", why: "", current: "", target: "", timeline: "" });

      // 会話一覧を再読み込み
      const convs = await getConversations(user.uid);
      setConversations(convs);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  // 会話を選択
  const handleSelectConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      setCurrentConversationId(conversationId);

      // メッセージを読み込み
      const msgs = await getConversationMessages(conversationId);
      const formattedMsgs: Message[] = msgs.map(m => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(formattedMsgs);

      // 最後のアシスタントメッセージを表示
      const lastAssistant = formattedMsgs.filter(m => m.role === "assistant").pop();
      if (lastAssistant) {
        setCharacterMessage(lastAssistant.content);
      } else {
        setCharacterMessage("今日はどのタスクから行く？");
      }

      // 会話からヒアリング状態を復元
      const selectedConv = conversations.find(c => c.id === conversationId);
      if (selectedConv) {
        // ステージを復元（保存されていなければnormal）
        setTaskBreakdownStage(selectedConv.taskBreakdownStage || "normal");

        // ヒアリング進捗を復元
        if (selectedConv.hearingProgress) {
          setHearingProgress(selectedConv.hearingProgress);
        } else {
          setHearingProgress({ why: false, current: false, target: false, timeline: false });
        }

        // ヒアリング要約を復元
        if (selectedConv.hearingSummary) {
          setHearingSummary(selectedConv.hearingSummary);
        } else {
          setHearingSummary({ goal: "", why: "", current: "", target: "", timeline: "" });
        }
      } else {
        setTaskBreakdownStage("normal");
        setHearingProgress({ why: false, current: false, target: false, timeline: false });
        setHearingSummary({ goal: "", why: "", current: "", target: "", timeline: "" });
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  // タイトルを更新
  const handleUpdateConversationTitle = async (conversationId: string, title: string) => {
    try {
      await updateConversationTitle(conversationId, title, true);
      // 会話一覧を再読み込み
      if (user) {
        const convs = await getConversations(user.uid);
        setConversations(convs);
      }
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  // 会話を削除
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId);

      // 削除した会話が現在表示中なら、メッセージをクリア
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
        setCharacterMessage("今日はどのタスクから行く？");
      }

      // 会話一覧を再読み込み
      if (user) {
        const convs = await getConversations(user.uid);
        setConversations(convs);
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  // AIでタイトルを生成
  const generateConversationTitle = async (firstMessage: string, conversationId: string) => {
    try {
      // 簡易的にタイトル生成（最初のメッセージを短く）
      const title = firstMessage.length > 20
        ? firstMessage.substring(0, 20) + "..."
        : firstMessage;

      await updateConversationTitle(conversationId, title, false);

      // 会話一覧を再読み込み
      if (user) {
        const convs = await getConversations(user.uid);
        setConversations(convs);
      }
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  };

  const handleReflectToTaskTree = async () => {
    if (messages.length === 0) return;

    // 最後のAIメッセージを取得
    const lastAIMessage = messages.filter(m => m.role === "assistant").pop();
    if (!lastAIMessage) {
      alert("タスクの提案が見つかりませんでした。");
      return;
    }

    // タスクツリー構造があるかチェック
    if (!hasTaskTreeStructure(lastAIMessage.content)) {
      alert("タスクツリー形式の出力が見つかりませんでした。\nAIに「タスクに分解して」と依頼してください。");
      return;
    }

    // AIメッセージをパース
    const parsedNodes = parseTaskTreeFromMessage(lastAIMessage.content);
    if (parsedNodes.length === 0) {
      alert("タスクのパースに失敗しました。");
      return;
    }

    // パース結果のサマリーを表示
    const summary = parsedNodes.map(node => {
      const countChildren = (n: TaskNode): number => {
        if (!n.children) return 0;
        return n.children.length + n.children.reduce((sum, c) => sum + countChildren(c), 0);
      };
      return `・${node.title} (${countChildren(node) + 1}項目)`;
    }).join("\n");

    const confirmAdd = confirm(
      `以下のタスクツリーを追加しますか？\n\n${summary}\n\n「OK」= 追加する`
    );

    if (!confirmAdd) return;

    // タスクツリーに追加（parsedNodesをそのまま追加）
    const updatedTree = [...taskTree, ...parsedNodes];
    setTaskTree(updatedTree);
    await saveTaskTreeAsync(updatedTree, user?.uid);

    // 成功メッセージ
    const totalItems = parsedNodes.reduce((sum, node) => {
      const countAll = (n: TaskNode): number => {
        if (!n.children) return 1;
        return 1 + n.children.reduce((s, c) => s + countAll(c), 0);
      };
      return sum + countAll(node);
    }, 0);

    setCharacterMessage(`${totalItems}個のタスクをツリーに追加しました！🎉`);
    setExpressionWithAutoReset("wawa");

    // タスクページに遷移
    setTimeout(() => {
      window.location.href = `/tasks?highlight=${parsedNodes[0]?.id}`;
    }, 1500);
  };

  const handleLogout = async () => {
    try {
      await firebaseSignOut();
      router.push('/login');
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  // 初回プロフィール設定完了
  const handleProfileSetupComplete = async (data: { nickname: string; occupation: string }) => {
    if (!user) return;

    try {
      if (userProfile) {
        // 既存プロフィールを更新
        await updateUserProfile(user.uid, {
          nickname: data.nickname,
          occupation: data.occupation,
          profileCompleted: true,
        });
      } else {
        // 新規プロフィール作成
        await createUserProfile(user.uid, user.email || "", {
          nickname: data.nickname,
          occupation: data.occupation,
          profileCompleted: true,
        });
      }

      // ローカル状態を更新
      const updatedProfile = await getUserProfile(user.uid);
      setUserProfile(updatedProfile);
      setShowProfileSetup(false);

      // 歓迎メッセージ
      setCharacterMessage(`${data.nickname}さん、よろしくね！今日はどのタスクから行く？`);
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  // 設定保存
  const handleSettingsSave = async (data: { nickname: string; occupation: string; hobbies: string }) => {
    if (!user) return;

    try {
      await updateUserProfile(user.uid, {
        nickname: data.nickname,
        occupation: data.occupation,
        hobbies: data.hobbies,
      });

      // ローカル状態を更新
      const updatedProfile = await getUserProfile(user.uid);
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  };

  // ユーザーの返答からヒアリング項目を検出して更新
  // AIの前の質問とユーザーの回答の両方を考慮
  const detectAndUpdateHearing = (userMsg: string) => {
    const newProgress = { ...hearingProgress };
    const newSummary = { ...hearingSummary };
    let detected = false;

    // 直前のAIメッセージを取得
    const lastAIMessage = messages.filter(m => m.role === "assistant").pop()?.content || "";

    // 興味本位の質問は無視（「個人的に気になる」が含まれていたらスキップ）
    const isCuriosityQuestion = /個人的に気になる/.test(lastAIMessage);
    if (isCuriosityQuestion) {
      // 興味本位の質問への回答なので、進捗には影響しない
      return newProgress;
    }

    // === Why（動機）の検出 ===
    if (!detected && !hearingProgress.why) {
      // AIが動機を聞いた: なんで、きっかけ、理由
      const aiAskedWhy = /なんで|きっかけ|理由|どうして|なぜ/.test(lastAIMessage);
      // ユーザーが理由を述べた
      const userAnsweredWhy = /だから|ので|のため|って思|と思って|理由は|きっかけは|したい|たくて|ほしくて/.test(userMsg);

      if (aiAskedWhy || userAnsweredWhy) {
        newProgress.why = true;
        newSummary.why = userMsg;
        detected = true;
      }
    }

    // === 現状の検出 ===
    if (!detected && !hearingProgress.current) {
      // AIが現状を聞いた: 今、状況、経験、やったこと
      const aiAskedCurrent = /今は|状況|経験|やったこと|これまで|現在/.test(lastAIMessage);
      // ユーザーが現状を述べた
      const userAnsweredCurrent = /今は|まだ|したことない|やってない|やってる|始めた|経験|初心者|未経験|ちょっと/.test(userMsg);

      if (aiAskedCurrent || userAnsweredCurrent) {
        newProgress.current = true;
        newSummary.current = userMsg;
        detected = true;
      }
    }

    // === ゴールの検出 ===
    if (!detected && !hearingProgress.target) {
      // AIがゴールを聞いた: どこまで、目指す、具体的に、どうなりたい
      const aiAskedTarget = /どこまで|目指|具体的|どうなりたい|レベル|ゴール/.test(lastAIMessage);
      // ユーザーがゴールを述べた
      const userAnsweredTarget = /になりたい|レベル|できるように|合格したい|受かりたい|目指し|達成|到達|ぐらい/.test(userMsg);

      if (aiAskedTarget || userAnsweredTarget) {
        newProgress.target = true;
        newSummary.target = userMsg;
        detected = true;
      }
    }

    // === 期限の検出 ===
    if (!detected && !hearingProgress.timeline) {
      // AIが期限を聞いた: いつまで、期限、期間
      const aiAskedTimeline = /いつまで|期限|期間|いつ頃|目標時期/.test(lastAIMessage);
      // ユーザーが期限を述べた
      const userAnsweredTimeline = /月まで|年まで|来年|今年|ヶ月|週間|日まで|以内|年末|年度|春|夏|秋|冬|202\d/.test(userMsg);

      if (aiAskedTimeline || userAnsweredTimeline) {
        newProgress.timeline = true;
        newSummary.timeline = userMsg;
        detected = true;
      }
    }

    setHearingProgress(newProgress);
    setHearingSummary(newSummary);

    return newProgress;
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading || !user) return;

    // === 利用制限チェック ===
    if (isLimitReached) {
      const limitMessage: Message = {
        role: "assistant",
        content: getLimitReachedMessage()
      };
      setMessages([...messages, { role: "user", content: message }, limitMessage]);
      setCharacterMessage(getLimitReachedMessage());
      setMessage("");
      return;
    }

    const userMessage: Message = { role: "user", content: message };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setMessage("");
    setIsLoading(true);

    // 会話IDがなければ新規作成
    let convId = currentConversationId;
    if (!convId) {
      try {
        convId = await createConversation(user.uid, '新しい会話');
        setCurrentConversationId(convId);
      } catch (error) {
        console.error("Failed to create conversation:", error);
      }
    }

    // Firestoreにユーザーメッセージを保存
    try {
      if (convId) {
        await addMessageToConversation(convId, 'user', message);
        // 最初のメッセージならタイトルを生成
        if (messages.length === 0) {
          await generateConversationTitle(message, convId);
        }
      }
    } catch (error) {
      console.error("Failed to save user message:", error);
    }

    try {
      let systemPrompt = "";
      let contextToSend: Message[] = newMessages;

      // === Stage 1: Normal → Hearing ===
      // キーワード検出で hearing stage に移行
      const hasTaskKeyword = /やりたい|成したい|達成したい|目標|勉強したい|学びたい|習得したい|始めたい|作りたい|実現したい|タスク|分解|計画|ステップ|行きたい|なりたい|受かりたい/.test(message);

      if (taskBreakdownStage === "normal" && hasTaskKeyword) {
        setTaskBreakdownStage("hearing");
        setGoalContext(message);
        setHearingSummary(prev => ({ ...prev, goal: message }));

        // 最初は興味を示す
        systemPrompt = getInterestStagePrompt();
      }
      // === Stage 2: Hearing ===
      // ヒアリング中 - 進捗を更新して次の質問を促す
      else if (taskBreakdownStage === "hearing") {
        // ユーザーの返答からヒアリング情報を検出
        const updatedProgress = detectAndUpdateHearing(message);

        // 進捗率を計算
        const progressCount = Object.values(updatedProgress).filter(Boolean).length;
        const newPercentage = Math.round((progressCount / 4) * 100);

        // 100%になったらproposal段階へ
        if (newPercentage === 100) {
          setTaskBreakdownStage("proposal");
          systemPrompt = getHearingCompletePrompt({
            ...hearingSummary,
            why: hearingSummary.why || message,
          });
        } else {
          // まだヒアリング中 - 次の質問を促す
          const nextItem = HEARING_ITEMS.find(
            item => !updatedProgress[item.key as keyof HearingProgress]
          ) || null;

          systemPrompt = getHearingPrompt(
            updatedProgress,
            nextItem,
            goalContext
          );
        }
      }
      // === Stage 3: Proposal → Output ===
      // ユーザーが同意したらタスク出力
      else if (taskBreakdownStage === "proposal") {
        const userAgreed = /うん|お願い|いいね|そうだね|やろう|はい|yes|ok|オッケー|よろしく|分解/.test(message.toLowerCase());

        if (userAgreed) {
          setTaskBreakdownStage("output");
          systemPrompt = getTaskOutputPrompt(hearingSummary);
        } else {
          // まだ同意を待つ
          systemPrompt = getHearingCompletePrompt(hearingSummary);
        }
      }
      // === Stage 4: Output ===
      // タスク出力モード
      else if (taskBreakdownStage === "output") {
        systemPrompt = getTaskOutputPrompt(hearingSummary);
      }

      // Few-shot examples を先頭に追加（AIに短い会話を学習させる）
      const fewShotExamples: Message[] = [
        { role: "user", content: "新しいこと始めたい" },
        { role: "assistant", content: "いいね！どんなこと？" },
        { role: "user", content: "まだ決まってないけど何か挑戦したくて" },
        { role: "assistant", content: "そうなんだ！何かきっかけあったの？" },
      ];

      // === プラン3: トークン節約 ===
      // 会話履歴を直近10件（5往復）に制限
      const MAX_HISTORY_MESSAGES = 10;
      const recentMessages = newMessages.slice(-MAX_HISTORY_MESSAGES);

      // ヒアリング情報をシステムプロンプトに埋め込む
      const hearingContext = (hearingSummary.goal || hearingSummary.why || hearingSummary.current || hearingSummary.target || hearingSummary.timeline)
        ? `\n【収集済みヒアリング情報】
◆ 目標: ${hearingSummary.goal || "未収集"}
◆ Why（動機）: ${hearingSummary.why || "未収集"}
◆ 現状: ${hearingSummary.current || "未収集"}
◆ ゴール: ${hearingSummary.target || "未収集"}
◆ 期限: ${hearingSummary.timeline || "未収集"}
※上記は過去の会話で収集済み。同じ質問を繰り返さないこと。`
        : "";

      // システムプロンプト + ヒアリング情報を結合
      const fullSystemPrompt = systemPrompt
        ? systemPrompt + hearingContext
        : hearingContext;

      // コンテキストを構築
      if (fullSystemPrompt) {
        contextToSend = [
          { role: "user", content: fullSystemPrompt },
          ...fewShotExamples,
          ...recentMessages,
        ];
      } else {
        contextToSend = [
          ...fewShotExamples,
          ...recentMessages,
        ];
      }

      // AIシームレスモードで会話
      const response = await chatWithAISeamless(contextToSend, provider);

      if (response.success && response.content) {
        let finalContent = response.content;

        // 通常モードで250文字超えたら要約を依頼
        if (taskBreakdownStage === "normal" && response.content.length > 250) {
          console.log(`Response too long (${response.content.length} chars), requesting summary...`);
          const summaryResponse = await chatWithAISeamless([
            { role: "user", content: `以下の文章を100文字以内で要約して、敬語で1〜2文にまとめて：\n\n${response.content}` }
          ], provider);
          if (summaryResponse.success && summaryResponse.content) {
            finalContent = summaryResponse.content;
          }
        }

        const assistantMessage: Message = { role: "assistant", content: finalContent };
        setMessages([...newMessages, assistantMessage]);
        setCharacterMessage(finalContent);

        // Firestoreにアシスタントメッセージを保存
        try {
          if (convId) {
            await addMessageToConversation(convId, 'assistant', finalContent);
          }
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }

        // 利用回数をインクリメント
        try {
          const newUsage = await incrementUsage(user.uid);
          setUsageData(newUsage);
          if (newUsage.count >= USAGE_LIMITS.DAILY_MESSAGE_LIMIT) {
            setIsLimitReached(true);
          }
        } catch (error) {
          console.error("Failed to increment usage:", error);
        }

        // 返答内容に応じて表情を変更（5秒後にnormalに戻る）
        const expression = getExpressionForMessage(response.content);
        setExpressionWithAutoReset(expression);
      } else {
        // レート制限やクォータエラーの検出
        const errorMsg = response.error?.toLowerCase() || "";
        const isRateLimitError =
          errorMsg.includes("429") ||
          errorMsg.includes("rate") ||
          errorMsg.includes("quota") ||
          errorMsg.includes("limit") ||
          errorMsg.includes("exceeded") ||
          errorMsg.includes("resource");

        if (isRateLimitError) {
          setCharacterMessage("現在βテスト版のため、しばらく時間を空けてから操作してください。");
        } else {
          setCharacterMessage("ごめんね、エラーが起きちゃった...");
        }
        setCharacterExpression("normal");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorStr = error instanceof Error ? error.message.toLowerCase() : "";
      const isRateLimitError =
        errorStr.includes("429") ||
        errorStr.includes("rate") ||
        errorStr.includes("quota") ||
        errorStr.includes("limit") ||
        errorStr.includes("exceeded") ||
        errorStr.includes("resource");

      if (isRateLimitError) {
        setCharacterMessage("現在βテスト版のため、しばらく時間を空けてから操作してください。");
      } else {
        setCharacterMessage("ごめんね、エラーが起きちゃった...");
      }
      setCharacterExpression("normal");
    } finally {
      setIsLoading(false);
    }
  };

  // ローディング中またはユーザーがいない場合は何も表示しない
  if (loading || profileLoading || !user) {
    return null;
  }

  return (
    <Box bg="#f8fafc" minH="100vh" pb="64px">
      {/* 会話履歴サイドバー */}
      <ConversationSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onUpdateTitle={handleUpdateConversationTitle}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* ヘッダー */}
      <Box
        bg="white"
        px={4}
        py={3}
        boxShadow="sm"
        borderBottom="1px solid"
        borderColor="gray.200"
      >
        <HStack justify="space-between" align="center">
          <HStack
            cursor="pointer"
            onClick={() => setIsSidebarOpen(true)}
            _hover={{ opacity: 0.7 }}
          >
            <Box color="gray.700">
              <FiMenu size={20} />
            </Box>
            <Text fontWeight="bold" fontSize="lg" color="gray.800">
              TimeTurn
            </Text>
          </HStack>
          <Button
            size="xs"
            colorScheme="gray"
            variant="ghost"
            color="gray.700"
            onClick={() => setShowSettings(true)}
          >
            <HStack gap={1}>
              <FiSettings />
              <Text>設定</Text>
            </HStack>
          </Button>
        </HStack>
      </Box>

      {/* メインコンテンツ */}
      <VStack gap={0} pt={8}>
        {/* ヒアリング進捗インジケーター */}
        {taskBreakdownStage === "hearing" && (
          <Box w="90%" maxW="340px" mb={4}>
            <Box
              bg="purple.500"
              px={4}
              py={2}
              borderRadius="lg"
              boxShadow="md"
              mb={2}
            >
              <Text color="white" fontWeight="bold" fontSize="sm" textAlign="center">
                💭 ヒアリング中... {hearingPercentage}%
              </Text>
            </Box>
            <HStack gap={1} justify="center">
              {HEARING_ITEMS.map((item) => (
                <Box
                  key={item.key}
                  px={2}
                  py={1}
                  borderRadius="md"
                  bg={hearingProgress[item.key as keyof HearingProgress] ? "green.500" : "gray.200"}
                  color={hearingProgress[item.key as keyof HearingProgress] ? "white" : "gray.500"}
                  fontSize="2xs"
                  fontWeight="semibold"
                >
                  {hearingProgress[item.key as keyof HearingProgress] ? "✓" : ""} {item.label}
                </Box>
              ))}
            </HStack>
          </Box>
        )}
        {taskBreakdownStage === "proposal" && (
          <Box
            bg="blue.500"
            px={4}
            py={2}
            borderRadius="full"
            mb={4}
            boxShadow="md"
          >
            <Text color="white" fontWeight="bold" fontSize="sm">
              ✅ ヒアリング完了！タスク分解の確認中
            </Text>
          </Box>
        )}
        {taskBreakdownStage === "output" && (
          <Box
            bg="green.500"
            px={4}
            py={2}
            borderRadius="full"
            mb={4}
            boxShadow="md"
          >
            <Text color="white" fontWeight="bold" fontSize="sm">
              ✨ タスクツリーを生成中...
            </Text>
          </Box>
        )}

        {/* キャラクター立ち絵（常に大きく表示） */}
        <Box
          position="relative"
          w="100%"
          display="flex"
          justifyContent="center"
          mb={6}
        >
          <CharacterAvatar
            expression={characterExpression}
            width="280px"
            height="420px"
          />
        </Box>

        {/* 吹き出し（常に表示、最新のゆりの発言） */}
        <Box
          bg="white"
          mx={4}
          px={6}
          py={4}
          borderRadius="16px"
          boxShadow="0 4px 12px rgba(0,0,0,0.08)"
          border="1px solid"
          borderColor="gray.200"
          position="relative"
          maxW="340px"
          w="90%"
          mb={4}
        >
          {/* 吹き出しのしっぽ（上向き三角形） */}
          <Box
            position="absolute"
            top="-12px"
            left="50%"
            transform="translateX(-50%)"
            w="0"
            h="0"
            borderLeft="12px solid transparent"
            borderRight="12px solid transparent"
            borderBottom="12px solid white"
            filter="drop-shadow(0 -2px 2px rgba(0,0,0,0.04))"
          />

          <VStack align="stretch" gap={2}>
            <Text fontSize="md" fontWeight="bold" color="gray.900" lineHeight="1.6" whiteSpace="pre-wrap">
              {isLoading ? "考えています..." : characterMessage}
            </Text>
          </VStack>
        </Box>

        {/* タスクツリー自動反映ボタン（AIメッセージにタスク構造がある時のみ表示） */}
        {!isLoading && hasTaskTreeStructure(characterMessage) && (
          <Button
            colorScheme="purple"
            size="md"
            onClick={async () => {
              const parsedNodes = parseTaskTreeFromMessage(characterMessage);
              if (parsedNodes.length > 0) {
                const updatedTree = [...taskTree, ...parsedNodes];
                setTaskTree(updatedTree);
                await saveTaskTreeAsync(updatedTree, user?.uid);
                setCharacterMessage("タスクツリーに反映しました！タスクページで確認してください。");
                setExpressionWithAutoReset("wawa");
              }
            }}
            mb={2}
          >
            🎯 タスクツリーに反映する
          </Button>
        )}

        {/* 会話履歴ボタン（会話がある時のみ表示） */}
        {messages.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            colorScheme="gray"
            onClick={() => setIsHistoryModalOpen(true)}
            mb={2}
          >
            📝 会話履歴を見る ({messages.length / 2}往復)
          </Button>
        )}

        {/* チャット入力欄 */}
        <Box w="90%" maxW="340px" mb={6}>
          <VStack gap={2}>
            <Input
              placeholder={
                taskBreakdownStage === "output"
                  ? "タスクについて何かあれば..."
                  : taskBreakdownStage === "proposal"
                  ? "「お願い」「やろう」など..."
                  : taskBreakdownStage === "hearing"
                  ? "気軽に答えてください..."
                  : "「〜したい」と話してみてください..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              bg="white"
              borderRadius="md"
              disabled={isLoading}
              color="gray.900"
              fontWeight="medium"
              fontSize="md"
              _placeholder={{ color: "gray.400" }}
            />
            <Button
              colorScheme="teal"
              w="100%"
              onClick={handleSendMessage}
              loading={isLoading}
              disabled={!message.trim() || isLoading}
            >
              {isLoading ? "送信中..." : "送信"}
            </Button>

            {/* タスク反映ボタン（output段階で会話がある時） */}
            {taskBreakdownStage === "output" && messages.length >= 4 && (
              <Button
                colorScheme="blue"
                w="100%"
                mt={2}
                size="lg"
                onClick={() => {
                  handleReflectToTaskTree();
                }}
              >
                📋 タスクツリーに反映する
              </Button>
            )}
          </VStack>
        </Box>
      </VStack>

      {/* ボトムナビ */}
      <NavTabs />

      {/* 会話履歴モーダル */}
      <Dialog.Root open={isHistoryModalOpen} onOpenChange={(e) => setIsHistoryModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW="600px" maxH="80vh" mx={4}>
            <Dialog.Header>
              <Dialog.Title color="gray.800">会話履歴</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body overflowY="auto">
              <VStack align="stretch" gap={3}>
                {messages.length === 0 ? (
                  <Text color="gray.600" textAlign="center" py={8}>
                    まだ会話がありません
                  </Text>
                ) : (
                  messages.map((msg, index) => (
                    <Box key={index}>
                      {msg.role === "assistant" ? (
                        <Card.Root bg="gray.50">
                          <Card.Body>
                            <HStack mb={1}>
                              <Badge colorScheme="purple" size="sm">秘書ちゃん</Badge>
                              <Text fontSize="xs" color="gray.600">
                                {index === 0 ? "最初" : `${Math.floor(index / 2) + 1}回目の返信`}
                              </Text>
                            </HStack>
                            <Text fontSize="sm" whiteSpace="pre-wrap">
                              {msg.content}
                            </Text>
                          </Card.Body>
                        </Card.Root>
                      ) : (
                        <Card.Root bg="blue.50" ml="auto" maxW="85%">
                          <Card.Body>
                            <HStack mb={1} justify="flex-end">
                              <Text fontSize="xs" color="gray.600">
                                {Math.floor((index + 1) / 2) + 1}回目の質問
                              </Text>
                              <Badge colorScheme="blue" size="sm">あなた</Badge>
                            </HStack>
                            <Text fontSize="sm" whiteSpace="pre-wrap">
                              {msg.content}
                            </Text>
                          </Card.Body>
                        </Card.Root>
                      )}
                    </Box>
                  ))
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => setIsHistoryModalOpen(false)}>
                閉じる
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* 初回プロフィール設定モーダル */}
      <ProfileSetupModal
        isOpen={showProfileSetup}
        onComplete={handleProfileSetupComplete}
      />

      {/* 設定モーダル */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        profile={userProfile}
        onSave={handleSettingsSave}
        onLogout={handleLogout}
      />
    </Box>
  );
}
