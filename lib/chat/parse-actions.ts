import type { ActionItem, NodeType } from "./types";

// タスクツリーをAI用に文字列化
export function serializeTreeForChat(tree: any[], depth: number = 0, maxDepth: number = 3): string {
  if (depth > maxDepth || !tree || tree.length === 0) return "";

  let result = "";
  const indent = "  ".repeat(depth);

  for (const node of tree) {
    const isArchived = node.archived === true;
    const status = isArchived ? "[完了]" : "";
    const memo = node.memo ? ` (メモ: ${node.memo})` : "";
    const deadline = node.endDate ? ` [期限: ${node.endDate}]` : "";
    const checklist = node.checklist && node.checklist.length > 0
      ? ` (チェックリスト: ${node.checklist.filter((c: any) => c.done).length}/${node.checklist.length}完了)`
      : "";

    result += `${indent}- ${node.title}${status}${deadline}${memo}${checklist}\n`;

    if (node.children && node.children.length > 0 && depth < maxDepth) {
      result += serializeTreeForChat(node.children, depth + 1, maxDepth);
    }
  }

  return result;
}

// フォーカスノードの詳細情報を生成
export function serializeFocusNode(node: any, tree: any[]): string {
  if (!node) return "";

  const nodeType = node.type ||
    (node.title?.startsWith("Goal:") ? "Goal" :
     node.title?.startsWith("Project:") ? "Project" :
     node.title?.startsWith("Milestone:") ? "Milestone" : "Task");

  // 親ノードのパスを探す
  const findPath = (nodes: any[], targetId: string, path: string[] = []): string[] | null => {
    for (const n of nodes) {
      if (n.id === targetId) return path;
      if (n.children) {
        const result = findPath(n.children, targetId, [...path, n.title]);
        if (result) return result;
      }
    }
    return null;
  };

  const parentPath = findPath(tree, node.id) || [];
  let info = `\n【★ 現在相談中のノード】\n`;
  info += `タイトル: ${node.title}\n`;
  info += `種類: ${nodeType}\n`;
  if (parentPath.length > 0) {
    info += `階層: ${parentPath.join(" → ")} → ${node.title}\n`;
  }
  if (node.memo) {
    info += `メモ: ${node.memo}\n`;
  }
  if (node.endDate) {
    info += `期限: ${node.endDate}\n`;
  }
  if (node.checklist && node.checklist.length > 0) {
    const done = node.checklist.filter((c: any) => c.done).length;
    info += `サブタスク: ${done}/${node.checklist.length}完了\n`;
    node.checklist.forEach((item: any) => {
      info += `  ${item.done ? "✓" : "□"} ${item.text}\n`;
    });
  }
  if (node.children && node.children.length > 0) {
    info += `子要素:\n`;
    for (const child of node.children) {
      const archived = child.archived ? " [完了]" : "";
      info += `  - ${child.title}${archived}\n`;
    }
  }
  info += `\n★ このノードについてユーザーが相談しに来ています。このノードの状況を踏まえて会話してください。\n`;

  return info;
}

