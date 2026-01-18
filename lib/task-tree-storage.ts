/**
 * タスクツリーのFirestore管理（localStorageフォールバック付き）
 */

import { TaskNode } from "@/types/task-tree";
import { getTaskTreeFromFirestore, saveTaskTreeToFirestore } from "./firebase/firestore";

const STORAGE_KEY = "task_tree_data";

// 初期タスクツリー（新規ユーザー用）
const initialTree: TaskNode[] = [];

/**
 * ユニークなIDを生成
 */
function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * ツリー内の重複IDを修正
 */
function fixDuplicateIds(tree: TaskNode[]): { tree: TaskNode[]; fixed: boolean } {
  const seenIds = new Set<string>();
  let fixed = false;

  const fixNode = (node: any): any => {
    // IDが重複している場合、新しいIDを生成
    if (seenIds.has(node.id)) {
      const prefix = node.title?.startsWith("Goal:") ? "goal" :
                     node.title?.startsWith("Project:") ? "project" :
                     node.title?.startsWith("Milestone:") ? "milestone" :
                     node.title?.startsWith("Task:") ? "task" : "node";
      node.id = generateUniqueId(prefix);
      fixed = true;
    }
    seenIds.add(node.id);

    // 子ノードも再帰的に処理
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(fixNode);
    }

    return node;
  };

  const fixedTree = tree.map(fixNode);
  return { tree: fixedTree, fixed };
}

/**
 * タスクツリーを取得（非同期・Firestore優先）
 */
export async function getTaskTreeAsync(userId?: string): Promise<TaskNode[]> {
  // userIdがある場合はFirestoreから取得
  if (userId) {
    try {
      const tree = await getTaskTreeFromFirestore(userId);
      if (tree && tree.length > 0) {
        // 重複IDをチェック・修正
        const { tree: fixedTree, fixed } = fixDuplicateIds(tree as TaskNode[]);
        if (fixed) {
          console.log("重複IDを検出・修正しました。データを保存します。");
          await saveTaskTreeToFirestore(userId, fixedTree);
        }
        return fixedTree;
      }
      // Firestoreにデータがない場合、localStorageからの移行を試みる
      const localTree = getTaskTreeFromLocal();
      if (localTree.length > 0) {
        // localStorageのデータをFirestoreに移行
        await saveTaskTreeToFirestore(userId, localTree);
        // 移行後、localStorageをクリア
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
        return localTree;
      }
      return initialTree;
    } catch (error) {
      console.error("Failed to load task tree from Firestore:", error);
      // フォールバック
      return getTaskTreeFromLocal();
    }
  }

  // userIdがない場合はlocalStorageから取得
  return getTaskTreeFromLocal();
}

/**
 * タスクツリーを保存（非同期・Firestore優先）
 */
export async function saveTaskTreeAsync(tree: TaskNode[], userId?: string): Promise<void> {
  if (userId) {
    try {
      await saveTaskTreeToFirestore(userId, tree);
      return;
    } catch (error) {
      console.error("Failed to save task tree to Firestore:", error);
      // フォールバック
    }
  }

  // localStorageに保存
  saveTaskTreeToLocal(tree);
}

/**
 * localStorageからタスクツリーを取得（同期・フォールバック用）
 */
function getTaskTreeFromLocal(): TaskNode[] {
  if (typeof window === "undefined") return initialTree;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load task tree from localStorage:", error);
  }

  return initialTree;
}

/**
 * localStorageにタスクツリーを保存（同期・フォールバック用）
 */
function saveTaskTreeToLocal(tree: TaskNode[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch (error) {
    console.error("Failed to save task tree to localStorage:", error);
  }
}

/**
 * 同期版（後方互換性のため残す - 非推奨）
 * @deprecated useTaskTreeAsync を使用してください
 */
export function getTaskTree(): TaskNode[] {
  return getTaskTreeFromLocal();
}

/**
 * 同期版（後方互換性のため残す - 非推奨）
 * @deprecated useTaskTreeAsync を使用してください
 */
export function saveTaskTree(tree: TaskNode[]): void {
  saveTaskTreeToLocal(tree);
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
