# アプリの使い方・試作からの引き継ぎ

[ロードマップ](MOBILE_ROADMAP.md) / [作業Issue #10](https://github.com/kakinymax/fx-survival-1/issues/10)。現在は正式IDの限定テスト準備版。旧試作は別アプリとして残す。2026-10-09にApple登録完了・正式App ID `com.kakinymax.fxsurvival`（DescriptionはFiction eXchange）の登録に続き、本人のMacでのArchive 1.0（1）とアップロード成功を確認。TestFlightの暗号化回答保存後「テスト準備完了」と内部グループ「本人テスト」の作成・本人のみのテスター追加・ビルド1.0（1）追加を本人報告で確認。TestFlight経由のiPhone導入/起動も本人報告で確認。新しい戦績版の保存/再表示と基本操作は確認中。ストア申請・一般公開は行っていない。最新のモバイル版は本人選択の端末内戦績保存に対応する。

## 最初にユーザーが確認すること

1. Macを**macOSで起動**し、左上の →「このMacについて」でmacOS名と数字を確認。Windowsで起動したMacではXcodeは動かない。
2. iPhoneの「設定」→「一般」→「情報」でiOSバージョンを確認。
3. Androidの「設定」→「デバイス情報」または「端末情報」で機種名とAndroidバージョンを確認。メーカーにより項目名が違う。
4. 分かった機種・版をチャットへ伝える。パスワードや認証コードは送らない。

2026-10-06 JST現在のユーザー環境はiPhone SE（第3世代）/iOS27.0.1、AQUOS sense4 basic/Android12、Mac mini2018/macOS Sequoia15.8.1、Xcode26.3、Node.js24.21.0/npm11.19.0、外付けSSDのWindows11環境。試作の最低設定はiOS15.4、Android7.0/API24 + WebView105。AndroidのWebView版は未照合だが、手持ち端末で基本操作は問題なしとの報告を受領した。

当初のVentura13.7.8からSequoia15.8.1へ更新し、Xcode26.3でiPhoneへ試作を導入・起動した。両OSでCPU対戦、対面2人の注文後の受け渡し、ホームへ戻り10秒後に復帰する操作が問題なしとのユーザー報告があり、今回の試作と基本確認は完了。端末上の全項目を検証した結果ではなく、追加の実機確認はロードマップ段階4に残す。CIのシミュレータ成果物は実機用の配布物ではない。

ユーザーはバックアップを不要と明示している。バックアップ作成や別ドライブ購入を再開の条件にしない。外付け1TB SSDはWindows11起動用で、試作のために消去・用途変更しない。Windowsの再起動結果は未報告。

出典: [AppleのMac対応表](https://support.apple.com/ja-jp/120282)、[Xcode対応表](https://developer.apple.com/xcode/system-requirements/)、[Capacitor環境要件](https://capacitorjs.com/docs/getting-started/environment-setup)。

## Androidで試す

最新版のAPKへのリンクは[Issue #10](https://github.com/kakinymax/fx-survival-1/issues/10)と[PR #11](https://github.com/kakinymax/fx-survival-1/pull/11)の最終記録にある。GitHub Actionsで配布する場合は、成功した実行のページ下部Artifacts→`fx-survival-android-debug`をダウンロードし、ZIPを展開した中の`app-debug.apk`を使う。APKをAndroid本体へダウンロードし、タップして「インストール」を選ぶ。提供元の許可が求められた時は、そのAPKを開いたブラウザ/ファイルアプリに限って「この提供元を許可」を有効にし、インストール後に戻す。全体の保護機能を無効にする必要はない。Google Playからのインストールとは異なり、最新版は「Fiction eXchange」／`com.kakinymax.fxsurvival` のテスト版。旧「FXサバイバル試作」／`com.kakinymax.fxsurvival.prototype` とは別アプリとして入り、新しい戦績で始める。

APKを自分でビルドする場合はMac/WindowsのAndroid Studioで実行できる。初回のSDK取得・設定は端末情報が分かってから一緒に進める。開発者向けの再現手順は下記。USB接続による実機実行では、Androidの開発者向けオプション→USBデバッグを使い、自分のPCからの接続だけを許可する。

## iPhoneで試す

iOS用の `.app`（シミュレータ向け）はiPhoneへタップしてインストールできない。MacのXcodeからUSB接続したiPhoneへ実行する。当初の試作では無料Personal Teamも候補だったが、現在は有料登録済みの本人のTeamを使い、正式IDのTestFlight用準備を進める。

開発環境を用意した後、`npm run mobile:ios` でXcodeを開く。左のApp→TARGETSのApp→Signing & CapabilitiesでAutomatically manage signingを有効にし、自分のTeamを選ぶ。上部の実行先に接続したiPhoneを選び、▶を押す。iPhone側に「このコンピュータを信頼」や開発者モードが求められた場合だけ、画面の案内に従う。提出や公開はこの操作に含まれない。署名エラーの場合は表示された文を共有する。

### 当初の試作で使用したMacの取得・起動手順

試作の取得先として案内したフォルダは、Macのデスクトップの`fx-survival-iphone-prototype`。以下は当初の取得手順の記録。現在の正式ID版は後述の別フォルダへ取得し、この試作フォルダを上書きしない。ビルドがGitのコミット情報を使うため、ソースのZIPではなくcloneを使用する。

当初はこのフォルダに試作IDのソースをcloneし、`npm ci` と `npm run mobile:ios` で起動した。現在の正式ID版のcloneコマンドは後述の別フォルダ用を使う。

Xcodeで青いApp→TARGETSのApp→Signing & Capabilitiesを開く。Automatically manage signingを有効にし、本人のTeam（無料の場合はPersonal Team）を選ぶ。iPhoneをUSBで接続・ロック解除し、実行先に選んで▶を押す。Register Deviceが出たら登録する。Run中にキーチェーン「ログイン」のパスワードを求められた場合は、通常Macのログインパスワードを本人が入力して「許可」を押す。

今回出た「Developer Mode disabled」は、iPhoneの設定→プライバシーとセキュリティ→開発者モードをオンにし、再起動後の確認を完了して解消した。続く「Developer App Certificate is not trusted」は、iPhoneの設定→一般→VPNとデバイス管理→今回のApple AccountのデベロッパAppを開き、「FXサバイバル試作」が対象であることを確認して本人の証明書を信頼する手順で解消し、起動できたとの報告を受領した。確認・再起動は実際の画面の案内に従う。Xcodeの推奨設定変更ダイアログにはCancelを案内した。推奨設定の変更を起動の前提にしない。

### 旧試作フォルダからの再起動・再導入

旧試作IDのソースを保持したフォルダだけを使う。正式ID版は次節の別フォルダを使う。iPhoneをMacに接続し、ロックを解除する。ターミナルで次を1行ずつ実行する。

```sh
cd ~/Desktop/fx-survival-iphone-prototype
npm run mobile:ios
```

XcodeのAppターゲットで本人のTeamと実行先のiPhoneを確認し、▶を押して導入・起動する。無料Personal Teamのプロビジョニングは発行から7日で期限切れになり、その場合は再ビルド・再導入が必要。今回は署名チームの表示や実機ビルドの個別ログを受領していないため、ユーザーの実際の署名種別・期限を断定しない。エラーが出たら表示文を保存して対応する。

出典: [Appleの個人実機試験とPersonal Teamの制約](https://developer.apple.com/jp/help/account/basics/about-your-developer-account/)、[Xcodeの実機実行](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)、[開発者モード](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)。

## 正式IDのテスト版を別フォルダに取得する（2026-10-09）

現在のブランチは正式名 `Fiction eXchange`／正式ID `com.kakinymax.fxsurvival` のテスト版を生成する。本人は新しい戦績で始めると選択した。旧試作 `com.kakinymax.fxsurvival.prototype` とは別アプリになり、旧試作とその記録は残す。最新ソースを旧試作の更新用とは扱わない。

旧試作のMacフォルダには本人の署名設定などの変更があり得るため、別フォルダへcloneする。ターミナルで次を1行ずつ実行し、処理の終了を待ってから次へ進む。エラーが出たらその行で止め、表示文を報告する。既存フォルダの削除・強制reset/cleanはしない。

```sh
git clone --branch mobile/prototype-20261005-codex-root --single-branch https://github.com/kakinymax/fx-survival-1.git ~/Desktop/fiction-exchange-iphone
cd ~/Desktop/fiction-exchange-iphone
npm ci
npm run mobile:ios
```

Xcodeで青いApp → TARGETSのApp → Signing & Capabilitiesを開く。Automatically manage signingを有効にし、本人の有料Teamを選ぶ。Bundle Identifierは `com.kakinymax.fxsurvival`、GeneralのVersionは1.0、Buildは1を確認する。Team名・メール・証明書・秘密鍵は共有しない。

この取得/設定の操作だけでは、Archiveやアップロード成功とは扱わない。2026-10-09には本人が有料Teamを選択し、Archive 1.0（1）の作成とXcodeアップロード成功を確認した。同梱情報の元コードは `fc8b6e5bb99722ce661d44837fcc6487d01ce010`、未コミット変更なし、端末内保存・オンライン保存なし、正式名/IDが一致し、mobile.jsのSHA256も検証済み資産と一致した。TestFlightは暗号化の回答保存後「テスト準備完了」と本人報告。「本人テスト」グループに本人のみとビルド1.0（1）を追加済みで、TestFlightからiPhoneへ導入して開けたと本人が報告。新しい戦績版の保存/再表示と基本操作を確認する。[登録・配布手順](MOBILE_DISTRIBUTION.md)に証拠と次の本人操作を保存する。今回の文書更新だけではMacの取得し直し・再ビルドを求めない。一般公開は後続指示で扱う。

正式版フォルダを後日更新する場合は、先に `git status --short --branch` で本人の変更を確認する。変更がない場合だけ `git pull --ff-only`、`npm ci`、`npm run mobile:ios` の順で更新する。変更がある場合は保存してから対応し、署名設定を捨てる操作をしない。

## 試す操作

対面2人で開始し、Aの注文確定後にBの入力が未選択になることを確認。全注文を公開し、方向と値動きを別々に抽選して精算。続行/資産確定を選び、最後の結果を確認する。CPU対戦も開始し、資産確定後の観戦/早送りを試す。試合の途中でホームに戻ってからアプリを開き直し、未確定入力はリセット、確定した相場は維持されることを確認する。

画面上部/下部のボタンが時刻・ノッチ・ホームバーと重ならないか、倍率入力中でも確定ボタンを押せるか、縦横で横はみ出しがないかを見る。Androidの戻るは、開いている説明を閉じる→戦績からゲームへ戻る→ゲーム画面ではアプリを背面へ送る。前のプレイヤーの秘密注文へ戻らない。

最新のモバイル版は確定レコードとTRIP設定を端末内に保存し、完成UIの履歴・生涯戦績・歴代記録・TRIP・モード別・殿堂・自己ベスト/CPUの前回記録を表示する。対面は履歴と「人間全体」へ保存し、本人未指定のため生涯戦績へは合算しない。試合終了後の「この端末にゲームの戦績を保存しました」を確認する。保存失敗時は同じ記録を再試行でき、成功を確認するまで送信待ちから除かない。旧試作の送信待ちは同じ試作ID・署名で更新できた場合に取り込む。ログインや外部API通信はなく、端末間/Web版との同期はない。削除/データ消去で失われる。本人が正式版は新しい戦績で始めると選択したため、別アプリからの移行・削除処理は追加しない。旧試作は残す。

## 開発者向け再現手順

Node.js22以上（検証環境は24）、JDK21、Android SDK36/Build Tools36、iOSはXcode26以上を使う。依存はlockで固定。WebのWorker/D1を動かさなくても試作を生成できる。

```sh
git clone --branch mobile/prototype-20261005-codex-root https://github.com/kakinymax/fx-survival-1.git fx-survival-mobile
cd fx-survival-mobile
npm ci
npm run mobile:sync
```

- 画面をブラウザで確認: `npm run mobile:preview` → 表示されたローカルURLを開く（標準4174）。ネイティブの実機動作確認とは別。
- Android Studioを開く: `npm run mobile:android`。SDKはIDEのSDK ManagerでAndroid API36とBuild Tools36.0.0を導入。
- Android debug APK: macOS/Linuxでは `npm run mobile:apk`。Windowsでは `npm run mobile:sync` 後、PowerShellで `cd android`、`./gradlew.bat assembleDebug`。出力 `android/app/build/outputs/apk/debug/app-debug.apk`。debug署名の試作で、ストア提出用ではない。
- iOS Xcodeを開く: macOSで `npm run mobile:ios`。Swift Package Managerを使用し、CocoaPodsの導入は不要。
- iOSシミュレータ向けコンパイル（Mac）:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build
```

検証: `npm test`、`npm run build`、`npm run mobile:sync`。別ターミナルで `npm run mobile:preview` を起動して `npm run mobile:check`。初回に `npx playwright install chromium` が必要。Linuxでインストール済みChromiumを使う場合は `CHROMIUM_PATH`、URL変更は `MOBILE_BASE_URL` を指定できる。モバイル確認は実際のIndexedDBを使い、取引のコミット/中断・競合・旧キューの取り込み・TRIP境界/再試行・大きな整数/ページング・ブラウザプロセス再起動後の保存を確認する。通常Webは既存のWorker/D1ブラウザ検証で別に確認する。

CI `.github/workflows/mobile-prototype.yml` はPRのWeb確認、Android APKコンパイル、MacでのXcode26.3/27.0を指定した署名なしiOSシミュレータ向けコンパイル・インストール・起動。Xcode27ランナーはpreviewのため、その状態と実行結果を記録する。CIの `.app` は実機IPAではない。GitHub Actionsの実行結果が成功したことを確認してからIssue/PRへ記録する。

## ファイルと残件

`dist/platform.js` と `dist/app.js` はWeb/モバイルの表示と保存先の切替。通常Webは既存認証/保存を使う。モバイルは `mobile/local-api.js` から `mobile/local-records.js` のIndexedDBへ接続し、既存の `dist/record-store.js` の送信待ち形式と再試行を使う。`server/` の集計関数は同梱して再利用するが、Worker/D1や外部APIは使わない。モバイル固有の起動・戻る・安全領域は `mobile/`。生成処理は `scripts/build-mobile.mjs`、設定は `capacitor.config.json`、OS別は `android/` と `ios/`。

生成資産 `mobile/www/` の `build-info.json` に元コミットと未コミット変更の有無が入る。APK等のログと一緒に参照する。`mobile/www/`、コピー先のpublic、SDK/署名ファイル/ローカル設定/ビルド出力はGit管理しない。既存Sites/Pagesは更新しない。

残件は、対面3〜6人、12ラウンド/早期終了/ギャップの個別照合、キーボード・安全領域・縦横・Android戻る・アプリ強制終了後の挙動、実機上のビルド版/資産の照合、正式アイコン、Androidの配布署名、新しい端末内保存版の実機操作/保存結果、掲載文・プライバシー・ストア申請。旧試作での導入・起動と基本3項目は両OSで問題なしとの報告を受領済み。本人のMacでの正式ID、有料Team選択、Archive生成・同梱資産照合・アップロード成功は確認済みだが、正式版の実機確認とは区別する。デフォルトのCapacitorアイコン/起動画面は試作用で、掲載準備段階で作り直す。

## 今回確認できた範囲

アプリコードの検証基準は`9919ee7`。[CI 37290829957](https://github.com/kakinymax/fx-survival-1/actions/runs/37290829957)でWeb/Android/iOS26.2/iOS27.0の4ジョブが成功。ユニット138件、モバイル生成/両OS同期、スマホ3サイズと安全領域・横向き・ルールダイアログ・オフラインの秘密注文/通常/ギャップ/CPU終了/再開、API通信なしを確認。通常Webのcompact-ui/records-browser/solo-browserも実際のローカルWorker/D1で成功。Android APKのビルド/署名検証、両iPhoneシミュレータのコンパイル/インストール/起動と開始画面を確認した。成果物のSHAとURLはIssue/PRを参照する。

実機はユーザー報告として次を保存する。Codexの自動検証とは別の証拠で、個別ビルドログ・署名チーム・端末のビルド版/資産は未照合。

| 端末 | 導入・起動 | CPU対戦 | 対面2人の注文後の受け渡し | ホームへ戻り10秒後に復帰 |
| --- | --- | --- | --- | --- |
| AQUOS sense4 basic / Android12 | Google Files経由で導入・起動 | 問題なし | 問題なし | 問題なし |
| iPhone SE（第3世代）/ iOS27.0.1 | Xcode26.3の手順で導入し、証明書信頼後に起動 | 問題なし | 問題なし | 問題なし |

Androidは2026-10-05 JST、iPhoneは2026-10-06 JSTの報告。試作と基本確認は完了。2026-10-06の後続指示で段階3「開発者登録・配布準備」を再開し、[登録・配布手順](MOBILE_DISTRIBUTION.md)にApple Accountの氏名確認、個人登録、費用、署名と限定配布の具体的手順を保存した。2026-10-09にApple登録完了報告・App Store Connectアクセス・Xcode開発者機能有効を確認し、端末内保存を採用/実装した。Appleの正式App ID登録も確認済み。App Store Connectレコード作成も確認。正式名/IDをコードへ反映し、新しい戦績で始める方針を確認。iOSは正式IDのArchive 1.0（1）とアップロード成功・TestFlightへの表示を確認。暗号化回答保存後「テスト準備完了」・内部グループ作成・本人のみのテスター追加・ビルド1.0（1）追加を本人報告で確認。TestFlight経由の導入/起動も本人報告で確認。新しい戦績版の保存/再表示・基本操作は確認中。Google登録、Androidの配布署名AAB/限定配布、料金/広告/課金は未完了。mainは未統合、PR #11はdraft、親Issue #10はopenを維持する。一般公開の申請・公開は後続指示で進める。

## 安全性更新後の実機確認（2026-10-07）

mainの安全性修正をこの試作ブランチへ正式に統合。Androidはバックアップと端末移行を無効にし、FileProviderを`cache/shared/`に限定。iOSは`Library/WebKit`を起動時・復帰時にバックアップから除外する。既存のゲーム／未送信レコードは消去しない。署名・正式アプリID・登録手続きは従来の方針を維持する。

更新版の実機確認はユーザーの指定で後日。以前の版で報告されたAndroid／iPhoneの起動・対戦・復帰の成功は、更新版の確認とは区別する。以下は旧試作IDの更新用に記録した手順。現在の正式ID版は前述の別フォルダとTestFlight手順を使い、旧試作へ上書きしない。

1. Macでこのブランチをpullし、`npm ci`、`npm run mobile:sync`を実行する。既存のiPhone署名設定を使ってXcodeから同じ試作アプリへ更新する（アンインストールしない）。
2. Androidは最新CIのdebug APKと既存版の署名一致を確認してから同じアプリへ上書き導入する。CIごとのdebug署名が同じとは限らず、この一致は未照合。更新が拒否された場合は削除せず、署名・記録移行の対応を先に確認する。
3. 両端末で起動、対面の秘密注文、ソロの終了、画面回転、バックグラウンドからの復帰、再起動後の進行中ゲームと保存済み履歴/生涯戦績/TRIP、旧未送信レコードの取り込みを確認する。外部サイトの読み込み・オンライン保存は行わない。
4. 結果と端末／OSをIssue #10へ記録する。署名期限切れのiPhoneは本書の再導入手順を使う。

## 端末内戦績版の自動検証（2026-10-09）

- ユニット157件、Web/モバイルの生成と両OSへの同期、依存監査0を確認。
- 実際のIndexedDBで保存のコミット/中断、同一試合の競合、旧送信待ちの取り込み、保存領域が使えない時のエラー表示を確認。
- 履歴・本人/人間/CPUの分離・TRIPの境界/名前/リセット/再試行・大きな整数・20件を超える殿堂ページング、ブラウザプロセス再起動、スマホ3サイズと横向き、外部API/外部資産の通信なしを確認。
- 通常Webは実際のWorker/D1で保存/再読込/競合/障害後の再試行、本人所有権、入力検証/頻度制限、CSPを確認。Webの認証付き保存を維持する。
- この版の両OSネイティブCI結果とコミットはIssue #10/PR #11の最新記録に保存する。正式名/ID反映後の元コード `fc8b6e5` はCIのWeb/Android/iOS26.2/iOS27.0で成功し、本人のiOS Archive同梱資産と一致した。iOSアップロード成功後、暗号化回答保存によるTestFlightの「テスト準備完了」と内部グループ作成・本人のみのテスター追加・ビルド1.0（1）追加を本人報告で確認。TestFlight経由のiPhone導入/起動も本人報告で確認。新しい版の戦績保存/再表示と基本操作、Androidの配布署名AABは残件。従来の実機成功をこの更新版の成功とは扱わない。