// 未完了タスクを抽出
export function getIncompleteTasks(tree: any[]): any[] {
  const tasks: any[] = [];

  const traverse = (nodes: any[]) => {
    for (const node of nodes) {
      if (!node.archived && (!node.children || node.children.length === 0)) {
        tasks.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  };

  traverse(tree);
  return tasks;
}

// ノードをIDまたはタイトルで検索（完全一致優先 → 部分一致の2パス）
export function findNodeByIdOrTitle(tree: any[], search: string): any | null {
  const searchLower = search.toLowerCase().trim();
  if (!searchLower) return null;

  // 第1パス: ID完全一致 or タイトル完全一致
  const traverseExact = (nodes: any[]): any | null => {
    for (const node of nodes) {
      if (node.id === search) return node;
      const titleWithoutPrefix = (node.title || "").toLowerCase().replace(/^(goal:|project:|milestone:|task:)\s*/i, "");
      if (titleWithoutPrefix === searchLower) return node;
      if (node.children) {
        const found = traverseExact(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const exactMatch = traverseExact(tree);
  if (exactMatch) return exactMatch;

  // 第2パス: タイトルが検索語を含む（タイトル側のincludes のみ、逆方向マッチングしない）
  const traversePartial = (nodes: any[]): any | null => {
    for (const node of nodes) {
      const titleLower = (node.title || "").toLowerCase();
      const titleWithoutPrefix = titleLower.replace(/^(goal:|project:|milestone:|task:)\s*/i, "");
      if (titleWithoutPrefix.includes(searchLower) || titleLower.includes(searchLower)) {
        return node;
      }
      if (node.children) {
        const found = traversePartial(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  return traversePartial(tree);
}

// ノードの種類を判定
export function getNodeType(node: any): NodeType | null {
  if (!node?.title) return null;
  if (node.type === "Goal" || node.title.startsWith("Goal:")) return "Goal";
  if (node.type === "Project" || node.title.startsWith("Project:")) return "Project";
  if (node.type === "Milestone" || node.title.startsWith("Milestone:")) return "Milestone";
  if (node.type === "Task" || node.title.startsWith("Task:")) return "Task";
  return null;
}

// 親ノードの種類から、子ノードの種類を決定
export function getChildNodeType(parentType: NodeType | null): NodeType | null {
  switch (parentType) {
    case "Goal": return "Project";
    case "Project": return "Milestone";
    case "Milestone": return "Task";
    case "Task": return null; // Task の下にはノードを追加しない（メモを使う）
    default: return null;
  }
}

// 全てのアクションタグを削除する
export function cleanAllTags(text: string): string {
  return text
    .replace(/\[ADD_GOAL:[^\]]+\]/g, "")
    .replace(/\[ADD_PROJECT:[^\]]+\]/g, "")
    .replace(/\[ADD_MILESTONE:[^\]]+\]/g, "")
    .replace(/\[ADD_TASK:[^\]]+\]/g, "")
    .replace(/\[ADD_MEMO:[^\]]+\]/g, "")
    .replace(/\[ADD_CHECKLIST:[^\]]+\]/g, "")
    .replace(/\[SET_COMPLETION:[^\]]+\]/g, "")
    .replace(/\[CALENDAR_ADD:[^\]]+\]/g, "")
    .replace(/\[PROMISE:[^\]]+\]/g, "")
    .trim();
}

// 表情タグ: [EMOTE:normal|happy|smug|calm] を抽出して本文から除去
export type EmoteKey = "normal" | "happy" | "smug" | "calm";

export function parseEmote(content: string): { emote: EmoteKey | null; content: string } {
  const match = content.match(/\[EMOTE:(normal|happy|smug|calm)\]/i);
  const cleaned = content.replace(/\[EMOTE:[^\]]*\]/gi, "").trim();
  return {
    emote: match ? (match[1].toLowerCase() as EmoteKey) : null,
    content: cleaned,
  };
}

// アクションタグから抽出した文字列のサニタイズ
// メモはtextToHtml→dangerouslySetInnerHTMLで表示されるため、HTMLタグ構成文字を除去してXSSを防ぐ
function clean(s: string): string {
  return s.replace(/[<>]/g, "").trim();
}

