# クラウド控えの本番確認手順

`/api/notebook/sync`、マジックリンクでの復元、JSON控えのダウンロードを、本番で確認するための手順です。
追記109で実装した内容の受け入れ確認にあたります。

## 前提

本番Vercelに次が設定されていること。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_WEB_BASE_URL`

Supabase Dashboard の Authentication > URL Configuration に、本番URLがRedirect URLとして入っていること。
入っていないと、マジックリンクを開いても `/home?cloud=1` に戻れません。

## 1. 自動チェック

トークン無しで実行すると、認証が要るエンドポイントであることだけを確認します。

```bash
WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app pnpm run smoke:notebook-sync
```

読み取りまで確認する場合は、本人確認済みのアクセストークンを渡します。

```bash
WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app \
NOTEBOOK_ACCESS_TOKEN=<access token> \
pnpm run smoke:notebook-sync
```

往復（書き込み→読み戻し→重複しないこと）まで確認する場合は `--write` を付けます。
確認用の対象者が1件残るので、本番では確認後に削除してください。

```bash
WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app \
NOTEBOOK_ACCESS_TOKEN=<access token> \
node scripts/smoke-notebook-sync.mjs --write
```

### アクセストークンの取り方

1. 本番の `/home` で「大事な記録を消さない」からメール確認を済ませる。
2. 同じブラウザのコンソールで次を実行し、表示された `access_token` を使う。

```js
Object.keys(localStorage)
  .filter((key) => key.includes("auth-token"))
  .map((key) => JSON.parse(localStorage.getItem(key))?.access_token);
```

トークンは通常1時間で切れます。切れたら `/home` を開き直してから取り直してください。

## 2. 手で確認すること

自動チェックでは見られない部分です。実機（できればiPhoneのSafari）で確認します。

| # | 確認 | 期待 |
| --- | --- | --- |
| 1 | `/home` で手帳を1件作り、日記を2件書く | 端末内に保存される |
| 2 | 「大事な記録を消さない」でメールを入力し、確認メールを送る | メールが届く |
| 3 | メール内のリンクを開く | `/home?cloud=1` に戻り、確認済みの表示になる |
| 4 | 「クラウドに保存」 | 件数付きで保存完了が出る |
| 5 | 別の端末、または同じ端末のプライベートウィンドウで、同じメールで確認 | 確認済みになる |
| 6 | 「クラウドから復元」 | 手帳と日記が戻る。日付、変化・急ぎ、本文が一致する |
| 7 | 「JSON控えをダウンロード」 | `oyano-moshimo-notebook-YYYY-MM-DD.json` が保存される |
| 8 | ダウンロードしたJSONを開く | `cases` と `diaryEntries` が入っている |
| 9 | Safariで「Webサイトデータを消去」した後、5→6をやり直す | 手帳が戻る |

9 が通ることが、この機能の目的そのものです。ここが通らない限り「記録が消えない」とは言えません。

## 3. 家族共有まで確認する場合

追記112で足したWebの招待導線もあわせて確認できます。

| # | 確認 | 期待 |
| --- | --- | --- |
| 1 | `/family` を開く | 未確認なら確認メールのフォーム |
| 2 | 確認後に再度開く | メンバー一覧と残り枠が出る |
| 3 | 家族のメールで「招待リンクを作る」 | リンクが出て、残り枠が1つ減る |
| 4 | 招待されていないアドレスでリンクを開き、参加を押す | アドレス不一致で断られる |
| 5 | 招待したアドレスでリンクを開き、参加を押す | 「参加しました」になる |
| 6 | 3人目を招待しようとする | 402で、Plusへの案内が出る |

## 4. 確認用データの削除

`--write` で作ったデータは、対象者の表示名が `【動作確認】削除してください` になっています。
Supabase側で次の順に削除してください（外部キーの都合で子から消します）。

```sql
-- <case-id> は smoke 実行時に表示された profile->>localCaseId の値
delete from timeline_events
where person_id in (select id from people where profile->>'localCaseId' = '<case-id>');

delete from tasks
where person_id in (select id from people where profile->>'localCaseId' = '<case-id>');

delete from people where profile->>'localCaseId' = '<case-id>';
```

## 5. 既知の注意点

- `/api/notebook/sync` は対象者を `profile->>localCaseId` で突き合わせます。端末のlocalStorageを消してから作り直した手帳は、別の対象者として増えます。JSON控えから戻すか、クラウドから復元してから使ってください。
- 日記写真は、メール確認済みならSupabase Storageへ保存し、同期データにはbucket/pathだけを残します。クラウド復元時は1時間の署名URLで表示します。未ログイン状態の写真だけは端末内プレビューに残ります。
- PDF添付は3組テスト前は一時停止しています。ファイル名だけ保存される状態を避けるため、UIでもPDF追加は受け付けません。
- Route Handler内のSupabaseへのGETは、Next.jsのData Cacheに載ると古い値を返します。`lib/serverSupabase.ts` で `cache: "no-store"` を強制しているので、ここを外さないでください。
