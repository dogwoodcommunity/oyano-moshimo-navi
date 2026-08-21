# 認証メールの文面（Supabase）

Supabase Dashboard に貼る認証メールの文面。

貼る場所: **Authentication → Emails → Templates**
https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/auth/templates

## いまの状態

**まだ貼れない。** 独自SMTPを設定するまで、Supabaseがテンプレートを編集させない。
先に「先に独自SMTPが要る」の節をやること。

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

## 先に独自SMTPが要る（2026-08-21 に判明）

**文面を貼ろうとしても入力できない。** Supabaseが標準のメール送信のままでは
テンプレートを編集させない仕様に変わっているため。文面より先にSMTPを設定する。

そして、止まっているのは文面だけではない。

> emails can only be sent to email addresses in your project's organization

標準の送信では、**Supabaseの組織メンバーとして登録されたアドレスにしかメールが届かない。**
それ以外の人が入れると `Email address cannot be used as it is not authorized` で弾かれる。

つまり **いまの本番は、開発者本人以外は誰もログインできない。**
家族を招待しても、招待された人はログインできないので参加できない。
これは「人に配る前にやること」ではなく、**人に配れない理由**にあたる。

出典:
- https://github.com/orgs/supabase/discussions/29370
- https://supabase.com/docs/guides/auth/auth-smtp

### 手順

1. Resend でアカウントを作る（https://resend.com）
2. Domains → Add Domain → `bee-ch.co.jp`
3. 表示された **MX / TXT（SPF）/ TXT（DKIM）** を `bee-ch.co.jp` のDNSへ追加する
4. Resend の画面で Verified になるまで待つ（数分〜数時間）
5. API Keys → Create API Key（Sending access）
6. Supabase の **Authentication → Emails → SMTP Settings** で Enable にして入れる

| 項目 | 値 |
| --- | --- |
| Sender email | `info@bee-ch.co.jp` |
| Sender name | `親のもしもナビ` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | ResendのAPIキー |

7. 保存すると **Templates が編集できるようになる。** そこで上の2つを貼る。

DNSにSPF / DKIMを入れないと、Gmailで迷惑メール扱いになりやすい。
入院直後の家族が受け取るメールが迷惑メールに入ると、気づかれずに終わる。

### 送信数

Resendの無料枠は1日100通・月3,000通。いまの規模なら足りる。
足りなくなるのは、それが良い知らせのときだけ。

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
