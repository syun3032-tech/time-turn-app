/**
 * タスクツリー操作ユーティリティ
 */

import { TaskNode, NodeType, GoalNode, ProjectNode, MilestoneNode, TaskNodeDetail, TaskBreakdownContext } from "@/types/task-tree";

/**
 * タスクツリーを文字列形式で出力（LLMに渡す用）
 */
export function serializeTaskTree(nodes: TaskNode[], level: number = 0): string {
  let result = "";

  for (const node of nodes) {
    const indent = "  ".repeat(level);
    const nodeType = getNodeType(node.title);

    result += `${indent}[${nodeType}] ${node.title}\n`;

    if (node.startDate || node.endDate) {
      result += `${indent}  期間: ${node.startDate || "未設定"} 〜 ${node.endDate || "未設定"}\n`;
    }

    if ("status" in node && node.status) {
      result += `${indent}  状態: ${node.status}\n`;
    }

    if ("ai" in node && node.ai) {
      result += `${indent}  AI実行可能\n`;
    }

    if (node.children && node.children.length > 0) {
      result += serializeTaskTree(node.children, level + 1);
    }

    result += "\n";
  }

  return result;
}

/**
 * タイトルからノードタイプを推測
 */
export function getNodeType(title: string): NodeType {
  if (title.startsWith("Goal:")) return "Goal";
  if (title.startsWith("Project:")) return "Project";
  if (title.startsWith("Milestone:")) return "Milestone";
  if (title.startsWith("Task:")) return "Task";
  if (title.startsWith("MicroTask:")) return "MicroTask";
  return "Task"; // デフォルト
}

/**
 * タスクツリーの統計情報を取得
 */
export function getTreeStatistics(nodes: TaskNode[]) {
  let goalCount = 0;
  let projectCount = 0;
  let milestoneCount = 0;
  let taskCount = 0;
  let completedTaskCount = 0;
  let inProgressTaskCount = 0;

  function traverse(node: TaskNode) {
    const type = getNodeType(node.title);

    if (type === "Goal") goalCount++;
    if (type === "Project") projectCount++;
    if (type === "Milestone") milestoneCount++;
    if (type === "Task") {
      taskCount++;
      if ("status" in node) {
        if (node.status === "完了") completedTaskCount++;
        if (node.status === "進行中") inProgressTaskCount++;
      }
    }

    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);

  return {
    goalCount,
    projectCount,
    milestoneCount,
    taskCount,
    completedTaskCount,
    inProgressTaskCount,
    completionRate: taskCount > 0 ? (completedTaskCount / taskCount) * 100 : 0,
  };
}

/**
 * タスクツリーのコンテキストを生成（LLMに渡す用）
 */
export function generateTaskTreeContext(context: TaskBreakdownContext): string {
  let result = "";

  result += `【ユーザーの目標】\n${context.userGoal}\n\n`;

  if (context.deadline) {
    result += `【期限】\n${context.deadline}\n\n`;
  }

  if (context.availableTime) {
    result += `【利用可能時間】\n週あたり ${context.availableTime} 時間\n\n`;
  }

  if (context.existingTree && context.existingTree.length > 0) {
    result += `【既存のタスクツリー】\n`;
    result += serializeTaskTree(context.existingTree);
    result += "\n";

    const stats = getTreeStatistics(context.existingTree);
    result += `【既存タスクの統計】\n`;
    result += `- Goal数: ${stats.goalCount}\n`;
    result += `- Project数: ${stats.projectCount}\n`;
    result += `- Milestone数: ${stats.milestoneCount}\n`;
    result += `- Task数: ${stats.taskCount}\n`;
    result += `- 完了タスク: ${stats.completedTaskCount}\n`;
    result += `- 進行中タスク: ${stats.inProgressTaskCount}\n`;
    result += `- 完了率: ${stats.completionRate.toFixed(1)}%\n\n`;
  }

  if (context.additionalInfo) {
    result += `【追加情報】\n${context.additionalInfo}\n\n`;
  }

  return result;
}

/**
 * ノードIDを生成
 */
export function generateNodeId(type: NodeType, counter: number): string {
  return `${type.toLowerCase()}-${counter}`;
}

/**
 * タスクツリーに新しいノードを追加
 */
export function addNodeToTree(
  tree: TaskNode[],
  parentId: string | null,
  newNode: TaskNode
): TaskNode[] {
  // parentIdがnullの場合はルートに追加
  if (parentId === null) {
    return [...tree, newNode];
  }

  // 再帰的に親ノードを探して追加
  function addToNode(nodes: TaskNode[]): TaskNode[] {
    return nodes.map((node) => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newNode],
        };
      } else if (node.children) {
        return {
          ...node,
          children: addToNode(node.children),
        };
      }
      return node;
    });
  }

  return addToNode(tree);
}

/**
 * 複数のノードをツリーに一括追加
 */
export function addMultipleNodesToTree(
  tree: TaskNode[],
  parentId: string | null,
  newNodes: TaskNode[]
): TaskNode[] {
  let updatedTree = tree;

  for (const node of newNodes) {
    updatedTree = addNodeToTree(updatedTree, parentId, node);
  }

  return updatedTree;
}

/**
 * ノードを検索
 */
export function findNodeById(tree: TaskNode[], nodeId: string): TaskNode | null {
  for (const node of tree) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * タスクツリーを平坦化
 */
export function flattenTree(nodes: TaskNode[]): TaskNode[] {
  const result: TaskNode[] = [];

  function traverse(node: TaskNode) {
    result.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return result;
}

/**
 * 特定の条件でノードをフィルタリング
 */
export function filterNodes(
  tree: TaskNode[],
  predicate: (node: TaskNode) => boolean
): TaskNode[] {
  return flattenTree(tree).filter(predicate);
}

/**
 * AI実行可能なタスクを取得
 */
export function getAICapableTasks(tree: TaskNode[]): TaskNode[] {
  return filterNodes(tree, (node) => "ai" in node && node.ai === true);
}

/**
 * 進行中のタスクを取得
 */
export function getInProgressTasks(tree: TaskNode[]): TaskNode[] {
  return filterNodes(tree, (node) => "status" in node && node.status === "進行中");
}

/**
 * 未着手のタスクを取得
 */
export function getPendingTasks(tree: TaskNode[]): TaskNode[] {
  return filterNodes(tree, (node) => "status" in node && node.status === "未着手");
}
