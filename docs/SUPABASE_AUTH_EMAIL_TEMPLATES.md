# 認証メールの文面（Supabase）

Supabase Dashboard に貼る認証メールの文面。

貼る場所: **Authentication → Emails → Templates**
https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/auth/templates

## 貼るのは2つだけ

このアプリが Supabase に送らせているメールは、マジックリンクだけ。
`signInWithOtp({ shouldCreateUser: true })` を使っているため、
**初めての人には Confirm signup、2回目以降の人には Magic Link** が届く。
どちらも利用者の操作は同じ（メールアドレスを入れて送信を押しただけ）なので、
文面もほぼ同じにしてある。

| テンプレート | 使う | 理由 |
| --- | --- | --- |
| Confirm signup | **使う** | 初めての人に届く |
| Magic Link | **使う** | 2回目以降の人に届く |
| Invite user | 使わない | 家族招待は自前のトークンリンク（`create_family_invite`）。Supabaseは送らない |
| Reset password | 使わない | パスワード認証を使っていない |
| Reauthentication | 使わない | 再認証を使っていない |
| Change email address | 使わない | メール変更の導線がない |

使わないものは、そのままで構わない。届かないメールの文面を直しても意味がない。

## 書くときに守ったこと

受け取るのは、親が入院した直後の家族。落ち着いていない人が読む。

- 件名で「何のメールか」が分かること。開かないと分からない件名にしない。
- 押すボタンは1つだけ。選ばせない。
- 「確認」「認証」より、次に何が起きるかを書く（「手帳をひらく」）。
- リンクが切れたときの逃げ道を必ず書く。
- 心当たりがない人を不安にさせない。「削除してください。何も起きません。」まで書く。
- 端末の制約は書かない。`flowType` は既定の implicit なので、
  **送った端末と違う端末で開いても通る**。書くと嘘になる。

---

## Confirm signup（初めての人）

Subject:

```text
【親のもしもナビ】ログイン用のリンクです
```

Body:

```html
<h2>ログイン用のリンクです</h2>

<p>親のもしもナビです。下のボタンを押すと、そのまま使いはじめられます。</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 18px;background:#276447;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
    手帳をひらく
  </a>
</p>

<p>
ボタンが開かないときは、下のURLをコピーして、ブラウザに貼ってください。<br>
{{ .ConfirmationURL }}
</p>

<p>
このリンクは、時間が経つと使えなくなります。そのときは、もう一度メールを送ってください。何度でも送れます。
</p>

<p style="color:#666;font-size:13px;">
心当たりがない場合は、このメールを削除してください。何も起きません。
</p>
```

## Magic Link（2回目以降の人）

Subject:

```text
【親のもしもナビ】ログイン用のリンクです
```

Body:

```html
<h2>ログイン用のリンクです</h2>

<p>親のもしもナビです。下のボタンを押すと、前の続きから使えます。</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 18px;background:#276447;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
    手帳をひらく
  </a>
</p>

<p>
ボタンが開かないときは、下のURLをコピーして、ブラウザに貼ってください。<br>
{{ .ConfirmationURL }}
</p>

<p>
このリンクは、時間が経つと使えなくなります。そのときは、もう一度メールを送ってください。何度でも送れます。
</p>

<p style="color:#666;font-size:13px;">
心当たりがない場合は、このメールを削除してください。何も起きません。
</p>
```

---

## 差出人と送信数の制限（文面より先に効いてくる話）

文面を直しても、**Supabaseの標準のメール送信は本番で使えない。**

- 差出人は `noreply@mail.app.supabase.io` 固定。`親のもしもナビ` にはできない。
- 送信数に上限がある（既定で1時間あたり数通）。上限を超えると**黙って届かなくなる**。
  エラーは画面に出ず、利用者は「メールが来ない」としか分からない。
- Supabase自身が、標準の送信は開発用であり本番では使うなと書いている。

利用者が増える前に、独自SMTPへ切り替える必要がある。

貼る場所: **Authentication → Emails → SMTP Settings**

| 項目 | 値 |
| --- | --- |
| Sender email | `info@bee-ch.co.jp` |
| Sender name | `親のもしもナビ` |
| Host / Port / User / Pass | 使うサービスの値 |

送信サービスは Resend / SendGrid / Amazon SES など。
どれも `bee-ch.co.jp` のDNSに SPF / DKIM を足す作業が要る。
これをやらないと、Gmailで迷惑メール扱いになりやすい。

**判断**: いまは自分ひとりで試している段階なので、標準のままでよい。
人に配る前に必ずやる。忘れると、届かない原因が一番分かりにくい形で出る。

## 貼ったあとの確認

1. Templates の画面で保存する。
2. 本番の `/home` で、自分のアドレスにマジックリンクを送る。
3. 件名が `【親のもしもナビ】ログイン用のリンクです` になっているか。
4. 「手帳をひらく」を押して、ログインできるか。
5. すでにログイン済みのアドレスと、初めてのアドレスの両方で試す
   （Confirm signup と Magic Link は別のテンプレート）。

## 注意

- テンプレートで使える変数は種類ごとに違う。マジックリンク系は `{{ .ConfirmationURL }}`。
- 文面に、法律・税務・医療の判断を断定する表現は入れない。
