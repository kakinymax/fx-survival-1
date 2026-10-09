# モバイル版の著作権表示とライセンス

アプリのフッター「プライバシー・ライセンス」から全文を読める。`scripts/build-mobile.mjs` は本文をHTMLとしてエスケープして同梱し、このフォルダの原文も `mobile/www/licenses/` へコピーする。ライセンス本文は編集・短縮しない。

| 同梱ファイル | 対象と原本 |
| --- | --- |
| `CAPACITOR-MIT.txt` | Capacitor core/iOS 8.5.2。インストール済みの両パッケージで同一のLICENSEを確認。[原本](https://github.com/ionic-team/capacitor/blob/8.5.2/LICENSE) |
| `CAPACITOR-APP-MIT.txt` | Capacitor App 8.1.2。インストール済みパッケージのLICENSE。[原本](https://github.com/ionic-team/capacitor-plugins/blob/%40capacitor/app%408.1.2/app/LICENSE) |
| `DOTGOTHIC16-OFL.txt` | `dist/fonts/OFL.txt` の全文をそのままコピー。フォント原本・取得元は `dist/fonts/provenance.json` |
| `APACHE-2.0.txt` | Capacitor 8.5.2に含まれるCordova由来のコードのASFヘッダーが指定するApache License 2.0。Apache Cordova iOSの[LICENSE](https://github.com/apache/cordova-ios/blob/8.0.0/LICENSE)から、別素材の「ADDITIONAL LICENSES」より前にあるApache本文・付録を同梱 |
| `CORDOVA-NOTICE.txt` | Apache Cordovaの[NOTICE](https://github.com/apache/cordova-ios/blob/8.0.0/NOTICE)を全文同梱 |

CordovaのURLの8.0.0はライセンス/NOTICEを取得した原本のタグで、アプリにCordova iOS 8.0.0を別途追加したという意味ではない。実際のiOS依存は `ios/App/CapApp-SPM/Package.swift` にあるCapacitor 8.5.2のCapacitorCordovaモジュール。既存モジュールのObjective-CソースにASFの著作権・Apacheライセンスヘッダーがあるため、トップレベルのMIT全文に加えて同梱する。

実際の最終Archiveでもフォント・HTML・原文ライセンスが保持されていることを確認する。依存を更新した場合は、バージョンと原本を再照合する。
