"use client";

import { Badge, Box, Card, Flex, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiStar, FiClock, FiCheckCircle } from "react-icons/fi";
import { getCompletedTasks } from "@/lib/firebase/firestore";
import type { CompletedTask } from "@/lib/firebase/firestore-types";

export default function LogPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 完了タスクを読み込み
  useEffect(() => {
    const loadCompletedTasks = async () => {
      if (!user) return;

      try {
        const tasks = await getCompletedTasks(user.uid, 50);
        setCompletedTasks(tasks);
      } catch (error) {
        console.error("Failed to load completed tasks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadCompletedTasks();
    }
  }, [user]);

  // ローディング中またはユーザーがいない場合は何も表示しない
  if (loading || !user) {
    return null;
  }

  // 日付フォーマット
  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.floor((today.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "昨日";
    if (diffDays < 7) return `${diffDays}日前`;

    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  // 統計情報
  const totalTasks = completedTasks.length;
  const totalTime = completedTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
  const avgRating = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => sum + (task.achievementRating || 0), 0) / completedTasks.length
    : 0;

  return (
    <Box px={{ base: 2, md: 4 }} py={{ base: 4, md: 6 }} bg="gray.50" minH="100vh" pb="80px">
      <Flex justify="space-between" align="center" mb={{ base: 4, md: 6 }} flexWrap="wrap" gap={2}>
        <Heading size={{ base: "sm", md: "md" }}>実績ログ</Heading>
        <HStack gap={2} flexWrap="wrap">
          <Badge colorScheme="green" fontSize={{ base: "2xs", md: "xs" }}>
            {totalTasks}個完了
          </Badge>
          <Badge colorScheme="blue" fontSize={{ base: "2xs", md: "xs" }}>
            {Math.floor(totalTime / 60)}時間{totalTime % 60}分
          </Badge>
        </HStack>
      </Flex>

      {/* 統計サマリー */}
      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">サマリー</Heading>
        </Card.Header>
        <Card.Body>
          <HStack justify="space-around" flexWrap="wrap" gap={4}>
            <VStack>
              <Text fontSize="2xl" fontWeight="bold" color="teal.500">{totalTasks}</Text>
              <Text fontSize="sm" color="gray.600">完了タスク</Text>
            </VStack>
            <VStack>
              <Text fontSize="2xl" fontWeight="bold" color="blue.500">
                {Math.floor(totalTime / 60)}h {totalTime % 60}m
              </Text>
              <Text fontSize="sm" color="gray.600">総作業時間</Text>
            </VStack>
            <VStack>
              <HStack>
                <FiStar color="orange" />
                <Text fontSize="2xl" fontWeight="bold" color="orange.500">
                  {avgRating.toFixed(1)}
                </Text>
              </HStack>
              <Text fontSize="sm" color="gray.600">平均達成感</Text>
            </VStack>
          </HStack>
        </Card.Body>
      </Card.Root>

      {/* タイムライン */}
      <Heading size="sm" mb={4}>タイムライン</Heading>

      {isLoading ? (
        <Text color="gray.500" textAlign="center" py={8}>読み込み中...</Text>
      ) : completedTasks.length === 0 ? (
        <Card.Root>
          <Card.Body>
            <VStack py={8} gap={2}>
              <FiCheckCircle size={48} color="gray" />
              <Text color="gray.500">まだ完了したタスクがありません</Text>
              <Text fontSize="sm" color="gray.400">タスクを完了すると、ここに表示されます</Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      ) : (
        <VStack align="stretch" gap={3}>
          {completedTasks.map((task) => (
            <Card.Root key={task.id}>
              <Card.Body p={{ base: 3, md: 4 }}>
                <VStack align="stretch" gap={2}>
                  {/* ヘッダー */}
                  <Flex justify="space-between" align="start" gap={2}>
                    <VStack align="start" flex={1} gap={1}>
                      <HStack gap={2} flexWrap="wrap">
                        <Badge size="sm" colorScheme={
                          task.taskType === 'Goal' ? 'purple' :
                          task.taskType === 'Project' ? 'blue' :
                          task.taskType === 'Milestone' ? 'teal' : 'green'
                        }>
                          {task.taskType}
                        </Badge>
                        {task.aiCapable && (
                          <Badge size="sm" colorScheme="pink">AI実行</Badge>
                        )}
                      </HStack>
                      <Text fontWeight="semibold" fontSize={{ base: "sm", md: "md" }}>
                        {task.taskTitle}
                      </Text>
                    </VStack>

                    {/* 達成感レーティング */}
                    {task.achievementRating && (
                      <HStack>
                        {[...Array(5)].map((_, i) => (
                          <FiStar
                            key={i}
                            size={16}
                            fill={i < task.achievementRating! ? "orange" : "none"}
                            color={i < task.achievementRating! ? "orange" : "gray"}
                          />
                        ))}
                      </HStack>
                    )}
                  </Flex>

                  {/* 時間情報 */}
                  <HStack gap={4} fontSize={{ base: "xs", md: "sm" }} color="gray.600" flexWrap="wrap">
                    <HStack gap={1}>
                      <FiCheckCircle />
                      <Text>{formatDate(task.completedAt)} {formatTime(task.completedAt)}</Text>
                    </HStack>
                    {task.timeSpent && (
                      <HStack gap={1}>
                        <FiClock />
                        <Text>{task.timeSpent}分</Text>
                      </HStack>
                    )}
                  </HStack>

                  {/* 振り返りメモ */}
                  {task.reflectionNote && (
                    <Box
                      bg="gray.50"
                      p={3}
                      borderRadius="md"
                      borderLeft="3px solid"
                      borderColor="teal.400"
                    >
                      <Text fontSize="sm" color="gray.700">
                        {task.reflectionNote}
                      </Text>
                    </Box>
                  )}
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
        </VStack>
      )}

      <NavTabs />
    </Box>
  );
}
