# アプリ試作の使い方・引き継ぎ

[ロードマップ](MOBILE_ROADMAP.md) / [作業Issue #10](https://github.com/kakinymax/fx-survival-1/issues/10)。今回は端末でゲームを試すための版。ストア申請・公開と有料の開発者登録はまだ行っていない。

## 最初にユーザーが確認すること

1. Macを**macOSで起動**し、左上の →「このMacについて」でmacOS名と数字を確認。Windowsで起動したMacではXcodeは動かない。
2. iPhoneの「設定」→「一般」→「情報」でiOSバージョンを確認。
3. Androidの「設定」→「デバイス情報」または「端末情報」で機種名とAndroidバージョンを確認。メーカーにより項目名が違う。
4. 分かった機種・版をチャットへ伝える。パスワードや認証コードは送らない。

ユーザーの手持ちはiPhone（iOS27.0.1）、AQUOS sense4 basic（Android12）、Mac mini 2018（macOS Ventura13.7.8）、Windows環境。試作の最低設定はiOS15.4、Android7.0/API24 + WebView105。古いAndroidではPlayストアから「AndroidシステムのWebView」と「Google Chrome」の更新を確認する。起動できない時は更新案内を出す。

現在のVentura13.7.8では必要なXcode26を動かせない。Mac mini 2018はSequoiaに対応。Xcode26.3はmacOS15.6以降に対応するので候補にする。最新版XcodeがこのMacで動くとは限らない。手持ちiPhoneのiOS27.0.1をXcode26.3から署名・インストールできるかは未確認。iOS27シミュレータ向けにはGitHubのXcode27ランナーでビルドと起動を検証する。CIビルドだけでiPhoneにインストール可能にはならず、実機用署名・配布は後続段階で扱う。OSの再インストールや非公式パッチを試作の前提にしない。更新を案内する際は現在のOS・空き容量・バックアップを確認してから具体的に案内する。

出典: [AppleのMac対応表](https://support.apple.com/ja-jp/120282)、[Xcode対応表](https://developer.apple.com/xcode/system-requirements/)、[Capacitor環境要件](https://capacitorjs.com/docs/getting-started/environment-setup)。

## Androidで試す

最新版のAPKへのリンクは[Issue #10](https://github.com/kakinymax/fx-survival-1/issues/10)と[PR #11](https://github.com/kakinymax/fx-survival-1/pull/11)の最終記録にある。GitHub Actionsで配布する場合は、成功した実行のページ下部Artifacts→`fx-survival-android-debug`をダウンロードし、ZIPを展開した中の`app-debug.apk`を使う。APKをAndroid本体へダウンロードし、タップして「インストール」を選ぶ。提供元の許可が求められた時は、そのAPKを開いたブラウザ/ファイルアプリに限って「この提供元を許可」を有効にし、インストール後に戻す。全体の保護機能を無効にする必要はない。Google Playからのインストールとは異なり、試作名は「FXサバイバル試作」。正式版とは別のapp IDを使う。

APKを自分でビルドする場合はMac/WindowsのAndroid Studioで実行できる。初回のSDK取得・設定は端末情報が分かってから一緒に進める。開発者向けの再現手順は下記。USB接続による実機実行では、Androidの開発者向けオプション→USBデバッグを使い、自分のPCからの接続だけを許可する。

## iPhoneで試す

iOS用の `.app`（シミュレータ向け）はiPhoneへタップしてインストールできない。MacのXcodeからUSB接続したiPhoneへ実行する。Apple Accountの無料Personal Teamでの個人実機確認を第一候補とし、署名の有効期限・対象端末の制約がある。有料のApple Developer Program登録は、TestFlight等の配布を進める段階で扱う。

開発環境を用意した後、`npm run mobile:ios` でXcodeを開く。左のApp→TARGETSのApp→Signing & CapabilitiesでAutomatically manage signingを有効にし、自分のTeamを選ぶ。上部の実行先に接続したiPhoneを選び、▶を押す。iPhone側に「このコンピュータを信頼」や開発者モードが求められた場合だけ、画面の案内に従う。提出や公開はこの操作に含まれない。署名エラーの場合は表示された文を共有する。

## 試す操作

対面2人で開始し、Aの注文確定後にBの入力が未選択になることを確認。全注文を公開し、方向と値動きを別々に抽選して精算。続行/資産確定を選び、最後の結果を確認する。CPU対戦も開始し、資産確定後の観戦/早送りを試す。試合の途中でホームに戻ってからアプリを開き直し、未確定入力はリセット、確定した相場は維持されることを確認する。

画面上部/下部のボタンが時刻・ノッチ・ホームバーと重ならないか、倍率入力中でも確定ボタンを押せるか、縦横で横はみ出しがないかを見る。Androidの戻るは、開いている説明を閉じる→戦績からゲームへ戻る→ゲーム画面ではアプリを背面へ送る。前のプレイヤーの秘密注文へ戻らない。

オンライン戦績は試作では未接続。確定レコードは端末内に送信待ちとして残すが、生涯戦績・TRIP・自己ベスト等は表示しない。試作削除/データ消去で記録が消える。Web版との同期・正式版への移行は未実装。重要な結果は画面を控える。

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

検証: `npm test`、`npm run build`、`npm run mobile:sync`。別ターミナルで `npm run mobile:preview` を起動して `npm run mobile:check`。初回に `npx playwright install chromium` が必要。Linuxでインストール済みChromiumを使う場合は `CHROMIUM_PATH`、URL変更は `MOBILE_BASE_URL` を指定できる。モバイル確認はAPI保存成功を模擬せず、通信なし・確定レコードの送信待ち保持を確認する。通常Webは既存のWorker/D1ブラウザ検証で別に確認する。

CI `.github/workflows/mobile-prototype.yml` はPRのWeb確認、Android APKコンパイル、MacでのXcode26.3/27.0を指定した署名なしiOSシミュレータ向けコンパイル・インストール・起動。Xcode27ランナーはpreviewのため、その状態と実行結果を記録する。CIの `.app` は実機IPAではない。GitHub Actionsの実行結果が成功したことを確認してからIssue/PRへ記録する。

## ファイルと残件

`dist/platform.js` と `dist/app.js` はWeb/試作の表示と通信の切替。通常Webには試作マーカーがなく、既存認証/保存を使う。`dist/record-store.js` の `autoRetry:false` は送信を止め、既存の送信待ち形式を保持する。モバイル固有の起動・戻る・安全領域は `mobile/`。生成処理は `scripts/build-mobile.mjs`、設定は `capacitor.config.json`、OS別は `android/` と `ios/`。

生成資産 `mobile/www/` の `build-info.json` に元コミットと未コミット変更の有無が入る。APK等のログと一緒に参照する。`mobile/www/`、コピー先のpublic、SDK/署名ファイル/ローカル設定/ビルド出力はGit管理しない。既存Sites/Pagesは更新しない。

残件は、両OSの実機起動・不具合修正、iOSのローカルXcodeビルド、正式アイコンと配布署名、オンライン戦績の認証/保存方針、正式app IDと記録移行、掲載文・プライバシー・ストア申請。現在のビルド/CI結果はIssue/PRの最新記録を参照する。デフォルトのCapacitorアイコン/起動画面は試作用で、掲載準備段階で作り直す。

## 今回確認できた範囲

ユニット138件、モバイル生成/両OS同期、スマホ3サイズと安全領域・横向き・ルールダイアログ・オフラインの秘密注文/通常/ギャップ/CPU終了/再開、API通信なしを確認。通常Webのcompact-ui/records-browser/solo-browserも実際のローカルWorker/D1で成功。Android debug APKのビルドと署名検証、お手元のOSと同じiOS27のシミュレータでコンパイル/インストール/起動・画面目視を確認した。最終CIのSHA・結果と成果物URLはIssue/PRの最新記録を参照する。手持ち端末への導入・操作、Xcodeの実機署名・配布はまだ確認していない。
