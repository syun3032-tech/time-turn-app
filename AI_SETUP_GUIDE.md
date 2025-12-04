# AI接続セットアップガイド

秘書ゆりがAIで動くようになりました！🎉

## 🚀 クイックスタート

### 1. APIキーを取得

以下のいずれかのAIサービスのAPIキーを取得してください：

#### **Google Gemini（推奨：無料枠が大きい！）**
1. https://aistudio.google.com/app/apikey にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. APIキーをコピー（`AI...` で始まる文字列）

**料金**: **無料枠が非常に大きい**（月60リクエスト/分まで無料）
**モデル**: Gemini 1.5 Pro（GPT-4相当の性能）
**特徴**:
- 日本語に強い
- レスポンスが速い（GPT-4の約2倍）
- 無料枠でも十分使える
- 有料でも25倍安い（$0.00025/1000トークン）

#### OpenAI（有名）
1. https://platform.openai.com/ にアクセス
2. アカウント作成（無料）
3. 「API keys」→「Create new secret key」
4. APIキーをコピー（`sk-...` で始まる文字列）

**料金**: 従量課金（$0.01/1000トークン程度）
**モデル**: GPT-4, GPT-3.5-turbo など

#### Anthropic Claude（高性能）
1. https://www.anthropic.com/ にアクセス
2. アカウント作成
3. API keysセクションでキー生成
4. APIキーをコピー

**料金**: 従量課金
**モデル**: Claude 3.5 Sonnet, Claude 3 Opus など

### 2. 環境変数を設定

プロジェクトのルートに `.env.local` ファイルを作成：

```bash
cd /Users/matsumotoshuntasuku/TimeTurn\ 11:17/time-turn-app
touch .env.local
```

`.env.local` に以下を追加：

#### **Geminiを使う場合（推奨）**
```
# 通常のチャット用
NEXT_PUBLIC_GEMINI_API_KEY=AIxxxxxxxxxxxxxxxxxxxxxxxx

# タスク分解用（オプション：コスト管理したい場合）
NEXT_PUBLIC_GEMINI_API_KEY_TASK=AIxxxxxxxxxxxxxxxxxxxxxxxx
```

**💡 デュアルAPIキー戦略**:
- タスク分解は通常のチャットの約50倍のトークンを消費します
- 別々のAPIキーを使うことで：
  - コストを明確に把握できる
  - 無料枠を2つ使える
  - トラブルシューティングが簡単
- タスク分解用キーを設定しない場合は、通常のキーが使われます

#### OpenAIを使う場合
```
NEXT_PUBLIC_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_OPENAI_API_KEY_TASK=sk-xxxxxxxxxxxxxxxxxxxxxxxx  # オプション
```

#### Anthropic Claudeを使う場合
```
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_ANTHROPIC_API_KEY_TASK=sk-ant-xxxxxxxxxxxxxxxxxxxxx  # オプション
```

#### 複数使う場合
```
# Gemini（推奨）
NEXT_PUBLIC_GEMINI_API_KEY=AIxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_GEMINI_API_KEY_TASK=AIxxxxxxxxxxxxxxxxxxxxxxxx

# OpenAI（オプション）
NEXT_PUBLIC_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Claude（オプション）
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

### 3. アプリを再起動

```bash
# 開発サーバーを停止（Ctrl+C）してから再起動
npm run dev
```

### 4. 動作確認

ブラウザで以下にアクセス：

```
http://localhost:3000/ai-chat
```

「英語を勉強したい」と入力してみてください！

## 📝 使い方

### AIチャットページ（テスト用）

`http://localhost:3000/ai-chat` にアクセス

**できること：**
- 秘書ゆりと自由に会話
- タスク分解プロンプトのテスト
- Gemini / OpenAI / Anthropic の切り替え

**試してみよう：**
1. 「タスク分解プロンプトを使用」にチェック
2. 「英語で日常会話ができるようになりたい」と入力
3. ゆりがヒアリング→検索→タスク分解してくれます！

### 🎭 シームレスモード切り替え機能

**新機能**: AIが自動的にチャットモードとタスク分解モードを切り替えます！

#### どう動くの？
```
あなた：「今日の天気は？」
  ↓ [チャットモード・通常APIキー]
ゆり：「今日は晴れですね！」

あなた：「英語を勉強したい」
  ↓ [自動検出→タスク分解モード・専用APIキー]
ゆり：「英語学習を始めたいということですね。
      何がきっかけでそう思ったんですか？」
```

#### 特徴
- **表面上は気づかない**: ゆりのキャラクターは一貫して保たれる
- **内部で自動切り替え**: キーワード検出で自動的にモード変更
- **コスト最適化**: 用途に応じて別々のAPIキーを使用
- **会話履歴維持**: モード切り替え後も会話の流れは継続

#### 自動検出キーワード
以下のキーワードを含むとタスク分解モードに切り替わります：
- 「〜したい」「〜成したい」「達成したい」
- 「勉強したい」「学びたい」「習得したい」
- 「始めたい」「作りたい」「実現したい」
- 「タスク」「分解」「計画」「ステップ」

### プロンプトの種類

#### 通常チャットモード
- 普通の会話
- システムプロンプト（秘書ゆりの性格設定）を使用
- 軽量・高速（平均110トークン）
- 通常APIキーを使用

#### タスク分解モード
- タスク分解に特化
- 強化版プロンプトを使用（軸合わせ＋抽象度一致）
- 詳細・丁寧（平均6100トークン）
- タスク分解専用APIキーを使用（設定されている場合）

