"use client";

import { Badge, Box, Button, Card, Flex, Heading, Stack, Text, Textarea } from "@chakra-ui/react";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { CharacterMessage } from "@/components/CharacterMessage";
import { useState } from "react";
import { AI_EXECUTION_MESSAGES, TASK_START_MESSAGES, getRandomMessage } from "@/constants/messages";

const mockTask = {
  title: "Task: 基礎問題集1-3章",
  outputType: "問題集メモ/解説ノート",
  agent: "勉強エージェント",
  prompt: "1-3章の要点をまとめ、練習問題を3問作って",
  model: "高性能モデル（例: Claude Sonnet）",
};

export default function TaskRunPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState(getRandomMessage(TASK_START_MESSAGES));

  const handleRun = () => {
    setIsRunning(true);
    setMessage(AI_EXECUTION_MESSAGES.starting);
    // モック: 2秒後に完了メッセージ
    setTimeout(() => {
      setMessage(AI_EXECUTION_MESSAGES.success);
      setIsRunning(false);
    }, 2000);
  };

  return (
    <Box px={4} py={6} bg="gray.50" minH="100vh" pb="80px">
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">キャラ画面 / AI実行</Heading>
        <Link href="/tasks">
          <Button variant="ghost" size="sm">
            戻る
          </Button>
        </Link>
      </Flex>

      {/* キャラクターメッセージ */}
      <CharacterMessage
        message={message.text}
        expression={message.expression}
        avatarSize="large"
      />

      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">今回のタスク</Heading>
        </Card.Header>
        <Card.Body>
          <Stack spacing={2}>
            <Text fontWeight="semibold">{mockTask.title}</Text>
            <Text fontSize="sm">出力タイプ: {mockTask.outputType}</Text>
            <Badge colorScheme="pink">{mockTask.model}</Badge>
          </Stack>
        </Card.Body>
      </Card.Root>

      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">サブエージェント</Heading>
        </Card.Header>
        <Card.Body>
          <Stack spacing={3}>
            <Text fontWeight="semibold">{mockTask.agent}</Text>
            <Textarea value={mockTask.prompt} readOnly />
            <Flex gap={3}>
              <Button
                colorScheme="teal"
                onClick={handleRun}
                disabled={isRunning}
              >
                {isRunning ? "実行中..." : "実行（モック）"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRunning(false);
                  setMessage(getRandomMessage(TASK_START_MESSAGES));
                }}
                disabled={!isRunning}
              >
                中断
              </Button>
            </Flex>
          </Stack>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Heading size="sm">生成結果プレビュー</Heading>
        </Card.Header>
        <Card.Body>
          <Text color="gray.500" mb={3}>
            ※スタブです。後で実APIを接続。
          </Text>
          <Textarea placeholder="ここにAIの生成結果が表示される想定" minH="180px" />
          <Button colorScheme="teal" mt={3}>
            タスクに保存
          </Button>
        </Card.Body>
      </Card.Root>
      <NavTabs />
    </Box>
  );
}
