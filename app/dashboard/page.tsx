"use client";

import { Box, Text, VStack, Input, Button, HStack, Badge, Card, IconButton } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { CharacterAvatar, getExpressionForMessage, type Expression } from "@/components/CharacterAvatar";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@chakra-ui/react";
import { chatWithAISeamless, AIProvider } from "@/lib/ai-service";
import { getTaskTreeAsync, saveTaskTreeAsync, serializeTreeForAI, addNodeToTree, generateNodeId } from "@/lib/task-tree-storage";
import { TaskNode } from "@/types/task-tree";
import { getHearingPrompt, getHearingCompletePrompt, getTaskOutputPrompt, getInterestStagePrompt, getChatModePrompt, type UserKnowledgeForPrompt } from "@/lib/prompts";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, createUserProfile, updateUserProfile, getUserUsage, incrementUsage, checkUsageLimit, updateLoginStreak, createConversation, getConversations, getConversationMessages, addMessageToConversation, updateConversationTitle, updateConversationHearingState, deleteConversation, getUserKnowledge, updateUserKnowledge, type UsageData } from "@/lib/firebase/firestore";
import { extractKnowledgeFromConversation, shouldExtractKnowledge } from "@/lib/knowledge-extractor";
import type { UserKnowledge } from "@/lib/firebase/firestore-types";
import { USAGE_LIMITS, getLimitReachedMessage } from "@/lib/usage-config";
import { signOut as firebaseSignOut } from "@/lib/firebase/auth";
import { parseTaskTreeFromMessage, hasTaskTreeStructure } from "@/lib/task-tree-parser";
import { ProfileSetupModal } from "@/components/ProfileSetupModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationPermission } from "@/components/NotificationPermission";
import { FiSettings, FiMenu, FiSend } from "react-icons/fi";
import type { UserProfile, Conversation } from "@/lib/firebase/firestore-types";
import { useTypingAnimation } from "@/lib/hooks/useTypingAnimation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ヒアリング進捗を追跡する型
interface HearingProgress {
  why: boolean;       // なぜやりたいか
  current: boolean;   // 現状（課題も含む）
  target: boolean;    // 目標の詳細
  timeline: boolean;  // いつまでに
}

