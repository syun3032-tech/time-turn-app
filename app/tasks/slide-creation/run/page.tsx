"use client";

import { Badge, Box, Button, Card, Flex, Heading, Input, Text, Textarea, VStack, Progress } from "@chakra-ui/react";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { CharacterMessage } from "@/components/CharacterMessage";
import { useState } from "react";
import { generateSlides } from "@/lib/manus-service";

type QuestionStep = "coreValue" | "generating" | "complete";

export default function SlideCreationPage() {
  const [step, setStep] = useState<QuestionStep>("coreValue");
  const [coreValue, setCoreValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getMessage = () => {
    switch (step) {
      case "coreValue":
        return "ビジコン用の資料を作るね！まず、あなたのビジネスのコアバリュー（核となる価値）を教えて！";
      case "generating":
        return "わかった！ビジコンフォーマットで資料作るね！";
      case "complete":
        return result ? "できたよ！確認してみて！" : "あれ...うまくいかなかったみたい...";
      default:
        return "ビジコン資料作成を始めるよ！";
    }
  };

  const getExpression = () => {
    switch (step) {
      case "coreValue":
        return "niyari";
      case "generating":
        return "wawa";
      case "complete":
        return result ? "ookiokutigake" : "mewo";
      default:
        return "normal";
    }
  };

  const handleNext = () => {
    if (!coreValue.trim()) {
      alert("コアバリューを入力してください");
      return;
    }
    handleGenerate();
  };

  const handleGenerate = async () => {
    setStep("generating");
    setError(null);

    try {
      // ビジコン用フォーマット
      const bizConFormat = `
【ビジネスコンテスト用プレゼンテーション構成】
1. 表紙（タイトル・チーム名）
2. 課題・問題提起
3. 解決策・サービス概要
4. コアバリュー（提供価値）
5. ビジネスモデル
6. 市場規模・競合分析
7. 収益計画
8. 実行計画・ロードマップ
9. チーム紹介
10. まとめ・Ask

コアバリュー: ${coreValue}

このコアバリューを中心に、上記フォーマットに沿った魅力的なビジコン資料を作成してください。
視覚的に訴求力があり、審査員を惹きつける内容にしてください。
      `.trim();

      const response = await generateSlides({
        topic: `ビジネスコンテスト: ${coreValue}`,
        numberOfSlides: 10,
        additionalInstructions: bizConFormat,
      });

      if (response.url) {
        setResult(response.url);
        setStep("complete");
      } else if (response.id) {
        setResult(`スライド作成中... ID: ${response.id}`);
        setStep("complete");
      }
    } catch (err: any) {
      console.error("Slide generation error:", err);
      setError(err.message || "スライドの生成に失敗しました");
      setStep("complete");
    }
  };

  const handleReset = () => {
    setStep("coreValue");
    setCoreValue("");
    setResult(null);
    setError(null);
  };

  return (
    <Box px={4} py={6} bg="gray.50" minH="100vh" pb="80px">
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">スライド作成</Heading>
        <Link href="/ai-chat">
          <Button variant="ghost" size="sm">
            戻る
          </Button>
        </Link>
      </Flex>

      {/* キャラクターメッセージ */}
      <CharacterMessage
        message={getMessage()}
        expression={getExpression()}
        avatarSize="large"
      />

      <Card.Root mb={4}>
        <Card.Body>
          <VStack align="stretch" gap={4}>
            {/* 進捗表示 */}
            <Flex gap={2}>
              <Badge colorScheme={step === "coreValue" ? "teal" : "gray"}>
                Step 1: コアバリュー
              </Badge>
              <Badge colorScheme={step === "generating" || step === "complete" ? "teal" : "gray"}>
                Step 2: 生成
              </Badge>
            </Flex>

            {/* コアバリュー入力 */}
            {step === "coreValue" && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  コアバリュー（核となる価値）
                </Text>
                <Textarea
                  placeholder="例：AIで学習時間を半減させる / 高齢者の孤独を解消するコミュニティ / 地方創生×テクノロジー"
                  value={coreValue}
                  onChange={(e) => setCoreValue(e.target.value)}
                  size="lg"
                  rows={4}
                  autoFocus
                />
                <Button
                  colorScheme="teal"
                  size="lg"
                  w="full"
                  mt={4}
                  onClick={handleNext}
                >
                  ビジコン資料を作成
                </Button>
              </Box>
            )}

            {/* 生成中 */}
            {step === "generating" && (
              <Box>
                <Progress.Root value={null} size="sm">
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
                <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
                  スライドを生成しています...
                </Text>
              </Box>
            )}

            {/* 完了 */}
            {step === "complete" && (
              <VStack align="stretch" gap={3}>
                {error ? (
                  <Card.Root bg="red.50" borderColor="red.200">
                    <Card.Body>
                      <Text color="red.700" fontSize="sm">
                        ❌ {error}
                      </Text>
                    </Card.Body>
                  </Card.Root>
                ) : result ? (
                  <Card.Root bg="green.50" borderColor="green.200">
                    <Card.Body>
                      <VStack align="stretch" gap={2}>
                        <Text fontWeight="semibold" color="green.700">
                          ✅ ビジコン資料が完成しました！
                        </Text>
                        <Text fontSize="sm" color="gray.700">
                          コアバリュー: {coreValue}
                        </Text>
                        {result.startsWith("http") && (
                          <a href={result} target="_blank" rel="noopener noreferrer">
                            <Button
                              colorScheme="green"
                              size="md"
                              w="full"
                            >
                              スライドを開く
                            </Button>
                          </a>
                        )}
                        {!result.startsWith("http") && (
                          <Text fontSize="sm">{result}</Text>
                        )}
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                ) : null}

                <Button onClick={handleReset} variant="outline">
                  もう一度作る
                </Button>
              </VStack>
            )}
          </VStack>
        </Card.Body>
      </Card.Root>

      <NavTabs />
    </Box>
  );
}
