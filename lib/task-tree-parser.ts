import { TaskNode } from "@/types/task-tree";
import { generateNodeId } from "./task-tree-storage";

/**
 * AIメッセージからタスクツリー構造を解析する
 *
 * 対応形式1（ツリーマーカー付き）:
 * Goal: 阪大医学部に合格する
 * ├─ Project: 数学の実力を上げる
 * │  ├─ Milestone: 微積分を完璧にする
 * │  │  └─ Task: 基礎問題集1-3章
 *
 * 対応形式2（フラット形式 - マーカーなし）:
 * Goal: 阪大医学部に合格する
 * Project: 数学の実力を上げる
 * Milestone: 微積分を完璧にする
 * Task: 基礎問題集1-3章
 */
export function parseTaskTreeFromMessage(message: string): TaskNode[] {
  const lines = message.split('\n');
  const result: TaskNode[] = [];

  // ツリーマーカーがあるかチェック
  const hasTreeMarkers = lines.some(line => /[│├└─]/.test(line));

  if (hasTreeMarkers) {
    // ツリーマーカー形式：インデントで親子関係を判断
    const stack: { node: TaskNode; indent: number }[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

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

      if (indent === 0) {
        result.push(newNode);
        stack.length = 0;
        if (nodeType !== "Task") {
          stack.push({ node: newNode, indent: 0 });
        }
      } else {
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
  } else {
    // フラット形式：ノードタイプの階層から親子関係を推論
    // Goal > Project > Milestone > Task の順で親を決定

    // 各タイプの最後のノードを追跡
    const lastNodeByType: { [key: string]: TaskNode | null } = {
      "Goal": null,
      "Project": null,
      "Milestone": null,
    };

    for (const line of lines) {
      if (!line.trim()) continue;

      const match = line.match(/^(Goal|Project|Milestone|Task)[:：]\s*(.+)$/);
      if (!match) continue;

      const [, type, title] = match;
      const nodeType = type as "Goal" | "Project" | "Milestone" | "Task";
      const newNode: TaskNode = {
        id: generateNodeId(nodeType.toLowerCase()),
        title: title.trim(),
        type: nodeType,
        description: "AIによって提案されたタスク",
        children: nodeType === "Task" ? undefined : [],
      };

      // 親を探す
      let parentFound = false;
      if (nodeType === "Goal") {
        // Goalは常にトップレベル
        result.push(newNode);
        lastNodeByType["Goal"] = newNode;
        lastNodeByType["Project"] = null;
        lastNodeByType["Milestone"] = null;
      } else if (nodeType === "Project") {
        // ProjectはGoalの子
        if (lastNodeByType["Goal"] && lastNodeByType["Goal"].children) {
          lastNodeByType["Goal"].children.push(newNode);
          parentFound = true;
        }
        lastNodeByType["Project"] = newNode;
        lastNodeByType["Milestone"] = null;
      } else if (nodeType === "Milestone") {
        // MilestoneはProjectの子
        if (lastNodeByType["Project"] && lastNodeByType["Project"].children) {
          lastNodeByType["Project"].children.push(newNode);
          parentFound = true;
        } else if (lastNodeByType["Goal"] && lastNodeByType["Goal"].children) {
          // Projectがない場合はGoalの直下
          lastNodeByType["Goal"].children.push(newNode);
          parentFound = true;
        }
        lastNodeByType["Milestone"] = newNode;
      } else if (nodeType === "Task") {
        // TaskはMilestone > Project > Goalの順で親を探す
        if (lastNodeByType["Milestone"] && lastNodeByType["Milestone"].children) {
          lastNodeByType["Milestone"].children.push(newNode);
          parentFound = true;
        } else if (lastNodeByType["Project"] && lastNodeByType["Project"].children) {
          lastNodeByType["Project"].children.push(newNode);
          parentFound = true;
        } else if (lastNodeByType["Goal"] && lastNodeByType["Goal"].children) {
          lastNodeByType["Goal"].children.push(newNode);
          parentFound = true;
        }
      }

      // 親が見つからなかった場合はトップレベルに追加（フォールバック）
      if (!parentFound && nodeType !== "Goal") {
        // Goalがまだない場合、暗黙のGoalを作成
        if (result.length === 0) {
          const implicitGoal: TaskNode = {
            id: generateNodeId("goal"),
            title: "目標",
            type: "Goal",
            description: "自動生成された目標",
            children: [newNode],
          };
          result.push(implicitGoal);
          lastNodeByType["Goal"] = implicitGoal;
        } else {
          // 最後のGoalに追加
          const lastGoal = result[result.length - 1];
          if (lastGoal.children) {
            lastGoal.children.push(newNode);
          }
        }
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
