# 現在地と引き継ぎ

確認日: 2026-10-06 JST。注文画面とトレンド描画の実装基準: [`cca0524`](https://github.com/kakinymax/fx-survival-1/commit/cca05240a4cd3aeedae034892d1063338bc3b946)。本書はPR #7・PR #9の実装を含む節目の要約。最新コードは[main](https://github.com/kakinymax/fx-survival-1/tree/main)、進行中作業は[open Issues](https://github.com/kakinymax/fx-survival-1/issues?q=is%3Aissue%20is%3Aopen)と[open PRs](https://github.com/kakinymax/fx-survival-1/pulls?q=is%3Apr%20is%3Aopen)を確認する。

## 実装済み

| 領域 | 内容 |
| --- | --- |
| 基本ゲーム | 最大12ラウンド、対面2〜6人、秘密注文、1〜100倍、通常ロスカット、ギャップ負債、永久の資産確定、同率勝利・勝者なし |
| ステージ | 全員共通のベーシック、ドル円、トルコリラ円 |
| CPU対戦 | 固定3人格、先に注文・進退を確定、結果に沿うセリフ、観戦・早送り |
| 戦績 Phase 1〜7 | 試合保存、生涯、歴代記録、TRIP A/B、モード別、殿堂入り、実際の履歴に基づく振り返り |
| 操作・結果 | 倍率の試算、中央の前回倍率と本人の前回相場・注文・損益、100倍入力の数字切れ修正、同じ設定で再戦、早送りの見せ場、5〜6人のスクロール案内 |
| 周回の記録 | ソロ自己ベスト通知、CPUの通算戦績と前回結果に沿う紹介 |
| UI | コンパクトな設定・秘密入力・注文一覧・一括進退・抽選。方向と値動きは別ボタン |
| 相場の表示 | 実際の履歴と急変判定に沿う足の演出、緑／赤の塗りと黒枠、点線4区間の整列、100中央の対称5目盛り・偶数刻み、3行の左揃え・小さな1行統計・左余白2px、同梱のピクセル字体 |
| 順位 | 現在・精算・最終・保存済み試合の順位。同率と確定・退場者も含む |

## 直近の変更の出典

- [PR #1](https://github.com/kakinymax/fx-survival-1/pull/1): UI刷新6単位。2026-10-03に統合。本スレッドでは公開成功を確認し、ユーザーも動作確認済み。
- [`c3ae013`](https://github.com/kakinymax/fx-survival-1/commit/c3ae013f0b3737b2695eaaf48e9d871b6265882b): 順位の表示と並べ替え。2026-10-03に公開成功を確認。
- [PR #2](https://github.com/kakinymax/fx-survival-1/pull/2): ピクセル字体・白黒トレンド・小画面の順位表示調整。2026-10-04に `35306e5` として統合。検証結果はPR本文を参照。本書の作成時点では、この版の本番公開状況は別途照合していない。
- [Issue #3](https://github.com/kakinymax/fx-survival-1/issues/3): 共同作業の文書と手順。現在の状態・完了結果はIssueを参照する。アプリの変更・再公開は対象外。

- [PR #7](https://github.com/kakinymax/fx-survival-1/pull/7): 注文画面の前回結果・中央の前回倍率・100倍入力。2026-10-05に[`17b8f01`](https://github.com/kakinymax/fx-survival-1/commit/17b8f017da03f77ec2aa4ff522449ac8ef7a1ff0)としてmainへ統合。検証と完了記録は[Issue #6](https://github.com/kakinymax/fx-survival-1/issues/6)。
- [PR #9](https://github.com/kakinymax/fx-survival-1/pull/9): 足の配色と黒枠、4区間のラウンド整列、100中央・基本2刻み、参考画像に合わせた文字密度と3行の左揃え、ラベルと同じ小さな統計値、左余白2px。PR #7に続く最終改修で、依頼された表示調整は完了。具体的な統合SHA・統合後の検証と完了記録は[Issue #8](https://github.com/kakinymax/fx-survival-1/issues/8)。

## 試技公開とmain

本スレッドの試技公開先: https://kakinymax.github.io/fx-survival-1/

Pagesの配布ブランチは`pages/font-change-preview`（root）、完成版はpreview_version 13、公開SHAは`9b5160dbd67c08705858bf927671856081bb8ec6`。PR #7とPR #9のアプリ変更を含み、ビルド成功・HTTPS 200・配布HTMLとmanifestの一致・スマホ3サイズとPCのブラウザ検証を確認済み。静的PagesはWorker/D1とオンライン戦績保存・生涯戦績・ランキング・TRIPの通信機能が未接続という既存の制約を維持する。mainへの統合とPagesの配布履歴は別管理。

過去に案内された別チャットのSites公開先: https://fx-survival-table.asai-ram.chatgpt.site/

GitHubの最新mainが公開先と一致するとは限らない。公開作業時はSitesの成功した公開結果と対象コミットを確認する。`v1.0.0` は過去の安定版を指すタグで、最新mainの別名ではない。

## 未完了・今後の案

### iPhone・Androidアプリ化（試作・両OS基本動作確認完了）

[Issue #10](https://github.com/kakinymax/fx-survival-1/issues/10)、専用ブランチ `mobile/prototype-20261005-codex-root`、担当 `mobile-prototype-20261005-codex-root`。UI完成版のmain `90c758b` を基準にCapacitorで両OSのプロジェクトと同梱資産を作成。[共有ロードマップ](MOBILE_ROADMAP.md)に6段階の完成条件・未完了項目、[試作手順](MOBILE_APP.md)に具体的な操作と再現方法を保存する。main統合・ストア公開済みとして扱わない。現在の検証結果はIssue/PRを参照する。今回は試作まで、登録・配布準備以降とストア申請・公開は後続指示で進める。

試作では対面/CPU対戦をオフラインで動かし、オンライン戦績は未接続と明示。確定レコードは端末内の送信待ちとして保持し、Web版と同期しない。2026-10-06 JSTまでに、AQUOS sense4 basic/Android12とiPhone SE第3世代/iOS27.0.1で導入/起動、CPU対戦、対面2人の注文後の受け渡し、ホームへ戻り10秒後の復帰がすべて問題なしとのユーザー報告を受領し、今回の試作と基本確認は完了した。

ユーザーのMac mini2018はSequoia15.8.1へ更新し、Xcode26.3・Node.js24.21.0/npm11.19.0でiPhone用Appを準備。開発者モードと開発者証明書の信頼設定を経て起動できた。具体的な再導入手順は[試作手順](MOBILE_APP.md)、自動検証と実機報告・未確認項目の正本は[Issue #10](https://github.com/kakinymax/fx-survival-1/issues/10)/[draft PR #11](https://github.com/kakinymax/fx-survival-1/pull/11)。

対面3〜6人やキーボード/縦横/安全領域/Android戻る/強制終了後等の追加実機確認、実機ビルド版の照合、正式アイコン/ID/配布署名、オンライン保存方針は未完了。親Issueはopen、PRはdraft、main未統合、既存Web公開先は変更なし、有料登録・ストア申請/公開は今回未実施。次は正式な登録・配布準備の後続指示で再開する。バックアップを不要としたユーザー指示を継続する。

注文画面とトレンド描画の本スレッドの追加改修は実装・試技反映完了。main統合・検証・Issue完了処理の結果はIssue #6／#8とPR #7／#9を参照する。以後の新しい依頼はIssueへ登録し、最新のopen一覧と担当範囲を確認する。別チャット内だけの未保存作業や案の完了状況は本書で判断せず、アイデアの列挙を実装指示と扱わない。

次の担当は、既存の12ラウンドゲームと戦績を維持したまま、依頼された範囲だけに着手する。個別ステージ等の基本仕様の拡張は、この文書を根拠に自動で開始しない。

## 節目で更新するもの

新しい機能や方針をmainへ統合したら、本書の実装済み項目と出典を追記する。ルールは[GAME_DESIGN.md](GAME_DESIGN.md)、構成・確認方法は[DEVELOPMENT.md](DEVELOPMENT.md)、共同作業は[COLLABORATION.md](COLLABORATION.md)を更新する。日々の担当・進捗はIssue/PRへ記録し、本書だけで予約を管理しない。
