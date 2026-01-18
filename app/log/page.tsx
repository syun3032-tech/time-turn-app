"use client";

import { Badge, Box, Card, Flex, Heading, HStack, Text, VStack, Progress, Dialog, Button, IconButton, SimpleGrid } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheckCircle, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { getCompletedTasks } from "@/lib/firebase/firestore";
import { getTaskTreeAsync } from "@/lib/task-tree-storage";
import type { CompletedTask } from "@/lib/firebase/firestore-types";

// 進捗計算関数
function calculateProgress(node: any): number {
  if (!node.children || node.children.length === 0) {
    return node.archived ? 100 : 0;
  }
  const childProgresses = node.children.map((child: any) => calculateProgress(child));
  const totalProgress = childProgresses.reduce((sum: number, p: number) => sum + p, 0);
  return Math.round(totalProgress / node.children.length);
}

// 連続ログイン日数を計算（タスク完了日ベース）
function calculateStreak(tasks: CompletedTask[]): number {
  if (tasks.length === 0) return 0;

  // 完了日をユニークな日付に変換してソート
  const uniqueDates = [...new Set(
    tasks.map(task => {
      const date = new Date(task.completedAt);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    })
  )].sort().reverse(); // 新しい順

  if (uniqueDates.length === 0) return 0;

  // 今日の日付
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // 昨日の日付
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  // 最新の完了日が今日か昨日でなければストリークは0
  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }

  // 連続日数をカウント
  let streak = 1;
  let currentDate = new Date(today);

  // 今日に完了がない場合は昨日から開始
  if (uniqueDates[0] !== todayStr) {
    currentDate = yesterday;
  }

  for (let i = 1; i < 365; i++) {
    currentDate.setDate(currentDate.getDate() - 1);
    const checkStr = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;

    if (uniqueDates.includes(checkStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// 完了日のSetを取得
function getCompletedDatesSet(tasks: CompletedTask[]): Set<string> {
  return new Set(
    tasks.map(task => {
      const date = new Date(task.completedAt);
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    })
  );
}

// カレンダーコンポーネント
function StreakCalendar({ tasks, currentMonth, onPrevMonth, onNextMonth }: {
  tasks: CompletedTask[];
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const completedDates = getCompletedDatesSet(tasks);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // 月の最初の日と最後の日
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // カレンダーの日付配列を生成
  const calendarDays: (number | null)[] = [];

  // 月初めの空白
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // 日付を追加
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // 日付が完了日かチェック
  const isCompleted = (day: number) => {
    const dateStr = `${year}-${month + 1}-${day}`;
    return completedDates.has(dateStr);
  };

  // 前日も完了日かチェック（連続表示用）
  const isPrevDayCompleted = (day: number) => {
    if (day === 1) return false;
    return isCompleted(day - 1);
  };

  // 翌日も完了日かチェック（連続表示用）
  const isNextDayCompleted = (day: number) => {
    if (day === daysInMonth) return false;
    return isCompleted(day + 1);
  };

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  // 3ヶ月前より古い月には戻れないようにする
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
  const canGoPrev = currentMonth > new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1);

  // 今月より先には進めないようにする
  const today = new Date();
  const canGoNext = currentMonth < new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <Box>
      {/* ヘッダー：年月と矢印 */}
      <HStack justify="space-between" mb={4}>
        <IconButton
          aria-label="前の月"
          size="sm"
          variant="ghost"
          onClick={onPrevMonth}
          disabled={!canGoPrev}
        >
          <FiChevronLeft />
        </IconButton>
        <Text fontSize="lg" fontWeight="bold">
          {year}年{month + 1}月
        </Text>
        <IconButton
          aria-label="次の月"
          size="sm"
          variant="ghost"
          onClick={onNextMonth}
          disabled={!canGoNext}
        >
          <FiChevronRight />
        </IconButton>
      </HStack>

      {/* 曜日ヘッダー */}
      <SimpleGrid columns={7} gap={1} mb={2}>
        {dayNames.map((name, i) => (
          <Box key={name} textAlign="center">
            <Text fontSize="xs" color={i === 0 ? "red.400" : i === 6 ? "blue.400" : "gray.500"}>
              {name}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* カレンダー本体 */}
      <SimpleGrid columns={7} gap={1}>
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <Box key={`empty-${index}`} h="40px" />;
          }

          const completed = isCompleted(day);
          const prevCompleted = isPrevDayCompleted(day);
          const nextCompleted = isNextDayCompleted(day);
          const dayOfWeek = (startDayOfWeek + day - 1) % 7;

          // 連続している場合の背景バー
          const showLeftBar = completed && prevCompleted && dayOfWeek !== 0;
          const showRightBar = completed && nextCompleted && dayOfWeek !== 6;

          return (
            <Box
              key={day}
              h="40px"
              position="relative"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {/* 連続バー（左） */}
              {showLeftBar && (
                <Box
                  position="absolute"
                  left={0}
                  top="50%"
                  transform="translateY(-50%)"
                  w="50%"
                  h="32px"
                  bg="orange.200"
                  zIndex={0}
                />
              )}
              {/* 連続バー（右） */}
              {showRightBar && (
                <Box
                  position="absolute"
                  right={0}
                  top="50%"
                  transform="translateY(-50%)"
                  w="50%"
                  h="32px"
                  bg="orange.200"
                  zIndex={0}
                />
              )}
              {/* 日付の円 */}
              <Box
                w="32px"
                h="32px"
                borderRadius="full"
                bg={completed ? "orange.400" : "transparent"}
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={1}
              >
                <Text
                  fontSize="sm"
                  fontWeight={completed ? "bold" : "normal"}
                  color={completed ? "white" : "gray.700"}
                >
                  {day}
                </Text>
              </Box>
            </Box>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}

export default function LogPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // カレンダーモーダル
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const handlePrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 完了タスクとゴールを読み込み
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        const tasks = await getCompletedTasks(user.uid, 50);
        setCompletedTasks(tasks);

        // タスクツリーからゴールを取得
        const tree = await getTaskTreeAsync(user.uid);
        setGoals(tree);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadData();
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
  const streak = calculateStreak(completedTasks);

  return (
    <Box px={{ base: 2, md: 4 }} py={{ base: 4, md: 6 }} bg="gray.50" minH="100vh" pb="80px">
      <Flex justify="space-between" align="center" mb={{ base: 4, md: 6 }} flexWrap="wrap" gap={2}>
        <Heading size={{ base: "sm", md: "md" }} color="gray.800">実績ログ</Heading>
        <Badge colorScheme="green" fontSize={{ base: "2xs", md: "xs" }}>
          {totalTasks}個完了
        </Badge>
      </Flex>

      {/* 統計サマリー */}
      <Card.Root mb={4}>
        <Card.Body>
          <HStack justify="center" gap={8} mb={4}>
            <VStack>
              <Text fontSize="3xl" fontWeight="bold" color="teal.500">{totalTasks}</Text>
              <Text fontSize="sm" color="gray.600">完了タスク</Text>
            </VStack>
            <VStack
              cursor="pointer"
              onClick={() => {
                setCalendarMonth(new Date());
                setIsCalendarOpen(true);
              }}
              _hover={{ opacity: 0.8 }}
              transition="opacity 0.2s"
            >
              <Text fontSize="3xl" fontWeight="bold" color="orange.500">{streak}</Text>
              <Text fontSize="sm" color="gray.600">連続日数 🔥</Text>
            </VStack>
          </HStack>

          {/* ゴール進捗 */}
          {goals.length > 0 && (
            <VStack align="stretch" gap={3}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700">ゴール進捗</Text>
              {goals.map((goal) => {
                const progress = calculateProgress(goal);
                const title = goal.title.replace('Goal: ', '');
                return (
                  <Box key={goal.id}>
                    <Flex justify="space-between" mb={1}>
                      <Text fontSize="sm" color="gray.700" lineClamp={1}>{title}</Text>
                      <Text fontSize="sm" fontWeight="bold" color={progress === 100 ? "green.500" : "teal.500"}>
                        {progress}%
                      </Text>
                    </Flex>
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

      {/* タイムライン */}
      <Heading size="sm" mb={4} color="gray.800">タイムライン</Heading>

      {isLoading ? (
        <Text color="gray.600" textAlign="center" py={8}>読み込み中...</Text>
      ) : completedTasks.length === 0 ? (
        <Card.Root>
          <Card.Body>
            <VStack py={8} gap={2}>
              <FiCheckCircle size={48} color="gray" />
              <Text color="gray.600">まだ完了したタスクがありません</Text>
              <Text fontSize="sm" color="gray.600">タスクを完了すると、ここに表示されます</Text>
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

                  </Flex>

                  {/* 完了日時 */}
                  <HStack gap={1} fontSize={{ base: "xs", md: "sm" }} color="gray.600">
                    <FiCheckCircle />
                    <Text>{formatDate(task.completedAt)} {formatTime(task.completedAt)}</Text>
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

      {/* カレンダーモーダル */}
      <Dialog.Root open={isCalendarOpen} onOpenChange={(e) => setIsCalendarOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW={{ base: "95vw", md: "400px" }} mx={4}>
            <Dialog.Header>
              <Flex justify="space-between" align="center" w="full">
                <Dialog.Title color="gray.800">アクティビティ</Dialog.Title>
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="teal"
                  onClick={() => setIsCalendarOpen(false)}
                >
                  戻る
                </Button>
              </Flex>
            </Dialog.Header>
            <Dialog.Body pb={6}>
              <StreakCalendar
                tasks={completedTasks}
                currentMonth={calendarMonth}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
              />
              <Box mt={4} p={3} bg="orange.50" borderRadius="md">
                <HStack gap={2}>
                  <Box w="12px" h="12px" borderRadius="full" bg="orange.400" />
                  <Text fontSize="sm" color="gray.600">タスクを完了した日</Text>
                </HStack>
              </Box>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}
