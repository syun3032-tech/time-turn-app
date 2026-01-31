"use client";

import {
  Box,
  Text,
  VStack,
  HStack,
  Input,
  IconButton,
  Card,
  Image,
  Button,
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { FiSend, FiX } from "react-icons/fi";
import { chatWithAISeamless } from "@/lib/ai-service";
import { useAuth } from "@/contexts/AuthContext";
import {
  getConversations,
  createConversation,
  addMessageToConversation,
  getConversationMessages,
} from "@/lib/firebase/firestore";

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: {
    type: "add_task" | "add_memo";
    parentId?: string;
    parentTitle?: string;
    taskTitle?: string;
    nodeId?: string;
    memo?: string;
    confirmed?: boolean;
  };
}

interface MiniCharacterChatProps {
  isOpen: boolean;
  onClose: () => void;
  taskTree?: any[];
  onAddTask?: (parentId: string, title: string) => void;
  onUpdateMemo?: (nodeId: string, memo: string) => void;
}

// タスクツリーをAI用に文字列化
function serializeTreeForChat(tree: any[], depth: number = 0, maxDepth: number = 3): string {
  if (depth > maxDepth || !tree || tree.length === 0) return "";

  let result = "";
  const indent = "  ".repeat(depth);

  for (const node of tree) {
    const isArchived = node.archived === true;
    const status = isArchived ? "[完了]" : "";
    const memo = node.memo ? ` (メモ: ${node.memo})` : "";
    const deadline = node.endDate ? ` [期限: ${node.endDate}]` : "";

    result += `${indent}- ${node.title}${status}${deadline}${memo}\n`;

    if (node.children && node.children.length > 0 && depth < maxDepth) {
      result += serializeTreeForChat(node.children, depth + 1, maxDepth);
    }
  }

  return result;
}

