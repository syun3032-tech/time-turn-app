"use client";

import { Box, Flex, Heading, Text, VStack, Input, Button, HStack, IconButton, Badge, Card, Progress, Slider, Stack } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { CharacterAvatar, getExpressionForMessage, type Expression } from "@/components/CharacterAvatar";
import { CharacterMessage } from "@/components/CharacterMessage";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiActivity } from "react-icons/fi";
import { Dialog } from "@chakra-ui/react";
import { chatWithAISeamless, AIProvider } from "@/lib/ai-service";
import { getTaskTree, saveTaskTree, serializeTreeForAI, addNodeToTree, generateNodeId } from "@/lib/task-tree-storage";
import { TaskNode } from "@/types/task-tree";
import { getInterestStagePrompt, getProposalStagePrompt, getEnhancedTaskBreakdownPrompt } from "@/lib/prompts";
import { useAuth } from "@/contexts/AuthContext";
import { getChatMessages, saveChatMessage } from "@/lib/firebase/firestore";
import { signOut as firebaseSignOut } from "@/lib/firebase/auth";
import { parseTaskTreeFromMessage, hasTaskTreeStructure } from "@/lib/task-tree-parser";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const sampleTasks = [
  { title: "基礎問題集1-3章", complete: false },
  { title: "英単語100個", complete: true },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [characterMessage, setCharacterMessage] = useState("今日はどのタスクから行く？");
  const [characterExpression, setCharacterExpression] = useState<Expression>("normal"); // 初期はノーマル
  const [isLoading, setIsLoading] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false); // 会話履歴モーダル
  const [provider] = useState<AIProvider>("gemini");
  const [taskBreakdownStage, setTaskBreakdownStage] = useState<
    "normal" | "interest" | "proposal" | "breakdown"
  >("normal");
  const [taskTree, setTaskTree] = useState<TaskNode[]>([]);
  const [goalContext, setGoalContext] = useState<string>(""); // 会話のサマリー
  const expressionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // タスクツリーを読み込み
  useEffect(() => {
    const tree = getTaskTree();
    setTaskTree(tree);
  }, []);

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

  const handleReflectToTaskTree = () => {
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
    saveTaskTree(updatedTree);

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
      let contextToSend = newMessages;

      // === Stage 1: Normal → Interest ===
      // キーワード検出で interest stage に移行
      const hasTaskKeyword = /やりたい|成したい|達成したい|目標|勉強したい|学びたい|習得したい|始めたい|作りたい|実現したい|タスク|分解|計画|ステップ/.test(message);

      if (taskBreakdownStage === "normal" && hasTaskKeyword) {
        setTaskBreakdownStage("interest");
        systemPrompt = getInterestStagePrompt();
        setGoalContext(message); // 最初の目標を保存
      }
      // === Stage 2: Interest → Proposal ===
      // Interest段階で2往復以上したら提案段階へ
      else if (taskBreakdownStage === "interest") {
        const interestMessages = newMessages.filter(m => m.role === "user" || m.role === "assistant");

        // 2往復（4メッセージ）以上で提案段階へ
        if (interestMessages.length >= 4) {
          setTaskBreakdownStage("proposal");

          // 会話のサマリーを作成
          const userGoals = interestMessages
            .filter(m => m.role === "user")
            .map(m => m.content)
            .join("、");
          setGoalContext(userGoals);

          systemPrompt = getProposalStagePrompt(userGoals);
        } else {
          systemPrompt = getInterestStagePrompt();
        }
      }
      // === Stage 3: Proposal → Breakdown ===
      // ユーザーが同意したら本格的なタスク分解へ
      else if (taskBreakdownStage === "proposal") {
        const userAgreed = /うん|お願い|いいね|そうだね|やろう|はい|yes|ok|オッケー|よろしく/.test(message.toLowerCase());

        if (userAgreed) {
          setTaskBreakdownStage("breakdown");

          // タスクツリー情報を含める
          if (taskTree.length > 0) {
            const treeContext = serializeTreeForAI(taskTree);
            const enhancedPrompt = getEnhancedTaskBreakdownPrompt(
              `${treeContext}\n\n【ユーザーの目標】\n${goalContext}`
            );

            // システムプロンプトとして追加
            contextToSend = [
              { role: "user", content: enhancedPrompt },
              ...newMessages,
            ];
          } else {
            systemPrompt = getEnhancedTaskBreakdownPrompt(goalContext);
          }
        } else {
          // まだ提案段階
          systemPrompt = getProposalStagePrompt(goalContext);
        }
      }
      // === Stage 4: Breakdown ===
      // 本格的なタスク分解中
      else if (taskBreakdownStage === "breakdown") {
        if (taskTree.length > 0) {
          const treeContext = serializeTreeForAI(taskTree);
          systemPrompt = getEnhancedTaskBreakdownPrompt(
            `${treeContext}\n\n【ユーザーの目標】\n${goalContext}`
          );
        } else {
          systemPrompt = getEnhancedTaskBreakdownPrompt(goalContext);
        }
      }

      // Few-shot examples を先頭に追加（AIに短い会話を学習させる）
      const fewShotExamples: Message[] = [
        { role: "user", content: "阪大行きたい" },
        { role: "assistant", content: "いいね！なんで？きっかけあるの？" },
        { role: "user", content: "周りにイキれるから" },
        { role: "assistant", content: "そうなの！？ なんでイキリたいの？今に満足できてない感じ？" },
      ];

      // システムプロンプトがある場合は先頭に追加
      if (systemPrompt && contextToSend[0]?.content !== systemPrompt) {
        contextToSend = [
          { role: "user", content: systemPrompt },
          ...fewShotExamples,
          ...contextToSend,
        ];
      } else {
        // システムプロンプトがない場合もFew-shot examplesは追加
        contextToSend = [
          ...fewShotExamples,
          ...contextToSend,
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
  if (loading || !user) {
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
        <Flex justify="space-between" align="flex-start" gap={3}>
          {/* 左側: 今日のToDo + ログボタン + ログアウトボタン */}
          <HStack flex={1} align="flex-start" gap={2}>
            <IconButton
              aria-label="ログを開く"
              size="sm"
              colorScheme="teal"
              variant="ghost"
              onClick={() => setIsLogModalOpen(true)}
            >
              <FiActivity />
            </IconButton>
            <Button
              size="xs"
              colorScheme="red"
              variant="ghost"
              onClick={handleLogout}
            >
              ログアウト
            </Button>
            <Box>
              <Text fontSize="xs" color="gray.500">
                今日のToDo
              </Text>
              <Text fontWeight="bold" fontSize="md" color="gray.800">
                基礎問題集1-3章
              </Text>
            </Box>
          </HStack>

          {/* 中央: 進行中 */}
          <Box flex={1} textAlign="center">
            <Text fontSize="xs" color="gray.500">
              進行中
            </Text>
            <Text fontWeight="semibold" fontSize="sm" color="blue.600">
              ライティング下書き
            </Text>
          </Box>

          {/* 右側: 次のToDo（通知エリア） */}
          <Box
            flex={1}
            textAlign="right"
            bg="orange.50"
            px={3}
            py={2}
            borderRadius="md"
            border="1px solid"
            borderColor="orange.200"
          >
            <Text fontSize="xs" color="orange.600" fontWeight="semibold">
              🔔 次のToDo
            </Text>
            <Text fontSize="sm" fontWeight="semibold" color="gray.800">
              英単語100個
            </Text>
          </Box>
        </Flex>
      </Box>

      {/* メインコンテンツ */}
      <VStack spacing={0} pt={8}>
        {/* タスク分解段階インジケーター */}
        {taskBreakdownStage === "interest" && (
          <Box
            bg="gradient-to-r from-purple.300 to-pink.300"
            px={4}
            py={2}
            borderRadius="full"
            mb={4}
            boxShadow="md"
          >
            <Text color="white" fontWeight="bold" fontSize="sm">
              💭 目標について話し中...
            </Text>
          </Box>
        )}
        {taskBreakdownStage === "proposal" && (
          <Box
            bg="gradient-to-r from-blue.400 to-teal.400"
            px={4}
            py={2}
            borderRadius="full"
            mb={4}
            boxShadow="md"
          >
            <Text color="white" fontWeight="bold" fontSize="sm">
              💡 タスク分解を提案中...
            </Text>
          </Box>
        )}
        {taskBreakdownStage === "breakdown" && (
          <Box
            bg="gradient-to-r from-teal.400 to-green.400"
            px={4}
            py={2}
            borderRadius="full"
            mb={4}
            boxShadow="md"
          >
            <Text color="white" fontWeight="bold" fontSize="sm">
              ✨ タスク分解モード - ヒアリング中
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

          <VStack align="stretch" spacing={2}>
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
            onClick={() => {
              const parsedNodes = parseTaskTreeFromMessage(characterMessage);
              if (parsedNodes.length > 0) {
                const updatedTree = [...taskTree, ...parsedNodes];
                setTaskTree(updatedTree);
                saveTaskTree(updatedTree);
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
          <VStack spacing={2}>
            <Input
              placeholder={
                taskBreakdownStage === "breakdown"
                  ? "詳しく答えてください..."
                  : taskBreakdownStage === "proposal"
                  ? "「お願い」「やろう」など..."
                  : taskBreakdownStage === "interest"
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
            <HStack w="100%" spacing={2}>
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
                onClick={() => {
                  const defaultMessage = "今日はどのタスクから行く？";
                  setCharacterMessage(defaultMessage);
                  setCharacterExpression("normal");
                  setMessages([]);
                  setTaskBreakdownStage("normal");
                  setGoalContext("");
                  setMessage("");
                  // 会話履歴をクリア
                  localStorage.removeItem("chatHistory");
                  // タイマーもクリア
                  if (expressionTimerRef.current) {
                    clearTimeout(expressionTimerRef.current);
                  }
                }}
              >
                リセット
              </Button>
            </HStack>

            {/* タスク反映ボタン（breakdown段階で会話がある時） */}
            {taskBreakdownStage === "breakdown" && messages.length >= 6 && (
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

      {/* ログモーダル */}
      <Dialog.Root open={isLogModalOpen} onOpenChange={(e) => setIsLogModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px" maxH="90vh" overflowY="auto">
            <Dialog.Header>
              <Dialog.Title>日次ログ</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                {/* 今日のタスク */}
                <Card.Root>
                  <Card.Header>
                    <Heading size="sm">今日のタスク</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Stack gap={3}>
                      {sampleTasks.map((task, idx) => (
                        <HStack key={idx} justify="space-between">
                          <Text>{task.title}</Text>
                          <Button size="sm" colorScheme={task.complete ? "green" : "gray"} variant={task.complete ? "solid" : "outline"}>
                            {task.complete ? "完了" : "完了する"}
                          </Button>
                        </HStack>
                      ))}
                      <Progress.Root value={80} borderRadius="md">
                        <Progress.Track bg="gray.100">
                          <Progress.Range bg="teal.400" />
                        </Progress.Track>
                      </Progress.Root>
                    </Stack>
                  </Card.Body>
                </Card.Root>

                {/* 時間ログ */}
                <Card.Root>
                  <Card.Header>
                    <Heading size="sm">時間ログ</Heading>
                  </Card.Header>
                  <Card.Body>
                    <Stack gap={3}>
                      <HStack>
                        <Text>今日の作業時間</Text>
                        <Input placeholder="例: 120 (分)" maxW="140px" />
                      </HStack>
                      <HStack gap={3}>
                        <Button colorScheme="teal">開始</Button>
                        <Button colorScheme="red" variant="outline">
                          停止
                        </Button>
                        <Button variant="ghost">保存</Button>
                      </HStack>
                    </Stack>
                  </Card.Body>
                </Card.Root>

                {/* 気分スライダー */}
                <Card.Root>
                  <Card.Header>
                    <Heading size="sm">気分スライダー</Heading>
                  </Card.Header>
                  <Card.Body>
                    <VStack align="stretch" gap={3}>
                      <Text>最悪</Text>
                      <Slider.Root defaultValue={[50]} min={0} max={100} step={10}>
                        <Slider.Track>
                          <Slider.Range />
                        </Slider.Track>
                        <Slider.Thumb index={0} />
                      </Slider.Root>
                      <Text textAlign="right">最高</Text>
                    </VStack>
                    <Button mt={4} colorScheme="teal" w="full">
                      記録する
                    </Button>
                  </Card.Body>
                </Card.Root>
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

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
    </Box>
  );
}
