"use client";

import { Badge, Box, Button, Card, Flex, Heading, HStack, Text, VStack, Dialog, Progress, Switch, Input, Textarea } from "@chakra-ui/react";
import { NavTabs } from "@/components/NavTabs";
import { MiniCharacter } from "@/components/MiniCharacter";
import { useState, useRef, useEffect, Suspense } from "react";
import { FiCalendar, FiX } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getTaskTreeAsync, saveTaskTreeAsync } from "@/lib/task-tree-storage";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { saveCompletedTask, deleteCompletedTaskByTaskId } from "@/lib/firebase/firestore";
import { TaskNode, ChecklistItem } from "@/types/task-tree";
import { ConfirmModal } from "@/components/ConfirmModal";

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
    if (node.archived) return 100;
    // サブタスクがある場合はその完了率を返す
    if (node.checklist && node.checklist.length > 0) {
      const done = node.checklist.filter((item: any) => item.done).length;
      return Math.round((done / node.checklist.length) * 100);
    }
    return 0;
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
  onOpenDetail: (node: any, section?: "all" | "subtask") => void;
  onCompleteTask: (node: any) => void;
  onDelete: (nodeId: string) => void;
  onUpdateMemo: (nodeId: string, memo: string) => void;
  onUpdateChecklist: (nodeId: string, checklist: ChecklistItem[]) => void;
  onRestoreTask: (nodeId: string) => void;
  highlightedId?: string | null;
  showArchived: boolean;
}

function ChecklistSection({ checklist, isArchived, onUpdate }: { checklist: ChecklistItem[]; isArchived: boolean; onUpdate: (newChecklist: ChecklistItem[]) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const handleToggleItem = (itemId: string) => {
    if (isArchived) return;
    onUpdate(checklist.map(item => item.id === itemId ? { ...item, done: !item.done } : item));
  };

  const handleDeleteItem = (itemId: string) => {
    if (isArchived) return;
    onUpdate(checklist.filter(item => item.id !== itemId));
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: newItemText.trim(),
      done: false,
    };
    onUpdate([...checklist, newItem]);
    setNewItemText("");
    setIsAdding(false);
  };

  const handleStartEdit = (item: ChecklistItem) => {
    if (isArchived) return;
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    if (!editingText.trim()) {
      // 空なら削除
      onUpdate(checklist.filter(item => item.id !== editingId));
    } else {
      onUpdate(checklist.map(item => item.id === editingId ? { ...item, text: editingText.trim() } : item));
    }
    setEditingId(null);
    setEditingText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const doneCount = checklist.filter(item => item.done).length;

  if (checklist.length === 0 && !isAdding) {
    return (
      <Button
        size="xs"
        variant="ghost"
        colorScheme="teal"
        onClick={(e) => {
          e.stopPropagation();
          setIsAdding(true);
        }}
      >
        + サブタスクを追加
      </Button>
    );
  }

  return (
    <Box bg="gray.50" borderRadius="lg" p={2} onClick={(e) => e.stopPropagation()}>
      {checklist.length > 0 && (
        <Text fontSize="2xs" color="gray.500" mb={1}>{doneCount}/{checklist.length} 完了</Text>
      )}
      <VStack align="stretch" gap={1}>
        {checklist.map((item) => (
          <HStack key={item.id} gap={2} px={1} py={0.5} borderRadius="sm">
            <Box
              as="button"
              w="18px"
              h="18px"
              minW="18px"
              borderRadius="sm"
              border="2px solid"
              borderColor={item.done ? "teal.500" : "gray.300"}
              bg={item.done ? "teal.500" : "transparent"}
              display="flex"
              alignItems="center"
              justifyContent="center"
              onClick={() => handleToggleItem(item.id)}
              cursor={isArchived ? "default" : "pointer"}
            >
              {item.done && (
                <Text fontSize="10px" color="white" fontWeight="bold">✓</Text>
              )}
            </Box>
            {editingId === item.id ? (
              <Input
                size="xs"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
                onBlur={handleSaveEdit}
                autoFocus
                flex={1}
                color="gray.800"
                _placeholder={{ color: "gray.400" }}
              />
            ) : (
              <Text
                fontSize="xs"
                color={item.done ? "gray.400" : "gray.700"}
                textDecoration={item.done ? "line-through" : "none"}
                flex={1}
                cursor={isArchived ? "default" : "pointer"}
                onClick={() => handleStartEdit(item)}
              >
                {item.text}
              </Text>
            )}
            {!isArchived && editingId !== item.id && (
              <Box
                as="button"
                onClick={() => handleDeleteItem(item.id)}
                color="gray.400"
                _hover={{ color: "red.400" }}
                cursor="pointer"
                flexShrink={0}
              >
                <FiX size={14} />
              </Box>
            )}
          </HStack>
        ))}
      </VStack>
      {!isArchived && (
        isAdding ? (
          <HStack mt={1} gap={1}>
            <Input
              size="xs"
              placeholder="項目を入力..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleAddItem();
                }
                if (e.key === "Escape") {
                  setNewItemText("");
                  setIsAdding(false);
                }
              }}
              autoFocus
              color="gray.800"
              _placeholder={{ color: "gray.400" }}
            />
            <Button size="xs" colorScheme="teal" onClick={handleAddItem} disabled={!newItemText.trim()}>
              追加
            </Button>
            <Button size="xs" variant="ghost" onClick={() => { setNewItemText(""); setIsAdding(false); }}>
              ×
            </Button>
          </HStack>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            colorScheme="teal"
            mt={1}
            onClick={() => setIsAdding(true)}
          >
            + 項目を追加
          </Button>
        )
      )}
    </Box>
  );
}