const HEARING_ITEMS = [
  { key: "why", label: "Why（動機）", question: "なんでそれやりたいの？きっかけは？" },
  { key: "current", label: "現状", question: "今どんな状況？困ってることや課題はある？" },
  { key: "target", label: "ゴール", question: "具体的にどうなりたい？どこまで目指してる？" },
  { key: "timeline", label: "期限", question: "いつまでに達成したい？" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [characterMessage, setCharacterMessage] = useState("");
  const [hasShownInitialGreeting, setHasShownInitialGreeting] = useState(false);
  const [characterExpression, setCharacterExpression] = useState<Expression>("normal"); // 初期はノーマル
  const [isLoading, setIsLoading] = useState(false);

  // タイピングアニメーション
  const { displayedText: typedMessage, isTyping } = useTypingAnimation(characterMessage, {
    speed: 35,
    enabled: !isLoading, // ローディング中は無効
  });
  const bubbleScrollRef = useRef<HTMLDivElement>(null);
  const [isBubbleExpanded, setIsBubbleExpanded] = useState(false); // 吹き出し展開状態
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

  // タスクツリー追加確認モーダル関連
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingTaskNodes, setPendingTaskNodes] = useState<TaskNode[]>([]);
  const [confirmSummary, setConfirmSummary] = useState("");

  // ユーザーナレッジ（雑談から学んだ情報）
  const [userKnowledge, setUserKnowledge] = useState<UserKnowledge | null>(null);
  const [lastExtractionCount, setLastExtractionCount] = useState(0);

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

  // ユーザーナレッジを読み込み
  useEffect(() => {
    if (!user) return;

    const loadKnowledge = async () => {
      try {
        const knowledge = await getUserKnowledge(user.uid);
        setUserKnowledge(knowledge);
      } catch (error) {
        console.error("Failed to load knowledge:", error);
      }
    };

    loadKnowledge();
  }, [user]);

  // currentConversationIdが変わったらlocalStorageに保存
  useEffect(() => {
    if (!user) return;

    if (currentConversationId) {
      localStorage.setItem(`lastConversationId_${user.uid}`, currentConversationId);
    } else {
      localStorage.removeItem(`lastConversationId_${user.uid}`);
    }
  }, [user, currentConversationId]);

  // 最後にアクティブだった会話を復元
  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const restoreLastConversation = async () => {
      // すでに会話が選択されている場合はスキップ
      if (currentConversationId) return;

      try {
        // localStorageから最後の会話IDを取得
        const lastConvId = localStorage.getItem(`lastConversationId_${user.uid}`);

        if (lastConvId) {
          // その会話がまだ存在するか確認
          const convExists = conversations.find(c => c.id === lastConvId);
          if (convExists) {
            // 存在する場合は復元
            await handleSelectConversation(lastConvId);
            return;
          }
        }

        // 最後の会話IDがないか、削除されている場合は初回挨拶を表示
        // （何もしない = 初回挨拶のuseEffectが発火）
      } catch (error) {
        console.error("Failed to restore last conversation:", error);
      }
    };

    restoreLastConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversations.length]); // conversationsが読み込まれた後に実行

  // 初回挨拶を生成（会話がない時に表示）- 雑談っぽく！
  useEffect(() => {
    // 条件: プロフィール読み込み済み、会話なし、初回挨拶まだ、会話IDなし
    if (profileLoading || hasShownInitialGreeting || currentConversationId) return;
    if (messages.length > 0) return;

    const generateCasualGreeting = () => {
      const hour = new Date().getHours();
      const nickname = userProfile?.nickname;
      const name = nickname ? `${nickname}さん` : "";
      const dayOfWeek = new Date().getDay(); // 0=日曜, 6=土曜

      // 早朝 (5-7時)
      if (hour >= 5 && hour < 7) {
        const patterns = [
          `おはようございます${name ? `、${name}` : ""}！早起きですね〜。`,
          `${name ? `${name}、` : ""}おはようございます！朝早いですね、えらい！`,
          `おはよう...ございます...。${name ? `${name}も` : ""}早起きなんですね。`,
          `ふあぁ...おはようございます${name ? `、${name}` : ""}。朝は眠いですよね...。`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // 朝 (7-10時)
      if (hour >= 7 && hour < 10) {
        const patterns = [
          `おはようございます${name ? `、${name}` : ""}！朝ごはん食べましたか？`,
          `${name ? `${name}、` : ""}おはようございます！よく眠れましたか？`,
          `おはようございます！${name ? `${name}、` : ""}今日もいい天気...かな？`,
          `おはよう...ございます！${name ? `${name}は` : ""}朝型ですか？`,
          `おはようございます${name ? `、${name}` : ""}！今日も一日、頑張りましょうね。`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // 午前中 (10-12時)
      if (hour >= 10 && hour < 12) {
        const patterns = [
          `${name ? `${name}、` : ""}こんにちは！午前中、調子どうですか？`,
          `こんにちは${name ? `、${name}` : ""}！もうすぐお昼ですね〜。`,
          `${name ? `${name}、` : ""}おはよう...じゃなくて、こんにちはですね！`,
          `こんにちは！${name ? `${name}、` : ""}お腹空いてきませんか？`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // お昼 (12-14時)
      if (hour >= 12 && hour < 14) {
        const patterns = [
          `こんにちは${name ? `、${name}` : ""}！お昼ごはん食べましたか？`,
          `${name ? `${name}、` : ""}こんにちは！お昼休み中ですか？`,
          `こんにちは！${name ? `${name}は` : ""}お昼何食べました？...気になります！`,
          `お昼ですね〜。${name ? `${name}、` : ""}ちゃんとご飯食べてくださいね！`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // 午後 (14-17時)
      if (hour >= 14 && hour < 17) {
        const patterns = [
          `こんにちは${name ? `、${name}` : ""}！午後も頑張ってますか？`,
          `${name ? `${name}、` : ""}こんにちは！眠くなる時間ですよね...。`,
          `こんにちは！${name ? `${name}、` : ""}おやつ食べました？`,
          `${name ? `${name}、` : ""}お疲れ様です！午後はどうですか？`,
          dayOfWeek === 5 ? `${name ? `${name}、` : ""}金曜日ですね！もうひと踏ん張り！` : `こんにちは${name ? `、${name}` : ""}！`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // 夕方 (17-19時)
      if (hour >= 17 && hour < 19) {
        const patterns = [
          `${name ? `${name}、` : ""}お疲れ様です！今日はどんな一日でしたか？`,
          `こんばんは${name ? `、${name}` : ""}！晩ごはん何にします？`,
          `${name ? `${name}、` : ""}お疲れ様です！もう夕方ですね〜。`,
          `お疲れ様です！${name ? `${name}、` : ""}今日も頑張りましたね。`,
          dayOfWeek === 5 ? `${name ? `${name}、` : ""}やっと金曜の夜ですね！お疲れ様でした！` : `${name ? `${name}、` : ""}お疲れ様です！`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // 夜 (19-22時)
      if (hour >= 19 && hour < 22) {
        const patterns = [
          `こんばんは${name ? `、${name}` : ""}！晩ごはん食べましたか？`,
          `${name ? `${name}、` : ""}こんばんは！今日も一日お疲れ様でした。`,
          `こんばんは！${name ? `${name}、` : ""}夜はゆっくりできてますか？`,
          `${name ? `${name}、` : ""}こんばんは！今日あったこと、聞かせてください！`,
          `こんばんは${name ? `、${name}` : ""}！夜ご飯、美味しかったですか？`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // 深夜 (22-24時)
      if (hour >= 22 && hour < 24) {
        const patterns = [
          `${name ? `${name}、` : ""}まだ起きてるんですね！夜更かしですか？`,
          `こんばんは${name ? `、${name}` : ""}...って、もうこんな時間！`,
          `${name ? `${name}、` : ""}お疲れ様です。そろそろ休む時間ですよ〜。`,
          `夜遅いですね...${name ? `${name}、` : ""}無理しないでくださいね。`,
          `${name ? `${name}、` : ""}こんな時間まで...お疲れ様です！`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
      }

      // 深夜〜早朝 (0-5時)
      const patterns = [
        `えっ...${name ? `${name}、` : ""}こんな時間に！？大丈夫ですか？`,
        `${name ? `${name}...` : ""}夜更かしさんですね...。体調気をつけてくださいね。`,
        `わ、びっくり！${name ? `${name}、` : ""}まだ起きてたんですか？`,
        `${name ? `${name}、` : ""}眠れないんですか...？`,
        `深夜ですね...${name ? `${name}も` : ""}夜型なんですか？`,
      ];
      return patterns[Math.floor(Math.random() * patterns.length)];
    };

    const greeting = generateCasualGreeting();
    setCharacterMessage(greeting);
    // 挨拶を会話履歴に追加（AIが文脈を理解できるように）
    setMessages([{ role: "assistant", content: greeting }]);
    setHasShownInitialGreeting(true);
  }, [profileLoading, userProfile, messages.length, hasShownInitialGreeting, currentConversationId]);

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

  // 会話一覧を読み込み（ミニ秘書の会話も含めて全て取得）
  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      try {
        // フィルタなしで全会話を取得（ミニ秘書の会話も表示）
        const convs = await getConversations(user.uid, 'all');
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

  // タイピング中に吹き出しを自動スクロール
  useEffect(() => {
    if (isTyping && bubbleScrollRef.current) {
      bubbleScrollRef.current.scrollTop = bubbleScrollRef.current.scrollHeight;
    }
  }, [typedMessage, isTyping]);

  // === 会話管理ハンドラー ===

  // 時間帯に応じた挨拶を取得
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "おはようございます";
    if (hour >= 12 && hour < 18) return "こんにちは";
    return "こんばんは";
  };

  // 新規会話を作成
  const handleNewConversation = async () => {
    if (!user) return;

    try {
      const newConvId = await createConversation(user.uid, '新しい会話', 'main');
      setCurrentConversationId(newConvId);
      setMessages([]);

      // 新規会話の挨拶（雑談っぽく）
      const nickname = userProfile?.nickname;
      const name = nickname ? `${nickname}さん` : "";
      const patterns = [
        `${name ? `${name}、` : ""}また会えましたね！最近どうですか？`,
        `新しい会話ですね！${name ? `${name}、` : ""}調子どうですか？`,
        `${name ? `${name}！` : ""}また話せて嬉しいです。何かありました？`,
        `${name ? `${name}、` : ""}どうも〜！元気ですか？`,
      ];
      const greeting = patterns[Math.floor(Math.random() * patterns.length)];
      setCharacterMessage(greeting);
      // 挨拶を会話履歴に追加（AIが文脈を理解できるように）
      setMessages([{ role: "assistant", content: greeting }]);

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
        // 会話がない場合の挨拶（雑談っぽく）
        const nickname = userProfile?.nickname;
        const name = nickname ? `${nickname}さん` : "";
        const patterns = [
          `${name ? `${name}、` : ""}この会話の続きですね！`,
          `あ、${name ? `${name}！` : ""}前の話の続きですか？`,
          `${name ? `${name}、` : ""}何か思い出しました？`,
        ];
        const greeting = patterns[Math.floor(Math.random() * patterns.length)];
        setCharacterMessage(greeting);
        // 挨拶を会話履歴に追加（AIが文脈を理解できるように）
        setMessages([{ role: "assistant", content: greeting }]);
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
          // goalContextも復元
          setGoalContext(selectedConv.hearingSummary.goal || "");
        } else {
          setHearingSummary({ goal: "", why: "", current: "", target: "", timeline: "" });
          setGoalContext("");
        }
      } else {
        setTaskBreakdownStage("normal");
        setHearingProgress({ why: false, current: false, target: false, timeline: false });
        setHearingSummary({ goal: "", why: "", current: "", target: "", timeline: "" });
        setGoalContext("");
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
        // 削除後の挨拶（雑談っぽく）
        const nickname = userProfile?.nickname;
        const name = nickname ? `${nickname}さん` : "";
        const patterns = [
          `${name ? `${name}、` : ""}スッキリしましたね！`,
          `整理整頓、大事ですよね。${name ? `${name}、` : ""}どうします？`,
          `${name ? `${name}、` : ""}片付け完了です！`,
        ];
        const greeting = patterns[Math.floor(Math.random() * patterns.length)];
        setCharacterMessage(greeting);
        // 挨拶を会話履歴に追加（AIが文脈を理解できるように）
        setMessages([{ role: "assistant", content: greeting }]);
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

  // 仮タイトルを設定（最初のメッセージを短く）
  const setTempTitle = async (firstMessage: string, conversationId: string) => {
    try {
      const title = firstMessage.length > 15
        ? firstMessage.substring(0, 15) + "..."
        : firstMessage;

      await updateConversationTitle(conversationId, title, false);

      // 会話一覧を再読み込み
      if (user) {
        const convs = await getConversations(user.uid);
        setConversations(convs);
      }
    } catch (error) {
      console.error("Failed to set temp title:", error);
    }
  };

  // AI要約でタイトル生成（2往復分を要約）
  const generateSummaryTitle = async (msgs: Message[], conversationId: string) => {
    try {
      const conversationText = msgs
        .map(m => `${m.role === "user" ? "ユーザー" : "秘書ちゃん"}: ${m.content}`)
        .join("\n");

      const summaryResponse = await chatWithAISeamless([
        {
          role: "user",
          content: `以下の会話の内容を10文字以内で要約してタイトルにしてください。
要約のみを出力し、「」や説明は不要です。

会話:
${conversationText}`,
        },
      ]);

      if (summaryResponse.success && summaryResponse.content) {
        // 余計な記号を除去して15文字に制限
        let title = summaryResponse.content
          .replace(/[「」『』【】]/g, "")
          .trim();
        if (title.length > 15) {
          title = title.substring(0, 15) + "...";
        }
        await updateConversationTitle(conversationId, title, false);
        if (user) {
          const convs = await getConversations(user.uid);
          setConversations(convs);
        }
      }
    } catch (error) {
      console.error("Failed to generate summary title:", error);
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

    // 確認モーダルを表示
    setPendingTaskNodes(parsedNodes);
    setConfirmSummary(summary);
    setIsConfirmModalOpen(true);
  };

  // タスクツリー追加を実行
  const handleConfirmAddTasks = async () => {
    if (pendingTaskNodes.length === 0) return;

    // タスクツリーに追加
    const updatedTree = [...taskTree, ...pendingTaskNodes];
    setTaskTree(updatedTree);
    await saveTaskTreeAsync(updatedTree, user?.uid);

    // 成功メッセージ
    const totalItems = pendingTaskNodes.reduce((sum, node) => {
      const countAll = (n: TaskNode): number => {
        if (!n.children) return 1;
        return 1 + n.children.reduce((s, c) => s + countAll(c), 0);
      };
      return sum + countAll(node);
    }, 0);

    setCharacterMessage(`${totalItems}個のタスクをツリーに追加しました！🎉`);
    setExpressionWithAutoReset("wawa");
    setIsConfirmModalOpen(false);

    // タスクページに遷移
    setTimeout(() => {
      window.location.href = `/tasks?highlight=${pendingTaskNodes[0]?.id}`;
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
        convId = await createConversation(user.uid, '新しい会話', 'main');
        setCurrentConversationId(convId);
      } catch (error) {
        console.error("Failed to create conversation:", error);
      }
    }

    // Firestoreにユーザーメッセージを保存
    try {
      if (convId) {
        await addMessageToConversation(convId, 'user', message);
        // 最初のメッセージなら仮タイトルを設定
        if (messages.length === 0) {
          await setTempTitle(message, convId);
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
      // やる気・意欲を感じるキーワードを検出
      const motivationKeywords = [
        // 〜したい系（意欲表現）
        "やりたい", "したい", "なりたい", "行きたい", "始めたい", "作りたい",
        "変わりたい", "挑戦したい", "頑張りたい", "成功したい", "達成したい",
        "勉強したい", "学びたい", "習得したい", "上達したい", "マスターしたい",
        "痩せたい", "稼ぎたい", "貯めたい", "増やしたい",
        "転職したい", "独立したい", "起業したい", "就職したい",
        "合格したい", "受かりたい", "取りたい", "受けたい",
        "克服したい", "治したい", "直したい", "改善したい", "やめたい", "辞めたい",
        "出たい", "入りたい", "続けたい", "できるようになりたい",
        // 〜する系（決意表現）
        "やる", "決めた", "決意", "決心", "本気", "覚悟",
        // 目標・計画系
        "目標", "夢", "将来", "いつか", "そのうち",
        // やる気表現
        "モチベ", "やる気", "頑張る", "頑張ろう", "挑戦", "チャレンジ",
        // その他意欲
        "変えたい", "よくしたい", "うまくなりたい", "強くなりたい",
      ];
      const hasTaskKeyword = motivationKeywords.some(keyword => message.includes(keyword));

      // ナレッジをプロンプト用に変換
      const knowledgeForPrompt: UserKnowledgeForPrompt | null = userKnowledge ? {
        interests: userKnowledge.interests,
        experiences: userKnowledge.experiences,
        personality: userKnowledge.personality,
        challenges: userKnowledge.challenges,
        goals: userKnowledge.goals,
        context: userKnowledge.context,
      } : null;

      if (taskBreakdownStage === "normal" && hasTaskKeyword) {
        setTaskBreakdownStage("hearing");
        setGoalContext(message);
        setHearingSummary(prev => ({ ...prev, goal: message }));

        // 最初は興味を示す
        systemPrompt = getInterestStagePrompt(userProfile);
      } else if (taskBreakdownStage === "normal") {
        // 目標キーワードがない場合は雑談モード
        systemPrompt = getChatModePrompt(userProfile, knowledgeForPrompt);
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
          }, userProfile);
        } else {
          // まだヒアリング中 - 次の質問を促す
          const nextItem = HEARING_ITEMS.find(
            item => !updatedProgress[item.key as keyof HearingProgress]
          ) || null;

          systemPrompt = getHearingPrompt(
            updatedProgress,
            nextItem,
            goalContext,
            userProfile
          );
        }
      }
      // === Stage 3: Proposal → Output ===
      // ユーザーが同意したらタスク出力
      else if (taskBreakdownStage === "proposal") {
        const userAgreed = /うん|お願い|いいね|そうだね|やろう|はい|yes|ok|オッケー|よろしく|分解/.test(message.toLowerCase());

        if (userAgreed) {
          setTaskBreakdownStage("output");
          systemPrompt = getTaskOutputPrompt(hearingSummary, userProfile);
        } else {
          // まだ同意を待つ
          systemPrompt = getHearingCompletePrompt(hearingSummary, userProfile);
        }
      }
      // === Stage 4: Output ===
      // タスク出力モード
      else if (taskBreakdownStage === "output") {
        systemPrompt = getTaskOutputPrompt(hearingSummary, userProfile);
      }

      // Few-shot examples を先頭に追加（AIに敬語ベースの会話を学習させる）
      const fewShotExamples: Message[] = [
        { role: "user", content: "新しいこと始めたい" },
        { role: "assistant", content: "おお、いいですね！どんなことですか？" },
        { role: "user", content: "まだ決まってないけど何か挑戦したくて" },
        { role: "assistant", content: "そうなんですね！何かきっかけがあったんですか？" },
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
          try {
            const summaryResponse = await chatWithAISeamless([
              { role: "user", content: `以下の文章を100文字以内で要約して、敬語で1〜2文にまとめて：\n\n${response.content}` }
            ], provider);
            if (summaryResponse.success && summaryResponse.content) {
              finalContent = summaryResponse.content;
            }
            // 要約失敗時は元のコンテンツをそのまま使う
          } catch (summaryError) {
            console.error("Summary request failed, using original content:", summaryError);
            // 元のコンテンツをそのまま使用
          }
        }

        const assistantMessage: Message = { role: "assistant", content: finalContent };
        const allMessages = [...newMessages, assistantMessage];
        setMessages(allMessages);
        setCharacterMessage(finalContent);

        // Firestoreにアシスタントメッセージを保存
        try {
          if (convId) {
            await addMessageToConversation(convId, 'assistant', finalContent);

            // 2往復目（4メッセージ）が揃ったらAI要約でタイトル生成
            if (allMessages.length === 4) {
              generateSummaryTitle(allMessages, convId);
            }
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

        // ナレッジ抽出（バックグラウンド処理）
        // 雑談モード（normal）で十分な会話がある場合のみ
        if (taskBreakdownStage === "normal" && shouldExtractKnowledge(allMessages.length, lastExtractionCount)) {
          // 非同期で実行（UIをブロックしない）
          extractKnowledgeFromConversation(allMessages).then(async (extracted) => {
            if (extracted && user) {
              try {
                await updateUserKnowledge(user.uid, extracted);
                // ローカル状態も更新
                const updatedKnowledge = await getUserKnowledge(user.uid);
                setUserKnowledge(updatedKnowledge);
                setLastExtractionCount(allMessages.length);
                console.log("Knowledge extracted and saved:", extracted);
              } catch (err) {
                console.error("Failed to save knowledge:", err);
              }
            }
          }).catch(err => {
            console.error("Knowledge extraction failed:", err);
          });
        }
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

        const isTimeoutError =
          errorMsg.includes("timeout") ||
          errorMsg.includes("タイムアウト") ||
          errorMsg.includes("abort");

        let errorMessage = "ごめんね、エラーが起きちゃった...";
        if (isRateLimitError) {
          errorMessage = "現在βテスト版のため、しばらく時間を空けてから操作してください。";
        } else if (isTimeoutError) {
          errorMessage = "応答に時間がかかりすぎちゃった...もう一度試してみてね。";
        } else if (response.error) {
          // 具体的なエラー内容を表示
          errorMessage = `エラーが発生しました: ${response.error}`;
        }

        // チャットにエラーメッセージを追加
        const errorChatMessage: Message = {
          role: "assistant",
          content: errorMessage
        };
        setMessages(prev => [...prev, errorChatMessage]);
        setCharacterMessage(errorMessage);
        setCharacterExpression("normal");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorStr = error instanceof Error ? error.message.toLowerCase() : "";
      const errorDetail = error instanceof Error ? error.message : "Unknown error";

      const isRateLimitError =
        errorStr.includes("429") ||
        errorStr.includes("rate") ||
        errorStr.includes("quota") ||
        errorStr.includes("limit") ||
        errorStr.includes("exceeded") ||
        errorStr.includes("resource");

      const isTimeoutError =
        errorStr.includes("timeout") ||
        errorStr.includes("abort") ||
        (error instanceof Error && error.name === "AbortError");

      let errorMessage = "ごめんね、エラーが起きちゃった...";
      if (isRateLimitError) {
        errorMessage = "現在βテスト版のため、しばらく時間を空けてから操作してください。";
      } else if (isTimeoutError) {
        errorMessage = "応答に時間がかかりすぎちゃった...もう一度試してみてね。";
      } else {
        errorMessage = `エラーが発生しました: ${errorDetail}`;
      }

      // チャットにエラーメッセージを追加
      const errorChatMessage: Message = {
        role: "assistant",
        content: errorMessage
      };
      setMessages(prev => [...prev, errorChatMessage]);
      setCharacterMessage(errorMessage);
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
    <Box bg="#f8fafc" h="100vh" overflow="hidden" display="flex" flexDirection="column">
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
        px={{ base: 4, md: 8 }}
        py={{ base: 3, md: 4 }}
        boxShadow="sm"
        borderBottom="1px solid"
        borderColor="gray.200"
        position="relative"
        zIndex={50}
      >
        <HStack justify="space-between" align="center">
          <HStack
            cursor="pointer"
            onClick={() => setIsSidebarOpen(true)}
            _hover={{ opacity: 0.7 }}
          >
            <Box color="gray.700" fontSize={{ base: "20px", md: "28px" }}>
              <FiMenu />
            </Box>
            <Text fontWeight="bold" fontSize={{ base: "lg", md: "2xl" }} color="gray.800">
              TimeTurn
            </Text>
          </HStack>
          <Button
            size={{ base: "xs", md: "md" }}
            colorScheme="gray"
            variant="ghost"
            color="gray.700"
            onClick={() => setShowSettings(true)}
          >
            <HStack gap={1}>
              <Box fontSize={{ base: "14px", md: "20px" }}><FiSettings /></Box>
              <Text fontSize={{ base: "sm", md: "md" }}>設定</Text>
            </HStack>
          </Button>
        </HStack>
      </Box>

      {/* メインコンテンツ - モバイル版 */}
      <VStack
        gap={0}
        pt={2}
        pb="64px"
        display={{ base: "flex", md: "none" }}
        flex={1}
        overflow="hidden"
      >
        {/* ヒアリング進捗インジケーター */}
        {taskBreakdownStage === "hearing" && (
          <Box w="90%" maxW="340px" mb={4}>
            <Box
              bg="teal.500"
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
                  bg={hearingProgress[item.key as keyof HearingProgress] ? "teal.600" : "gray.200"}
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
            bg="teal.500"
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
            bg="teal.500"
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

        {/* キャラクター + 吹き出し（一体化） - モバイル版 */}
        <Box
          position="relative"
          w="100%"
          display="flex"
          flexDirection="column"
          alignItems="center"
          flex={1}
          minH={0}
          justifyContent="center"
          mt="-15px"
        >
          {/* キャラクター */}
          <Box position="relative" ml={4}>
            <CharacterAvatar
              expression={characterExpression}
              width="330px"
              height="495px"
              variant="bare"
            />

            {/* 吹き出し（キャラクターに対して相対配置） */}
            <Box
              bg="white"
              px={6}
              py={4}
              borderRadius="16px"
              boxShadow={isBubbleExpanded ? "0 8px 24px rgba(0,0,0,0.15)" : "0 4px 12px rgba(0,0,0,0.08)"}
              border="1px solid"
              borderColor="gray.200"
              position={isBubbleExpanded ? "fixed" : "absolute"}
              bottom={isBubbleExpanded ? "auto" : "-20px"}
              top={isBubbleExpanded ? "50%" : "auto"}
              left={isBubbleExpanded ? "50%" : "50%"}
              transform={isBubbleExpanded ? "translate(-50%, -50%)" : "translateX(-50%)"}
              maxW={isBubbleExpanded ? "90vw" : "320px"}
              w={isBubbleExpanded ? "90vw" : "90vw"}
              zIndex={isBubbleExpanded ? 100 : 10}
              cursor="pointer"
              onClick={() => !isTyping && setIsBubbleExpanded(!isBubbleExpanded)}
              transition="all 0.2s ease"
            >
              {!isBubbleExpanded && (
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
              )}

              <Box ref={bubbleScrollRef} maxH={isBubbleExpanded ? "60vh" : "80px"} overflowY="auto">
                <Text fontSize="md" fontWeight="bold" color="gray.900" lineHeight="1.6" whiteSpace="pre-wrap">
                  {isLoading ? "考えています..." : typedMessage}
                  {!isLoading && isTyping && (
                    <Box as="span" animation="blink 1s infinite" ml={0.5}>▌</Box>
                  )}
                </Text>
              </Box>

              {isBubbleExpanded && (
                <Text fontSize="xs" color="gray.400" textAlign="center" mt={2}>
                  タップで閉じる
                </Text>
              )}
            </Box>
          </Box>

          {isBubbleExpanded && (
            <Box
              position="fixed"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="blackAlpha.500"
              zIndex={99}
              onClick={() => setIsBubbleExpanded(false)}
            />
          )}
        </Box>

        {/* 下部固定エリア（会話履歴ボタン + 入力欄） - モバイル版 */}
        <Box w="90%" maxW="340px" flexShrink={0} pb={2}>
          {/* 会話履歴ボタン */}
          {messages.length > 0 && (
            <Button
              size="xs"
              variant="ghost"
              colorScheme="gray"
              onClick={() => setIsHistoryModalOpen(true)}
              mb={2}
              w="100%"
            >
              📝 会話履歴を見る ({messages.length / 2}往復)
            </Button>
          )}
          {/* 入力欄と送信ボタンを横並びに */}
          <HStack gap={2} w="100%">
            <Input
              placeholder={
                taskBreakdownStage === "output"
                  ? "タスクについて..."
                  : taskBreakdownStage === "proposal"
                  ? "「お願い」など..."
                  : taskBreakdownStage === "hearing"
                  ? "答えてください..."
                  : "「〜したい」と話す..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && message.trim() && !isLoading) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              bg="white"
              borderRadius="md"
              disabled={isLoading}
              color="gray.900"
              fontWeight="medium"
              fontSize="sm"
              size="sm"
              px={3}
              flex={1}
              _placeholder={{ color: "gray.400" }}
            />
            <IconButton
              aria-label="送信"
              colorScheme="teal"
              size="sm"
              onClick={handleSendMessage}
              loading={isLoading}
              disabled={!message.trim() || isLoading}
              flexShrink={0}
              borderRadius="full"
            >
              <FiSend />
            </IconButton>
          </HStack>

          {/* タスク反映ボタン（output段階で会話がある時） */}
          {taskBreakdownStage === "output" && messages.length >= 4 && (
            <Button
              colorScheme="blue"
              w="100%"
              mt={1}
              size="sm"
              onClick={() => {
                handleReflectToTaskTree();
              }}
            >
              📋 タスクツリーに反映
            </Button>
          )}
        </Box>
      </VStack>

      {/* メインコンテンツ - PC版（キャラクター背面レイアウト） */}
      <Box
        display={{ base: "none", md: "flex" }}
        position="relative"
        flex={1}
        overflow="hidden"
        pb="64px"
      >
        {/* キャラクター + 吹き出し + 入力欄（横並び） */}
        <Box
          position="relative"
          zIndex={10}
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          flex={1}
          px={8}
          gap={4}
          overflow="hidden"
        >
          {/* キャラクター（吹き出しの左側） */}
          <Box
            flexShrink={0}
            alignSelf="center"
            ml="-100px"
          >
            <CharacterAvatar
              expression={characterExpression}
              width="550px"
              height="825px"
              variant="bare"
            />
          </Box>
          {/* 吹き出し + 入力欄 */}
          <VStack gap={6} maxW="600px" w="100%">
          {/* ヒアリング進捗インジケーター - PC版 */}
          {taskBreakdownStage === "hearing" && (
            <Box w="100%">
              <Box
                bg="teal.500"
                px={6}
                py={3}
                borderRadius="lg"
                boxShadow="md"
                mb={3}
              >
                <Text color="white" fontWeight="bold" fontSize="lg" textAlign="center">
                  💭 ヒアリング中... {hearingPercentage}%
                </Text>
              </Box>
              <HStack gap={2} justify="center">
                {HEARING_ITEMS.map((item) => (
                  <Box
                    key={item.key}
                    px={3}
                    py={2}
                    borderRadius="md"
                    bg={hearingProgress[item.key as keyof HearingProgress] ? "teal.600" : "gray.200"}
                    color={hearingProgress[item.key as keyof HearingProgress] ? "white" : "gray.500"}
                    fontSize="sm"
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
              bg="teal.500"
              px={6}
              py={3}
              borderRadius="full"
              boxShadow="md"
              maxW="fit-content"
            >
              <Text color="white" fontWeight="bold" fontSize="lg">
                ✅ ヒアリング完了！タスク分解の確認中
              </Text>
            </Box>
          )}
          {taskBreakdownStage === "output" && (
            <Box
              bg="teal.500"
              px={6}
              py={3}
              borderRadius="full"
              boxShadow="md"
              maxW="fit-content"
            >
              <Text color="white" fontWeight="bold" fontSize="lg">
                ✨ タスクツリーを生成中...
              </Text>
            </Box>
          )}

          {/* 吹き出し - PC版 */}
          <Box
            bg="white"
            px={8}
            py={6}
            borderRadius="20px"
            boxShadow={isBubbleExpanded ? "0 8px 24px rgba(0,0,0,0.15)" : "0 4px 20px rgba(0,0,0,0.12)"}
            border="1px solid"
            borderColor="gray.200"
            position={isBubbleExpanded ? "fixed" : "relative"}
            top={isBubbleExpanded ? "50%" : "auto"}
            left={isBubbleExpanded ? "50%" : "auto"}
            transform={isBubbleExpanded ? "translate(-50%, -50%)" : "none"}
            maxW={isBubbleExpanded ? "700px" : "600px"}
            w="100%"
            zIndex={isBubbleExpanded ? 100 : 10}
            cursor="pointer"
            onClick={() => !isTyping && setIsBubbleExpanded(!isBubbleExpanded)}
            transition="all 0.2s ease"
          >
            <Box ref={bubbleScrollRef} maxH={isBubbleExpanded ? "60vh" : "200px"} overflowY="auto">
              <Text fontSize="xl" fontWeight="bold" color="gray.900" lineHeight="1.8" whiteSpace="pre-wrap">
                {isLoading ? "考えています..." : typedMessage}
                {!isLoading && isTyping && (
                  <Box as="span" animation="blink 1s infinite" ml={0.5}>▌</Box>
                )}
              </Text>
            </Box>

            {isBubbleExpanded && (
              <Text fontSize="sm" color="gray.400" textAlign="center" mt={3}>
                クリックで閉じる
              </Text>
            )}
          </Box>

          {/* 展開時のオーバーレイ - PC版 */}
          {isBubbleExpanded && (
            <Box
              position="fixed"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="blackAlpha.500"
              zIndex={99}
              onClick={() => setIsBubbleExpanded(false)}
            />
          )}

          {/* 会話履歴ボタン - PC版 */}
          {messages.length > 0 && (
            <Button
              size="lg"
              variant="ghost"
              colorScheme="gray"
              onClick={() => setIsHistoryModalOpen(true)}
              maxW="fit-content"
            >
              📝 会話履歴を見る ({messages.length / 2}往復)
            </Button>
          )}

          {/* チャット入力欄 - PC版 */}
          <Box maxW="600px" w="100%">
            <VStack gap={4}>
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
                onKeyDown={(e) => {
                  // Enterキーで送信（IME変換中は除く）
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && message.trim() && !isLoading) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                bg="white"
                borderRadius="lg"
                disabled={isLoading}
                color="gray.900"
                fontWeight="medium"
                fontSize="lg"
                size="lg"
                h="60px"
                px={5}
                _placeholder={{ color: "gray.400" }}
              />
              <Button
                colorScheme="teal"
                w="100%"
                size="lg"
                h="56px"
                fontSize="lg"
                onClick={handleSendMessage}
                loading={isLoading}
                disabled={!message.trim() || isLoading}
              >
                {isLoading ? "送信中..." : "送信"}
              </Button>

              {/* タスク反映ボタン - PC版 */}
              {taskBreakdownStage === "output" && messages.length >= 4 && (
                <Button
                  colorScheme="blue"
                  w="100%"
                  size="lg"
                  h="56px"
                  fontSize="lg"
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
        </Box>
      </Box>

      {/* ボトムナビ */}
      <NavTabs />

      {/* 会話履歴モーダル - ゲームUI風 */}
      <Dialog.Root open={isHistoryModalOpen} onOpenChange={(e) => setIsHistoryModalOpen(e.open)}>
        <Dialog.Backdrop bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content
            maxW="600px"
            maxH="80vh"
            mx={4}
            bgGradient="linear(to-b, #1a1a2e, #16213e, #0f3460)"
            border="2px solid"
            borderColor="cyan.400"
            borderRadius="xl"
            boxShadow="0 0 40px rgba(99, 179, 237, 0.3)"
            overflow="hidden"
          >
            {/* ヘッダー装飾ライン */}
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              h="2px"
              bgGradient="linear(to-r, transparent, cyan.400, purple.400, transparent)"
            />
            <Dialog.Header
              bgGradient="linear(to-r, rgba(99, 179, 237, 0.2), rgba(159, 122, 234, 0.2))"
              borderBottom="1px solid"
              borderColor="whiteAlpha.200"
            >
              <Dialog.Title
                color="white"
                textShadow="0 0 10px rgba(99, 179, 237, 0.5)"
                fontWeight="bold"
              >
                会話履歴
              </Dialog.Title>
              <Dialog.CloseTrigger color="whiteAlpha.800" _hover={{ color: "white" }} />
            </Dialog.Header>
            <Dialog.Body
              overflowY="auto"
              css={{
                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.1)", borderRadius: "3px" },
                "&::-webkit-scrollbar-thumb": { background: "linear-gradient(to-b, #667eea, #764ba2)", borderRadius: "3px" },
              }}
            >
              <VStack align="stretch" gap={3}>
                {messages.length === 0 ? (
                  <Text color="whiteAlpha.600" textAlign="center" py={8}>
                    まだ会話がありません
                  </Text>
                ) : (
                  messages.map((msg, index) => (
                    <Box key={index}>
                      {msg.role === "assistant" ? (
                        <Box
                          bg="whiteAlpha.100"
                          borderRadius="xl"
                          p={3}
                          border="1px solid"
                          borderColor="whiteAlpha.200"
                          position="relative"
                          _before={{
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            w: "3px",
                            bgGradient: "linear(to-b, cyan.400, purple.400)",
                            borderRadius: "full",
                          }}
                        >
                          <HStack mb={2}>
                            <Badge
                              bg="linear-gradient(135deg, #f093fb, #f5576c)"
                              color="white"
                              borderRadius="full"
                              px={2}
                              fontSize="xs"
                            >
                              秘書ちゃん
                            </Badge>
                            <Text fontSize="xs" color="whiteAlpha.500">
                              {index === 0 ? "最初" : `${Math.floor(index / 2) + 1}回目の返信`}
                            </Text>
                          </HStack>
                          <Text fontSize="sm" whiteSpace="pre-wrap" color="whiteAlpha.900">
                            {msg.content}
                          </Text>
                        </Box>
                      ) : (
                        <Box
                          bg="linear-gradient(135deg, rgba(99, 179, 237, 0.3), rgba(129, 230, 217, 0.3))"
                          borderRadius="xl"
                          p={3}
                          ml="auto"
                          maxW="85%"
                          border="1px solid"
                          borderColor="cyan.400"
                          boxShadow="0 0 15px rgba(99, 179, 237, 0.2)"
                        >
                          <HStack mb={2} justify="flex-end">
                            <Text fontSize="xs" color="whiteAlpha.500">
                              {Math.floor((index + 1) / 2) + 1}回目の質問
                            </Text>
                            <Badge
                              bg="linear-gradient(135deg, rgba(99, 179, 237, 0.8), rgba(129, 230, 217, 0.8))"
                              color="white"
                              borderRadius="full"
                              px={2}
                              fontSize="xs"
                            >
                              あなた
                            </Badge>
                          </HStack>
                          <Text fontSize="sm" whiteSpace="pre-wrap" color="white" textShadow="0 0 10px rgba(255,255,255,0.2)">
                            {msg.content}
                          </Text>
                        </Box>
                      )}
                    </Box>
                  ))
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer
              bgGradient="linear(to-r, rgba(99, 179, 237, 0.1), rgba(159, 122, 234, 0.1))"
              borderTop="1px solid"
              borderColor="whiteAlpha.200"
            >
              <Button
                bg="linear-gradient(135deg, rgba(99, 179, 237, 0.3), rgba(129, 230, 217, 0.3))"
                color="cyan.100"
                border="1px solid"
                borderColor="cyan.400"
                _hover={{
                  bg: "linear-gradient(135deg, rgba(99, 179, 237, 0.5), rgba(129, 230, 217, 0.5))",
                  boxShadow: "0 0 15px rgba(99, 179, 237, 0.4)",
                }}
                onClick={() => setIsHistoryModalOpen(false)}
              >
                閉じる
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* タスクツリー追加確認モーダル */}
      <Dialog.Root open={isConfirmModalOpen} onOpenChange={(e) => setIsConfirmModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW="400px" mx={4}>
            <Dialog.Header>
              <Dialog.Title color="gray.800">タスクツリーに追加</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Text color="gray.700" mb={3}>以下のタスクツリーを追加しますか？</Text>
              <Box bg="gray.50" p={3} borderRadius="md" maxH="200px" overflowY="auto">
                <Text fontSize="sm" whiteSpace="pre-wrap" color="gray.800">
                  {confirmSummary}
                </Text>
              </Box>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2} w="100%">
                <Button
                  flex={1}
                  variant="outline"
                  onClick={() => setIsConfirmModalOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  flex={1}
                  colorScheme="teal"
                  onClick={handleConfirmAddTasks}
                >
                  追加する
                </Button>
              </HStack>
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

      {/* PWAインストールプロンプト */}
      <InstallPrompt />

      {/* 通知許可プロンプト */}
      <NotificationPermission />
    </Box>
  );
}
