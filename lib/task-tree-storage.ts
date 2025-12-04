/**
 * タスクツリーのローカルストレージ管理
 */

import { TaskNode } from "@/types/task-tree";

const STORAGE_KEY = "task_tree_data";

// 初期タスクツリー
const initialTree: TaskNode[] = [
  {
    id: "goal-1",
    title: "Goal: 国立理系に合格する",
    type: "Goal",
    startDate: "2024-04-01",
    endDate: "2025-03-31",
    children: [
      {
        id: "project-1",
        title: "Project: 共通テスト対策",
        type: "Project",
        startDate: "2024-04-01",
        endDate: "2025-01-15",
        children: [
          {
            id: "milestone-1",
            title: "Milestone: 数学基礎固め",
            type: "Milestone",
            children: [
              { id: "task-1", title: "Task: 基礎問題集1-3章", type: "Task" },
              { id: "task-2", title: "Task: 過去問1年分", type: "Task" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "goal-2",
    title: "Goal: TOEIC 800点突破",
    type: "Goal",
    children: [
      {
        id: "project-3",
        title: "Project: リスニング強化",
        type: "Project",
        children: [
          {
            id: "milestone-5",
            title: "Milestone: Part1-4対策",
            type: "Milestone",
            children: [
              { id: "task-10", title: "Task: 公式問題集Part1", type: "Task" },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * タスクツリーを取得
 */
export function getTaskTree(): TaskNode[] {
  if (typeof window === "undefined") return initialTree;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load task tree:", error);
  }

  return initialTree;
}

/**
 * タスクツリーを保存
 */
export function saveTaskTree(tree: TaskNode[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch (error) {
    console.error("Failed to save task tree:", error);
  }
}

/**
 * タスクツリーにノードを追加
 */
export function addNodeToTree(
  tree: TaskNode[],
  parentId: string | null,
  newNode: TaskNode
): TaskNode[] {
  // parentIdがnullの場合、ルートに追加
  if (parentId === null) {
    return [...tree, newNode];
  }

  // 再帰的に親ノードを探して追加
  const updateTree = (nodes: TaskNode[]): TaskNode[] => {
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

  return updateTree(tree);
}

/**
 * タスクツリーを文字列に変換（AI用）
 */
export function serializeTreeForAI(tree: TaskNode[], maxDepth: number = 3): string {
  const serializeNode = (node: TaskNode, depth: number): string => {
    if (depth > maxDepth) return "";

    const indent = "  ".repeat(depth);
    const childrenCount = node.children?.length || 0;
    const childrenInfo = childrenCount > 0 ? ` (${childrenCount}個のサブタスク)` : "";

    let result = `${indent}- ${node.title}${childrenInfo}\n`;

    if (node.description) {
      result += `${indent}  説明: ${node.description}\n`;
    }

    if (node.children && depth < maxDepth) {
      node.children.forEach((child) => {
        result += serializeNode(child, depth + 1);
      });
    }

    return result;
  };

  let result = "【現在のタスクツリー】\n";
  tree.forEach((node) => {
    result += serializeNode(node, 0);
  });

  return result;
}

/**
 * IDを生成
 */
export function generateNodeId(type: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${type.toLowerCase()}-${timestamp}-${random}`;
}
