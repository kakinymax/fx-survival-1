# 現在地と引き継ぎ

確認日: 2026-10-04 UTC。コードの基準: [`35306e5`](https://github.com/kakinymax/fx-survival/commit/35306e5514deb233fff22d63f2b787386108f29f)。本書は節目の要約であり、以後の進行中作業は[open Issues](https://github.com/kakinymax/fx-survival/issues?q=is%3Aissue%20is%3Aopen)と[open PRs](https://github.com/kakinymax/fx-survival/pulls?q=is%3Apr%20is%3Aopen)を必ず確認する。

## 実装済み

| 領域 | 内容 |
| --- | --- |
| 基本ゲーム | 最大12ラウンド、対面2〜6人、秘密注文、1〜100倍、通常ロスカット、ギャップ負債、永久の資産確定、同率勝利・勝者なし |
| ステージ | 全員共通のベーシック、ドル円、トルコリラ円 |
| CPU対戦 | 固定3人格、先に注文・進退を確定、結果に沿うセリフ、観戦・早送り |
| 戦績 Phase 1〜7 | 試合保存、生涯、歴代記録、TRIP A/B、モード別、殿堂入り、実際の履歴に基づく振り返り |
| 操作・結果 | 倍率の試算、ソロの前回倍率、同じ設定で再戦、早送りの見せ場、5〜6人のスクロール案内 |
| 周回の記録 | ソロ自己ベスト通知、CPUの通算戦績と前回結果に沿う紹介 |
| UI | コンパクトな設定・秘密入力・注文一覧・一括進退・抽選。方向と値動きは別ボタン |
| 相場の表示 | 履歴、急変判定の確定値に沿う足の演出、白黒のドット描画・同梱のピクセル字体 |
| 順位 | 現在・精算・最終・保存済み試合の順位。同率と確定・退場者も含む |

## 直近の変更の出典

- [PR #1](https://github.com/kakinymax/fx-survival/pull/1): UI刷新6単位。2026-10-03に統合。本スレッドでは公開成功を確認し、ユーザーも動作確認済み。
- [`c3ae013`](https://github.com/kakinymax/fx-survival/commit/c3ae013f0b3737b2695eaaf48e9d871b6265882b): 順位の表示と並べ替え。2026-10-03に公開成功を確認。
- [PR #2](https://github.com/kakinymax/fx-survival/pull/2): ピクセル字体・白黒トレンド・小画面の順位表示調整。2026-10-04に `35306e5` として統合。検証結果はPR本文を参照。本書の作成時点では、この版の本番公開状況は別途照合していない。
- [Issue #3](https://github.com/kakinymax/fx-survival/issues/3): 共同作業の文書と手順。現在の状態・完了結果はIssueを参照する。アプリの変更・再公開は対象外。

公開先: https://fx-survival-table.asai-ram.chatgpt.site/

GitHubの最新mainが公開先と一致するとは限らない。公開作業時はSitesの成功した公開結果と対象コミットを確認する。`v1.0.0` は過去の安定版を指すタグで、最新mainの別名ではない。

## 未完了・今後の案

この文書の作成開始時点で、GitHub上に本Issue以外のopen作業Issue/PRはなかった。別チャット内だけの未保存作業や案の完了状況までは判断できない。新しい依頼はIssueへ登録し、依頼・検討段階・実装中を区別する。アイデアの列挙を実装指示と扱わない。

次の担当は、既存の12ラウンドゲームと戦績を維持したまま、依頼された範囲だけに着手する。個別ステージ等の基本仕様の拡張は、この文書を根拠に自動で開始しない。

## 節目で更新するもの

新しい機能や方針をmainへ統合したら、本書の実装済み項目と出典を追記する。ルールは[GAME_DESIGN.md](GAME_DESIGN.md)、構成・確認方法は[DEVELOPMENT.md](DEVELOPMENT.md)、共同作業は[COLLABORATION.md](COLLABORATION.md)を更新する。日々の担当・進捗はIssue/PRへ記録し、本書だけで予約を管理しない。
