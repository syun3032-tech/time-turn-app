"use client";

import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { Expression } from "@/components/CharacterAvatar";

const VrmAvatar = dynamic(() => import("@/components/chat/VrmAvatar").then(m => m.VrmAvatar), { ssr: false });

/**
 * VRM動作確認ページ（開発用・ナビからはリンクしない）
 * public/models/sample.vrm（three-vrm公式サンプル）で
 * 口パク・まばたき・表情・アイドルモーションを確認できる。
 * ゆりのVRMが完成したら public/models/yuri.vrm に置けば本番に反映される。
 */
export default function VrmTestPage() {
  const [talking, setTalking] = useState(false);
  const [expression, setExpression] = useState<Expression>("normal");
  const [error, setError] = useState(false);

  return (
    <Flex direction="column" h="100dvh" bg="linear-gradient(175deg, #dff0ec 0%, #f2f3ee 45%, #e8e4da 100%)">
      <Box p={3}>
        <Text fontWeight="bold">VRMテスト（sample.vrm）</Text>
        <Text fontSize="xs" color="gray.600">
          ゆりのVRMができたら public/models/yuri.vrm に置くと本番ホームが3Dになります
        </Text>
      </Box>

      <Flex flex={1} justify="center" align="center" minH={0}>
        {error ? (
          <Text color="red.500">sample.vrm の読み込みに失敗しました</Text>
        ) : (
          <VrmAvatar
            src="/models/sample.vrm"
            expression={expression}
            talking={talking}
            height="90%"
            onLoadError={() => setError(true)}
          />
        )}
      </Flex>

      <Box p={4} pb={8}>
        <HStack mb={3} justify="center">
          <Button
            colorScheme={talking ? "red" : "teal"}
            onClick={() => setTalking(v => !v)}
          >
            {talking ? "口パク停止" : "口パク開始"}
          </Button>
        </HStack>
        <HStack justify="center" flexWrap="wrap" gap={2}>
          {([
            ["normal", "通常"],
            ["wawa", "わわ(驚き)"],
            ["niyari", "ニヤリ"],
            ["mewo", "目閉じ微笑"],
          ] as [Expression, string][]).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={expression === key ? "solid" : "outline"}
              colorScheme="teal"
              onClick={() => setExpression(key)}
            >
              {label}
            </Button>
          ))}
        </HStack>
      </Box>
    </Flex>
  );
}