function TreeNode({ node, level = 0, expandedNodes, onToggle, onAddChild, onOpenDetail, onCompleteTask, onDelete, onUpdateMemo, onUpdateChecklist, onRestoreTask, highlightedId, showArchived }: TreeNodeProps) {
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Tempo風: 子要素があるかどうか、またはサブタスクがあるかで表示を切り替え
  const hasChecklist = node.checklist && node.checklist.length > 0;
  const showProgressBar = hasChildren || hasChecklist; // 子またはサブタスクがあれば進捗バー
  const showCheckbox = !hasChildren && !hasChecklist && !isArchived; // どちらもなければチェックボックス表示
  const progress = showProgressBar ? calculateProgress(node) : 0;

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
                    colorScheme="teal"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(node);
                    }}
                  >
                    詳細
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleteConfirmOpen(true);
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

              {/* Period display (read-only) */}
              {node.endDate && (
                <HStack gap={1} fontSize={{ base: "2xs", md: "xs" }} color="teal.600">
                  <FiCalendar />
                  <Text>
                    期限: {node.endDate}
                  </Text>
                </HStack>
              )}

              {/* メモ1行プレビュー（読み取り専用、タップで詳細モーダルを開く） */}
              {node.memo && (
                <Box
                  w="full"
                  bg="gray.100"
                  borderRadius="lg"
                  px={3}
                  py={1.5}
                  cursor="pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(node);
                  }}
                  _hover={{ bg: "gray.200" }}
                  transition="background 0.2s"
                >
                  <Text
                    fontSize="xs"
                    color="gray.700"
                    lineClamp={1}
                  >
                    {node.memo.split('\n')[0]}
                  </Text>
                </Box>
              )}

              {/* サブタスク サマリー（Taskノードのみ、読み取り専用） */}
              {isTask && node.checklist && node.checklist.length > 0 && (
                <Box
                  bg="gray.50"
                  borderRadius="lg"
                  px={3}
                  py={1.5}
                  cursor="pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(node, "subtask");
                  }}
                  _hover={{ bg: "gray.100" }}
                >
                  <Text fontSize="xs" color="gray.600">
                    サブタスク: {node.checklist.filter((item: any) => item.done).length}/{node.checklist.length} 完了
                  </Text>
                </Box>
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
              onOpenDetail={onOpenDetail}
              onCompleteTask={onCompleteTask}
              onDelete={onDelete}
              onUpdateMemo={onUpdateMemo}
              onUpdateChecklist={onUpdateChecklist}
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

      {/* 削除確認モーダル */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => onDelete(node.id)}
        title="タスクを削除"
        message={`「${node.title}」を削除しますか？この操作は取り消せません。`}
        confirmText="削除する"
        cancelText="キャンセル"
        confirmColorScheme="red"
      />
    </Box>
  );
}