// AIレスポンスからアクション提案を解析（複数アクション対応）
export function parseActionsFromResponse(content: string, tree: any[]): { cleanContent: string; actions: ActionItem[] } {
  const actions: ActionItem[] = [];

  // Goal追加: [ADD_GOAL:目標名] または [ADD_GOAL:目標名|メモ] （複数対応）
  const goalMatches = content.matchAll(/\[ADD_GOAL:([^\]]+)\]/g);
  for (const match of goalMatches) {
    const fullContent = clean(match[1]);
    // パイプ(|)でメモを分離
    const [goalTitle, goalMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    actions.push({
      type: "add_goal",
      title: goalTitle,
      nodeType: "Goal",
      memo: goalMemo,
      selected: true,
    });
  }

  // Project追加: [ADD_PROJECT:Goal名:Project名] または [ADD_PROJECT:Goal名:Project名|メモ] （複数対応）
  const projectMatches = content.matchAll(/\[ADD_PROJECT:([^:]+):([^\]]+)\]/g);
  for (const match of projectMatches) {
    const parentSearch = clean(match[1]);
    const fullContent = clean(match[2]);
    // パイプ(|)でメモを分離
    const [projectTitle, projectMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    const parentNode = findNodeByIdOrTitle(tree, parentSearch);
    const parentType = getNodeType(parentNode);

    if (parentNode && parentType !== "Goal") {
      // 親がGoalでない場合はGoalとして追加
      actions.push({
        type: "add_goal",
        title: projectTitle,
        nodeType: "Goal",
        memo: projectMemo,
        selected: true,
      });
    } else {
      actions.push({
        type: "add_project",
        parentId: parentNode?.id,
        parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
        title: projectTitle,
        nodeType: "Project",
        memo: projectMemo,
        selected: true,
      });
    }
  }

  // Milestone追加: [ADD_MILESTONE:Project名:Milestone名] または [ADD_MILESTONE:Project名:Milestone名|メモ] （複数対応）
  const milestoneMatches = content.matchAll(/\[ADD_MILESTONE:([^:]+):([^\]]+)\]/g);
  for (const match of milestoneMatches) {
    const parentSearch = clean(match[1]);
    const fullContent = clean(match[2]);
    // パイプ(|)でメモを分離
    const [milestoneTitle, milestoneMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    const parentNode = findNodeByIdOrTitle(tree, parentSearch);
    const parentType = getNodeType(parentNode);

    if (parentNode && parentType !== "Project") {
      if (parentType === "Goal") {
        actions.push({
          type: "add_project",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Goal:\s*/, "") || parentSearch,
          title: milestoneTitle,
          nodeType: "Project",
          memo: milestoneMemo,
          selected: true,
        });
      } else if (parentType === "Milestone") {
        actions.push({
          type: "add_task",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Milestone:\s*/, "") || parentSearch,
          title: milestoneTitle,
          nodeType: "Task",
          memo: milestoneMemo,
          selected: true,
        });
      } else {
        actions.push({
          type: "add_milestone",
          parentId: parentNode?.id,
          parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
          title: milestoneTitle,
          nodeType: "Milestone",
          memo: milestoneMemo,
          selected: true,
        });
      }
    } else {
      actions.push({
        type: "add_milestone",
        parentId: parentNode?.id,
        parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
        title: milestoneTitle,
        nodeType: "Milestone",
        memo: milestoneMemo,
        selected: true,
      });
    }
  }

  // タスク追加: [ADD_TASK:Milestone名:Task名] または [ADD_TASK:Milestone名:Task名|メモ] （複数対応）
  const taskMatches = content.matchAll(/\[ADD_TASK:([^:]+):([^\]]+)\]/g);
  for (const match of taskMatches) {
    const parentSearch = clean(match[1]);
    const fullContent = clean(match[2]);
    // パイプ(|)でメモを分離
    const [taskTitle, taskMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    const parentNode = findNodeByIdOrTitle(tree, parentSearch);
    const parentType = getNodeType(parentNode);

    if (parentNode && parentType !== "Milestone") {
      if (parentType === "Goal") {
        actions.push({
          type: "add_project",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Goal:\s*/, "") || parentSearch,
          title: taskTitle,
          nodeType: "Project",
          memo: taskMemo,
          selected: true,
        });
      } else if (parentType === "Project") {
        actions.push({
          type: "add_milestone",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Project:\s*/, "") || parentSearch,
          title: taskTitle,
          nodeType: "Milestone",
          memo: taskMemo,
          selected: true,
        });
      } else if (parentType === "Task") {
        actions.push({
          type: "add_memo",
          nodeId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Task:\s*/, "") || parentSearch,
          memo: taskTitle,
          selected: true,
        });
      } else {
        actions.push({
          type: "add_task",
          parentId: parentNode?.id,
          parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
          title: taskTitle,
          taskTitle: taskTitle,
          nodeType: "Task",
          memo: taskMemo,
          selected: true,
        });
      }
    } else {
      actions.push({
        type: "add_task",
        parentId: parentNode?.id,
        parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
        title: taskTitle,
        taskTitle: taskTitle,
        nodeType: "Task",
        memo: taskMemo,
        selected: true,
      });
    }
  }

  // メモ追加: [ADD_MEMO:ノード名:メモ内容] （複数対応）
  const memoMatches = content.matchAll(/\[ADD_MEMO:([^:]+):([^\]]+)\]/g);
  for (const match of memoMatches) {
    const nodeSearch = clean(match[1]);
    const memo = clean(match[2]);
    const node = findNodeByIdOrTitle(tree, nodeSearch);

    actions.push({
      type: "add_memo",
      nodeId: node?.id,
      parentTitle: node?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || nodeSearch,
      memo,
      selected: true,
    });
  }

  // チェックリスト追加: [ADD_CHECKLIST:Task名:項目1,項目2,項目3] （複数対応）
  const checklistMatches = content.matchAll(/\[ADD_CHECKLIST:([^:]+):([^\]]+)\]/g);
  for (const match of checklistMatches) {
    const taskSearch = clean(match[1]);
    const items = match[2].split(',').map(s => clean(s)).filter(s => s.length > 0);
    const node = findNodeByIdOrTitle(tree, taskSearch);

    if (items.length > 0) {
      actions.push({
        type: "add_checklist",
        nodeId: node?.id,
        parentTitle: node?.title?.replace(/^Task:\s*/, "") || taskSearch,
        checklistItems: items,
        selected: true,
      });
    }
  }

  // 完了条件セット: [SET_COMPLETION:ノード名:完了条件: ○○ / 進め方: ○○] （複数対応）
  const completionMatches = content.matchAll(/\[SET_COMPLETION:([^:]+):([^\]]+)\]/g);
  for (const match of completionMatches) {
    const nodeSearch = clean(match[1]);
    const completionText = clean(match[2]);
    const node = findNodeByIdOrTitle(tree, nodeSearch);

    actions.push({
      type: "set_completion",
      nodeId: node?.id,
      parentTitle: node?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || nodeSearch,
      memo: completionText,
      selected: true,
    });
  }

  // カレンダーイベント追加: [CALENDAR_ADD:タイトル|開始日時|終了日時] または [CALENDAR_ADD:タイトル|開始日時]
  const calendarMatches = content.matchAll(/\[CALENDAR_ADD:([^\]]+)\]/g);
  for (const match of calendarMatches) {
    const parts = match[1].split("|").map(s => clean(s));
    if (parts.length >= 2) {
      actions.push({
        type: "add_calendar_event",
        title: parts[0],
        calendarStart: parts[1],
        calendarEnd: parts[2] || undefined,
        calendarDescription: parts[3] || undefined,
        selected: true,
      });
    }
  }

  // 約束追跡: [PROMISE:内容] または [PROMISE:内容|期限]
  const promiseMatches = content.matchAll(/\[PROMISE:([^\]]+)\]/g);
  for (const match of promiseMatches) {
    const parts = match[1].split("|").map(s => clean(s));
    if (parts.length >= 1 && parts[0]) {
      actions.push({
        type: "add_promise",
        title: parts[0],
        promiseDeadline: parts[1] || undefined,
        selected: true,
      });
    }
  }

  return { cleanContent: cleanAllTags(content), actions };
}
