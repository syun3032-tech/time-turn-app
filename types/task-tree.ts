/**
 * タスクツリーの型定義
 */

export type NodeType = "Goal" | "Project" | "Milestone" | "Task" | "MicroTask";

export type TaskStatus = "未着手" | "進行中" | "完了" | "保留";

export type TaskPriority = "Low" | "Medium" | "High";

export type TaskDifficulty = "Easy" | "Medium" | "Hard";

/**
 * タスクノードの基本インターフェース
 */
export interface TaskNode {
  id: string;
  title: string;
  type?: NodeType;
  description?: string;
  startDate?: string;
  endDate?: string;
  children?: TaskNode[];
}

/**
 * Goalノード
 */
export interface GoalNode extends TaskNode {
  type: "Goal";
  why?: string; // 動機
  category?: string; // カテゴリー（勉強/仕事/創作/健康など）
  priority?: TaskPriority;
  status?: TaskStatus;
  progress?: number;
}

/**
 * Projectノード
 */
export interface ProjectNode extends TaskNode {
  type: "Project";
  goalId?: string;
  order?: number;
  status?: TaskStatus;
  progress?: number;
}

/**
 * Milestoneノード
 */
export interface MilestoneNode extends TaskNode {
  type: "Milestone";
  projectId?: string;
  order?: number;
  status?: TaskStatus;
  deadline?: string;
}

/**
 * Taskノード
 */
export interface TaskNodeDetail extends TaskNode {
  type: "Task";
  milestoneId?: string;
  estimatedTime?: number; // 所要時間（分）
  difficulty?: TaskDifficulty;
  deadline?: string; // 必須
  requiredSkill?: string;
  outputType?: string; // 成果物の種類
  status?: TaskStatus;
  order?: number;
  progress?: number;
  ai?: boolean; // AI実行可能か
}

/**
 * MicroTaskノード
 */
export interface MicroTaskNode extends TaskNode {
  type: "MicroTask";
  taskId?: string;
  estimatedTime?: number;
  status?: TaskStatus;
  order?: number;
}

/**
 * タスク分解の提案結果
 */
export interface TaskBreakdownProposal {
  goal?: GoalNode;
  projects?: ProjectNode[];
  milestones?: MilestoneNode[];
  tasks?: TaskNodeDetail[];
  microTasks?: MicroTaskNode[];
  reasoning?: string; // 分解の理由・根拠
  researchInfo?: string; // 検索して得た情報
}

/**
 * タスク分解のコンテキスト
 */
export interface TaskBreakdownContext {
  userGoal: string; // ユーザーが達成したいこと
  existingTree?: TaskNode[]; // 既存のタスクツリー
  availableTime?: number; // 利用可能な時間（週あたり）
  deadline?: string; // 期限
  additionalInfo?: string; // 追加情報
}
