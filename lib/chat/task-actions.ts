import type { Dispatch, SetStateAction } from "react";
import type { TaskNode } from "@/types/task-tree";
import { textToHtml } from "@/lib/memo-utils";
import type { TaskTreeActions, NodeType } from "./types";

// タスクページのインラインハンドラと同一のツリー変更ロジック。
// ChatScreen が保持するツリーstateに対して動作し、永続化は呼び出し側のeffectが行う。
export function createTaskTreeActions(
  setTree: Dispatch<SetStateAction<TaskNode[]>>
): TaskTreeActions {
  const addNode = (
    parentId: string | null,
    title: string,
    nodeType: NodeType,
    memo?: string
  ): string => {
    const newNode: any = {
      id: `${nodeType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: `${nodeType}: ${title}`,
      type: nodeType,
      children: nodeType === "Task" ? undefined : [],
      memo: memo ? textToHtml(memo) : undefined,
    };

    if (nodeType === "Task") {
      newNode.ai = false;
      newNode.status = "未着手";
    }

    // parentId が null の場合は新しい Goal をルートに追加
    if (parentId === null) {
      setTree(prev => [...prev, newNode]);
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

    return newNode.id;
  };

  const updateMemo = (nodeId: string, memo: string) => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
    const memoHtml = textToHtml(memo);
    const dateHtml = `<p style="color:#a0aec0;font-size:12px">[${dateStr}]</p>`;
    setTree(prev => {
      const updateNodes = (nodes: any[]): any[] => {
        return nodes.map((n) => {
          if (n.id === nodeId) {
            const existing = n.memo || "";
            const existingHtml = textToHtml(existing);
            const newMemo = existingHtml
              ? `${existingHtml}<hr>${dateHtml}${memoHtml}`
              : `${dateHtml}${memoHtml}`;
            return { ...n, memo: newMemo };
          }
          if (n.children) {
            return { ...n, children: updateNodes(n.children) };
          }
          return n;
        });
      };
      return updateNodes(prev);
    });
  };

  const updateChecklist = (nodeId: string, newItems: any[]) => {
    // Append mode: 既存チェックリストに新規アイテムをマージ
    setTree(prev => {
      const updateNodes = (nodes: any[]): any[] => {
        return nodes.map((n) => {
          if (n.id === nodeId) {
            return { ...n, checklist: [...(n.checklist || []), ...newItems] };
          }
          if (n.children) {
            return { ...n, children: updateNodes(n.children) };
          }
          return n;
        });
      };
      return updateNodes(prev);
    });
  };

  const setCompletion = (nodeId: string, completion: string) => {
    const completionHtml = textToHtml(completion);
    setTree(prev => {
      const updateNodes = (nodes: any[]): any[] => {
        return nodes.map((n) => {
          if (n.id === nodeId) {
            const existing = n.memo || "";
            const existingHtml = textToHtml(existing);
            // 既存HTMLから完了条件・進め方のパラグラフを除去（重複防止）
            const cleaned = existingHtml
              .replace(/<p[^>]*>完了条件:.*?<\/p>/g, "")
              .replace(/<p[^>]*>進め方:.*?<\/p>/g, "")
              .trim();
            // 完了条件を先頭に、既存メモをその下に配置
            const newMemo = cleaned
              ? `${completionHtml}${cleaned}`
              : completionHtml;
            return { ...n, memo: newMemo };
          }
          if (n.children) {
            return { ...n, children: updateNodes(n.children) };
          }
          return n;
        });
      };
      return updateNodes(prev);
    });
  };

  return { addNode, updateMemo, updateChecklist, setCompletion };
}
