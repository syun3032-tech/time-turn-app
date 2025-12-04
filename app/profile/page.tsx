"use client";

import { Badge, Box, Card, Flex, Heading, Progress, SimpleGrid, Stack, Tag, Text, VStack } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type RadarStat = {
  label: string;
  value: number; // 0-100
};

const radarStats: RadarStat[] = [
  { label: "知識", value: 70 },
  { label: "実践", value: 55 },
  { label: "創造", value: 60 },
  { label: "体力", value: 50 },
  { label: "習慣", value: 80 },
];

const personalityStats: RadarStat[] = [
  { label: "集中力", value: 85 },
  { label: "朝型度", value: 75 },
  { label: "瞬発力", value: 90 },
  { label: "持続力", value: 55 },
  { label: "柔軟性", value: 70 },
];

const center = { x: 110, y: 110 };
const radius = 80;

function polarToCartesian(angleDeg: number, r: number) {
  const rad = (Math.PI / 180) * angleDeg;
  return {
    x: center.x + r * Math.cos(rad),
    y: center.y + r * Math.sin(rad),
  };
}

function statPoints(stats: RadarStat[]) {
  const step = 360 / stats.length;
  return stats
    .map((s, i) => {
      const angle = -90 + step * i;
      const r = (s.value / 100) * radius;
      const { x, y } = polarToCartesian(angle, r);
      return `${x},${y}`;
    })
    .join(" ");
}

const achievements = [
  "5日連続で80%達成",
  "初めてライティングタスク完了",
  "昨日より+30分作業",
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ローディング中またはユーザーがいない場合は何も表示しない
  if (loading || !user) {
    return null;
  }

  return (
    <Box px={4} py={6}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">プロフィール / RPGビュー</Heading>
        <Badge
          colorScheme="purple"
          fontSize="2xl"
          px={4}
          py={2}
          borderRadius="lg"
          fontWeight="bold"
        >
          Lv.12
        </Badge>
      </Flex>

      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">ジョブ / 称号</Heading>
        </Card.Header>
        <Card.Body>
          <Text fontWeight="semibold">学習探索者</Text>
          <Text color="gray.600">現在のGoal: 国立理系に合格する</Text>
          <Progress.Root value={72} mt={2} borderRadius="md">
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text fontSize="sm" color="gray.600" mt={1}>
            次のレベルまで: 28%（進捗率をXP換算）
          </Text>
        </Card.Body>
      </Card.Root>

      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">パラメータ</Heading>
        </Card.Header>
        <Card.Body>
          <Box as="svg" viewBox="0 0 220 220" w="100%" h="220px">
            {[20, 40, 60, 80, 100].map((p) => {
              const r = (p / 100) * radius;
              const pts = radarStats
                .map((_, i) => {
                  const step = 360 / radarStats.length;
                  const angle = -90 + step * i;
                  const { x, y } = polarToCartesian(angle, r);
                  return `${x},${y}`;
                })
                .join(" ");
              return <polygon key={p} points={pts} fill="none" stroke="#e5e7eb" strokeWidth="1" />;
            })}
            <polygon
              points={radarStats
                .map((_, i) => {
                  const step = 360 / radarStats.length;
                  const angle = -90 + step * i;
                  const { x, y } = polarToCartesian(angle, radius);
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
            />
            <polygon points={statPoints(radarStats)} fill="rgba(34,197,94,0.35)" stroke="#22c55e" strokeWidth="2" />
            {radarStats.map((s, i) => {
              const step = 360 / radarStats.length;
              const angle = -90 + step * i;
              const { x, y } = polarToCartesian(angle, radius + 14);
              return (
                <text key={s.label} x={x} y={y} fontSize="10" textAnchor="middle" fill="#111827">
                  {s.label}
                </text>
              );
            })}
          </Box>
        </Card.Body>
      </Card.Root>

      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">気分・特性</Heading>
        </Card.Header>
        <Card.Body>
          <Box as="svg" viewBox="0 0 220 220" w="100%" h="220px" mb={2}>
            {[20, 40, 60, 80, 100].map((p) => {
              const r = (p / 100) * radius;
              const pts = personalityStats
                .map((_, i) => {
                  const step = 360 / personalityStats.length;
                  const angle = -90 + step * i;
                  const { x, y } = polarToCartesian(angle, r);
                  return `${x},${y}`;
                })
                .join(" ");
              return <polygon key={p} points={pts} fill="none" stroke="#e5e7eb" strokeWidth="1" />;
            })}
            <polygon
              points={personalityStats
                .map((_, i) => {
                  const step = 360 / personalityStats.length;
                  const angle = -90 + step * i;
                  const { x, y } = polarToCartesian(angle, radius);
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
            />
            <polygon points={statPoints(personalityStats)} fill="rgba(59,130,246,0.35)" stroke="#3b82f6" strokeWidth="2" />
            {personalityStats.map((s, i) => {
              const step = 360 / personalityStats.length;
              const angle = -90 + step * i;
              const { x, y } = polarToCartesian(angle, radius + 14);
              return (
                <text key={s.label} x={x} y={y} fontSize="10" textAnchor="middle" fill="#111827">
                  {s.label}
                </text>
              );
            })}
          </Box>
          <Stack direction="row" gap={2}>
            <Tag.Root colorScheme="blue">
              <Tag.Label>集中タイプ</Tag.Label>
            </Tag.Root>
            <Tag.Root colorScheme="teal">
              <Tag.Label>朝型</Tag.Label>
            </Tag.Root>
            <Tag.Root colorScheme="orange">
              <Tag.Label>スプリント型</Tag.Label>
            </Tag.Root>
          </Stack>
        </Card.Body>
      </Card.Root>

      <Card.Root mt={4}>
        <Card.Header>
          <Heading size="sm">実績バッジ</Heading>
        </Card.Header>
        <Card.Body>
          <SimpleGrid columns={{ base: 2, md: 3 }} gap={2}>
            {achievements.map((a) => (
              <VStack key={a} align="stretch" gap={1} bg="white" p={3} borderRadius="md" border="1px solid" borderColor="gray.100">
                <Text fontWeight="semibold" fontSize="sm">
                  {a}
                </Text>
                <Badge colorScheme="yellow">Uncommon</Badge>
              </VStack>
            ))}
          </SimpleGrid>
        </Card.Body>
      </Card.Root>
      <NavTabs />
    </Box>
  );
}
