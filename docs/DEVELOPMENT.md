# 開発・検証・保存先

## コードの入口

| 対象 | 主なファイル |
| --- | --- |
| 画面・操作・スタイル | `dist/app.js`、`dist/style.css`、`dist/index.html` |
| 相場・精算・進行・ステージ | `dist/engine.js` |
| CPU | `dist/solo.js` |
| 現在／最終順位 | `dist/standings.js` |
| 相場履歴、抽選の演出 | `dist/chart.js`、`dist/market-candle.js`、`dist/market-raster.js`、`dist/market-chart-renderer.js` |
| 確定レコード・送信待ち | `dist/records.js`、`dist/record-store.js` |
| 戦績画面 | `dist/*-view.js` |
| Worker・API・集計 | `server/worker.js`、`server/api.js`、`server/`内の各集計ファイル |
| D1スキーマ・履歴 | `db/schema.ts`、`drizzle/` |
| Workerビルド | `scripts/build.mjs` |
| フォントとライセンス | `dist/fonts/`、`scripts/build-pixel-font.py` |
| 検証 | `tests/*.test.mjs`、`tests/*-check.cjs` |

`dist/` にあるフロントのファイルはソースとしてGit管理する。`dist/server/` は生成物で、画面の変更後はWorkerをビルドし直してからブラウザ確認する。フォントの由来とライセンスを維持する。

## 保存先

- GitHub: コード・仕様・作業記録・テスト・設定・マイグレーション。実際のユーザーの戦績、データベースの内容、認証情報は登録しない。
- ブラウザ: 進行中ゲーム、未送信レコードなどの端末内状態。未確定の注文は再読み込みで初期状態へ戻す。
- D1: 所有者ごとの確定試合レコードとTRIP設定。確定レコードは同一ゲームIDで冪等保存し、書き換えない。

FINAL RESULTSと保存APIは同じ `finalRecord` を使う。現在の `schemaVersion` は1。本人の生涯戦績には `ownerPlayerId` がある人間を使い、本人未指定の対面とCPUは合算しない。新しい指標も元ログから再計算可能にし、ゲーム結果を再抽選・再精算しない。

## ローカル起動

依存関係がなければ `npm ci`、続いて `npm run build`。新しいローカルD1には下記の0000、0001、0002を順に適用する。既存環境では適用状況を確認し、未適用のファイルだけを実行する。

```sh
WRANGLER_LOG_PATH=.wrangler/logs/wrangler.log node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dusty_wiccan.sql
WRANGLER_LOG_PATH=.wrangler/logs/wrangler.log node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_jazzy_kang.sql
WRANGLER_LOG_PATH=.wrangler/logs/wrangler.log node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_sparkling_invisible_woman.sql
npm start -- --port 4173
```

ローカルの保存API検証ではテスト用の `oai-authenticated-user-id` ヘッダーを付与する。本番ではSitesが認証済みヘッダーを付与する。これは本番の認証を外すための設定ではない。

## 変更に合わせた確認

攻撃に対する検証・認証入口の前提・依存の修正理由は [SECURITY_REVIEW.md](SECURITY_REVIEW.md) を参照する。保存境界を変えた場合は `tests/security.test.mjs` と `tests/security-browser-check.cjs` も確認する。後者はローカルWorker/D1を使用し、必要なら `CHROMIUM_PATH=/usr/bin/chromium` を指定する。

- ゲーム・集計・保存の変更は `npm test` と対象の既存テストを使う。ソース変更後のビルドは `npm run build`。
- UI変更は、最低320×568、390×600、390×844で、横はみ出し・固定ボタンとの重なり・操作を確認する。既存のPC配置を触る時はPCも確認する。
- 代表的なブラウザ検証: 注文は `tests/compact-ui-check.cjs` と `tests/orders-browser-check.cjs`、精算は `tests/settlement-browser-check.cjs`、順位は `tests/standings-browser-check.cjs`、抽選演出は `tests/market-candle-browser-check.cjs`。保存・各戦績は対応する `tests/*-browser-check.cjs` を参照する。
- 検証はローカルWorkerとローカルD1を使い、再読み込み、固定済みプレイヤー、同率、0円、負債など変更に関係するケースを含める。
- 文書だけの変更はリンク・実装との整合性・差分を確認する。アプリの全テストや本番公開を儀式的に繰り返さない。

実行した検証だけをIssue/PRへ書く。過去のPRのテスト件数はその時点の記録で、現在の版の成功を保証しない。

## 統合と公開

GitHubの `main` と公開中のアプリは別の状態。push・PR作成・mergeだけで本番へ反映済みと書かない。公開の実施は当該タスクのユーザー指示とセッション内の承認に従う。

本番アプリは既存のSitesプロジェクト（`.openai/hosting.json`）へ公開し、対象コミットと成功した公開結果を記録する。アクセス範囲、D1、既存戦績を維持する。文書・Issue・PRテンプレートのみの変更ではアプリを再公開しない。トークン、`.env`、`.wrangler/`、`node_modules/`、ローカルD1、ビルド中間物はGitHubへ追加しない。
