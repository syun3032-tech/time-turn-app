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
import { getChatMessages, saveChatMessage, clearChatHistory, getUserProfile, createUserProfile, updateUserProfile } from "@/lib/firebase/firestore";
import { signOut as firebaseSignOut } from "@/lib/firebase/auth";
import { parseTaskTreeFromMessage, hasTaskTreeStructure } from "@/lib/task-tree-parser";
import { ProfileSetupModal } from "@/components/ProfileSetupModal";
import { SettingsModal } from "@/components/SettingsModal";
import type { UserProfile } from "@/lib/firebase/firestore-types";

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

  const handleReflectToTaskTree = async () => {
    if (messages.length === 0) return;

    // 最後のAIメッセージを取得
    const lastAIMessage = messages.filter(m => m.role === "assistant").pop();
    if (!lastAIMessage) {
      alert("タスクの提案が見つかりませんでした。");
      return;
    }

    // 既存Goalのリストを表示
    const existingGoals = taskTree
      .filter(node => node.type === "Goal")
      .map((node, idx) => `${idx + 1}. ${node.title} (ID: ${node.id})`)
      .join("\n");

    let parentId: string | null = null;
    if (existingGoals) {
      const addToExisting = confirm(
        `既存の目標に追加しますか？\n\n${existingGoals}\n\n「OK」= 既存に追加 / 「キャンセル」= 新しいGoalを作成`
      );

      if (addToExisting) {
        const selectedIndex = prompt(`どの目標に追加しますか？番号を入力してください (1-${taskTree.filter(n => n.type === "Goal").length}):`);
        if (selectedIndex) {
          const index = parseInt(selectedIndex) - 1;
          const goals = taskTree.filter(n => n.type === "Goal");
          if (goals[index]) {
            parentId = goals[index].id;
          }
        }
      }
    }

    // 追加するノードのタイトルと種類を取得
    const nodeTitle = prompt("追加するタスクのタイトルを入力してください:");
    if (!nodeTitle) return;

    const nodeType = prompt(
      "種類を選んでください:\n1. Goal\n2. Project\n3. Milestone\n4. Task\n\n番号を入力:"
    );

    const typeMap: { [key: string]: "Goal" | "Project" | "Milestone" | "Task" } = {
      "1": "Goal",
      "2": "Project",
      "3": "Milestone",
      "4": "Task",
    };

    const selectedType = nodeType && typeMap[nodeType] ? typeMap[nodeType] : "Goal";

    // 新しいノードを作成
    const newNode: TaskNode = {
      id: generateNodeId(selectedType.toLowerCase()),
      title: `${selectedType}: ${nodeTitle}`,
      type: selectedType,
      description: `AIヒアリングから作成`,
      children: selectedType === "Task" ? undefined : [],
    };

    // タスクツリーに追加
    const updatedTree = addNodeToTree(taskTree, parentId, newNode);
    setTaskTree(updatedTree);
    await saveTaskTreeAsync(updatedTree, user?.uid);

    // 成功メッセージ
    setCharacterMessage(`「${nodeTitle}」をタスクツリーに追加しました！タスクページに移動します。`);
    setExpressionWithAutoReset("wawa");

    // タスクページに遷移（ハイライト付き）
    setTimeout(() => {
      window.location.href = `/tasks?highlight=${newNode.id}`;
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
  // 1メッセージにつき最大1項目だけ検出（急に100%にならないように）
  const detectAndUpdateHearing = (userMsg: string) => {
    const newProgress = { ...hearingProgress };
    const newSummary = { ...hearingSummary };
    let detected = false;

    // Why（動機）の検出 - AIが「なんで」「きっかけ」を聞いた後の返答
    // より具体的なパターンに限定
    if (!detected && !hearingProgress.why) {
      // 理由を述べるパターン: 〜だから、〜ので、〜のために、〜って思って
      if (/だから|ので|のため|って思|と思って|理由は|きっかけは/.test(userMsg)) {
        newProgress.why = true;
        newSummary.why = userMsg;
        detected = true;
      }
    }

    // 現状の検出 - AIが「今どんな状況」を聞いた後の返答
    if (!detected && !hearingProgress.current) {
      // 現状を述べるパターン: 今は〜、まだ〜、〜したことない、〜やってる
      if (/今は|まだ|したことない|やってない|やってる|始めた|経験/.test(userMsg)) {
        newProgress.current = true;
        newSummary.current = userMsg;
        detected = true;
      }
    }

    // ゴールの検出 - AIが「どこまで目指す」を聞いた後の返答
    if (!detected && !hearingProgress.target) {
      // 目標を述べるパターン: 〜になりたい、〜レベル、〜できるように
      if (/になりたい|レベル|できるように|合格したい|受かりたい|目指し/.test(userMsg)) {
        newProgress.target = true;
        newSummary.target = userMsg;
        detected = true;
      }
    }

    // 期限の検出 - AIが「いつまでに」を聞いた後の返答
    if (!detected && !hearingProgress.timeline) {
      // 期限を述べるパターン: 〜月まで、来年、今年中、〜ヶ月で
      if (/月まで|年まで|来年|今年|ヶ月|週間|日まで|以内/.test(userMsg)) {
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

    const userMessage: Message = { role: "user", content: message };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setMessage("");
    setIsLoading(true);

    // Firestoreにユーザーメッセージを保存
    try {
      await saveChatMessage(user.uid, 'user', message);
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
        { role: "user", content: "阪大行きたい" },
        { role: "assistant", content: "いいね！なんで？きっかけあるの？" },
        { role: "user", content: "周りにイキれるから" },
        { role: "assistant", content: "そうなの！？ なんでイキリたいの？" },
      ];

      // システムプロンプトがある場合は先頭に追加
      if (systemPrompt) {
        contextToSend = [
          { role: "user", content: systemPrompt },
          ...fewShotExamples,
          ...newMessages,
        ];
      } else {
        contextToSend = [
          ...fewShotExamples,
          ...newMessages,
        ];
      }

      // AIシームレスモードで会話
      const response = await chatWithAISeamless(contextToSend, provider);

      if (response.success && response.content) {
        const assistantMessage: Message = { role: "assistant", content: response.content };
        setMessages([...newMessages, assistantMessage]);
        setCharacterMessage(response.content);

        // Firestoreにアシスタントメッセージを保存
        try {
          await saveChatMessage(user.uid, 'assistant', response.content);
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }

        // 返答内容に応じて表情を変更（5秒後にnormalに戻る）
        const expression = getExpressionForMessage(response.content);
        setExpressionWithAutoReset(expression);
      } else {
        setCharacterMessage(`エラーが発生しました: ${response.error || "Unknown error"}`);
        setCharacterExpression("normal");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setCharacterMessage("ごめんね、エラーが起きちゃった...");
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
          <Text fontWeight="bold" fontSize="lg" color="gray.800">
            TimeTurn
          </Text>
          <Button
            size="xs"
            colorScheme="red"
            variant="ghost"
            onClick={handleLogout}
          >
            ログアウト
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleSendMessage();
                }
              }}
              bg="white"
              borderRadius="md"
              disabled={isLoading}
              color="gray.900"
              fontWeight="medium"
              fontSize="md"
              _placeholder={{ color: "gray.400" }}
            />
            <HStack w="100%" gap={2}>
              <Button
                colorScheme="teal"
                flex={1}
                onClick={handleSendMessage}
                loading={isLoading}
                disabled={!message.trim() || isLoading}
              >
                {isLoading ? "送信中..." : "送信"}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const defaultMessage = "今日はどのタスクから行く？";
                  setCharacterMessage(defaultMessage);
                  setCharacterExpression("normal");
                  setMessages([]);
                  setTaskBreakdownStage("normal");
                  setGoalContext("");
                  setMessage("");
                  // ヒアリング進捗もリセット
                  setHearingProgress({
                    why: false,
                    current: false,
                    target: false,
                    timeline: false,
                  });
                  setHearingSummary({
                    goal: "",
                    why: "",
                    current: "",
                    target: "",
                    timeline: "",
                  });
                  // 会話履歴をクリア（Firestore）
                  if (user) {
                    try {
                      await clearChatHistory(user.uid);
                      console.log("会話履歴をFirestoreから削除しました");
                    } catch (error) {
                      console.error("Failed to clear chat history:", error);
                    }
                  }
                  // タイマーもクリア
                  if (expressionTimerRef.current) {
                    clearTimeout(expressionTimerRef.current);
                  }
                }}
              >
                リセット
              </Button>
            </HStack>

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
      <NavTabs onSettingsClick={() => setShowSettings(true)} />

      {/* 会話履歴モーダル */}
      <Dialog.Root open={isHistoryModalOpen} onOpenChange={(e) => setIsHistoryModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px" maxH="80vh">
            <Dialog.Header>
              <Dialog.Title>会話履歴</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body overflowY="auto">
              <VStack align="stretch" gap={3}>
                {messages.length === 0 ? (
                  <Text color="gray.500" textAlign="center" py={8}>
                    まだ会話がありません
                  </Text>
                ) : (
                  messages.map((msg, index) => (
                    <Box key={index}>
                      {msg.role === "assistant" ? (
                        <Card.Root bg="gray.50">
                          <Card.Body>
                            <HStack mb={1}>
                              <Badge colorScheme="purple" size="sm">ゆり</Badge>
                              <Text fontSize="xs" color="gray.500">
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
                              <Text fontSize="xs" color="gray.500">
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
      />
    </Box>
  );
}