## 🎯 タスク分解の流れ

```
あなた：「英語を勉強したい」
  ↓
ゆり：「英語学習を始めたいということですね。
      つまり、英語を使って何かできるようになりたい
      ということでしょうか？」
  ↓
あなた：「海外旅行で困らないように」
  ↓
ゆり：「なるほど。海外旅行での日常会話が目標ですね。
      何がきっかけでそう思ったんですか？」
  ↓
... ヒアリング続く ...
  ↓
ゆり：「では、整理させてください：
      - 目標：海外旅行で困らない英会話
      - 現状：TOEIC 600点レベル
      - ネック：リスニングとスピーキング

      検索結果を踏まえて、こんな流れはどうでしょう？
      1. 基礎リスニング強化
      2. 旅行頻出フレーズ習得
      3. 実践会話練習」
  ↓
あなた：「いいね！」
  ↓
ゆり：「では、詳細なタスクに分解しますね...」
```

## 🛠️ トラブルシューティング

### エラー: "APIキーが設定されていません"

**原因**: 環境変数が読み込まれていない

**解決策**:
1. `.env.local` ファイルがプロジェクトルートにあるか確認
2. ファイル名が正しいか確認（`.env.local`）
3. 開発サーバーを再起動

### エラー: "OpenAI API Error: ..."

**原因1**: APIキーが間違っている
- APIキーをコピペし直す
- 余分なスペースがないか確認

**原因2**: クレジットがない
- OpenAIのダッシュボードで残高確認
- クレジットカードを登録

**原因3**: レート制限
- 短時間に大量リクエストを送った
- 少し待ってから再試行

### 反応が遅い

**GPT-4は遅い（20-40秒）**
- これは正常です
- GPT-3.5-turboの方が速い（5-10秒）

**変更方法**:
`lib/ai-service.ts` の `model` を変更：
```typescript
model: "gpt-3.5-turbo", // GPT-4より速い
```

## 💰 料金の目安

### Google Gemini（推奨）
- **無料枠**: 月60リクエスト/分まで無料（ほとんどの個人利用で十分）
- **Gemini 1.5 Pro**: $0.00025/1000入力トークン, $0.001/1000出力トークン

**タスク分解1回あたり**:
- 無料枠内なら **$0（無料）**
- 有料でも約 **$0.002-0.008（0.2-0.8円）**

**通常チャット1回あたり**:
- 無料枠内なら **$0（無料）**
- 有料でも約 **$0.0001（0.01円）**

### OpenAI
- **GPT-4 Turbo**: $0.01/1000入力トークン, $0.03/1000出力トークン
- **GPT-3.5 Turbo**: $0.0015/1000トークン

**タスク分解1回あたり**: 約$0.05-0.15（5-15円）

### Anthropic Claude
- **Claude 3.5 Sonnet**: $3/100万入力トークン, $15/100万出力トークン
- **Claude 3 Opus**: $15/100万入力トークン, $75/100万出力トークン

**タスク分解1回あたり**: 約$0.05-0.20（5-20円）

### 💡 コスト比較
| プロバイダー | チャット1回 | タスク分解1回 | 特徴 |
|------------|-----------|-------------|------|
| **Gemini** | 0.01円 | 0.5円 | 無料枠大、日本語強、速い ⭐️ |
| OpenAI | 1円 | 10円 | 有名、安定 |
| Claude | 2円 | 12円 | 高性能、長文対応 |

## 📚 コード解説

### プロンプト
`lib/prompts/index.ts` の `getEnhancedTaskBreakdownPrompt()`
- 軸合わせ＋抽象度一致
- ステップバイステップのヒアリング
- 段階的な具体化

### AI接続
`lib/ai-service.ts`
- **Gemini API呼び出し**（推奨）
- OpenAI API呼び出し
- Anthropic API呼び出し
- **シームレスモード切り替え**機能（`chatWithAISeamless()`）
  - 自動モード検出（チャット vs タスク分解）
  - キャラクター一貫性の維持
  - デュアルAPIキー管理
- 会話履歴の管理

### シームレスモード切り替え（新機能）
`lib/ai-service.ts` の `chatWithAISeamless()`
```typescript
export async function chatWithAISeamless(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  provider: AIProvider = "gemini",
  forceMode?: "chat" | "task_breakdown"
)
```
- キーワード自動検出でモード切り替え
- キャラクターベースプロンプトを常に保持
- 適切なAPIキーを自動選択
- ユーザーには透過的に動作

### UIコンポーネント
`app/ai-chat/page.tsx`
- チャットUI
- メッセージ履歴管理
- プロバイダー切り替え（Gemini / OpenAI / Anthropic）

## 🔐 セキュリティ注意

### ❌ やってはいけないこと
- APIキーをGitにコミット
- APIキーを公開リポジトリにプッシュ
- `.env.local` を共有

### ✅ 推奨
- `.env.local` は `.gitignore` に追加済み
- APIキーは個人で管理
- 本番環境ではサーバーサイドで呼び出し

## 🚀 次のステップ

### タスクページと統合
`app/tasks/page.tsx` にAIチャットを組み込む

### 自動タスク追加
AIの返答をパースして、自動でタスクツリーに追加

### 会話履歴の保存
Supabaseに会話履歴を保存

### 音声入力
Web Speech APIで音声入力対応

## 💬 質問・サポート

- エラーが出たら、コンソールログを確認
- APIキーの問題は、プロバイダーのダッシュボードを確認
- それでも解決しない場合は、Issue報告
