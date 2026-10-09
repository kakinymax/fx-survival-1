# 開発者登録・配布準備（段階3）

更新: 2026-10-09 JST。正本は[Issue #10](https://github.com/kakinymax/fx-survival-1/issues/10) / [draft PR #11](https://github.com/kakinymax/fx-survival-1/pull/11)。担当 `mobile-prototype-20261005-codex-root`、固有ブランチ `mobile/prototype-20261005-codex-root`。6段階の全体像は[ロードマップ](MOBILE_ROADMAP.md)、試作の再導入は[試作手順](MOBILE_APP.md)を参照する。

段階3を継続中。Appleの支払・登録完了を本人報告で確認し、App Store Connectのアプリ一覧へのアクセスと、Xcode開発者チームのCertificates, Identifiers & Profiles有効・実機1台登録を画面で確認した。正式App ID `com.kakinymax.fxsurvival` をDescription「Fiction eXchange」で登録済みと確認した。App Store ConnectにFiction eXchangeのiOSアプリ1.0「提出準備中」とTestFlightタブが表示され、アプリレコード作成を確認した。正式名/IDをコードへ反映。本人のMacでの署名・Archive・限定配布はまだ未確認。レコードのBundle ID/SKUはこの画面だけでは確認しない。Google登録は未報告。登録名義は個人。個人情報や秘密値は保存しない。一般公開の審査・申請・リリースは後続指示で進める。

## 登録時の本人情報の確認（実施済み）

Appleの個人開発者登録には、本人確認書類と一致する正式な氏名が必要で、App Storeの販売者名にもその氏名が表示される。ログイン用メールアドレスがニックネーム由来でも、それだけを理由にメールアドレスを変更する必要はない。氏名欄とメールアドレスを区別する。

1. iPhoneまたはMacのSafariで[Apple Account](https://account.apple.com/)を開き、試作で使った本人のApple Accountでサインインする。
2. 「個人情報」を開き、「名前」の氏名欄を確認する。
3. 氏名欄がニックネームなら、本人確認書類と一致する姓・名へ更新する。既に正式な氏名なら更新は不要。メールアドレスやパスワードはこの作業のために変更しない。
4. チャットには「氏名欄を確認した」「本名へ変更した」等の作業状況だけを伝える。実名・住所・本人確認書類・パスワード・確認コードは送らない。

氏名欄が見当たらない場合は、個人情報を除いた項目名を確認して案内する。Apple Developer登録時の氏名と販売者名は独立した登録情報で、登録後にApple Accountの表示名を変えても販売者名は自動では変わらない。個人登録で屋号やニックネームを正式氏名として申請しない。

出典: [Appleの登録条件と販売者名](https://developer.apple.com/jp/help/account/membership/program-enrollment)、[登録後のアカウント情報の更新](https://developer.apple.com/jp/help/account/membership/updating-your-account-information)。

## 費用・準備するもの

金額と条件は2026-10-06に公式情報で確認。実際の現地通貨額・税・支払方法は登録画面で本人が確認する。

| 項目 | Apple Developer Program | Google Play Console |
| --- | --- | --- |
| 登録料 | 年99米ドル相当。Apple Developerアプリ経由は年単位の自動更新 | 一度だけ25米ドル |
| 個人登録 | 2ファクタ認証を有効にしたApple Account、正式な氏名、本人確認、支払方法 | Google Account、正式な氏名・住所、本人確認、連絡先と支払方法 |
| 公開される情報 | 個人登録の販売者名は正式な氏名 | 個人の氏名・国・公開用メールアドレス。収益化する場合は詳細住所も公開される |
| 最初の配布案 | 本人を対象にTestFlight内部テスト | 本人を対象にGoogle Play内部テスト |

登録料はアプリを無料にしても必要。Googleの表示用デベロッパー名を別名にしても、本人確認用の氏名が不要になるわけではない。地域や販売方式による追加の公開情報は掲載準備段階で確認する。組織登録へ方針を変える場合は、法人・D-U-N-S等の条件を再確認してから進める。

出典: [Appleの登録料](https://developer.apple.com/jp/help/account/membership/program-enrollment)、[Googleの登録料](https://support.google.com/googleplay/android-developer/answer/6112435?hl=ja)、[Googleの登録情報・公開範囲](https://support.google.com/googleplay/android-developer/answer/13628312?hl=ja)。

## Appleの個人登録

氏名欄の確認後、次を1段階ずつ案内し、報告で状況を更新する。iPhoneにはiCloudへのサインインとパスコード等を設定し、登録手続きは同じ端末で行う。

1. iPhoneで[Apple Developer（Apple製のアプリ）](https://apps.apple.com/jp/app/apple-developer/id640199958)を入手・起動する。アプリの入手自体は無料。
2. 「Account／アカウント」を開き、試作で使った本人のApple Accountでサインインする。求められた契約を本人が確認する。
3. 「Enroll Now／今すぐ登録」を開き、個人（Individual）として登録する。正式な氏名・連絡先を本人が入力し、画面に従い写真付き身分証等による本人確認を行う。
4. 登録内容と契約、表示された年額・自動更新・支払方法を本人が確認して購入する。Apple Account残高やギフトカード残高はこのメンバーシップの支払方法に使えない。
5. 完了通知と[Developer Account](https://developer.apple.com/account/)のメンバーシップ状況を確認する。申込済み・本人確認中・購入済み・有効化済みを区別して報告する。
6. MacのXcode → Settings → Apple Accountsで同じApple Accountを確認する。登録が有効になったTeamを使って準備する。無料Personal Teamの実機Run成功と有料メンバーシップの有効化は別の証拠として扱う。

有料メンバーシップの登録完了を本人が報告済み。App Store Connectのアプリ一覧とXcodeの開発者チーム機能を確認した。これは配布用Archiveの署名成功とは区別する。Codexは本人のアカウント内を操作していない。登録情報や金額の画面が異なる場合は実際の文言に合わせて案内する。

出典: [Apple Developerアプリでの登録・本人確認・購入](https://developer.apple.com/help/account/membership/enrolling-in-the-app)。

## Google Playの個人登録

1. MacまたはWindowsのブラウザで[Google Play Console](https://play.google.com/console/)を開き、本人が今後管理するGoogle Accountでサインインする。
2. 登録画面で個人用を選び、デベロッパー名・正式な氏名/住所・連絡先・公開用メールアドレス等を画面の指示に従って入力する。公開用メールアドレスは長期に管理できるものを本人が選ぶ。
3. 契約と登録料25米ドル、実際の決済額を本人が確認して支払い、本人確認とメール/電話の確認を完了する。登録済みと本人確認済みを区別して記録する。
4. 新しい個人アカウントで求められるAndroid実機の確認を行う。ブラウザのアカウント準備欄からデバイス確認を開始し、AndroidにGoogle製Play Consoleアプリを入れ、登録に使った所有者のGoogle Accountでサインインして画面の手順を進める。
5. Consoleのデバイス確認・本人確認が完了したことを本人が確認する。

デバイス確認はAndroid10以上のroot化していない実機が対象。手持ちAQUOS sense4 basic/Android12はOS条件を満たすが、root状態・Play Consoleアプリの導入・確認完了は未確認。端末が古いという理由だけで買い替えを条件にしない。

出典: [Googleの登録手順](https://support.google.com/googleplay/android-developer/answer/6112435?hl=ja)、[必要な情報](https://support.google.com/googleplay/android-developer/answer/13628312?hl=ja)、[Android実機の確認](https://support.google.com/googleplay/android-developer/answer/14316361?hl=ja)。

## 正式版を作る前に決める項目

以下は本人が選んだ方針と未決事項。Appleの正式App IDは登録済み。正式版コードへID/表示名を反映した。本人は正式版の戦績を新しく始めると選択。配布用署名/Archiveは未実施。

| 項目 | 提案 / 決めること | 現在の結果 |
| --- | --- | --- |
| 正式アプリ名 | Fiction eXchange。2026-10-09に本人が正式名として指定 | AppleのApp IDはDescription「Fiction eXchange」で登録済み。App Store Connectでも同名のレコード作成を確認。新しいアプリの表示名と同梱タイトルに反映。旧試作は別アプリとして残す |
| 正式アプリ識別子 | iPhone用は `com.kakinymax.fxsurvival` で登録済み。Android用も同じ識別子でテストする | Capacitor/iOS/AndroidとCIの起動IDを `com.kakinymax.fxsurvival` へ統一。Play Consoleの登録・署名・配布は未実施 |
| 試作の記録 | 2026-10-09に本人が「正式版は新しい戦績で始める」を選択 | 旧試作は別IDのまま残す。別アプリからの移行・削除処理は追加しない。正式IDのアプリ更新ではそのアプリ内の保存を継続する |
| 戦績 | 2026-10-09に本人が端末内保存を選択。ログインなし、各端末で独立 | IndexedDBに確定レコード/TRIP設定を保存。履歴・生涯/歴代/モード別戦績・殿堂・自己ベスト/CPU前回記録を完成UIで表示。新しい版の実機確認は未実施 |
| 料金・広告・課金 | 本人回答は未定 | 今回の限定テスト版に支払・広告・課金処理は追加しない。無料公開の決定とは扱わない |
| 配布対象 | 最初は本人の両OS。第三者の人数・参加方法は後で指定 | テスターの招待・連絡は未実施 |
| 署名の管理 | Appleは本人のMac/Xcodeの有料Team。AndroidはPlayアプリ署名と本人管理のアップロード鍵を使う案 | 配布署名・鍵保管先は未確定。クラウドに秘密鍵を生成/保存していない |

AppleのBundle IDは初回ビルドをApp Store Connectにアップロードした後に変更できない。正式IDと保存/移行の方針を先に確定する。ゲーム確率・BigInt・確定レコード・秘密注文の処理は維持する。

出典: [AppleのBundle ID](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)、[Androidの署名管理](https://developer.android.com/studio/publish/app-signing?hl=ja)。

## 正式App ID登録の本人操作（登録済み）

2026-10-09に本人のIdentifiers一覧で、Description「Fiction eXchange」／`com.kakinymax.fxsurvival` の登録済み表示を確認した。既存の `com.kakinymax.fxsurvival.prototype` も残っており、試作の設定と一致する。以下は実施した手順の記録。App Store Connectのアプリレコード作成も次節の本人の画面で確認済み。

1. [Apple DeveloperのIdentifiers](https://developer.apple.com/account/resources/identifiers/list)で＋ → App IDs → Continue。種類が表示されればAppを選ぶ。
2. Descriptionに `Fiction eXchange` を入力する。大文字のXを含め、本人が指定した表記を使う。
3. Bundle IDはExplicitを選び、`com.kakinymax.fxsurvival` を入力する。正式名を変えても、識別子を名前に合わせて変更する必要はない。
4. Capabilitiesを追加で選ばずContinue。確認画面のIDを確認してRegister。
5. 登録後の一覧で正式IDと試作IDが別行に表示されることを確認。本人の画面で確認済み。

DescriptionはApple Developer内の管理名。App Store Connectのアプリ名と端末上の表示名は別途設定する。Descriptionの登録だけでストアの名前を予約したことや掲載済みとは扱わない。

出典: [AppleのApp ID登録](https://developer.apple.com/help/account/identifiers/register-an-app-id/)、[App Store Connectのアプリレコード作成](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)。

## App Store Connectのアプリレコード作成（作成確認済み）

2026-10-09に本人の画面でFiction eXchange／iOSアプリ1.0「提出準備中」・TestFlightタブを確認した。以下は案内した作成手順の記録。審査提出・一般公開や署名済みビルドのアップロード成功は、この画面から確認したとはしない。

1. MacのSafariで[App Store Connect](https://appstoreconnect.apple.com/)へサインインし、「アプリ」→ ＋ →「新規アプリ」を開く。
2. 次の値を入力・選択する。

| 項目 | 入力・選択する値 |
| --- | --- |
| プラットフォーム | iOS |
| 名前 | `Fiction eXchange` |
| プライマリ言語 | 日本語 |
| Bundle ID | `com.kakinymax.fxsurvival`。DescriptionがFiction eXchangeのものを選び、`.prototype`が付く試作IDを選ばない |
| SKU | `fiction-exchange-ios-001` |
| ユーザーアクセス | フルアクセス |

3. 「作成」を押す。アプリの管理画面が開いたら作成できたと報告する。作成できない場合はエラー文言を報告する。

SKUは利用者に表示されない内部管理番号で、作成後に変更できない。上記は作成時に案内した値であり、SKUの入力結果は受領画面から確認できていない。配布前に「アプリ情報」でBundle IDが `com.kakinymax.fxsurvival` と一致することを照合する。正式版は新しい戦績で始める方針が本人回答で確定し、コードの表示名/OS別IDへ反映した。

出典: [Appleのアプリレコード作成](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)、[アプリ情報とSKU](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)。

## 限定配布用のビルドと確認

次の手順は、アカウント有効化と正式IDの確定後に使う。現在のdebug APKやCIの署名なしシミュレータ用アプリを正式配布物としてアップロードしない。

### iPhone：本人へのTestFlight内部テスト

1. 前節の手順でApp Store Connectのアプリレコードを作成し、登録済みの正式Bundle IDと対応していることを確認する。アプリ名Fiction eXchange・日本語・Bundle ID・内部管理用SKUを照合する。名前やIDが利用できない場合はその時点で対応する。
2. [正式IDのテスト版を別フォルダに取得する手順](MOBILE_APP.md)で本人のMacに取得してXcodeを開く。旧試作フォルダや署名設定を上書きしない。AppターゲットのSigning & CapabilitiesでAutomatically manage signingを有効にし、有料TeamとBundle Identifier `com.kakinymax.fxsurvival` を確認する。GeneralのVersionは1.0、Buildは1。初回の提出済みBuildがある場合は次の番号に増やす。
3. 実行先に汎用iOSデバイスを選び、Product → Archive。OrganizerでArchiveと元コミット・版を確認し、Distribute AppからApp Store Connect/TestFlight向けの配布を選ぶ。内部テスト専用を選択できる場合は今回の対象に合わせ、画面の処理に従う。輸出コンプライアンス等は実装を確認して回答する。
4. App Store Connectの処理完了と検証エラーの有無を確認し、TestFlight → Internal Testingにグループを作成する。最初は本人のみを対象にビルドを手動で追加する。内部テスターはApp Store Connectの権限を持つユーザーに限られる。
5. 本人のiPhoneでTestFlightから導入し、版・起動・CPU/対面/復帰を確認する。限定配布URL/版/元SHA/結果をIssue/PRへ保存する。

内部テストは最大100人、ビルドの試験可能期間は90日。外部テスターへ広げる場合はベータ審査が必要になることがあり、一般公開の審査とは区別する。今回の準備では外部テスターの招待やベータ審査の送信をしていない。

出典: [アプリレコード](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)、[TestFlight内部テスト](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)、[TestFlight全体](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)。

### Android：本人へのGoogle Play内部テスト

1. 本人のAndroid Studioで正式IDのプロジェクトを開き、Build → Generate Signed Bundle/APK → Android App Bundleを選ぶ。
2. 本人のMac内のリポジトリ外にアップロード鍵を作成・保管する。既存鍵があれば再利用し、勝手に作り直さない。鍵のパスワードは本人が管理し、GitHub/チャットへ送らない。保管先は本人と決め、Mac全体のバックアップや外付けドライブの購入を前提にしない。
3. releaseの署名付きAABを作成し、署名検証、正式ID/Version Code/元SHA/同梱資産を確認する。現在のGradleには配布用の署名設定がなく、このビルドは未実施。
4. Play Consoleでアプリレコードを作成し、Playアプリ署名を設定する。テストとリリース → テスト → 内部テストで新しいリリースを作り、署名付きAABと変更点を登録する。
5. 本人のGoogle Accountだけをテスター対象に指定し、内部テスト用の参加リンクから手持ちAndroidへ導入する。配布対象と版を確認して起動・CPU/対面/復帰を試し、結果をIssue/PRへ保存する。

内部テストは最大100人。AAB自体をGoogle Filesから直接インストールする手順ではない。内部テストで動いたことだけでは一般公開の条件を満たさない。

新しい個人アカウントでは、一般公開の前に12人以上が14日間連続して参加するクローズドテストと製品版アクセスの申請が必要。参加者の実際の利用・フィードバックも記録する。今回のAPKの個人試技や内部テストをこの要件の代わりに数えない。クローズドテスト開始日、必要な掲載設定、参加者の確保は後続の限定テスト計画で決める。

出典: [署名付きAAB](https://developer.android.com/studio/publish/app-signing?hl=ja)、[Play内部テスト](https://support.google.com/googleplay/android-developer/answer/9845334?hl=ja)、[新しい個人アカウントのテスト要件](https://support.google.com/googleplay/android-developer/answer/14151465?hl=ja)。

## この段階の完成条件・検証結果・未完了

| 完成条件 | 確認方法 | 現在の結果 |
| --- | --- | --- |
| 最新ルール・担当・重複確認 | main・AGENTS・設計・全open一覧/コメントとIssue予約 | 2026-10-09 main eee32bd、着手head6c75351。openは#10/draft #11のみ。他担当との重複なし、編集前に予約済み |
| 登録料・名義・限定配布条件が具体的な案内になっている | Apple/Googleの一次情報を2026-10-06に照合 | 文書準備済み。Appleの登録後の管理画面を確認 |
| 本人の登録・本人確認・アカウント有効化 | 本人報告で各状態を区別し、秘密値を残さない | Appleは支払/登録完了報告・App Store Connectアクセス・Xcode開発者機能有効を確認。Googleは未報告 |
| 正式ID・記録移行・保存方式が決まっている | 仕様を共有し、実装とアカウント内のIDを照合 | 端末内保存は本人が選択し実装/自動検証済み。Appleの正式App ID登録を確認。正式ID/表示名をコードへ反映。正式版は新しい戦績で始め、旧試作を残すと本人が選択。料金は未決 |
| 配布用署名ビルドを作れる | 元SHA/版/署名/同梱資産とビルド結果 | debug APKとiOSシミュレータは検証済み。配布署名AAB/Archiveは未作成 |
| 本人への限定配布が両OSで動く | TestFlight/Play参加からの実機導入と基本操作 | 手動導入の基本3項目は両OS問題なし。ストア経由の限定配布は未実施 |

提出SDKの照合: Appleは2026-04-28以降Xcode26/iOS26 SDK以上、Googleの新規スマホアプリは2026-08-31以降target API36以上。試作のXcode26.3/iOS26.2 CIとAndroid compile/target36はこれらの版条件に合う。提出直前にも公式条件・署名・警告・プライバシー等を確認し、この版条件の一致だけをストア提出可能という判定にしない。

出典: [AppleのSDK要件](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)、[Googleの対象API要件](https://support.google.com/googleplay/android-developer/answer/11926878?hl=ja)。

段階3は進行中。署名鍵/証明書・本人確認書類・決済情報・パスワード・認証コードはGitHubへ保存しない。Issue/PRには完了状態、版、元SHA、成功した検証と残件を保存する。次の担当は最新main・全open一覧・既存担当を確認して予約を更新してから再開する。一般公開のストア申請・公開、main統合、本番Web更新は今回の文書準備では行っていない。
