"use client";

import { Box, Button, Card, Flex, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { CharacterMessage } from "@/components/CharacterMessage";
import { GREETING_MESSAGES, GOAL_SETTING_MESSAGES } from "@/constants/messages";

const sampleGoals = [
  { title: "国立理系に合格する", why: "将来の研究に必要だから", deadline: "1年以内", priority: "High" },
  { title: "英語で日常会話ができるようになる", why: "留学準備", deadline: "6ヶ月", priority: "Medium" },
];

export default function OnboardingPage() {
  return (
    <Box px={4} py={6} bg="gray.50" minH="100vh" pb="80px">
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">オンボーディング</Heading>
        <Link href="/tasks">
          <Button colorScheme="teal" size="sm">
            Goal登録へ進む
          </Button>
        </Link>
      </Flex>

      {/* キャラクターメッセージ */}
      <CharacterMessage
        message={GREETING_MESSAGES.first_meeting.text}
        expression={GREETING_MESSAGES.first_meeting.expression}
        avatarSize="large"
      />

      <CharacterMessage
        message={GOAL_SETTING_MESSAGES.dream_inquiry.text}
        expression={GOAL_SETTING_MESSAGES.dream_inquiry.expression}
        showAvatar={false}
      />

      <VStack align="stretch" spacing={3} mt={6}>
        <Heading size="sm">暫定Goal案</Heading>
        {sampleGoals.map((goal, idx) => (
          <Card.Root key={idx}>
            <Card.Body>
              <Stack spacing={1}>
                <Heading size="sm">{goal.title}</Heading>
                <Text fontSize="sm">Why: {goal.why}</Text>
                <Text fontSize="sm">期限: {goal.deadline} / 優先度: {goal.priority}</Text>
              </Stack>
            </Card.Body>
          </Card.Root>
        ))}
      </VStack>

      <Flex mt={6} gap={3}>
        <Button colorScheme="teal" flex={1}>
          承認してGoal登録
        </Button>
        <Button variant="outline" flex={1}>
          修正する
        </Button>
      </Flex>

      <NavTabs />
    </Box>
  );
}
