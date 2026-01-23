"use client";

import { Badge, Box, Button, Card, Flex, Heading, HStack, Text, VStack, Dialog, Progress, Switch, Input, Textarea } from "@chakra-ui/react";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { useState, useRef, useEffect, Suspense } from "react";
import { FiCalendar } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getTaskTreeAsync, saveTaskTreeAsync } from "@/lib/task-tree-storage";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { saveCompletedTask, deleteCompletedTaskByTaskId } from "@/lib/firebase/firestore";
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
  onDelete: (nodeId: string) => void;
  onUpdateMemo: (nodeId: string, memo: string) => void;
  onRestoreTask: (nodeId: string) => void;
  highlightedId?: string | null;
  showArchived: boolean;
}

function TreeNode({ node, level = 0, expandedNodes, onToggle, onAddChild, onOpenPeriodModal, onCompleteTask, onDelete, onUpdateMemo, onRestoreTask, highlightedId, showArchived }: TreeNodeProps) {
  // typeフィールドまたはタイトルプレフィックスで判定（両方の形式をサポート）
  const isTask = node.type === "Task" || node.title?.startsWith("Task:");
  const isGoal = node.type === "Goal" || node.title?.startsWith("Goal:");
  const isProject = node.type === "Project" || node.title?.startsWith("Project:");
  const isMilestone = node.type === "Milestone" || node.title?.startsWith("Milestone:");
  const canHaveChildren = isGoal || isProject || isMilestone; // Task以外は子を持てる
  const hasChildren = node.children && node.children.length > 0;
  const isArchived = node.archived === true;
  const isExpanded = expandedNodes.has(node.id);
  const isHighlighted = highlightedId === node.id;
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState(node.memo || "");

  // Tempo風: 子要素があるかどうかで表示を切り替え
  const showProgressBar = hasChildren; // 子があれば進捗バー
  const showCheckbox = !hasChildren && !isArchived; // 子がなければチェックボックス表示
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
    // 子を持てるノード（Goal, Project, Milestone）はクリックで展開/折りたたみ
    if (canHaveChildren) {
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
          cursor: canHaveChildren ? "pointer" : "default",
        }}
        onClick={handleClick}
      >
        <Card.Body p={{ base: 3, md: 4 }}>
          <HStack justify="space-between" align="flex-start">
            <VStack align="stretch" gap={2} flex={1}>
              <HStack justify="space-between" align="flex-start">
                <Text
                  fontSize={{ base: "sm", md: "md" }}
                  fontWeight="semibold"
                  lineClamp={2}
                  color="gray.900"
                  flex={1}
                >
                  {node.title}
                </Text>
                <HStack gap={1}>
                  {isArchived && (
                    <Button
                      size="xs"
                      variant="outline"
                      colorScheme="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreTask(node.id);
                      }}
                    >
                      未完了に戻す
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`「${node.title}」を削除しますか？`)) {
                        onDelete(node.id);
                      }
                    }}
                  >
                    削除
                  </Button>
                </HStack>
              </HStack>

              {/* 進捗バー（子要素がある場合） */}
              {showProgressBar && (
                <Box w="full">
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="xs" color="gray.700">進捗</Text>
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
                  <Text fontSize="sm" color="gray.700">未完了</Text>
                </HStack>
              )}

              {isTask && (
                <HStack gap={2} flexWrap="wrap">
                  <Box w="8px" h="8px" borderRadius="full" bg={node.ai ? "pink.400" : "gray.300"} />
                  {node.ai && <Badge size="sm" colorScheme="pink">AI実行可</Badge>}
                </HStack>
              )}

              {!isTask && !showProgressBar && (
                <Flex gap={2} fontSize={{ base: "2xs", md: "xs" }} color="gray.700" flexWrap="wrap">
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

              {/* メモエリア（横展開） */}
              <HStack w="full" gap={2} align="flex-start" flexWrap="wrap">
                {/* メモボタンと入力欄 */}
                <HStack flex={1} gap={2} align="center" minW="200px">
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMemoOpen(!isMemoOpen);
                    }}
                  >
                    <Text>メモ {isMemoOpen ? "▲" : "▼"}</Text>
                  </Button>

                  {/* メモ入力欄（横展開） */}
                  {isMemoOpen && (
                    <HStack flex={1} gap={1}>
                      <Input
                        placeholder="メモを入力..."
                        value={memoText}
                        onChange={(e) => setMemoText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        size="xs"
                      />
                      <Button
                        size="xs"
                        colorScheme="teal"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateMemo(node.id, memoText);
                          setIsMemoOpen(false);
                        }}
                      >
                        保存
                      </Button>
                    </HStack>
                  )}

                  {/* メモ表示（閉じている時） */}
                  {!isMemoOpen && node.memo && (
                    <Text fontSize="xs" color="gray.700" flex={1}>
                      {node.memo}
                    </Text>
                  )}
                </HStack>

                {/* 期限ボタン（右寄せ） */}
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
              </HStack>

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
              onDelete={onDelete}
              onUpdateMemo={onUpdateMemo}
              onRestoreTask={onRestoreTask}
              highlightedId={highlightedId}
              showArchived={showArchived}
            />
          ))}

          {/* Add button - only show if no child is expanded */}
          {canHaveChildren && !hasExpandedChild && (
            <Button
              size="sm"
              variant="outline"
              colorScheme="teal"
              w="full"
              mb={2}
              onClick={(e) => {
                e.stopPropagation();
                const childType =
                  isGoal ? "Project" :
                  isProject ? "Milestone" :
                  isMilestone ? "Task" :
                  "Item";
                onAddChild(node.id, childType);
              }}
            >
              + {isGoal ? "Project" : isProject ? "Milestone" : "Task"}を追加
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

  const [tree, setTree] = useState<TaskNode[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  // Goal追加モーダル用state
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalEndDate, setNewGoalEndDate] = useState<Date | null>(null);

  // 振り返りメモモーダル用state
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");
  const [completingNode, setCompletingNode] = useState<any>(null);

  // 子要素追加モーダル用state
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);
  const [addChildParentId, setAddChildParentId] = useState<string>("");
  const [addChildType, setAddChildType] = useState<string>("");
  const [newChildTitle, setNewChildTitle] = useState("");


  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // タスクツリーを読み込み
  useEffect(() => {
    if (!user) {
      setTree([]);
      setIsTreeLoading(false);
      return;
    }

    const loadTree = async () => {
      setIsTreeLoading(true);
      setTree([]); // ユーザー切り替え時に前のデータをクリア
      const loadedTree = await getTaskTreeAsync(user.uid);
      setTree(loadedTree);
      setIsTreeLoading(false);
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
    setAddChildParentId(parentId);
    setAddChildType(type);
    setNewChildTitle("");
    setIsAddChildModalOpen(true);
  };

  const handleSaveNewChild = () => {
    if (!newChildTitle.trim() || !addChildParentId) return;

    const newNode: any = {
      id: `${addChildType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: `${addChildType}: ${newChildTitle.trim()}`,
      children: addChildType === "Task" ? undefined : [],
    };

    if (addChildType === "Task") {
      newNode.ai = false;
      newNode.status = "未着手";
    }

    // Recursively find and update the parent node
    const updateTree = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === addChildParentId) {
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
      newSet.add(addChildParentId);
      return newSet;
    });

    setIsAddChildModalOpen(false);
  };

  const handleAddGoal = () => {
    setNewGoalTitle("");
    setNewGoalEndDate(null);
    setIsAddGoalModalOpen(true);
  };

  const handleSaveNewGoal = () => {
    if (!newGoalTitle) return;

    const formatDate = (date: Date | null) => {
      if (!date) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const newGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: `Goal: ${newGoalTitle}`,
      children: [],
      endDate: formatDate(newGoalEndDate),
    };
    setTree([...tree, newGoal]);
    setIsAddGoalModalOpen(false);
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
    // モーダルを開いて振り返りメモを入力
    setCompletingNode(node);
    setReflectionNote("");
    setIsReflectionModalOpen(true);
  };

  const handleConfirmComplete = async (withNote: boolean) => {
    if (!user || !completingNode) return;

    try {
      // タスクタイプを取得
      const getTaskType = (title: string): 'Goal' | 'Project' | 'Milestone' | 'Task' => {
        if (title.startsWith('Goal:')) return 'Goal';
        if (title.startsWith('Project:')) return 'Project';
        if (title.startsWith('Milestone:')) return 'Milestone';
        return 'Task';
      };

      // Firestoreに保存（振り返りメモ付き）
      const completedTaskData: any = {
        taskId: completingNode.id,
        taskTitle: completingNode.title,
        taskType: getTaskType(completingNode.title),
        completedAt: new Date(),
        aiCapable: completingNode.ai || false,
      };
      if (withNote && reflectionNote.trim()) {
        completedTaskData.reflectionNote = reflectionNote.trim();
      }
      await saveCompletedTask(user.uid, completedTaskData);

      // ツリーからアーカイブに移動
      const archiveNode = (nodes: any[]): any[] => {
        return nodes.map((n) => {
          if (n.id === completingNode.id) {
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
      setIsReflectionModalOpen(false);
      setCompletingNode(null);
      setReflectionNote("");
      console.log("タスク完了！");
    } catch (error) {
      console.error("Failed to complete task:", error);
      alert("タスクの完了処理に失敗しました");
    }
  };

  const handleDelete = (nodeId: string) => {
    const deleteFromTree = (nodes: any[]): any[] => {
      return nodes.filter((n) => {
        if (n.id === nodeId) return false;
        if (n.children) {
          n.children = deleteFromTree(n.children);
        }
        return true;
      });
    };
    setTree(deleteFromTree(tree));
  };

  const handleUpdateMemo = (nodeId: string, memo: string) => {
    const updateTree = (nodes: any[]): any[] => {
      return nodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, memo };
        }
        if (n.children) {
          return { ...n, children: updateTree(n.children) };
        }
        return n;
      });
    };
    setTree(updateTree(tree));
  };

  const handleRestoreTask = async (nodeId: string) => {
    if (!user) return;

    try {
      // Firestoreから完了タスクを削除
      await deleteCompletedTaskByTaskId(user.uid, nodeId);

      // ツリーからarchivedフラグを削除
      const restoreNode = (nodes: any[]): any[] => {
        return nodes.map((n) => {
          if (n.id === nodeId) {
            // archivedフラグを削除して未完了に戻す
            const { archived, completedAt, ...rest } = n;
            return rest;
          }
          if (n.children) {
            return { ...n, children: restoreNode(n.children) };
          }
          return n;
        });
      };
      setTree(restoreNode(tree));
    } catch (error) {
      console.error("Failed to restore task:", error);
      alert("タスクの復元に失敗しました");
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
        <Heading size={{ base: "sm", md: "md" }} color="gray.800">タスクツリー</Heading>
        <HStack gap={2} flexWrap="wrap">
          <HStack>
            <Text fontSize="sm" color="gray.800">完了済みを表示</Text>
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
        {isTreeLoading ? (
          <Text color="gray.500" textAlign="center" py={8}>読み込み中...</Text>
        ) : (
          <>
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                expandedNodes={expandedNodes}
                onToggle={handleToggle}
                onAddChild={handleAddChild}
                onOpenPeriodModal={handleOpenPeriodModal}
                onCompleteTask={handleCompleteTask}
                onDelete={handleDelete}
                onUpdateMemo={handleUpdateMemo}
                onRestoreTask={handleRestoreTask}
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
          </>
        )}
      </VStack>

      <NavTabs />

      {/* Period Modal */}
      <Dialog.Root open={isPeriodModalOpen} onOpenChange={(e) => setIsPeriodModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW="400px" mx={4}>
            <Dialog.Header>
              <Dialog.Title color="gray.800">期限を設定</Dialog.Title>
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

      {/* Goal追加モーダル */}
      <Dialog.Root open={isAddGoalModalOpen} onOpenChange={(e) => setIsAddGoalModalOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW="400px" mx={4}>
            <Dialog.Header>
              <Dialog.Title color="gray.800">新しいGoalを追加</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.800">Goal名</Text>
                  <Input
                    placeholder="Goal名を入力..."
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    color="gray.800"
                    _placeholder={{ color: "gray.500" }}
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.800">終了日（任意）</Text>
                  <DatePicker
                    selected={newGoalEndDate}
                    onChange={(date) => setNewGoalEndDate(date)}
                    dateFormat="yyyy/MM/dd"
                    inline
                                      />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack w="full" justify="flex-end" gap={2}>
                <Button variant="outline" onClick={() => setIsAddGoalModalOpen(false)}>
                  キャンセル
                </Button>
                <Button colorScheme="teal" onClick={handleSaveNewGoal} disabled={!newGoalTitle}>
                  追加
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* 振り返りメモモーダル */}
      <Dialog.Root open={isReflectionModalOpen} onOpenChange={(e) => {
        if (!e.open) {
          setIsReflectionModalOpen(false);
          setCompletingNode(null);
          setReflectionNote("");
        }
      }}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW="400px" mx={4}>
            <Dialog.Header>
              <Dialog.Title color="black" fontWeight="bold">タスク完了！</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Text fontSize="md" color="gray.800">
                  おめでとうございます！
                </Text>
                <Text fontSize="sm" color="gray.700">
                  振り返りメモを書いてみませんか？（任意）
                </Text>
                <Textarea
                  placeholder="学んだこと、次に活かしたいこと..."
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  rows={4}
                  color="gray.800"
                  _placeholder={{ color: "gray.500" }}
                />
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <VStack w="full" gap={2}>
                <Button
                  colorScheme="teal"
                  w="full"
                  onClick={() => handleConfirmComplete(true)}
                  disabled={!reflectionNote.trim()}
                >
                  メモを保存して完了
                </Button>
                <Button
                  variant="ghost"
                  w="full"
                  onClick={() => handleConfirmComplete(false)}
                >
                  スキップして完了
                </Button>
              </VStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* 子要素追加モーダル */}
      <Dialog.Root open={isAddChildModalOpen} onOpenChange={(e) => {
        if (!e.open) {
          setIsAddChildModalOpen(false);
          setNewChildTitle("");
        }
      }}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW="400px" mx={4}>
            <Dialog.Header>
              <Dialog.Title color="gray.800">新しい{addChildType}を追加</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.800">{addChildType}名</Text>
                  <Input
                    placeholder={`${addChildType}名を入力...`}
                    value={newChildTitle}
                    onChange={(e) => setNewChildTitle(e.target.value)}
                    color="gray.800"
                    _placeholder={{ color: "gray.500" }}
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack w="full" justify="flex-end" gap={2}>
                <Button variant="outline" onClick={() => setIsAddChildModalOpen(false)}>
                  キャンセル
                </Button>
                <Button colorScheme="teal" onClick={handleSaveNewChild} disabled={!newChildTitle.trim()}>
                  追加
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
