# FXサバイバル フォント変更版

GitHub PagesのHTTPS試技用の静的ページです。
公開URL: https://kakinymax.github.io/fx-survival-1/
公開ソースはpages/font-change-previewブランチの/ (root)です。

今回の版は、R02以降の注文画面で「前回○倍」の枠に相場方向・変動率・通常／ギャップと、本人の買い／売り・確定損益を表示します。対面では現在の手番プレイヤーの結果を表示し、ソロの倍率復元ボタンを維持します。初回は枠を出しません。
ソース: ui/order-previous-result-20261005 / 5a5cb04953c0af0f272c08872d0e8ced3c18d991。
変更はmain対象のdraft PR #7で共有しています。

index.htmlはフロントをIIFEにまとめ、同梱WOFFをFontFaceに直接登録した単独HTMLです。英数字はFX Trend Pixel、日本語はDotGothic16。後者のライセンスをOFL.txtとHTML内に収録しています。
この配布HTMLを320×568、390×600、390×844、1280×900でローカル検証し、実際のドット字体、前回結果・倍率復元・再読み込み・対面受け渡し・重なりや横はみ出しがないことを確認しました。公開対象SHAと公開後の検証結果は下記Issueを参照してください。

対面・CPU対戦、秘密注文、方向/変動率抽選、実際の確定結果に沿う急変演出、精算を試せます。
GitHub Pagesは静的ページなので、Worker/D1や認証付き戦績APIは実行されません。戦績のオンライン保存、生涯戦績、ランキング、TRIP等の通信機能は未接続です。保存成功を模擬する処理はありません。

公開状況・検証・制約の正本: https://github.com/kakinymax/fx-survival-1/issues/6
このブランチは公開成果物専用で、mainへの統合対象ではありません。
