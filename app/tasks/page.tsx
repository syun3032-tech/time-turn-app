"use client";

import { Badge, Box, Button, Card, Flex, Heading, HStack, Text, VStack, IconButton, Input, Dialog, Progress, Stack, Textarea, Switch } from "@chakra-ui/react";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { useState, useRef, useEffect } from "react";
import { FiChevronRight, FiChevronDown, FiCalendar, FiCheck, FiStar } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getTaskTree, saveTaskTree, generateNodeId } from "@/lib/task-tree-storage";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { saveCompletedTask } from "@/lib/firebase/firestore";

const initialTreeBackup = [
  {
    id: "goal-1",
    title: "Goal: 国立理系に合格する",
    startDate: "2024-04-01",
    endDate: "2025-03-31",
    children: [
      {
        id: "project-1",
        title: "Project: 共通テスト対策",
        startDate: "2024-04-01",
        endDate: "2025-01-15",
        children: [
          {
            id: "milestone-1",
            title: "Milestone: 数学基礎固め",
            children: [
              { id: "task-1", title: "Task: 基礎問題集1-3章", ai: true, status: "未着手" },
              { id: "task-2", title: "Task: 過去問1年分", ai: false, status: "進行中" },
              { id: "task-3", title: "Task: 応用問題集1章", ai: true, status: "未着手" },
            ],
          },
          {
            id: "milestone-2",
            title: "Milestone: 英語長文読解",
            children: [
              { id: "task-4", title: "Task: 速読英単語", ai: false, status: "未着手" },
              { id: "task-5", title: "Task: 長文問題集10題", ai: true, status: "未着手" },
            ],
          },
        ],
      },
      {
        id: "project-2",
        title: "Project: 二次試験対策",
        children: [
          {
            id: "milestone-3",
            title: "Milestone: 物理演習",
            children: [
              { id: "task-6", title: "Task: 力学演習10問", ai: true, status: "未着手" },
              { id: "task-7", title: "Task: 電磁気演習5問", ai: false, status: "未着手" },
            ],
          },
          {
            id: "milestone-4",
            title: "Milestone: 化学演習",
            children: [
              { id: "task-8", title: "Task: 有機化学まとめ", ai: true, status: "進行中" },
              { id: "task-9", title: "Task: 無機化学暗記", ai: false, status: "未着手" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "goal-2",
    title: "Goal: TOEIC 800点突破",
    children: [
      {
        id: "project-3",
        title: "Project: リスニング強化",
        children: [
          {
            id: "milestone-5",
            title: "Milestone: Part1-4対策",
            children: [
              { id: "task-10", title: "Task: 公式問題集Part1", ai: true, status: "未着手" },
              { id: "task-11", title: "Task: 公式問題集Part2", ai: true, status: "未着手" },
              { id: "task-12", title: "Task: シャドーイング練習", ai: false, status: "未着手" },
            ],
          },
        ],
      },
      {
        id: "project-4",
        title: "Project: リーディング強化",
        children: [
          {
            id: "milestone-6",
            title: "Milestone: Part5-7対策",
            children: [
              { id: "task-13", title: "Task: 文法問題100問", ai: true, status: "未着手" },
              { id: "task-14", title: "Task: 長文問題20題", ai: false, status: "未着手" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "goal-3",
    title: "Goal: プログラミングスキル向上",
    children: [
      {
        id: "project-5",
        title: "Project: Web開発マスター",
        children: [
          {
            id: "milestone-7",
            title: "Milestone: React学習",
            children: [
              { id: "task-15", title: "Task: 公式チュートリアル", ai: false, status: "進行中" },
              { id: "task-16", title: "Task: Hooksの理解", ai: true, status: "未着手" },
              { id: "task-17", title: "Task: ミニアプリ作成", ai: true, status: "未着手" },
            ],
          },
          {
            id: "milestone-8",
            title: "Milestone: TypeScript習得",
            children: [
              { id: "task-18", title: "Task: 型システムの学習", ai: true, status: "未着手" },
              { id: "task-19", title: "Task: 実践プロジェクト", ai: false, status: "未着手" },
            ],
          },
        ],
      },
    ],
  },
];

// プロジェクトの進捗データ（マイルストーン）
const projectMilestones = [
  { title: "Project: 共通テスト対策", progress: 60 },
  { title: "Project: 英語基礎", progress: 40 },
];

interface TreeNodeProps {
  node: any;
  level?: number;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onAddChild: (parentId: string, type: string) => void;
  onOpenPeriodModal: (node: any) => void;
  onCompleteTask: (node: any) => void;
  highlightedId?: string | null;
  showArchived: boolean;
}

function TreeNode({ node, level = 0, expandedNodes, onToggle, onAddChild, onOpenPeriodModal, onCompleteTask, highlightedId, showArchived }: TreeNodeProps) {
  const isTask = node.title?.startsWith("Task:");
  const hasChildren = node.children && node.children.length > 0;
  const isArchived = node.archived === true;
  const isExpanded = expandedNodes.has(node.id);
  const isHighlighted = highlightedId === node.id;
  const nodeRef = useRef<HTMLDivElement>(null);

  // Check if any child is expanded
  const hasExpandedChild = hasChildren && node.children.some((child: any) => expandedNodes.has(child.id));

  // Scroll to highlighted node
  useEffect(() => {
    if (isHighlighted && nodeRef.current) {
      setTimeout(() => {
        nodeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [isHighlighted]);

  const handleClick = () => {
    if (hasChildren && !isTask) {
      onToggle(node.id);
      if (!isExpanded) {
        // Scroll to this node after expansion
        setTimeout(() => {
          nodeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  };

  // アーカイブされたタスクを表示しない場合はスキップ
  if (isArchived && !showArchived) {
    return null;
  }

  return (
    <Box>
      <Card.Root
        ref={nodeRef}
        size="sm"
        w="full"
        bg={isHighlighted ? "yellow.100" : isExpanded ? "teal.50" : "white"}
        borderRadius="xl"
        shadow={isHighlighted ? "lg" : "sm"}
        border="2px solid"
        borderColor={isHighlighted ? "yellow.400" : isExpanded ? "teal.300" : "gray.200"}
        transition="all 0.3s"
        mb={2}
        animation={isHighlighted ? "pulse 2s ease-in-out infinite" : undefined}
        _hover={{
          shadow: "md",
          borderColor: isHighlighted ? "yellow.500" : "teal.300",
          cursor: hasChildren && !isTask ? "pointer" : "default",
        }}
        onClick={handleClick}
      >
        <Card.Body p={{ base: 3, md: 4 }}>
          <HStack justify="space-between" align="center">
            <VStack align="stretch" gap={2} flex={1}>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                fontWeight="semibold"
                lineClamp={2}
                color="gray.900"
              >
                {node.title}
              </Text>

              {isTask && (
                <HStack gap={2} flexWrap="wrap">
                  <Box w="8px" h="8px" borderRadius="full" bg={node.ai ? "pink.400" : "gray.300"} />
                  {node.ai && <Badge size="sm" colorScheme="pink">AI実行可</Badge>}
                  <Badge size="sm" colorScheme={node.status === "進行中" ? "blue" : "gray"}>
                    {node.status}
                  </Badge>
                </HStack>
              )}

              {!isTask && (
                <Flex gap={2} fontSize={{ base: "2xs", md: "xs" }} color="gray.500" flexWrap="wrap">
                  <Text>OKR</Text>
                  <Text>KPI</Text>
                  <Text>Action Map</Text>
                </Flex>
              )}

              {/* Period display */}
              {(node.startDate || node.endDate) && (
                <HStack gap={1} fontSize={{ base: "2xs", md: "xs" }} color="teal.600">
                  <FiCalendar />
                  <Text>
                    {node.startDate || "未設定"} 〜 {node.endDate || "未設定"}
                  </Text>
                </HStack>
              )}

              {/* Set period button */}
              <Button
                size="xs"
                variant="ghost"
                colorScheme="teal"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPeriodModal(node);
                }}
              >
                <HStack gap={1}>
                  <FiCalendar />
                  <Text>{node.startDate || node.endDate ? "期間を変更" : "期間を設定"}</Text>
                </HStack>
              </Button>

              {isTask && node.ai && !isArchived && (
                <Link href="/tasks/sample-task-id/run">
                  <Button size="xs" colorScheme="teal" variant="outline" w="full">
                    AI実行へ
                  </Button>
                </Link>
              )}

              {isTask && !isArchived && (
                <Button
                  size="xs"
                  colorScheme="green"
                  w="full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompleteTask(node);
                  }}
                >
                  <FiCheck /> 完了
                </Button>
              )}

              {isArchived && (
                <Badge colorScheme="gray" size="sm">
                  アーカイブ済み
                </Badge>
              )}
            </VStack>

            {hasChildren && !isTask && (
              <IconButton
                aria-label={isExpanded ? "閉じる" : "展開"}
                size="sm"
                variant="ghost"
                colorScheme="teal"
              >
                {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
              </IconButton>
            )}
          </HStack>
        </Card.Body>
      </Card.Root>

      {/* Render children if expanded */}
      {isExpanded && (
        <Box ml={{ base: 3, md: 4 }} pl={{ base: 2, md: 3 }} borderLeft="2px solid" borderColor="gray.200">
          {hasChildren && node.children.map((child: any) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onOpenPeriodModal={onOpenPeriodModal}
              onCompleteTask={onCompleteTask}
              highlightedId={highlightedId}
              showArchived={showArchived}
            />
          ))}

          {/* Add button - only show if no child is expanded */}
          {!isTask && !hasExpandedChild && (
            <Button
              size="sm"
              variant="outline"
              colorScheme="teal"
              w="full"
              mb={2}
              onClick={(e) => {
                e.stopPropagation();
                const childType =
                  node.title.startsWith("Goal:") ? "Project" :
                  node.title.startsWith("Project:") ? "Milestone" :
                  node.title.startsWith("Milestone:") ? "Task" :
                  "Item";
                onAddChild(node.id, childType);
              }}
            >
              + {node.title.startsWith("Goal:") ? "Project" : node.title.startsWith("Project:") ? "Milestone" : "Task"}を追加
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [tree, setTree] = useState(initialTreeBackup);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodeCounter, setNodeCounter] = useState(20); // Start from 20 since we have 19 tasks
  const [showArchived, setShowArchived] = useState(false);

  // 振り返りモーダル
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
  const [completingTask, setCompletingTask] = useState<any>(null);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [reflectionNote, setReflectionNote] = useState("");
  const [achievementRating, setAchievementRating] = useState<number>(3);

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // タスクツリーを読み込み
  useEffect(() => {
    const loadedTree = getTaskTree();
    setTree(loadedTree);
  }, []);

  // タスクツリーが変更されたら保存
  useEffect(() => {
    if (tree !== initialTreeBackup) {
      saveTaskTree(tree);
    }
  }, [tree]);

  // ハイライト対象のノードとその親を自動展開
  useEffect(() => {
    if (highlightId && tree.length > 0) {
      const findParentNodes = (nodes: any[], targetId: string, parents: string[] = []): string[] | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return parents;
          }
          if (node.children) {
            const result = findParentNodes(node.children, targetId, [...parents, node.id]);
            if (result) return result;
          }
        }
        return null;
      };

      const parentIds = findParentNodes(tree, highlightId);
      if (parentIds) {
        setExpandedNodes(new Set(parentIds));
      }
    }
  }, [highlightId, tree]);

  // Period modal state
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);

  const handleToggle = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleAddChild = (parentId: string, type: string) => {
    const title = prompt(`新しい${type}の名前を入力してください:`);
    if (!title) return;

    const newNode: any = {
      id: `${type.toLowerCase()}-${nodeCounter}`,
      title: `${type}: ${title}`,
      children: type === "Task" ? undefined : [],
    };

    if (type === "Task") {
      newNode.ai = false;
      newNode.status = "未着手";
    }

    setNodeCounter(nodeCounter + 1);

    // Recursively find and update the parent node
    const updateTree = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...(node.children || []), newNode],
          };
        } else if (node.children) {
          return {
            ...node,
            children: updateTree(node.children),
          };
        }
        return node;
      });
    };

    setTree(updateTree(tree));

    // Auto-expand the parent node
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      newSet.add(parentId);
      return newSet;
    });
  };

  const handleAddGoal = () => {
    const title = prompt("新しいGoalの名前を入力してください:");
    if (!title) return;

    const newGoal = {
      id: `goal-${nodeCounter}`,
      title: `Goal: ${title}`,
      children: [],
    };

    setNodeCounter(nodeCounter + 1);
    setTree([...tree, newGoal]);
  };

  const handleOpenPeriodModal = (node: any) => {
    setSelectedNode(node);
    // Convert string dates to Date objects
    setTempStartDate(node.startDate ? new Date(node.startDate) : null);
    setTempEndDate(node.endDate ? new Date(node.endDate) : null);
    setIsPeriodModalOpen(true);
  };

  const handleSavePeriod = () => {
    if (!selectedNode) return;

    // Convert Date objects to string format (YYYY-MM-DD)
    const formatDate = (date: Date | null) => {
      if (!date) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Recursively find and update the node's period
    const updateTree = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            startDate: formatDate(tempStartDate),
            endDate: formatDate(tempEndDate),
          };
        } else if (node.children) {
          return {
            ...node,
            children: updateTree(node.children),
          };
        }
        return node;
      });
    };

    setTree(updateTree(tree));
    setIsPeriodModalOpen(false);
    setSelectedNode(null);
  };

  const handleCompleteTask = (node: any) => {
    setCompletingTask(node);
    setTimeSpent(0);
    setReflectionNote("");
    setAchievementRating(3);
    setIsReflectionModalOpen(true);
  };

  const handleSaveCompletion = async () => {
    if (!user || !completingTask) return;

    try {
      // タスクタイプを取得
      const getTaskType = (title: string): 'Goal' | 'Project' | 'Milestone' | 'Task' => {
        if (title.startsWith('Goal:')) return 'Goal';
        if (title.startsWith('Project:')) return 'Project';
        if (title.startsWith('Milestone:')) return 'Milestone';
        return 'Task';
      };

      // Firestoreに保存
      await saveCompletedTask(user.uid, {
        taskId: completingTask.id,
        taskTitle: completingTask.title,
        taskType: getTaskType(completingTask.title),
        completedAt: new Date(),
        timeSpent: timeSpent || undefined,
        reflectionNote: reflectionNote || undefined,
        achievementRating: achievementRating,
        aiCapable: completingTask.ai || false
      });

      // ツリーからアーカイブに移動
      const archiveNode = (nodes: any[]): any[] => {
        return nodes.map((node) => {
          if (node.id === completingTask.id) {
            return {
              ...node,
              archived: true,
              completedAt: new Date().toISOString()
            };
          } else if (node.children) {
            return {
              ...node,
              children: archiveNode(node.children)
            };
          }
          return node;
        });
      };

      setTree(archiveNode(tree));
      setIsReflectionModalOpen(false);
      setCompletingTask(null);

      console.log("タスク完了！ログに記録しました");
    } catch (error) {
      console.error("Failed to complete task:", error);
      alert("タスクの完了処理に失敗しました");
    }
  };

  // ローディング中またはユーザーがいない場合は何も表示しない
  if (loading || !user) {
    return null;
  }

  return (
    <Box px={{ base: 2, md: 4 }} py={{ base: 4, md: 6 }} bg="gray.50" minH="100vh" pb="80px">
      <Flex
        justify="space-between"
        align="center"
        mb={{ base: 4, md: 6 }}
        flexWrap="wrap"
        gap={2}
      >
        <Heading size={{ base: "sm", md: "md" }}>タスクツリー</Heading>
        <HStack gap={2} flexWrap="wrap">
          <HStack>
            <Text fontSize="sm">完了済みを表示</Text>
            <Switch.Root checked={showArchived} onCheckedChange={(e) => setShowArchived(e.checked)}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Root>
          </HStack>
          <Badge colorScheme="purple" fontSize={{ base: "2xs", md: "xs" }}>AI実行ラベル</Badge>
        </HStack>
      </Flex>

      <VStack align="stretch" gap={2}>
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            expandedNodes={expandedNodes}
            onToggle={handleToggle}
            onAddChild={handleAddChild}
            onOpenPeriodModal={handleOpenPeriodModal}
            onCompleteTask={handleCompleteTask}
            highlightedId={highlightId}
            showArchived={showArchived}
          />
        ))}

        {/* Add Goal button */}
        <Button
          size="sm"
          variant="outline"
          colorScheme="teal"
          w="full"
          onClick={handleAddGoal}
        >
          + Goalを追加
        </Button>
      </VStack>

      {/* 道のりバー / マイルストーン */}
      <Card.Root mt={6} mb={4}>
        <Card.Header>
          <Heading size="sm">道のりバー / マイルストーン</Heading>
        </Card.Header>
        <Card.Body>
          <Stack gap={3}>
            {projectMilestones.map((m) => (
              <Box key={m.title}>
                <Flex justify="space-between" mb={1}>
                  <Text fontWeight="semibold" fontSize="sm">{m.title}</Text>
                  <Text fontSize="sm" color="gray.600">{m.progress}%</Text>
                </Flex>
                <Progress.Root value={m.progress} borderRadius="md" size="sm">
                  <Progress.Track bg="gray.100">
                    <Progress.Range bg="teal.500" />
                  </Progress.Track>
                </Progress.Root>
              </Box>
            ))}
          </Stack>
        </Card.Body>
      </Card.Root>

      <NavTabs />

      {/* Period Modal */}
      <Dialog.Root open={isPeriodModalOpen} onOpenChange={(e) => setIsPeriodModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="400px">
            <Dialog.Header>
              <Dialog.Title>期間を設定</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>開始日</Text>
                  <DatePicker
                    selected={tempStartDate}
                    onChange={(date) => setTempStartDate(date)}
                    dateFormat="yyyy/MM/dd"
                    inline
                    locale="ja"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>終了日</Text>
                  <DatePicker
                    selected={tempEndDate}
                    onChange={(date) => setTempEndDate(date)}
                    dateFormat="yyyy/MM/dd"
                    inline
                    locale="ja"
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack w="full" justify="flex-end" gap={2}>
                <Button variant="outline" onClick={() => setIsPeriodModalOpen(false)}>
                  キャンセル
                </Button>
                <Button colorScheme="teal" onClick={handleSavePeriod}>
                  保存
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Reflection Modal */}
      <Dialog.Root open={isReflectionModalOpen} onOpenChange={(e) => setIsReflectionModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header>
              <Dialog.Title>タスク完了の振り返り</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>タスク名</Text>
                  <Text fontSize="sm" color="gray.600">{completingTask?.title}</Text>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>かかった時間（分）</Text>
                  <Input
                    type="number"
                    value={timeSpent}
                    onChange={(e) => setTimeSpent(Number(e.target.value))}
                    placeholder="例: 30"
                  />
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>振り返りメモ</Text>
                  <Textarea
                    value={reflectionNote}
                    onChange={(e) => setReflectionNote(e.target.value)}
                    placeholder="どうだったか、学んだことなど..."
                    rows={4}
                  />
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>達成感レーティング</Text>
                  <HStack justify="center" gap={2}>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <IconButton
                        key={rating}
                        aria-label={`${rating}つ星`}
                        size="lg"
                        variant="ghost"
                        color={achievementRating >= rating ? "yellow.400" : "gray.300"}
                        onClick={() => setAchievementRating(rating)}
                      >
                        <FiStar fill={achievementRating >= rating ? "currentColor" : "none"} />
                      </IconButton>
                    ))}
                  </HStack>
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack w="full" justify="flex-end" gap={2}>
                <Button variant="outline" onClick={() => setIsReflectionModalOpen(false)}>
                  キャンセル
                </Button>
                <Button colorScheme="green" onClick={handleSaveCompletion}>
                  完了して記録
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}
