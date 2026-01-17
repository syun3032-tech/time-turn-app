"use client";

import { Badge, Box, Button, Card, Flex, Heading, HStack, Text, VStack, IconButton, Dialog, Progress, Switch } from "@chakra-ui/react";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { useState, useRef, useEffect, Suspense } from "react";
import { FiChevronRight, FiChevronDown, FiCalendar } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getTaskTreeAsync, saveTaskTreeAsync } from "@/lib/task-tree-storage";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { saveCompletedTask } from "@/lib/firebase/firestore";
import { TaskNode } from "@/types/task-tree";

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

// 子要素の完了率を計算する関数
function calculateProgress(node: any): number {
  if (!node.children || node.children.length === 0) {
    // 子がない場合は、自身がアーカイブ済みなら100%、そうでなければ0%
    return node.archived ? 100 : 0;
  }

  // 子要素の進捗を再帰的に計算
  const childProgresses = node.children.map((child: any) => calculateProgress(child));
  const totalProgress = childProgresses.reduce((sum: number, p: number) => sum + p, 0);
  return Math.round(totalProgress / node.children.length);
}

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

  // Tempo風: 子要素があるかどうかで表示を切り替え
  const showProgressBar = hasChildren; // 子があれば進捗バー
  const showCheckbox = !hasChildren && !isArchived; // 子がなければチェックボックス
  const progress = hasChildren ? calculateProgress(node) : 0;

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

              {/* 進捗バー（子要素がある場合） */}
              {showProgressBar && (
                <Box w="full">
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="xs" color="gray.500">進捗</Text>
                    <Text fontSize="xs" fontWeight="bold" color={progress === 100 ? "green.500" : "teal.500"}>{progress}%</Text>
                  </HStack>
                  <Progress.Root value={progress} borderRadius="md" size="sm">
                    <Progress.Track bg="gray.200">
                      <Progress.Range bg={progress === 100 ? "green.500" : "teal.500"} />
                    </Progress.Track>
                  </Progress.Root>
                </Box>
              )}

              {/* チェックボックス（子要素がない場合） */}
              {showCheckbox && (
                <HStack gap={2}>
                  <Box
                    as="button"
                    w="24px"
                    h="24px"
                    borderRadius="md"
                    border="2px solid"
                    borderColor="gray.300"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{ borderColor: "green.400", bg: "green.50" }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onCompleteTask(node);
                    }}
                  >
                    {/* 空のチェックボックス */}
                  </Box>
                  <Text fontSize="sm" color="gray.500">未完了</Text>
                </HStack>
              )}

              {isTask && (
                <HStack gap={2} flexWrap="wrap">
                  <Box w="8px" h="8px" borderRadius="full" bg={node.ai ? "pink.400" : "gray.300"} />
                  {node.ai && <Badge size="sm" colorScheme="pink">AI実行可</Badge>}
                </HStack>
              )}

              {!isTask && !showProgressBar && (
                <Flex gap={2} fontSize={{ base: "2xs", md: "xs" }} color="gray.500" flexWrap="wrap">
                  <Text>OKR</Text>
                  <Text>KPI</Text>
                  <Text>Action Map</Text>
                </Flex>
              )}

              {/* Period display */}
              {node.endDate && (
                <HStack gap={1} fontSize={{ base: "2xs", md: "xs" }} color="teal.600">
                  <FiCalendar />
                  <Text>
                    期限: {node.endDate}
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
                  <Text>{node.endDate ? "期限を変更" : "期限を設定"}</Text>
                </HStack>
              </Button>

              {isTask && node.ai && !isArchived && (
                <Link href="/tasks/sample-task-id/run">
                  <Button size="xs" colorScheme="teal" variant="outline" w="full">
                    AI実行へ
                  </Button>
                </Link>
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

function TasksPageContent() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [tree, setTree] = useState<TaskNode[]>(initialTreeBackup as TaskNode[]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodeCounter, setNodeCounter] = useState(20); // Start from 20 since we have 19 tasks
  const [showArchived, setShowArchived] = useState(false);


  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // タスクツリーを読み込み
  useEffect(() => {
    if (!user) return;

    const loadTree = async () => {
      const loadedTree = await getTaskTreeAsync(user.uid);
      setTree(loadedTree);
    };

    loadTree();
  }, [user]);

  // タスクツリーが変更されたら保存
  const saveTreeRef = useRef(tree);
  useEffect(() => {
    // 初回レンダリングはスキップ
    if (tree === saveTreeRef.current) return;
    if (!user) return;

    saveTreeRef.current = tree;
    saveTaskTreeAsync(tree, user.uid);
  }, [tree, user]);

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
    // Convert string date to Date object
    setTempEndDate(node.endDate ? new Date(node.endDate) : null);
    setIsPeriodModalOpen(true);
  };

  const handleSavePeriod = () => {
    if (!selectedNode) return;

    // Convert Date object to string format (YYYY-MM-DD)
    const formatDate = (date: Date | null) => {
      if (!date) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Recursively find and update the node's endDate
    const updateTree = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
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

  const handleCompleteTask = async (node: any) => {
    if (!user) return;

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
        taskId: node.id,
        taskTitle: node.title,
        taskType: getTaskType(node.title),
        completedAt: new Date(),
        aiCapable: node.ai || false
      });

      // ツリーからアーカイブに移動
      const archiveNode = (nodes: any[]): any[] => {
        return nodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              archived: true,
              completedAt: new Date().toISOString()
            };
          } else if (n.children) {
            return {
              ...n,
              children: archiveNode(n.children)
            };
          }
          return n;
        });
      };

      setTree(archiveNode(tree));
      console.log("タスク完了！");
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
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Root>
          </HStack>
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

        {/* Add Goal button - only show when nothing is expanded */}
        {expandedNodes.size === 0 && (
          <Button
            size="sm"
            variant="outline"
            colorScheme="teal"
            w="full"
            onClick={handleAddGoal}
          >
            + Goalを追加
          </Button>
        )}
      </VStack>

      <NavTabs />

      {/* Period Modal */}
      <Dialog.Root open={isPeriodModalOpen} onOpenChange={(e) => setIsPeriodModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="400px">
            <Dialog.Header>
              <Dialog.Title>期限を設定</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
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

    </Box>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<Box px={4} py={6}><Text>読み込み中...</Text></Box>}>
      <TasksPageContent />
    </Suspense>
  );
}
