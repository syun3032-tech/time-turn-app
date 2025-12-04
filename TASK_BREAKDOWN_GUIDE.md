# タスク分解機能ガイド

このガイドでは、強化されたタスク分解機能の使い方を説明します。

## 📋 概要

ユーザーが「やりたいこと・成したいこと」を話すと、秘書ゆりが以下の流れでタスクを分解します：

1. **必要な情報を検索** - Web検索で最新の情報を取得
2. **逆算思考で分解** - ゴールから逆算して必要なステップを洗い出し
3. **既存ツリーを考慮** - 既にあるタスクとの関連性をチェック
4. **ユーザー確認** - 分解案を提示して確認を取る
5. **ツリーに反映** - OKが出たらタスクツリーに追加

## 🎯 主な機能

### 1. 検索機能付きタスク分解

AIが自動的に以下のような検索を実行します：
- 「[目標] 達成方法 ロードマップ」
- 「[目標] 必要なスキル」
- 「[目標] 学習期間」
- 「[目標] 初心者 手順」

検索結果をもとに、**根拠のある**タスク分解を行います。

### 2. 逆算思考での分解

ゴールから逆算して、必要なステップを段階的に洗い出します：

```
Goal（最終目標）
 ↓ 何が必要？
Project（大項目）
 ↓ どう進める？
Milestone（中項目）
 ↓ 具体的には？
Task（実行可能な単位）
 ↓ さらに細かく？
MicroTask（30分〜1時間）
```

### 3. 既存タスクツリーとの統合

- 既存のGoal/Project/Milestoneと重複がないかチェック
- 関連するタスクがあれば活用
- 追加すべき場所を提案

### 4. 適切な粒度のタスク生成

各タスクには以下の属性が自動設定されます：
- `estimatedTime`: 所要時間（分）
- `difficulty`: 難易度（Easy/Medium/Hard）
- `deadline`: 期限（必須）
- `requiredSkill`: 必要なスキル
- `outputType`: 成果物の種類
- `ai`: AI実行可能か（true/false）

## 📁 実装ファイル

```
time-turn-app/
├── types/
│   └── task-tree.ts              # タスクツリーの型定義
├── lib/
│   ├── task-tree-utils.ts        # タスクツリー操作ユーティリティ
│   └── prompts/
│       └── index.ts              # 強化版タスク分解プロンプト
└── components/
    └── TaskBreakdownPreview.tsx  # タスク分解確認UIコンポーネント
```

## 🔧 使用方法

### 基本的な使い方

```typescript
import { getEnhancedTaskBreakdownPrompt } from "@/lib/prompts";
import { generateTaskTreeContext } from "@/lib/task-tree-utils";
import { TaskBreakdownContext, TaskNode } from "@/types/task-tree";

// 1. コンテキストを準備
const context: TaskBreakdownContext = {
  userGoal: "英語で日常会話ができるようになりたい",
  existingTree: currentTaskTree, // 既存のタスクツリー
  availableTime: 10, // 週あたり10時間
  deadline: "2025-06-30",
  additionalInfo: "TOEIC 600点レベルから始めたい",
};

// 2. コンテキストを文字列化
const contextString = generateTaskTreeContext(context);

// 3. プロンプトを生成
const prompt = getEnhancedTaskBreakdownPrompt(contextString);

// 4. LLM APIに送信（例：OpenAI、Claude など）
const response = await callLLMAPI({
  systemPrompt: getSystemPrompt(),
  userPrompt: prompt,
});

// 5. レスポンスをパースしてTaskNode[]に変換
const proposal: TaskNode[] = parseAIResponse(response);

// 6. ユーザーに確認
// TaskBreakdownPreviewコンポーネントを使用
```

### TaskBreakdownPreviewコンポーネントの使用