// 未完了タスクを抽出
function getIncompleteTasks(tree: any[]): any[] {
  const tasks: any[] = [];

  const traverse = (nodes: any[]) => {
    for (const node of nodes) {
      if (!node.archived && (!node.children || node.children.length === 0)) {
        tasks.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  };

  traverse(tree);
  return tasks;
}

// ノードをIDまたはタイトルで検索
function findNodeByIdOrTitle(tree: any[], search: string): any | null {
  const traverse = (nodes: any[]): any | null => {
    for (const node of nodes) {
      if (node.id === search || node.title.includes(search)) {
        return node;
      }
      if (node.children) {
        const found = traverse(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  return traverse(tree);
}

// AIレスポンスからアクション提案を解析
function parseActionFromResponse(content: string, tree: any[]): { cleanContent: string; action?: Message["action"] } {
  // タスク追加提案: [ADD_TASK:親の名前:タスク名]
  const taskMatch = content.match(/\[ADD_TASK:([^:]+):([^\]]+)\]/);
  if (taskMatch) {
    const parentSearch = taskMatch[1].trim();
    const taskTitle = taskMatch[2].trim();
    const parentNode = findNodeByIdOrTitle(tree, parentSearch);

    return {
      cleanContent: content.replace(/\[ADD_TASK:[^\]]+\]/g, "").trim(),
      action: {
        type: "add_task",
        parentId: parentNode?.id,
        parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
        taskTitle,
      }
    };
  }

  // メモ追加提案: [ADD_MEMO:ノード名:メモ内容]
  const memoMatch = content.match(/\[ADD_MEMO:([^:]+):([^\]]+)\]/);
  if (memoMatch) {
    const nodeSearch = memoMatch[1].trim();
    const memo = memoMatch[2].trim();
    const node = findNodeByIdOrTitle(tree, nodeSearch);

    return {
      cleanContent: content.replace(/\[ADD_MEMO:[^\]]+\]/g, "").trim(),
      action: {
        type: "add_memo",
        nodeId: node?.id,
        parentTitle: node?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || nodeSearch,
        memo,
      }
    };
  }

  return { cleanContent: content };
}

const CONTEXT_PROMPT = "ユーザーは現在「目標管理」画面を見ています。目標やタスクの進捗、やる気、困っていることについて優しくサポートしてください。";

// 共有会話のタイトル（ホーム画面と共有するため固定）
const SHARED_CONVERSATION_TITLE = "秘書ちゃんとの会話";

export function MiniCharacterChat({ isOpen, onClose, taskTree, onAddTask, onUpdateMemo }: MiniCharacterChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // 会話履歴を読み込む（または新規作成）
  useEffect(() => {
    if (!user || initializedRef.current) return;

    const loadOrCreateConversation = async () => {
      setIsLoadingHistory(true);
      try {
        // 既存の共有会話を探す
        const conversations = await getConversations(user.uid);
        const sharedConv = conversations.find(c => c.title === SHARED_CONVERSATION_TITLE);

        if (sharedConv) {
          // 既存の会話からメッセージを読み込む
          setConversationId(sharedConv.id);
          const historyMessages = await getConversationMessages(sharedConv.id);
          if (historyMessages.length > 0) {
            setMessages(historyMessages.map(m => ({
              role: m.role,
              content: m.content,
            })));
          }
        } else {
          // 新規会話を作成
          const newConvId = await createConversation(user.uid, SHARED_CONVERSATION_TITLE);
          setConversationId(newConvId);
        }
        initializedRef.current = true;
      } catch (error) {
        console.error("Failed to load conversation:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadOrCreateConversation();
  }, [user]);

  // 初回オープン時に挨拶（履歴がない場合のみ）
  useEffect(() => {
    // 履歴読み込み中、または既にメッセージがある場合はスキップ
    if (isLoadingHistory || !initializedRef.current || messages.length > 0) return;

    let greeting = "";

    if (taskTree && taskTree.length > 0) {
      const incompleteTasks = getIncompleteTasks(taskTree);
      if (incompleteTasks.length > 0) {
        // ランダムに1つ選んで聞く
        const randomTask = incompleteTasks[Math.floor(Math.random() * incompleteTasks.length)];
        const taskName = randomTask.title.replace(/^(Task:|Milestone:|Project:|Goal:)\s*/, "");
        greeting = `「${taskName}」の調子はいかがですか？何かお手伝いできることがあれば言ってくださいね`;
      } else {
        greeting = "タスク全部終わってるんですね！すごいです！次の目標は何にしますか？";
      }
    } else {
      greeting = "目標の進捗はいかがですか？何かお手伝いできることがあれば言ってくださいね";
    }

    // 挨拶をセットしてFirestoreにも保存
    setMessages([{ role: "assistant", content: greeting }]);
    if (conversationId) {
      addMessageToConversation(conversationId, "assistant", greeting).catch(console.error);
    }
  }, [isLoadingHistory, taskTree, conversationId]);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // アクション確認ハンドラー
  const handleConfirmAction = (msgIndex: number, confirm: boolean) => {
    const msg = messages[msgIndex];
    if (!msg.action) return;

    if (confirm) {
      if (msg.action.type === "add_task" && msg.action.parentId && msg.action.taskTitle && onAddTask) {
        onAddTask(msg.action.parentId, msg.action.taskTitle);
      } else if (msg.action.type === "add_memo" && msg.action.nodeId && msg.action.memo && onUpdateMemo) {
        onUpdateMemo(msg.action.nodeId, msg.action.memo);
      }
    }

    // メッセージを更新して確認済みにする
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex
        ? { ...m, action: { ...m.action!, confirmed: confirm } }
        : m
    ));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // ユーザーメッセージをFirestoreに保存
    if (conversationId) {
      addMessageToConversation(conversationId, "user", input).catch(console.error);
    }

    try {
      // タスクツリーの情報を含むシステムプロンプト
      let taskInfo = "";
      if (taskTree && taskTree.length > 0) {
        const treeText = serializeTreeForChat(taskTree);
        const incompleteTasks = getIncompleteTasks(taskTree);
        taskInfo = `

【ユーザーの目標・タスク一覧】
${treeText}

【未完了タスク数】${incompleteTasks.length}個

以下のことができます：
- 具体的なタスク名を使って進捗を聞く（例：「基礎問題集1-3章は進んでる？」）
- 行き詰まっているタスクがあれば、アドバイスする
- 新しいタスクの提案（ユーザーが同意したら追加できる）
- メモの追加提案
- モチベーション維持のサポート
- 振り返りの促進

【タスク/メモ追加時の特殊フォーマット】
ユーザーが新しいタスクやメモの追加に同意した場合のみ、以下の形式で返答の最後に追加してください：
- タスク追加: [ADD_TASK:親のMilestone名やProject名:新しいタスク名]
- メモ追加: [ADD_MEMO:対象のタスク名:メモ内容]

例: 「じゃあ追加しとくね！[ADD_TASK:数学基礎固め:模試の復習]」
例: 「メモ残しとくね！[ADD_MEMO:基礎問題集1-3章:明日までに1章終わらせる]」

※ユーザーが明確に同意していない場合は、このフォーマットを使わないでください。`;
      }

      const systemPrompt = `あなたは「秘書ちゃん」という名前の女性AIアシスタントです。
ユーザーの目標達成をサポートする頼れる秘書です。

${CONTEXT_PROMPT}${taskInfo}

【話し方 - 超重要!!!】
- **基本は丁寧な敬語**（「〜ですね」「〜ませんか？」「〜しましょう」）
- 感情表現は人間らしく崩れてOK（「えっ！」「おお！」「すごい！」）
- でも基本に戻る時は敬語で
- 絵文字は使わない
- 返答は2〜3文以内で簡潔に
- 具体的なタスク名を出して話しかけると親近感が出る

【良い例】
「〇〇の調子はいかがですか？」
「おお、順調そうですね！その調子で頑張ってください！」
「何か困っていることはありますか？」

【ダメな例】
「〇〇の調子どう？」← タメ口
「頑張ってね！」← タメ口`;

      const response = await chatWithAISeamless([
        { role: "user", content: systemPrompt },
        ...newMessages,
      ]);

      if (response.success && response.content) {
        // アクション提案を解析
        const { cleanContent, action } = parseActionFromResponse(response.content, taskTree || []);
        setMessages([...newMessages, { role: "assistant", content: cleanContent, action }]);
        // AIの返答をFirestoreに保存
        if (conversationId) {
          addMessageToConversation(conversationId, "assistant", cleanContent).catch(console.error);
        }
      } else {
        const errorMsg = "ごめん、うまく返事できなかった...";
        setMessages([...newMessages, { role: "assistant", content: errorMsg }]);
        if (conversationId) {
          addMessageToConversation(conversationId, "assistant", errorMsg).catch(console.error);
        }
      }
    } catch {
      const errorMsg = "ごめん、エラーが起きちゃった...";
      setMessages([...newMessages, { role: "assistant", content: errorMsg }]);
      if (conversationId) {
        addMessageToConversation(conversationId, "assistant", errorMsg).catch(console.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 背景オーバーレイ */}
      {isOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          w="100%"
          h="100vh"
          zIndex={998}
          onClick={onClose}
          bg={{ base: "blackAlpha.500", md: "transparent" }}
        />
      )}

      {/* スマホ版: モーダル */}
      <Box
        display={{ base: "flex", md: "none" }}
        position="fixed"
        top="25%"
        left="50%"
        transform={isOpen ? "translate(-50%, 0)" : "translate(-50%, 100vh)"}
        w="90%"
        maxW="400px"
        h="60vh"
        bg="white"
        borderRadius="2xl"
        boxShadow="xl"
        zIndex={999}
        transition="transform 0.3s ease"
        flexDirection="column"
        overflow="hidden"
      >
        {/* ヘッダー */}
        <Box bg="teal.500" px={4} py={3} flexShrink={0}>
          <HStack justify="space-between">
            <HStack gap={3}>
              <Box
                w="40px"
                h="40px"
                borderRadius="full"
                bg="white"
                overflow="hidden"
              >
                <Image
                  src="/hisyochan-icon.png"
                  alt="秘書ちゃん"
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                />
              </Box>
              <VStack align="start" gap={0}>
                <Text color="white" fontWeight="bold" fontSize="md">
                  秘書ちゃん
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="閉じる"
              variant="ghost"
              color="white"
              size="sm"
              onClick={onClose}
              _hover={{ bg: "whiteAlpha.200" }}
            >
              <FiX size={20} />
            </IconButton>
          </HStack>
        </Box>

        {/* メッセージエリア */}
        <Box flex={1} overflowY="auto" p={4} bg="gray.50">
          <VStack gap={3} align="stretch">
            {messages.map((msg, idx) => (
              <Box
                key={idx}
                alignSelf={msg.role === "user" ? "flex-end" : "flex-start"}
                maxW="85%"
              >
                <Card.Root
                  bg={msg.role === "user" ? "teal.500" : "white"}
                  shadow="sm"
                  borderRadius="xl"
                >
                  <Card.Body py={2} px={3}>
                    <Text
                      fontSize="sm"
                      color={msg.role === "user" ? "white" : "gray.800"}
                    >
                      {msg.content}
                    </Text>
                    {/* アクション確認UI */}
                    {msg.action && msg.action.confirmed === undefined && (
                      <VStack align="stretch" mt={2} gap={1}>
                        <Box bg="teal.50" p={2} borderRadius="md">
                          <Text fontSize="xs" color="teal.700" fontWeight="bold">
                            {msg.action.type === "add_task" ? "タスク追加" : "メモ追加"}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            {msg.action.type === "add_task"
                              ? `「${msg.action.parentTitle}」に「${msg.action.taskTitle}」を追加`
                              : `「${msg.action.parentTitle}」にメモ追加`}
                          </Text>
                        </Box>
                        <HStack gap={2}>
                          <Button
                            size="xs"
                            colorScheme="teal"
                            flex={1}
                            onClick={() => handleConfirmAction(idx, true)}
                          >
                            追加する
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            flex={1}
                            onClick={() => handleConfirmAction(idx, false)}
                          >
                            やめる
                          </Button>
                        </HStack>
                      </VStack>
                    )}
                    {msg.action && msg.action.confirmed === true && (
                      <Text fontSize="xs" color="green.500" mt={1}>追加しました</Text>
                    )}
                    {msg.action && msg.action.confirmed === false && (
                      <Text fontSize="xs" color="gray.400" mt={1}>キャンセルしました</Text>
                    )}
                  </Card.Body>
                </Card.Root>
              </Box>
            ))}
            {isLoading && (
              <Box alignSelf="flex-start" maxW="85%">
                <Card.Root bg="white" shadow="sm" borderRadius="xl">
                  <Card.Body py={2} px={3}>
                    <Text fontSize="sm" color="gray.500">...</Text>
                  </Card.Body>
                </Card.Root>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        {/* 入力エリア */}
        <Box p={3} bg="white" borderTop="1px solid" borderColor="gray.200" flexShrink={0}>
          <HStack gap={2}>
            <Input
              placeholder="メッセージを入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enterキーで送信（IME変換中は除く）
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              size="md"
              borderRadius="full"
              bg="gray.100"
              color="gray.800"
              _placeholder={{ color: "gray.500" }}
              disabled={isLoading}
            />
            <IconButton
              aria-label="送信"
              colorScheme="teal"
              borderRadius="full"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <FiSend />
            </IconButton>
          </HStack>
        </Box>
      </Box>

      {/* PC版: サイドバー */}
      <Box
        display={{ base: "none", md: "flex" }}
        position="fixed"
        top={0}
        right={0}
        w="30%"
        maxW="400px"
        h="100vh"
        bg="gray.50"
        borderLeft="1px solid"
        borderColor="gray.200"
        zIndex={999}
        transform={isOpen ? "translateX(0)" : "translateX(100%)"}
        transition="transform 0.3s ease"
        flexDirection="column"
      >
        {/* ヘッダー */}
        <Box bg="teal.500" px={4} py={3} flexShrink={0}>
          <HStack justify="space-between">
            <HStack gap={3}>
              <Box
                w="40px"
                h="40px"
                borderRadius="full"
                bg="white"
                overflow="hidden"
              >
                <Image
                  src="/hisyochan-icon.png"
                  alt="秘書ちゃん"
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                />
              </Box>
              <VStack align="start" gap={0}>
                <Text color="white" fontWeight="bold" fontSize="md">
                  秘書ちゃん
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="閉じる"
              variant="ghost"
              color="white"
              size="sm"
              onClick={onClose}
              _hover={{ bg: "whiteAlpha.200" }}
            >
              <FiX size={20} />
            </IconButton>
          </HStack>
        </Box>

        {/* メッセージエリア */}
        <Box
          flex={1}
          overflowY="auto"
          p={4}
          bg="gray.50"
        >
          <VStack gap={3} align="stretch">
            {messages.map((msg, idx) => (
              <Box
                key={idx}
                alignSelf={msg.role === "user" ? "flex-end" : "flex-start"}
                maxW="90%"
              >
                <Card.Root
                  bg={msg.role === "user" ? "teal.500" : "white"}
                  shadow="sm"
                  borderRadius="xl"
                >
                  <Card.Body py={2} px={3}>
                    <Text
                      fontSize="sm"
                      color={msg.role === "user" ? "white" : "gray.800"}
                    >
                      {msg.content}
                    </Text>
                    {/* アクション確認UI */}
                    {msg.action && msg.action.confirmed === undefined && (
                      <VStack align="stretch" mt={2} gap={1}>
                        <Box bg="teal.50" p={2} borderRadius="md">
                          <Text fontSize="xs" color="teal.700" fontWeight="bold">
                            {msg.action.type === "add_task" ? "タスク追加" : "メモ追加"}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            {msg.action.type === "add_task"
                              ? `「${msg.action.parentTitle}」に「${msg.action.taskTitle}」を追加`
                              : `「${msg.action.parentTitle}」にメモ追加`}
                          </Text>
                        </Box>
                        <HStack gap={2}>
                          <Button
                            size="xs"
                            colorScheme="teal"
                            flex={1}
                            onClick={() => handleConfirmAction(idx, true)}
                          >
                            追加する
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            flex={1}
                            onClick={() => handleConfirmAction(idx, false)}
                          >
                            やめる
                          </Button>
                        </HStack>
                      </VStack>
                    )}
                    {msg.action && msg.action.confirmed === true && (
                      <Text fontSize="xs" color="green.500" mt={1}>追加しました</Text>
                    )}
                    {msg.action && msg.action.confirmed === false && (
                      <Text fontSize="xs" color="gray.400" mt={1}>キャンセルしました</Text>
                    )}
                  </Card.Body>
                </Card.Root>
              </Box>
            ))}
            {isLoading && (
              <Box alignSelf="flex-start" maxW="90%">
                <Card.Root bg="white" shadow="sm" borderRadius="xl">
                  <Card.Body py={2} px={3}>
                    <Text fontSize="sm" color="gray.500">
                      ...
                    </Text>
                  </Card.Body>
                </Card.Root>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        {/* 入力エリア */}
        <Box p={3} bg="white" borderTop="1px solid" borderColor="gray.200" flexShrink={0}>
          <HStack gap={2}>
            <Input
              placeholder="メッセージを入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enterキーで送信（IME変換中は除く）
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              size="md"
              borderRadius="full"
              bg="gray.100"
              color="gray.800"
              _placeholder={{ color: "gray.500" }}
              disabled={isLoading}
            />
            <IconButton
              aria-label="送信"
              colorScheme="teal"
              borderRadius="full"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <FiSend />
            </IconButton>
          </HStack>
        </Box>
      </Box>
    </>
  );
}
