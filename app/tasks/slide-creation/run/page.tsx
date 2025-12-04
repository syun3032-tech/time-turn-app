"use client";

import { Badge, Box, Button, Card, Flex, Heading, Input, Text, Textarea, VStack, Progress } from "@chakra-ui/react";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { CharacterMessage } from "@/components/CharacterMessage";
import { useState } from "react";
import { generateSlides } from "@/lib/manus-service";

type QuestionStep = "topic" | "target" | "style" | "generating" | "complete";

export default function SlideCreationPage() {
  const [step, setStep] = useState<QuestionStep>("topic");
  const [topic, setTopic] = useState("");
  const [target, setTarget] = useState("");
  const [style, setStyle] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getMessage = () => {
    switch (step) {
      case "topic":
        return "スライドのテーマを教えて！何について作りたい？";
      case "target":
        return "誰に向けたスライドなの？対象者を教えて！";
      case "style":
        return "どんな雰囲気がいい？シンプル、ポップ、ビジネスライクとか！";
      case "generating":
        return "わかった！今からスライド作るね！";
      case "complete":
        return result ? "できたよ！確認してみて！" : "あれ...うまくいかなかったみたい...";
      default:
        return "スライド作成を始めるよ！";
    }
  };

  const getExpression = () => {
    switch (step) {
      case "topic":
      case "target":
      case "style":
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
    if (step === "topic" && !topic.trim()) {
      alert("テーマを入力してください");
      return;
    }

    if (step === "topic") {
      setStep("target");
    } else if (step === "target") {
      setStep("style");
    } else if (step === "style") {
      handleGenerate();
    }
  };

  const handleGenerate = async () => {
    setStep("generating");
    setError(null);

    try {
      const instructions = `
対象者: ${target || "一般"}
スタイル: ${style || "標準"}
      `.trim();

      const response = await generateSlides({
        topic: topic,
        numberOfSlides: 10,
        additionalInstructions: instructions,
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
    setStep("topic");
    setTopic("");
    setTarget("");
    setStyle("");
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
              <Badge colorScheme={step === "topic" || step === "target" || step === "style" ? "teal" : "gray"}>
                Step 1: テーマ
              </Badge>
              <Badge colorScheme={step === "target" || step === "style" ? "teal" : "gray"}>
                Step 2: 対象者
              </Badge>
              <Badge colorScheme={step === "style" ? "teal" : "gray"}>
                Step 3: スタイル
              </Badge>
              <Badge colorScheme={step === "generating" || step === "complete" ? "teal" : "gray"}>
                Step 4: 生成
              </Badge>
            </Flex>

            {/* テーマ入力 */}
            {step === "topic" && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  スライドのテーマ
                </Text>
                <Input
                  placeholder="例：Next.js入門、機械学習の基礎、英語プレゼンのコツ"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  size="lg"
                  autoFocus
                />
                <Button
                  colorScheme="teal"
                  size="lg"
                  w="full"
                  mt={4}
                  onClick={handleNext}
                >
                  次へ
                </Button>
              </Box>
            )}

            {/* 対象者入力 */}
            {step === "target" && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  対象者
                </Text>
                <Input
                  placeholder="例：初心者、大学生、ビジネスパーソン"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  size="lg"
                  autoFocus
                />
                <Button
                  colorScheme="teal"
                  size="lg"
                  w="full"
                  mt={4}
                  onClick={handleNext}
                >
                  次へ
                </Button>
              </Box>
            )}

            {/* スタイル入力 */}
            {step === "style" && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  スタイル・雰囲気
                </Text>
                <Input
                  placeholder="例：シンプル、ポップ、ビジネスライク"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  size="lg"
                  autoFocus
                />
                <Button
                  colorScheme="teal"
                  size="lg"
                  w="full"
                  mt={4}
                  onClick={handleNext}
                >
                  スライドを作成
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
                          ✅ スライドが完成しました！
                        </Text>
                        <Text fontSize="sm" color="gray.700">
                          テーマ: {topic}
                        </Text>
                        {result.startsWith("http") && (
                          <Button
                            as="a"
                            href={result}
                            target="_blank"
                            colorScheme="green"
                            size="md"
                          >
                            スライドを開く
                          </Button>
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