```tsx
import { TaskBreakdownPreview } from "@/components/TaskBreakdownPreview";

function MyPage() {
  const [proposal, setProposal] = useState<TaskNode[]>([]);
  const [tree, setTree] = useState<TaskNode[]>(initialTree);

  const handleApprove = () => {
    // タスクツリーに反映
    const updatedTree = addMultipleNodesToTree(
      tree,
      null, // ルートに追加、または parentId を指定
      proposal
    );
    setTree(updatedTree);
  };

  const handleReject = () => {
    // やり直し
    setProposal([]);
  };

  return (
    <TaskBreakdownPreview
      proposal={proposal}
      reasoning="検索結果から、英会話習得には3ヶ月〜6ヶ月が標準的です..."
      researchInfo="英語の日常会話習得には、リスニングとスピーキングの練習が重要..."
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
```

## 🛠️ ユーティリティ関数

### タスクツリーの文字列化

```typescript
import { serializeTaskTree } from "@/lib/task-tree-utils";

const treeString = serializeTaskTree(taskTree);
// LLMに既存ツリー情報を渡す際に使用
```

### タスクツリーの統計情報取得

```typescript
import { getTreeStatistics } from "@/lib/task-tree-utils";

const stats = getTreeStatistics(taskTree);
console.log(stats);
// {
//   goalCount: 3,
//   projectCount: 5,
//   milestoneCount: 8,
//   taskCount: 19,
//   completedTaskCount: 5,
//   inProgressTaskCount: 3,
//   completionRate: 26.3
// }
```

### ノードの追加

```typescript
import { addNodeToTree, addMultipleNodesToTree } from "@/lib/task-tree-utils";

// 単一ノード追加
const newTree = addNodeToTree(tree, parentId, newNode);

// 複数ノード一括追加
const newTree = addMultipleNodesToTree(tree, parentId, newNodes);
```

### ノードの検索・フィルタリング

```typescript
import {
  findNodeById,
  getAICapableTasks,
  getInProgressTasks,
  getPendingTasks,
} from "@/lib/task-tree-utils";

// IDでノードを検索
const node = findNodeById(tree, "task-1");

// AI実行可能なタスクを取得
const aiTasks = getAICapableTasks(tree);

// 進行中のタスクを取得
const inProgressTasks = getInProgressTasks(tree);

// 未着手のタスクを取得
const pendingTasks = getPendingTasks(tree);
```

## 📝 プロンプトの構成

強化版タスク分解プロンプトは以下の要素で構成されています：

### 1. 情報収集（必須）
```
まず、目標達成に必要な情報を必ず検索してください：
- 目標達成に必要なスキル・知識
- 一般的な学習ロードマップや達成プロセス
- 必要な期間の目安
- つまずきやすいポイント
- 推奨される教材やリソース
```

### 2. 逆算思考での分解
```
Goal → Project → Milestone → Task → MicroTask
の順に、「何が必要か？」を考えながら分解
```

### 3. 既存ツリーとの統合
```
- 既存のGoal/Project/Milestoneと重複がないか確認
- 既存のタスクと関連性があれば活用
- 追加すべき場所を提案
```

### 4. 分解の原則
```
- 小さく始める：最初のタスクは特に簡単に
- 順序性：依存関係を明確に
- 現実的な時間配分：利用可能時間を考慮
- モチベーション維持：定期的に達成感を得られるよう設計
- 柔軟性：調整の余地を残す
```

### 5. 出力フォーマット
```
【分解結果】
◆ Goal: ...
  ├─ Project: ...
  │   ├─ Milestone: ...
  │   │   └─ Task: ...
  │   └─ ...
  └─ ...

【分解の根拠】
- 検索して得た情報: ...
- なぜこの分解が適切か: ...

【既存ツリーとの統合案】
- ...
```

## 🎨 カスタマイズ

### プロンプトのカスタマイズ

`lib/prompts/index.ts` の `getEnhancedTaskBreakdownPrompt` 関数を編集：

```typescript
export const getEnhancedTaskBreakdownPrompt = (context: string) => {
  return `${getSystemPrompt()}

