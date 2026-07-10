# Supabase Auth email templates

Supabase Dashboardで設定する認証メール文面です。

対象画面:

- Supabase: https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/auth/templates
- Authentication -> Emails -> Templates

送信元:

- Sender name: `親のもしもナビ`
- Sender email: `info@bee-ch.co.jp`

## Confirm signup

Subject:

```text
【親のもしもナビ】メールアドレスの確認
```

Body:

```html
<h2>メールアドレスの確認</h2>

<p>親のもしもナビをご利用いただきありがとうございます。</p>

<p>
下のボタンを押すと、メールアドレスの確認が完了します。
確認後、Webで整理した内容をアプリの家族ボードへ保存できます。
</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 18px;background:#276447;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
    メールアドレスを確認する
  </a>
</p>

<p>
ボタンが開かない場合は、以下のURLをコピーしてブラウザで開いてください。<br>
{{ .ConfirmationURL }}
</p>

<p style="color:#666;font-size:13px;">
このメールに心当たりがない場合は、何もせず破棄してください。
</p>
```

## Magic Link

Subject:

```text
【親のもしもナビ】本人確認リンク
```

Body:

```html
<h2>本人確認リンク</h2>

<p>親のもしもナビの本人確認リンクです。</p>

<p>
下のボタンを押すと、ログインまたは本人確認が完了します。
Webで整理した内容をアプリへ保存する場合は、この端末で開いてください。
</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 18px;background:#276447;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
    本人確認して続ける
  </a>
</p>

<p>
ボタンが開かない場合は、以下のURLをコピーしてブラウザで開いてください。<br>
{{ .ConfirmationURL }}
</p>

<p style="color:#666;font-size:13px;">
このメールは、親のもしもナビで本人確認が必要な操作が行われたため送信されています。
心当たりがない場合は、何もせず破棄してください。
</p>
```

## Invite user

Subject:

```text
【親のもしもナビ】家族ボードへの招待
```

Body:

```html
<h2>家族ボードへの招待</h2>

<p>親のもしもナビの家族ボードへ招待されています。</p>

<p>
下のボタンから参加すると、期限のある手続きや担当未定のタスクを家族で確認できます。
</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 18px;background:#276447;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
    家族ボードに参加する
  </a>
</p>

<p>
ボタンが開かない場合は、以下のURLをコピーしてブラウザで開いてください。<br>
{{ .ConfirmationURL }}
</p>

<p style="color:#666;font-size:13px;">
心当たりがない場合は、このメールを破棄してください。
</p>
```

## Reset password

Subject:

```text
【親のもしもナビ】パスワード再設定
```

Body:

```html
<h2>パスワード再設定</h2>

<p>親のもしもナビのパスワード再設定リンクです。</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 18px;background:#276447;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
    パスワードを再設定する
  </a>
</p>

<p>
ボタンが開かない場合は、以下のURLをコピーしてブラウザで開いてください。<br>
{{ .ConfirmationURL }}
</p>

<p style="color:#666;font-size:13px;">
心当たりがない場合は、このメールを破棄してください。
</p>
```

## Reauthentication

Subject:

```text
【親のもしもナビ】本人確認コード
```

Body:

```html
<h2>本人確認コード</h2>

<p>親のもしもナビの本人確認コードです。</p>

<p style="font-size:28px;font-weight:bold;letter-spacing:2px;">
{{ .Token }}
</p>

<p style="color:#666;font-size:13px;">
心当たりがない場合は、このメールを破棄してください。
</p>
```

## Notes

- Supabaseのテンプレート変数は画面上の種類によって使えるものが異なるため、保存前にPreview/Test sendで確認する。
- Magic Link / Confirm signup は `{{ .ConfirmationURL }}` を使う。
- OTPコード型のテンプレートは `{{ .Token }}` を使う。
- 文面内に法律・税務判断を断定する表現は入れない。
