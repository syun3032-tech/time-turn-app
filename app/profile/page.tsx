"use client";

import { Box, Card, Heading, Text, VStack, HStack, Progress } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCompletedTasks } from "@/lib/firebase/firestore";
import { getTaskTreeAsync } from "@/lib/task-tree-storage";
import { TaskNode } from "@/types/task-tree";

type RadarStat = {
  label: string;
  value: number; // 0-100
  description: string;
  source: string;
};

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

// 進捗計算関数
function calculateProgress(node: any): number {
  if (!node.children || node.children.length === 0) {
    return node.archived ? 100 : 0;
  }
  const childProgresses = node.children.map((child: any) => calculateProgress(child));
  const totalProgress = childProgresses.reduce((sum: number, p: number) => sum + p, 0);
  return Math.round(totalProgress / node.children.length);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [completedCount, setCompletedCount] = useState(0);
  const [taskTree, setTaskTree] = useState<TaskNode[]>([]);

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // データを読み込み
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // 完了タスクを取得
        const completed = await getCompletedTasks(user.uid, 1000);
        setCompletedCount(completed.length);

        // タスクツリーを取得
        const tree = await getTaskTreeAsync(user.uid);
        setTaskTree(tree);
      } catch (error) {
        console.error("Failed to load profile data:", error);
      }
    };

    loadData();
  }, [user]);

  // Goalをタップしたときの処理
  const handleGoalClick = (goalId: string) => {
    router.push(`/tasks?highlight=${goalId}`);
  };

  // ローディング中またはユーザーがいない場合は何も表示しない
  if (loading || !user) {
    return null;
  }

  // 動的なパラメータ（タスクツリーの状況に基づく）
  const goalCount = taskTree.filter(n => n.type === "Goal").length;
  const radarStats: RadarStat[] = [
    {
      label: "計画力",
      value: Math.min(100, goalCount * 15),
      description: "目標を設定し、計画を立てる力",
      source: "Goal・Project・Milestoneの設定数"
    },
    {
      label: "実行力",
      value: Math.min(100, completedCount * 5),
      description: "タスクを着実に完了させる力",
      source: "完了したタスクの数"
    },
    {
      label: "継続力",
      value: Math.min(100, completedCount * 3),
      description: "毎日コツコツ続ける力",
      source: "連続ログイン日数・週間完了数"
    },
    {
      label: "集中力",
      value: Math.min(100, completedCount * 4),
      description: "一つのことに没頭する力",
      source: "1日の完了タスク数"
    },
    {
      label: "分析力",
      value: Math.min(100, completedCount * 2),
      description: "振り返りから学ぶ力",
      source: "振り返りメモの記入数"
    },
    {
      label: "挑戦力",
      value: Math.min(100, goalCount * 10),
      description: "新しいことに挑む力",
      source: "新規Goalの追加数"
    },
  ];

  return (
    <Box px={4} py={6} pb="80px">
      <Heading size="md" mb={4}>プロフィール</Heading>

      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">Goal一覧</Heading>
        </Card.Header>
        <Card.Body>
          {taskTree.length === 0 ? (
            <Text fontSize="sm" color="gray.600">目標を設定してください</Text>
          ) : (
            <VStack align="stretch" gap={3}>
              {taskTree.map((goal) => {
                const progress = calculateProgress(goal);
                const title = goal.title.replace('Goal: ', '');
                return (
                  <Box
                    key={goal.id}
                    p={3}
                    bg="gray.50"
                    borderRadius="md"
                    cursor="pointer"
                    onClick={() => handleGoalClick(goal.id)}
                    _hover={{ bg: "gray.100" }}
                    transition="background 0.2s"
                  >
                    <Text fontWeight="semibold" fontSize="sm" mb={2}>{title}</Text>
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="xs" color="gray.700">進捗</Text>
                      <Text fontSize="xs" fontWeight="bold" color={progress === 100 ? "green.500" : "teal.500"}>
                        {progress}%
                      </Text>
                    </HStack>
                    <Progress.Root value={progress} size="sm" borderRadius="full">
                      <Progress.Track bg="gray.200">
                        <Progress.Range bg={progress === 100 ? "green.500" : "teal.500"} />
                      </Progress.Track>
                    </Progress.Root>
                  </Box>
                );
              })}
            </VStack>
          )}
        </Card.Body>
      </Card.Root>

      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">あなたの能力</Heading>
        </Card.Header>
        <Card.Body>
          <Box w="100%" h="220px" mb={4}>
            <svg viewBox="0 0 220 220" width="100%" height="220">
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
              const { x, y } = polarToCartesian(angle, radius + 18);
              return (
                <text key={s.label} x={x} y={y} fontSize="9" textAnchor="middle" fill="#111827" fontWeight="bold">
                  {s.label}
                </text>
              );
            })}
            </svg>
          </Box>

          {/* 各パラメータの説明 */}
          <VStack align="stretch" gap={3}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.700">各能力の説明</Text>
            {radarStats.map((stat) => (
              <Box key={stat.label} p={3} bg="gray.50" borderRadius="md">
                <HStack justify="space-between" mb={1}>
                  <Text fontSize="sm" fontWeight="bold" color="gray.800">{stat.label}</Text>
                  <Text fontSize="sm" fontWeight="bold" color="teal.500">{stat.value}%</Text>
                </HStack>
                <Text fontSize="xs" color="gray.600" mb={1}>{stat.description}</Text>
                <Text fontSize="2xs" color="gray.600">📊 {stat.source}</Text>
              </Box>
            ))}
          </VStack>
        </Card.Body>
      </Card.Root>

      <NavTabs />
    </Box>
  );
}
