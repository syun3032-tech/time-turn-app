# 開発進捗ログ

## 2025-11-17
- Next.js (App Router, TS) プロジェクトを `time-turn-app` として作成。
- 依存追加: Chakra UI, Supabase JS, @dnd-kit/core/sortable/modifiers, react-virtuoso, react-icons。
- ※ npm install の postinstall が一度失敗したため、`--ignore-scripts` でインストール済み（SWCバイナリ取得は別途確認が必要）。
- ルーティング/画面スタブ追加:
  - `/onboarding`: チャット+Goal承認のモックUI。
  - `/tasks`: タスクツリー（折り畳み風の一覧）とAI実行バッジ。
  - `/tasks/[id]/run`: キャラ画面でAI実行のモック。「保存」CTA。
  - `/log`: 日次ログ（達成率80%判定、時間、気分、タイマーUIスタブ）。
  - `/dashboard`: KPIカード、チャートプレースホルダ、成功フィード。
  - `/profile`: RPG風プロフィール（レベル/XP、レーダー占位、道のりバー、実績）。
- 共通ナビ: `NavTabs` を各画面下部に配置。
- ルートページ `/` は `/dashboard` へリダイレクト。

## 2025-11-17 (later)
- Chakra UI v3に合わせてProviderを`defaultSystem`で構成（extendThemeを撤去）。
- Chakra v3で存在しないコンポーネントに対応：DashboardのStatNumber→StatValueText/Divider除去、LogのSliderFilledTrack→SliderRange。
- Next devサーバーをport 3001で起動（`node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3001`）。
