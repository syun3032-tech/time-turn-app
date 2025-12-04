"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Card, Heading, Input, Text, VStack, Textarea, Progress } from "@chakra-ui/react";
import { CharacterMessage } from "@/components/CharacterMessage";
import { generateSlides } from "@/lib/manus-service";

export default function SlideCreatePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("トピックを入力してください");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await generateSlides({
        topic: topic,
        numberOfSlides: 10,
        additionalInstructions: additionalInfo || undefined,
      });

      if (response.url) {
        setResult(response.url);
      } else if (response.id) {
        setResult(`スライド作成中... ID: ${response.id}`);
      }
    } catch (err: any) {
      console.error("Slide generation error:", err);
      setError(err.message || "スライドの生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Box px={4} py={6} bg="gray.50" minH="100vh">
      <VStack align="stretch" gap={4} maxW="800px" mx="auto">
        <Heading size="lg">スライド作成</Heading>

        <CharacterMessage
          message="スライドを作成するね！トピックを教えて！"
          expression="niyari"
          avatarSize="medium"
        />

        <Card.Root>
          <Card.Body>
            <VStack align="stretch" gap={4}>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  トピック（必須）
                </Text>
                <Input
                  placeholder="例：Next.js入門、機械学習の基礎、英語プレゼンのコツ"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  size="lg"
                />
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  追加情報（任意）
                </Text>
                <Textarea
                  placeholder="スライドに含めたい内容や、対象者など..."
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  rows={4}
                />
              </Box>

              <Button
                colorScheme="teal"
                size="lg"
                w="full"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "作成中..." : "スライドを作成"}
              </Button>

              {isGenerating && (
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

              {error && (
                <Card.Root bg="red.50" borderColor="red.200">
                  <Card.Body>
                    <Text color="red.700" fontSize="sm">
                      ❌ {error}
                    </Text>
                  </Card.Body>
                </Card.Root>
              )}

              {result && (
                <Card.Root bg="green.50" borderColor="green.200">
                  <Card.Body>
                    <VStack align="stretch" gap={2}>
                      <Text fontWeight="semibold" color="green.700">
                        ✅ スライドが完成しました！
                      </Text>
                      {result.startsWith("http") ? (
                        <Button
                          as="a"
                          href={result}
                          target="_blank"
                          colorScheme="green"
                          size="sm"
                        >
                          スライドを開く
                        </Button>
                      ) : (
                        <Text fontSize="sm" color="gray.700">
                          {result}
                        </Text>
                      )}
                    </VStack>
                  </Card.Body>
                </Card.Root>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>

        <Button variant="outline" onClick={() => router.push("/ai-chat")}>
          チャットに戻る
        </Button>
      </VStack>
    </Box>
  );
}