function DetailDateSection({ detailEndDate, setDetailEndDate }: { detailEndDate: Date | null; setDetailEndDate: (d: Date | null) => void }) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const formatDisplay = (date: Date | null) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  };

  return (
    <Box>
      <HStack
        bg="gray.50"
        borderRadius="lg"
        px={3}
        py={2}
        cursor="pointer"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        _hover={{ bg: "gray.100" }}
        transition="background 0.2s"
        border="1px solid"
        borderColor="gray.200"
      >
        <FiCalendar color="gray" />
        <Text fontSize="sm" color={detailEndDate ? "gray.800" : "gray.400"} flex={1}>
          {detailEndDate ? formatDisplay(detailEndDate) : "タップして期限を設定"}
        </Text>
        {detailEndDate && (
          <Box
            as="button"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setDetailEndDate(null);
            }}
            color="gray.400"
            _hover={{ color: "red.400" }}
          >
            <FiX size={14} />
          </Box>
        )}
        <Text fontSize="xs" color="gray.400">{isCalendarOpen ? "▲" : "▼"}</Text>
      </HStack>
      {isCalendarOpen && (
        <Box mt={2}>
          <DatePicker
            selected={detailEndDate}
            onChange={(date) => {
              setDetailEndDate(date);
              setIsCalendarOpen(false);
            }}
            dateFormat="yyyy/MM/dd"
            inline
          />
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
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

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

  // ミニキャラチャット用state
  const [isMiniChatOpen, setIsMiniChatOpen] = useState(false);

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // タスクツリー保存用のRef
  const saveTreeRef = useRef(tree);
  const hasLoadedOnce = useRef(false);

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
      hasLoadedOnce.current = true; // 初回ロード完了
    };

    loadTree();
  }, [user]);

  // タスクツリーが変更されたら保存
  useEffect(() => {
    // 初回レンダリングはスキップ
    if (tree === saveTreeRef.current) return;
    if (!user) return;
    // ローディング中は保存しない（空配列の保存を防ぐ）
    if (isTreeLoading) return;
    // 最初のロードが完了するまで保存しない
    if (!hasLoadedOnce.current) return;

    saveTreeRef.current = tree;
    saveTaskTreeAsync(tree, user.uid);
  }, [tree, user, isTreeLoading]);

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

  // 詳細モーダル用state
  const [detailNode, setDetailNode] = useState<any>(null);
  const [detailMemoText, setDetailMemoText] = useState("");
  const [detailEndDate, setDetailEndDate] = useState<Date | null>(null);
  const [detailSection, setDetailSection] = useState<"all" | "subtask">("all");

  // AIと相談用state
  const [chatFocusNode, setChatFocusNode] = useState<any>(null);
  const chatOpenRef = useRef<(() => void) | null>(null);

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

  const handleOpenDetail = (node: any, section: "all" | "subtask" = "all") => {
    setDetailNode(node);
    setDetailMemoText(node.memo || "");
    setDetailEndDate(node.endDate ? new Date(node.endDate) : null);
    setDetailSection(section);
  };

  const handleSaveDetail = () => {
    if (!detailNode) return;

    const formatDate = (date: Date | null) => {
      if (!date) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const formattedDate = formatDate(detailEndDate);

    // メモと期限をまとめてツリーに反映
    const updateTree = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === detailNode.id) {
          return { ...node, memo: detailMemoText, endDate: formattedDate };
        } else if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    setTree(updateTree(tree));
    setDetailNode(null);
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

  const handleUpdateChecklist = (nodeId: string, checklist: ChecklistItem[]) => {
    const updateTree = (nodes: any[]): any[] => {
      return nodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, checklist };
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
    <Box
      w={{ base: "100%", md: isMiniChatOpen ? "70%" : "100%" }}
      transition="width 0.3s ease"
      minH="100vh"
      bg="gray.50"
    >
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
                onOpenDetail={handleOpenDetail}
                onCompleteTask={handleCompleteTask}
                onDelete={handleDelete}
                onUpdateMemo={handleUpdateMemo}
                onUpdateChecklist={handleUpdateChecklist}
                onRestoreTask={handleRestoreTask}
                highlightedId={highlightedNodeId || highlightId}
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

      <MiniCharacter
        onChatOpenChange={setIsMiniChatOpen}
        taskTree={tree}
        onAddNode={(parentId, title, nodeType, memo) => {
          const newNode: any = {
            id: `${nodeType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            title: `${nodeType}: ${title}`,
            type: nodeType,
            children: nodeType === "Task" ? undefined : [],
            memo: memo || undefined,
          };

          if (nodeType === "Task") {
            newNode.ai = false;
            newNode.status = "未着手";
          }

          // parentId が null の場合は新しい Goal をルートに追加
          if (parentId === null) {
            setTree(prev => [...prev, newNode]);
            setHighlightedNodeId(newNode.id);
            setTimeout(() => setHighlightedNodeId(null), 3000);
            return newNode.id;
          }

          // 関数型更新で最新のtreeを使う（連続呼び出し対応）
          setTree(prev => {
            // 親ノードの種類をチェック
            const findNode = (nodes: any[], id: string): any | null => {
              for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                  const found = findNode(node.children, id);
                  if (found) return found;
                }
              }
              return null;
            };

            const parentNode = findNode(prev, parentId);
            if (parentNode) {
              const parentType = parentNode.type ||
                (parentNode.title?.startsWith("Goal:") ? "Goal" :
                 parentNode.title?.startsWith("Project:") ? "Project" :
                 parentNode.title?.startsWith("Milestone:") ? "Milestone" :
                 parentNode.title?.startsWith("Task:") ? "Task" : null);

              // 階層バリデーション
              const validChildTypes: Record<string, string> = {
                "Goal": "Project",
                "Project": "Milestone",
                "Milestone": "Task",
              };

              if (parentType && validChildTypes[parentType] !== nodeType) {
                console.warn(`階層エラー: ${parentType} の下に ${nodeType} は追加できません。`);
                const correctedType = validChildTypes[parentType];
                if (correctedType) {
                  newNode.id = `${correctedType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
                  newNode.title = `${correctedType}: ${title}`;
                  newNode.type = correctedType;
                  newNode.children = correctedType === "Task" ? undefined : [];
                  if (correctedType === "Task") {
                    newNode.ai = false;
                    newNode.status = "未着手";
                  }
                }
              }
            }

            const updateNodes = (nodes: any[]): any[] => {
              return nodes.map((node) => {
                if (node.id === parentId) {
                  return {
                    ...node,
                    children: [...(node.children || []), newNode],
                  };
                } else if (node.children) {
                  return {
                    ...node,
                    children: updateNodes(node.children),
                  };
                }
                return node;
              });
            };

            return updateNodes(prev);
          });

          // 親ノードを自動展開
          setExpandedNodes((prev) => {
            const newSet = new Set(prev);
            newSet.add(parentId);
            return newSet;
          });

          // 追加したノードをハイライト（3秒後に消える）
          setHighlightedNodeId(newNode.id);
          setTimeout(() => setHighlightedNodeId(null), 3000);

          return newNode.id;
        }}
        onUpdateMemo={handleUpdateMemo}
        onUpdateChecklist={handleUpdateChecklist}
        focusNode={chatFocusNode}
        onFocusNodeHandled={() => setChatFocusNode(null)}
        chatOpenRef={chatOpenRef}
      />
      <NavTabs shrink={isMiniChatOpen} />

      {/* 詳細モーダル */}
      <Dialog.Root open={detailNode !== null} onOpenChange={(e) => { if (!e.open) setDetailNode(null); }}>
        <Dialog.Backdrop />
        <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
          <Dialog.Content maxW="420px" mx={4} borderRadius="xl" overflow="hidden">
            <Dialog.Header bg="teal.500" py={3} px={4}>
              <Dialog.Title color="white" fontSize="md" lineClamp={2}>{detailNode?.title}</Dialog.Title>
              <Dialog.CloseTrigger color="white" />
            </Dialog.Header>
            <Dialog.Body py={4} px={4}>
              <VStack align="stretch" gap={0}>
                {/* ミニ秘書ちゃんと相談するボタン（allモードのみ） */}
                {detailSection === "all" && (
                  <Box pb={3}>
                    <Button
                      variant="outline"
                      colorScheme="purple"
                      w="full"
                      borderRadius="lg"
                      onClick={() => {
                        const node = detailNode;
                        setDetailNode(null);
                        setChatFocusNode(node);
                        setTimeout(() => {
                          chatOpenRef.current?.();
                        }, 100);
                      }}
                    >
                      ミニ秘書ちゃんと相談する
                    </Button>
                    <Box h="1px" bg="gray.100" mt={3} />
                  </Box>
                )}

                {/* メモ編集（allモードのみ） */}
                {detailSection === "all" && (
                  <>
                    <Box py={3}>
                      <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2} textTransform="uppercase" letterSpacing="wide">メモ</Text>
                      <Textarea
                        placeholder="メモを入力..."
                        value={detailMemoText}
                        onChange={(e) => setDetailMemoText(e.target.value)}
                        size="sm"
                        bg="gray.50"
                        color="gray.800"
                        _placeholder={{ color: "gray.400" }}
                        rows={3}
                        resize="vertical"
                        borderColor="gray.200"
                        borderRadius="lg"
                        _focus={{ borderColor: "teal.400", bg: "white" }}
                      />
                    </Box>
                    <Box h="1px" bg="gray.100" />
                  </>
                )}

                {/* サブタスク（Taskノードのみ） */}
                {detailNode && (detailNode.type === "Task" || detailNode.title?.startsWith("Task:")) && (
                  <>
                    <Box py={3}>
                      <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2} textTransform="uppercase" letterSpacing="wide">サブタスク</Text>
                      <ChecklistSection
                        checklist={detailNode.checklist || []}
                        isArchived={detailNode.archived === true}
                        onUpdate={(newChecklist) => {
                          handleUpdateChecklist(detailNode.id, newChecklist);
                          setDetailNode({ ...detailNode, checklist: newChecklist });
                        }}
                      />
                    </Box>
                    {detailSection === "all" && <Box h="1px" bg="gray.100" />}
                  </>
                )}

                {/* 期限設定（allモードのみ） */}
                {detailSection === "all" && (
                  <Box py={3}>
                    <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2} textTransform="uppercase" letterSpacing="wide">期限</Text>
                    <DetailDateSection detailEndDate={detailEndDate} setDetailEndDate={setDetailEndDate} />
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer px={4} pb={4} pt={0}>
              {detailSection === "all" ? (
                <HStack w="full" gap={2}>
                  <Button variant="outline" flex={1} onClick={() => setDetailNode(null)} borderRadius="lg">
                    キャンセル
                  </Button>
                  <Button colorScheme="teal" flex={1} onClick={handleSaveDetail} borderRadius="lg">
                    保存
                  </Button>
                </HStack>
              ) : (
                <Button variant="outline" w="full" onClick={() => setDetailNode(null)} borderRadius="lg">
                  閉じる
                </Button>
              )}
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
