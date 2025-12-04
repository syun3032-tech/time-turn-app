# TimeTurn 更新まとめ

## プロジェクト構成
- Next.js (App Router, TypeScript) + Chakra UI v3。ルート`/`は`/dashboard`へリダイレクト。
- 主要依存: Chakra UI v3（defaultSystem使用）、@dnd-kit、react-datepicker、react-icons、react-virtuoso、Supabase JS（未接続）、Next 16 / React 19。
- キャラ立ち絵を `public/秘書ゆり_*.png` として参照（画像未在時はプレースホルダ表示）。
- 環境メモ: `PROGRESS.md` に postinstall失敗のため `npm install --ignore-scripts` 済、開発サーバーを port 3001 で起動したメモあり（npm scripts はデフォルトで3000）。

## バックエンド/API
- `app/api/chat/route.ts`: Gemini 2.0 Flash へ POST。env `GEMINI_API_KEY` が必須。簡易エラーハンドリング付きで返信テキストを返す。

## 共通コンポーネント
- `app/providers.tsx`: CacheProvider + ChakraProvider(defaultSystem) で全体をラップ。
- `components/NavTabs.tsx`: ダッシュボード/タスク/ログ/プロフィールへのボトムタブ。現在パスで強調表示。
- `components/CharacterAvatar.tsx`: normal/open_mouth/wawa の3表情を切替。`getExpressionForMessage` で文面から表情推定。

## 画面
- `/dashboard`: キャラとのチャット（/api/chat呼び出し、返答に応じて表情が5秒後にnormalへ戻る）。今日/進行中/次ToDoのヘッダー、日次ログモーダル（今日のタスク、時間ログ、気分スライダーのスタブ）、NavTabs。
- `/onboarding`: キャラ立ち絵＋暫定Goalカード。Goal登録へ進む/承認/修正のボタン。
- `/tasks`: Goal→Project→Milestone→Taskのツリー。展開/折畳み、ノード追加（promptでタイトル入力）、Goal追加。期間設定ボタン→DatePickerモーダルで開始/終了日保存。AI実行可タスクはバッジ表示＆`/tasks/sample-task-id/run` へのリンク。道のりバーでマイルストーン進捗をバー表示。
- `/tasks/[id]/run`: キャラ付きAI実行スタブ。サブエージェント情報とプロンプト表示、実行/中断ボタン、生成結果テキストエリアと「タスクに保存」CTA。
- `/log`: 今日のタスク完了ボタン＋進捗バー、作業時間入力/開始・停止/保存、気分スライダー。streak条件のバッジ表示。
- `/profile`: RPGビュー。レベル/XPバーと現在Goal、パラメータと気分・特性のレーダーチャート（SVG）、特性タグ、実績バッジ。NavTabs付き。
