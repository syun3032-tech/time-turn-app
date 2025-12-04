"use client";

import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Input,
  Select,
  Stack,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react";
import { useState } from "react";
import { NavTabs } from "@/components/NavTabs";
import { CharacterMessage } from "@/components/CharacterMessage";
import { chatWithAI, chatWithAISeamless, AIProvider } from "@/lib/ai-service";
import { getSystemPrompt } from "@/config/character";
import { getEnhancedTaskBreakdownPrompt } from "@/lib/prompts";

const providerOptions = createListCollection({
  items: [
    { label: "Google Gemini（推奨）", value: "gemini" },
    { label: "OpenAI (GPT-4)", value: "openai" },
    { label: "Anthropic (Claude)", value: "anthropic" },
  ],
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [useTaskBreakdownPrompt, setUseTaskBreakdownPrompt] = useState(false);
  const [useSeamlessMode, setUseSeamlessMode] = useState(true);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      let response;

      if (useSeamlessMode) {
        // シームレスモード：自動でチャット・タスク分解を切り替え
        response = await chatWithAISeamless(newMessages, provider);
      } else {
        // 従来モード：手動でプロンプトを設定
        let messagesToSend = newMessages;

        if (newMessages.length === 1 && useTaskBreakdownPrompt) {
          // タスク分解プロンプトを使用
          const taskBreakdownPrompt = getEnhancedTaskBreakdownPrompt(
            `【ユーザーの目標】\n${input}`
          );
          messagesToSend = [{ role: "user", content: taskBreakdownPrompt }];
        } else if (newMessages.length === 1) {
          // 通常のシステムプロンプトを使用
          const systemPrompt = getSystemPrompt();
          messagesToSend = [
            { role: "user", content: `${systemPrompt}\n\nユーザー: ${input}` },
          ];
        }

        response = await chatWithAI(messagesToSend, provider);
      }

      if (response.success) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: response.content || "" },
        ]);
      } else {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: `エラーが発生しました: ${response.error}`,
          },
        ]);
      }
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `エラーが発生しました: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <Box px={4} py={6} bg="gray.50" minH="100vh" pb="80px">
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">AI チャット（テスト）</Heading>
        <Button variant="outline" size="sm" onClick={handleReset}>
          リセット
        </Button>
      </Flex>

      {/* 設定 */}
      <Card.Root mb={4}>
        <Card.Body>
          <Stack gap={3}>
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                AI プロバイダー
              </Text>
              <Select.Root
                collection={providerOptions}
                value={[provider]}
                onValueChange={(e) => setProvider(e.value[0] as AIProvider)}
                size="sm"
              >
                <Select.Trigger>
                  <Select.ValueText placeholder="プロバイダーを選択" />
                </Select.Trigger>
                <Select.Content>
                  {providerOptions.items.map((item) => (
                    <Select.Item key={item.value} item={item.value}>
                      {item.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Box>
              <label>
                <input
                  type="checkbox"
                  checked={useSeamlessMode}
                  onChange={(e) => setUseSeamlessMode(e.target.checked)}
                />
                <Text as="span" ml={2} fontSize="sm" fontWeight="semibold">
                  シームレスモード（自動モード切り替え）⭐️
                </Text>
              </label>
              <Text fontSize="xs" color="gray.600" ml={6}>
                キーワードを検出して自動的にチャット・タスク分解を切り替え
              </Text>
            </Box>

            {!useSeamlessMode && (
              <Box>
                <label>
                  <input
                    type="checkbox"
                    checked={useTaskBreakdownPrompt}
                    onChange={(e) => setUseTaskBreakdownPrompt(e.target.checked)}
                  />
                  <Text as="span" ml={2} fontSize="sm">
                    タスク分解プロンプトを使用（初回メッセージのみ）
                  </Text>
                </label>
              </Box>
            )}
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* メッセージ一覧 */}
      <VStack align="stretch" gap={3} mb={4}>
        {messages.length === 0 && (
          <CharacterMessage
            message="こんにちは！秘書ゆりです。何でも聞いてくださいね。"
            expression="wawa"
            avatarSize="large"
          />
        )}

        {messages.map((msg, index) => (
          <Box key={index}>
            {msg.role === "assistant" ? (
              <CharacterMessage
                message={msg.content}
                expression="open_mouth"
                showAvatar={index === 0 || messages[index - 1]?.role !== "assistant"}
              />
            ) : (
              <Card.Root bg="blue.50" ml="auto" maxW="80%">
                <Card.Body>
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    {msg.content}
                  </Text>
                </Card.Body>
              </Card.Root>
            )}
          </Box>
        ))}

        {isLoading && (
          <CharacterMessage
            message="考えています..."
            expression="normal"
            showAvatar={false}
          />
        )}
      </VStack>

      {/* 入力欄 */}
      <Card.Root position="sticky" bottom="80px" bg="white" shadow="lg">
        <Card.Body>
          <Flex gap={2}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                useSeamlessMode
                  ? "メッセージを入力...（「〜したい」で自動モード切替）"
                  : useTaskBreakdownPrompt && messages.length === 0
                  ? "やりたいこと・成したいことを入力..."
                  : "メッセージを入力..."
              }
              disabled={isLoading}
              flex={1}
            />
            <Button
              colorScheme="teal"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
            >
              送信
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      <NavTabs />
    </Box>
  );
}
