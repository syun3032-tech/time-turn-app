import { TaskNode } from "@/types/task-tree";
import { generateNodeId } from "./task-tree-storage";

/**
 * AIメッセージからタスクツリー構造を解析する
 *
 * 例:
 * Goal: 阪大医学部に合格する
 * ├─ Project: 数学の実力を上げる
 * │  ├─ Milestone: 微積分を完璧にする
 * │  │  └─ Task: 基礎問題集1-3章
 * │  └─ Milestone: 確率統計をマスターする
 * └─ Project: 英語力を向上させる
 */
export function parseTaskTreeFromMessage(message: string): TaskNode[] {
  const lines = message.split('\n');
  const result: TaskNode[] = [];
  const stack: { node: TaskNode; indent: number }[] = [];

  for (const line of lines) {
    // 空行をスキップ
    if (!line.trim()) continue;

    // インデント計算（├─、│、└─などの記号を考慮）
    const match = line.match(/^([│├└\s─]*)(Goal|Project|Milestone|Task)[:：]\s*(.+)$/);
    if (!match) continue;

    const [, indentStr, type, title] = match;
    const indent = indentStr.replace(/[─]/g, '').length;

    const nodeType = type as "Goal" | "Project" | "Milestone" | "Task";
    const newNode: TaskNode = {
      id: generateNodeId(nodeType.toLowerCase()),
      title: title.trim(),
      type: nodeType,
      description: "AIによって提案されたタスク",
      children: nodeType === "Task" ? undefined : [],
    };

    // インデントが0なら最上位レベル
    if (indent === 0) {
      result.push(newNode);
      stack.length = 0;
      if (nodeType !== "Task") {
        stack.push({ node: newNode, indent: 0 });
      }
    } else {
      // 親ノードを探す（自分より浅いインデントの最後のノード）
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1].node;
        if (parent.children) {
          parent.children.push(newNode);
        }
      }

      if (nodeType !== "Task") {
        stack.push({ node: newNode, indent });
      }
    }
  }

  return result;
}

/**
 * メッセージにタスクツリー構造が含まれているかチェック
 */
export function hasTaskTreeStructure(message: string): boolean {
  const taskKeywords = /(Goal|Project|Milestone|Task)[:：]/;

  // タスクキーワードが2つ以上含まれていればツリー構造とみなす
  const matches = message.match(new RegExp(taskKeywords.source, 'g'));

  return matches !== null && matches.length >= 2;
}

/**
 * タスクツリーをマークダウン形式で整形
 */
export function formatTaskTreeToMarkdown(nodes: TaskNode[], indent = 0): string {
  let result = '';

  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const prefix = indent === 0 ? '' : (isLast ? '└─ ' : '├─ ');
    const childPrefix = indent === 0 ? '' : (isLast ? '   ' : '│  ');

    result += '  '.repeat(indent) + prefix + `${node.type}: ${node.title}\n`;

    if (node.children && node.children.length > 0) {
      const childLines = formatTaskTreeToMarkdown(node.children, indent + 1);
      result += childLines.split('\n').map(line =>
        line ? childPrefix + line : line
      ).join('\n');
    }
  });

  return result;
}
