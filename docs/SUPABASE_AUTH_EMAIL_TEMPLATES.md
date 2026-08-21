# 認証メールの文面（Supabase）

Supabase Dashboard に貼る認証メールの文面。

貼る場所: **Authentication → Emails → Templates**
https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/auth/templates

## いまの状態

**画面からは貼れなかった。** 原因は特定できていない。

**画面を使わなければ入る。** Management API (`PATCH /v1/projects/{ref}/config/auth`) が
同じ設定を受け付けるので、そちらから入れる。

**本番はすでに独自SMTPが入っている**（2026-08-21 に確認）。
`mail86.onamae.ne.jp:465` / `親のもしもナビ <info@bee-ch.co.jp>`。
つまり組織メンバー以外にもメールは届く。残っているのは文面だけ。

### すでに独自SMTPが入っている場合（2026-08-21 時点の本番がこれ）

本番はすでに `mail86.onamae.ne.jp:465` / `親のもしもナビ <info@bee-ch.co.jp>` が
設定されている。**送信の設定は触らず、文面だけ差し替える。**

```
cd ~/Desktop/oyano-moshimo-navi && git pull origin main

printf "Supabaseのトークン: "; read -s SUPABASE_ACCESS_TOKEN; echo
export SUPABASE_ACCESS_TOKEN

node scripts/setup-auth-email.mjs --templates-only
```

`--templates-only` は `mailer_*` の4項目だけを送る。`smtp_*` は一切含めない。

**3行まとめて貼らないこと。** `read` が次の行を値として飲み込む。
1行目だけ貼って Enter、トークンを貼って Enter、それから残りを貼る。

macOSの標準シェルはzshで、bashの `read -p` は通らない（`no coprocess` になる）。
`printf` で促してから `read -s` にすれば両方で動く。

### 独自SMTPがまだ無い場合（Gmailを使う）

会社のメールボックスを新しく作る必要がない。DNSも触らない。新規登録もない。

1. https://myaccount.google.com/apppasswords でアプリパスワードを作る（16桁）
   - 2段階認証が有効でないと、このページは出ない
2. https://supabase.com/dashboard/account/tokens でアクセストークンを作る
3. 次を順に実行する（1行ずつ）

```
printf "Supabaseのトークン: "; read -s SUPABASE_ACCESS_TOKEN; echo
printf "アプリパスワード: "; read -s SMTP_PASS; echo
export SUPABASE_ACCESS_TOKEN SMTP_PASS

node scripts/setup-auth-email.mjs --gmail --user じぶんのアドレス@gmail.com
```

### お名前.comのメールで入れ直す場合

```
node scripts/setup-auth-email.mjs --host mail86.onamae.ne.jp --port 465 --user noreply@bee-ch.co.jp
```

送信専用の箱を使うこと。SMTPのパスワードはメールボックスのログインパスワード
そのものなので、`info@` を渡すと会社の受信メールを読める鍵をSupabaseに預けることになる。

### 先に状態だけ見る

```
node scripts/setup-auth-email.mjs --check
```

何も変えずに、いまの設定だけ表示する。

### 文面を直したいとき

文面の実体は `supabase/auth-emails/` にある。下に載せているHTMLと同じもの。
そのファイルを編集して、上のコマンドをもう一度実行する。

トークンとパスワードは画面に出ないし、どこにも保存されない。

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

### 送信サービスの選定（2026-08-21 に判明）

**Resendは使えない。**

`bee-ch.co.jp` はお名前.comで取得しているが、**ネームサーバーはWixに向いている**
（Wixでサイトを作ると切り替わる）。ResendはWixを検出して拒否する。

理由は、Resendが送信用サブドメイン `send.bee-ch.co.jp` への
**MXレコードを必須**にしているため（AWS SESのバウンス受信に使う）。
**Wixはサブドメインに対するMXレコードを作れない。** 仕様上どうにもならない。

MXをルートに置く逃げ方は取れない。`bee-ch.co.jp` は会社のメールで使っており、
既存のMXを壊すと会社のメールが止まる。

出典:
- https://resend.com/docs/add-a-domain
- https://support.wix.com/en/article/managing-dns-records-in-your-wix-account

### いま取る道: すでに持っているメールのSMTPをそのまま使う

Supabaseは普通のSMTPを受け付ける。**送信サービスに新規登録しなくても、
いま使っているメールボックスの送信サーバーをそのまま指定すればよい。**
DNSも触らない。Wixも触らない。

会社のメールはお名前.comのメールサービスで受けている。
その送信サーバー（`mail***.onamae.ne.jp` / ポート587）を使う。

出典: https://help.onamae.com/answer/15480

**送信専用のメールボックスを1つ作ってから使うこと。**
SupabaseにはSMTPのパスワードを保存する。お名前.comのメールでは
**SMTPのパスワード＝メールボックスのログインパスワード**なので、
`info@bee-ch.co.jp` をそのまま渡すと、会社の受信メールを読める鍵を
Supabaseに預けることになる。`noreply@bee-ch.co.jp` のような送信専用の箱を
作って、それだけを渡す。漏れても被害がその箱に閉じる。

| 項目 | 値 |
| --- | --- |
| Sender email | `noreply@bee-ch.co.jp` |
| Sender name | `親のもしもナビ` |
| Host | お名前.comの管理画面に出る `mail***.onamae.ne.jp` |
| Port | `587` |
| Username | `noreply@bee-ch.co.jp` |
| Password | そのメールボックスのパスワード |

保存すると **Templates が編集できるようになる。** そこで上の2つを貼る。

#### これで通らなかった場合

お名前.comのメールが外部サーバーからの送信を弾く可能性がある
（SMTP AUTHは通るのが普通だが、確認できていない）。
弾かれたら、Gmailのアプリパスワードに切り替える。

| 項目 | 値 |
| --- | --- |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | Gmailのアドレス |
| Password | アプリパスワード（16桁） |

アプリパスワードは2段階認証を有効にしてから
https://myaccount.google.com/apppasswords で作る。
新規登録は不要。差出人はGmailのアドレスになる。
アプリパスワードは後から個別に取り消せるので、鍵としてはこちらのほうが安全。

出典: https://support.google.com/accounts/answer/185833

#### それでも足りなくなったら

送信数が増えるか、迷惑メール扱いが目立つようになったら、Brevoへ移す。
ドメイン認証がTXTだけで済み、MXを要求しないのでWixのDNSのまま通る。
無料枠は1日300通。

出典: https://help.brevo.com/hc/en-us/articles/12163873383186

### 送信数

お名前.comのメールもGmailも、1日数百通は送れる。いまの規模なら足りる。
足りなくなるのは、それが良い知らせのときだけ。

### 将来やること

いまは会社ドメイン `bee-ch.co.jp` から送る形にしている。
本来は、このサービス自身のドメインを取って、そこから送るほうがよい。

- 受け取る人が知らない会社名より、サービス名のドメインのほうが信用される
- Webの入口が `oyano-moshimo-navi.vercel.app` のままになっている
- WixのDNSに縛られなくなる

ドメイン代は年1,000〜4,000円程度。急ぎではないが、人に配る規模になる前に。

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