【現在のシーン】
// ここをカスタマイズ

【あなたのタスク】
// 追加の指示を記述

...
`;
};
```

### UIコンポーネントのカスタマイズ

`components/TaskBreakdownPreview.tsx` を編集：

```typescript
// ノードの表示をカスタマイズ
const renderNode = (node: TaskNode, level: number = 0) => {
  // カスタムレンダリングロジック
};
```

## 💡 ベストプラクティス

### 1. コンテキストを充実させる

```typescript
const context: TaskBreakdownContext = {
  userGoal: "英語で日常会話ができるようになりたい",
  existingTree: currentTaskTree,
  availableTime: 10,
  deadline: "2025-06-30",
  additionalInfo: `
    - 現在のレベル: TOEIC 600点
    - 目標: 海外旅行で困らないレベル
    - 苦手分野: リスニングとスピーキング
    - 得意分野: 文法と読解
  `, // 詳細な情報を提供
};
```

### 2. 検索キーワードを最適化

プロンプト内の検索クエリ例を、目標に応じてカスタマイズ：

```
「英語 日常会話 習得 ロードマップ」
「英語 初心者 おすすめ 教材」
「英会話 3ヶ月 上達方法」
```

### 3. 分解結果の検証

```typescript
// 分解結果を受け取った後、検証
const validateProposal = (proposal: TaskNode[]) => {
  // タスク数が多すぎないかチェック
  const taskCount = flattenTree(proposal).filter(
    (n) => n.title?.startsWith("Task:")
  ).length;

  if (taskCount > 50) {
    console.warn("タスク数が多すぎます。さらに集約を検討してください。");
  }

  // 期限の妥当性チェック
  // ...
};
```

### 4. ユーザーフィードバックの収集

```typescript
const handleApprove = () => {
  // 分解案を承認
  addToTaskTree(proposal);

  // フィードバックを記録（任意）
  logUserFeedback({
    action: "approved",
    proposalId: proposal[0].id,
    timestamp: new Date(),
  });
};
```

## 🚀 今後の拡張案

- [ ] **AIレスポンスの自動パース**: JSON形式での出力を指定し、パース処理を自動化
- [ ] **リアルタイムプレビュー**: ユーザーが目標を入力中にリアルタイムで分解案をプレビュー
- [ ] **テンプレート機能**: 「TOEIC対策」「資格試験」などのテンプレートを用意
- [ ] **学習データの蓄積**: ユーザーの成功パターンを学習し、より精度の高い分解を実現
- [ ] **コラボレーション機能**: 他のユーザーの分解案を参考にできる
- [ ] **進捗に応じた再分解**: 進捗状況に応じて自動的にタスクを再調整

## 📚 関連ドキュメント

- [キャラクタープロンプト設定ガイド](./CHARACTER_PROMPT_README.md)
- [SPEC.md](../SPEC.md) - TimeTurnの全体仕様
- [PLAN.md](../PLAN.md) - 実装方針と作業手順

## 🆘 トラブルシューティング

### Q: タスクが細かすぎる/粗すぎる

A: プロンプト内の「分解の原則」セクションで粒度の目安を調整してください：

```typescript
- 各Milestoneを、2〜4時間で完了できるTask（タスク）に分解
// ↓
- 各Milestoneを、1〜2時間で完了できるTask（タスク）に分解（より細かく）
```

### Q: 検索結果が反映されていない

A: プロンプトで検索を**必須**としていることを確認してください：

```
## 1. 情報収集（必須）
まず、目標達成に必要な情報を**必ず検索**してください：
```

### Q: 既存ツリーとの統合がうまくいかない

A: `generateTaskTreeContext` で既存ツリーが正しく文字列化されているか確認：

```typescript
console.log(generateTaskTreeContext(context));
// 既存ツリーが表示されることを確認
```

## 📞 サポート

質問や改善提案は、GitHubのIssueまたはDiscussionsにてお願いします。
