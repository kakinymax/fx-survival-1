# FXサバイバル フォント変更版

GitHub PagesのHTTPS試技用の独立した静的ページです。
サイトのPages設定で公開ソースを `pages/font-change-preview` ブランチの `/ (root)` に指定します。

公開URL: https://kakinymax.github.io/fx-survival-1/
リポジトリの公開設定とPagesのビルド完了、HTTPSでのHTTP 200応答を確認済みです。
公開ページを320×568、390×600、390×844、1280×900で検証し、実際に使われるドット字体、対面・CPU対戦の開始、R04の履歴、急変判定の通常・ギャップ表示、抽選1回、整数縦軸、グラフ角丸を確認しました。

`index.html` は配布済みv2 HTMLと同じバイト列です。mainのフロントをIIFEにまとめ、同梱WOFFをFontFaceに直接登録します。英数字はFX Trend Pixel、日本語はDotGothic16です。後者のライセンスをOFL.txtとHTML内に収録しています。

対面・CPU対戦、秘密注文、方向/変動率抽選、実際の確定結果に沿う急変演出、精算を試せます。
GitHub Pagesは静的ページなので、Worker/D1や認証付き戦績APIは実行されません。戦績のオンライン保存、生涯戦績、ランキング、TRIP等の通信機能は未接続です。保存成功を模擬する処理はありません。

公開状況・検証・制約の正本: https://github.com/kakinymax/fx-survival-1/issues/5
このブランチは公開成果物専用で、mainへ統合するものではありません。
