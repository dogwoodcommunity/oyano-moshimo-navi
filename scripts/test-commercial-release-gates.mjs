import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const readiness = read("apps/web/lib/commercialReadiness.ts");
const plans = read("apps/web/app/plans/page.tsx");
const upgrade = read("apps/web/components/PlusUpgrade.tsx");
const plusCheckout = read("apps/web/app/api/stripe/plus-checkout/route.ts");
const supportCheckout = read("apps/web/app/api/stripe/checkout/route.ts");
const supportPage = read("apps/web/app/support-pack/page.tsx");
const supportClient = read("apps/web/app/support-pack/SupportPackClient.tsx");
const tokushoho = read("apps/web/app/legal/tokushoho/page.tsx");
const privacy = read("apps/web/app/legal/privacy/page.tsx");
const terms = read("apps/web/app/legal/terms/page.tsx");
const layout = read("apps/web/app/layout.tsx");
const envExample = read("apps/web/.env.example");
const adminEnv = read("apps/web/app/api/admin/env-check/route.ts");
const releaseInputs = read("docs/COMMERCIAL_RELEASE_INPUTS.md");
const operationsRunbook = read("docs/COMMERCIAL_OPERATIONS_RUNBOOK.md");
const adminAuthPolicy = read("docs/ADMIN_AUTH_POLICY.md");
const productionChecklist = read("docs/PRODUCTION_CHECKLIST.md");
const commercialReleasePlan = read("docs/COMMERCIAL_RELEASE_PLAN_2026-09-03.md");
const privateIdentityLedger = read("supabase/account_delete_identity_ledger.sql");
const privateIdentityLedgerRegression = read("supabase/account_delete_identity_ledger_regression.sql");
const operatorProvisioningRegression = read("supabase/account_delete_operator_provisioning_regression.sql");
const compactVerification = read("supabase/verify_compact.sql");
const accountErasureSqlTest = read("scripts/test-account-erasure-sql.sh");

const sqlBlockAfter = (document, marker) => {
  const markerIndex = document.indexOf(marker);
  assert.ok(markerIndex >= 0, `SQL marker must exist: ${marker}`);
  const openingFence = document.indexOf("```sql", markerIndex);
  assert.ok(openingFence >= 0, `SQL opening fence must follow: ${marker}`);
  const sqlStart = openingFence + "```sql".length;
  const closingFence = document.indexOf("```", sqlStart);
  assert.ok(closingFence >= 0, `SQL closing fence must follow: ${marker}`);
  return document.slice(sqlStart, closingFence);
};

const provisionOperatorSql = sqlBlockAfter(adminAuthPolicy, "次の初回登録は");
const activateOperatorSql = sqlBlockAfter(adminAuthPolicy, "未有効・未失効の初回行を1件に限定して有効化する");
const revokeOperatorSql = sqlBlockAfter(adminAuthPolicy, "次のように即時失効させる");
const statementBefore = (sql, startMarker, endMarker) => {
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `SQL statement must contain ${startMarker} before ${endMarker}`);
  return sql.slice(start, end);
};
const activateUpdateSql = statementBefore(activateOperatorSql, "update public.account_delete_executors", "if not found");
const revokeUpdateSql = statementBefore(revokeOperatorSql, "update public.account_delete_executors", "if not found");

const legalKeys = [
  "LEGAL_BUSINESS_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_ADDRESS",
  "LEGAL_PHONE",
  "LEGAL_PHONE_HOURS",
  "LEGAL_CONTACT",
  "LEGAL_CONTACT_RESPONSE_TARGET",
  "LEGAL_TERMS_EFFECTIVE_DATE",
  "LEGAL_PRIVACY_EFFECTIVE_DATE",
  "LEGAL_PRICE_DESCRIPTION",
  "LEGAL_SERVICE_DELIVERY",
  "LEGAL_CANCELLATION_POLICY"
];

const saleSwitches = [
  "COMMERCIAL_SUPPORT_PACK_SALES_ENABLED",
  "COMMERCIAL_PLUS_SALES_ENABLED"
];

for (const key of legalKeys) {
  assert.ok(readiness.includes(`"${key}"`), `commercial readiness must require ${key}`);
  assert.ok(envExample.includes(`${key}=`), `.env.example must document ${key}`);
  assert.ok(adminEnv.includes(`"${key}"`), `admin env check must report ${key}`);
}

for (const key of saleSwitches) {
  assert.ok(readiness.includes(`enabled("${key}")`), `commercial readiness must require explicit ${key}`);
  assert.ok(envExample.includes(`${key}=false`), `.env.example must keep ${key} closed by default`);
  assert.ok(adminEnv.includes(`"${key}"`), `admin env check must report ${key}`);
}

assert.ok(adminEnv.includes("configured: isConfigured(key)"), "admin env readiness must use the validated configuration check");
assert.ok(adminEnv.includes("isValidLegalEffectiveDate(current)"), "admin env readiness must reject invalid legal effective dates");

assert.ok(envExample.includes("LEGAL_BUSINESS_NAME=株式会社BEECH"), "the release configuration example must retain the confirmed operator name");
assert.ok(releaseInputs.includes("| サービス運営者の正式名称 | **株式会社BEECH** |"), "the release input ledger must retain the confirmed operator name");
assert.ok(envExample.includes("LEGAL_RESPONSIBLE_PERSON=代表取締役 池田哲也"), "the release configuration example must retain the confirmed responsible person");
assert.ok(releaseInputs.includes("| 個人情報管理責任者の氏名または役職 | **代表取締役 池田哲也** |"), "the release input ledger must retain the confirmed responsible person");
assert.ok(envExample.includes("LEGAL_CONTACT=info@bee-ch.co.jp"), "the release configuration example must retain the confirmed public contact");
assert.ok(releaseInputs.includes("| 利用者向け問い合わせ先 | **info@bee-ch.co.jp** |"), "the release input ledger must retain the confirmed public contact");
assert.ok(envExample.includes("LEGAL_CONTACT_RESPONSE_TARGET=メール受付：24時間／原則3営業日以内に返信"), "the release configuration example must retain the confirmed response target");
assert.ok(releaseInputs.includes("| 問い合わせ受付時間・一次返信目標 | **メール受付：24時間／原則3営業日以内に返信** |"), "the release input ledger must retain the confirmed response target");
assert.ok(envExample.includes("LEGAL_TERMS_EFFECTIVE_DATE=\n"), "the terms effective date must remain empty until the actual public release date is known");
assert.doesNotMatch(envExample, /LEGAL_TERMS_EFFECTIVE_DATE=(?:正式公開日と同日|要確定)/, "a policy label must never be accepted as the effective-date env value");
assert.ok(releaseInputs.includes("| 利用規約の施行日 | **正式公開日と同日** |"), "the release input ledger must retain the confirmed terms effective-date policy");
assert.ok(envExample.includes("LEGAL_PRIVACY_EFFECTIVE_DATE=\n"), "the privacy effective date must remain empty until the actual public release date is known");
assert.doesNotMatch(envExample, /LEGAL_PRIVACY_EFFECTIVE_DATE=(?:正式公開日と同日|要確定)/, "a policy label must never be accepted as the privacy effective-date env value");
assert.ok(releaseInputs.includes("| プライバシーポリシーの施行日 | **正式公開日と同日** |"), "the release input ledger must retain the confirmed privacy effective-date policy");
assert.ok(releaseInputs.includes("| アカウント削除担当・代行者 | **主担当：代表取締役 池田哲也／代行者：システム責任者 池田知也** |"), "the release input ledger must retain both confirmed account-deletion assignees and the delegate title");
assert.ok(releaseInputs.includes("| アカウント完全削除の登録済み実行者 | **システム責任者 池田知也（有効化済み・実行スイッチOFF）** |"), "the release input ledger must record the activated deletion-only executor without claiming that erasure is enabled");
assert.ok(operationsRunbook.includes("| Supabase・個人情報削除担当 | **代表取締役 池田哲也**"), "the operations runbook must retain the confirmed account-deletion owner");
assert.ok(operationsRunbook.includes("最終更新: 2026-09-05"), "the operations runbook date must include the completed MFA and provisioning-policy update");
assert.ok(operationsRunbook.includes("private台帳の本人確認eventと別確認者の `activation_approved` eventを分離して記録し、削除専用roleを有効化済み。削除専用ログイン試験は完了し、単独テスト削除は未完了。実行スイッチはOFF"), "the runbook must record completed approval, activation, and scope verification while keeping destructive execution disabled");
assert.ok(releaseInputs.includes("主担当不在時に削除依頼の受付・本人確認・実行担当への引継ぎを代行。本番削除は登録済み削除実行者と別確認者の二者で実施"), "the release input ledger must retain the confirmed account-deletion delegate scope");
assert.ok(releaseInputs.includes("メールによる削除依頼は `info@bee-ch.co.jp` の共有受信箱で受けて両名へ通知する方針"), "the release input ledger must retain the confirmed email account-deletion inbox policy");
assert.ok(releaseInputs.includes("アプリ内依頼は `/admin/delete-requests` のDBキューへ入り、現行実装では自動メール通知しない"), "the release input ledger must distinguish in-app deletion requests from email intake");
assert.ok(releaseInputs.includes("本人端末のverified TOTP 1件・unverified 0件と設定完了時AAL2"), "the release input ledger must record completed MFA enrollment and setup-time possession");
assert.ok(releaseInputs.includes("別確認者 `代表取締役 池田哲也` の確認済みAuth・profile一致と `activation_approved` event、削除専用role有効化、本番の削除専用ログインと一覧200・一般Admin 3 APIの403は確認済み"), "the release input ledger must record the separate approval evidence, deletion-only role activation, and production scope check");
assert.ok(commercialReleasePlan.includes("履歴資料：これは2026-09-03作成時の基準線であり、現在の完了状況を示す台帳ではない"), "the dated release plan must not be mistaken for the current readiness ledger");
assert.ok(operationsRunbook.includes("受付経路は主担当と同じ。実際の権限・通知設定・2経路の試験は要確認"), "the operations runbook must retain the account-deletion delegate title and scope without claiming unverified routing");
assert.ok(operationsRunbook.includes("現行実装は、このDBキューへの保存時に自動メール通知を行わない"), "the runbook must not claim that in-app deletion requests currently generate email");
assert.ok(operationsRunbook.includes("共有パスワードを使わず、個別アカウントへの委任または追跡可能な転送を使う"), "shared inbox access must be individually attributable");
assert.ok(operationsRunbook.includes("共有受信箱のパスワード、MFA、復旧コードはGitや一般チャットへ記録しない"), "shared inbox credentials and recovery material must remain out of tracked documentation and general chat");
assert.ok(operationsRunbook.includes("身分証画像、パスワード、Magic Link、access tokenは受け取らない"), "identity verification must not collect authentication secrets or identity documents");
assert.ok(operationsRunbook.includes("削除実行の正式運用を開始しない"), "account deletion must remain operationally closed until delegate and dual control are assigned");
assert.ok(adminAuthPolicy.includes("指名しただけではAdmin権限を付与しない"), "an operational assignment must not grant app-admin authorization");
assert.ok(adminAuthPolicy.includes("現行の `app_admin` は削除専用roleではなく、全Admin APIに共通する管理者権限"), "the policy must retain that app_admin is broader than deletion execution");
assert.ok(adminAuthPolicy.includes("削除実行予定者の指名だけでは、Supabase Authユーザー、MFA、`account_delete_executors` 行、Vercel・Supabase等の本番権限を作成・付与しない"), "the intended executor assignment must not create production identity or authorization");
assert.ok(adminAuthPolicy.includes("削除専用roleは `account_delete_executors` で管理し、有効化済み・未失効の個別ユーザーだけを受け付ける"), "the policy must document the active and unrevoked deletion-only allowlist");
assert.ok(adminAuthPolicy.includes("一般Admin APIへは権限を広げない"), "the deletion-only role must not widen general Admin access");
assert.ok(adminAuthPolicy.includes("実削除は登録済みTOTPで追加認証したAAL2を必須"), "account erasure must require verified MFA step-up");
assert.ok(adminAuthPolicy.includes("本人だけが `/admin/delete-requests/setup` を開き"), "the policy must document the operator-only setup route");
assert.ok(adminAuthPolicy.includes("verified TOTPが1件でも、現在のセッションがAAL2になるまで設定完了と扱わない"), "existing MFA enrollment alone must not count as current possession");
assert.ok(adminAuthPolicy.includes("この画面から新規ユーザー、`profiles`、家族、対象者、削除専用roleを作らない"), "MFA setup must remain separate from profile and role creation");
assert.ok(adminAuthPolicy.includes("`profiles` 行だけでは、家族への所属、一般Admin、削除専用roleのいずれも付与されない"), "the minimal operator profile must be documented as an identity anchor rather than an authorization grant");
assert.match(privateIdentityLedger, /create schema account_delete_private authorization postgres;/, "the identity ledger must be owner-only from creation");
assert.doesNotMatch(privateIdentityLedger, /create schema if not exists account_delete_private/i, "an unknown pre-existing private schema must fail closed");
assert.match(privateIdentityLedger, /record_kind in \('identity_verified', 'activation_approved'\)/, "the private ledger must limit record kinds");
assert.match(privateIdentityLedger, /foreign key \(identity_record_id, operator_user_id, identity_record_kind\)[\s\S]*?references account_delete_private\.operator_identity_events/, "approval evidence must bind to the same operator identity event");
assert.match(privateIdentityLedger, /message = 'operator identity events are append-only'/, "the private ledger mutation guard must fail closed");
assert.match(privateIdentityLedger, /before update or delete or truncate on account_delete_private\.operator_identity_events/, "the private ledger must reject ordinary mutation");
assert.match(privateIdentityLedger, /revoke all on schema account_delete_private[\s\S]*?public, anon, authenticated, service_role/, "API roles must not use the private ledger schema");
assert.match(privateIdentityLedger, /owner_only_acl_guard[\s\S]*?aclexplode[\s\S]*?pg_default_acl[\s\S]*?privilege\.grantee <> v_owner_id/, "the migration must fail closed on any non-owner object or default ACL");
assert.doesNotMatch(privateIdentityLedger, /\b(?:email|otp|secret|token|metadata|note)\s+(?:text|jsonb)/i, "the private ledger must not add sensitive or free-text columns");
assert.match(privateIdentityLedgerRegression, /^begin;[\s\S]*?rollback;\s*$/m, "the private-ledger regression must never retain fixture evidence");
assert.match(privateIdentityLedgerRegression, /refusing to run private-ledger regression outside the disposable Auth shim/, "the private-ledger regression must refuse a production-shaped Auth schema");
assert.match(privateIdentityLedgerRegression, /set local lock_timeout = '5s';[\s\S]*?set local statement_timeout = '30s';/, "the private-ledger regression must fail closed instead of waiting indefinitely");
assert.match(compactVerification, /account_delete_executor_acl[\s\S]*?INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER/, "the production verifier must reject every non-SELECT executor-table privilege");
assert.match(compactVerification, /select count\(\*\) = 6[\s\S]*?pg_get_constraintdef[\s\S]*?operator_identity_events_pkey[\s\S]*?operator_identity_events_reference_key/, "the production verifier must compare the complete exact private-ledger constraint set");
assert.match(compactVerification, /attribute\.attgenerated = 's'[\s\S]*?pg_get_expr[\s\S]*?activation_approved[\s\S]*?identity_verified/, "the production verifier must validate the generated identity-reference discriminator");
assert.match(compactVerification, /select count\(\*\) = 2[\s\S]*?from pg_trigger[\s\S]*?not trigger\.tgisinternal/, "the production verifier must reject extra user-defined private-ledger triggers");
assert.ok(accountErasureSqlTest.includes("run_sql supabase/account_delete_identity_ledger.sql"), "the disposable SQL suite must apply the private ledger migration");
assert.ok(accountErasureSqlTest.includes("run_sql supabase/account_delete_identity_ledger_regression.sql"), "the disposable SQL suite must exercise the private ledger security contract");
assert.ok(accountErasureSqlTest.includes("run_policy_sql provision") && accountErasureSqlTest.includes("run_policy_sql activate"), "the disposable SQL suite must execute both exact documented operator policy blocks");
assert.ok(accountErasureSqlTest.includes("run_sql supabase/account_delete_operator_provisioning_regression.sql"), "the disposable SQL suite must verify the documented operator transaction results");
assert.match(operatorProvisioningRegression, /event\.identity_record_id = v_identity_record_id[\s\S]*?executor\.note = concat_ws\([\s\S]*?'identity=ledger:' \|\| v_identity_record_id::text[\s\S]*?'approval=ledger:' \|\| v_approval_record_id::text/, "the provisioning regression must bind both executor-note pointers to the exact ledger events");
assert.match(provisionOperatorSql, /begin;[\s\S]*?insert into account_delete_private\.operator_identity_events[\s\S]*?insert into public\.profiles \(id, email\)[\s\S]*?insert into public\.account_delete_executors[\s\S]*?false,[\s\S]*?null,[\s\S]*?null[\s\S]*?commit;/, "operator provisioning must create identity evidence, the minimal profile, and an inactive role in one transaction");
assert.match(provisionOperatorSql, /set local lock_timeout = '5s';[\s\S]*?set local statement_timeout = '30s';/, "operator provisioning must fail closed instead of waiting indefinitely for global safety locks");
assert.match(provisionOperatorSql, /lock table auth\.mfa_factors,[\s\S]*?public\.account_delete_executors[\s\S]*?share row exclusive mode/, "operator provisioning must stabilize TOTP and absence checks until commit");
assert.match(provisionOperatorSql, /email_confirmed_at is not null/, "operator provisioning must require a confirmed Auth identity");
assert.match(provisionOperatorSql, /count\(\*\),[\s\S]*?count\(\*\) filter \(where factor\.status = 'verified'\),[\s\S]*?count\(\*\) filter \(where factor\.status = 'unverified'\)[\s\S]*?v_totp_total <> 1[\s\S]*?v_totp_verified <> 1[\s\S]*?v_totp_unverified <> 0/, "operator provisioning must require exactly one total TOTP, one verified, and no unfinished or unknown-status TOTP");
assert.match(provisionOperatorSql, /position\('<' in v_identity_evidence_ref\) > 0[\s\S]*?raise exception/, "operator provisioning must reject an unchanged identity-evidence placeholder");
assert.match(provisionOperatorSql, /v_operator_user_id = v_approver_user_id[\s\S]*?raise exception/, "operator provisioning must keep the operator and verifier distinct");
assert.match(provisionOperatorSql, /exists \(select 1 from public\.profiles[\s\S]*?exists \(select 1 from public\.families where owner_user_id[\s\S]*?exists \(select 1 from public\.family_members[\s\S]*?exists \(select 1 from public\.app_admins[\s\S]*?exists \(select 1 from public\.account_delete_executors[\s\S]*?raise exception/, "operator provisioning must reject every pre-existing identity or authority row");
assert.match(provisionOperatorSql, /insert into account_delete_private\.operator_identity_events[\s\S]*?'identity_verified'[\s\S]*?returning record_id into v_identity_record_id/, "operator provisioning must append identity evidence before the public identity anchor");
assert.match(provisionOperatorSql, /'identity=ledger:' \|\| v_identity_record_id::text/, "the inactive executor row must retain its private-ledger pointer");
assert.match(provisionOperatorSql, /event\.evidence_ref = btrim\(v_identity_evidence_ref\)[\s\S]*?profile\.display_name is null[\s\S]*?profile\.phone is null/, "operator provisioning must verify exact evidence and a truly minimal profile");
assert.match(provisionOperatorSql, /operator identity provisioning postcondition failed/, "operator provisioning must assert all inactive-state postconditions before commit");
assert.ok(adminAuthPolicy.includes("失効済み行へ `on conflict ... revoked_at = null` を行って復活させてはいけない"), "revoked deletion authority must never be silently reactivated by an upsert");
assert.match(activateOperatorSql, /v_operator_user_id = v_approver_user_id[\s\S]*?auth\.users[\s\S]*?email_confirmed_at is not null/, "activation must require distinct and confirmed operator and approver Auth identities");
assert.match(activateOperatorSql, /set local lock_timeout = '5s';[\s\S]*?set local statement_timeout = '30s';/, "activation must fail closed instead of waiting indefinitely for global safety locks");
assert.match(activateOperatorSql, /lock table auth\.mfa_factors,[\s\S]*?public\.account_delete_executors[\s\S]*?share row exclusive mode/, "activation must stabilize identity and authority checks until commit");
assert.match(activateOperatorSql, /join public\.profiles profile on profile\.id = auth_user\.id[\s\S]*?auth_user\.id = v_approver_user_id[\s\S]*?email_confirmed_at is not null[\s\S]*?lower\(profile\.email\) = lower\(auth_user\.email\)/, "activation must bind the separate approver to a confirmed matching Auth identity");
assert.match(activateOperatorSql, /v_totp_total <> 1[\s\S]*?v_totp_verified <> 1[\s\S]*?v_totp_unverified <> 0/, "activation must recheck the exact complete TOTP state immediately before authorization");
assert.match(activateOperatorSql, /public\.families[\s\S]*?public\.family_members[\s\S]*?public\.app_admins/, "activation must reject an operator who owns or joined an application family or gained broader admin access");
assert.match(activateOperatorSql, /position\('<' in v_approval_evidence_ref\) > 0[\s\S]*?raise exception/, "activation must reject an unchanged approval-evidence placeholder");
assert.match(activateOperatorSql, /record_kind,[\s\S]*?approver_user_id,[\s\S]*?identity_record_id[\s\S]*?'activation_approved'[\s\S]*?returning record_id into v_approval_record_id/, "activation must append separate approval evidence in the same transaction");
assert.match(activateOperatorSql, /active = false[\s\S]*?activated_at is null[\s\S]*?revoked_at is null[\s\S]*?if not found/, "activation must update exactly the new inactive state and fail closed when it is absent");
assert.match(activateUpdateSql, /created_by is null[\s\S]*?note = 'identity=ledger:' \|\| v_identity_record_id::text[\s\S]*?active = false[\s\S]*?activated_at is null[\s\S]*?revoked_at is null/, "the authorization update must be limited to the exact untouched provisional row");
assert.match(activateUpdateSql, /auth_user\.id = v_operator_user_id[\s\S]*?email_confirmed_at is not null[\s\S]*?lower\(profile\.email\) = lower\(auth_user\.email\)/, "the authorization update itself must revalidate the operator Auth/profile identity");
assert.match(activateUpdateSql, /v_totp_total = 1[\s\S]*?v_totp_verified = 1[\s\S]*?v_totp_unverified = 0/, "the authorization update itself must use the exact stable TOTP snapshot");
assert.match(activateUpdateSql, /not exists \([\s\S]*?public\.families[\s\S]*?not exists \([\s\S]*?public\.family_members[\s\S]*?not exists \([\s\S]*?public\.app_admins/, "the authorization update itself must reject family ownership, membership, and broader admin authority");
assert.match(activateUpdateSql, /auth_user\.id = v_approver_user_id[\s\S]*?email_confirmed_at is not null[\s\S]*?lower\(profile\.email\) = lower\(auth_user\.email\)/, "the authorization update itself must revalidate the separate approver identity");
assert.match(activateUpdateSql, /nullif\(btrim\(note\), ''\)[\s\S]*?'approval=ledger:' \|\| v_approval_record_id::text/, "activation must append approval evidence without overwriting identity evidence");
assert.match(activateOperatorSql, /event\.evidence_ref = btrim\(v_approval_evidence_ref\)/, "activation must verify the exact approval evidence before commit");
assert.match(activateOperatorSql, /operator activation postcondition failed/, "activation must assert ledger and active-state postconditions before commit");
assert.match(revokeUpdateSql, /set active = false,[\s\S]*?revoked_at = now\(\)[\s\S]*?active = true[\s\S]*?activated_at is not null[\s\S]*?revoked_at is null/, "revocation must disable exactly an active unrevoked row and retain prior evidence");
assert.ok(adminAuthPolicy.includes("削除依頼の一覧・状態変更・事前確認・実行では一切受け付けない"), "the static emergency token must not enter any deletion surface");
assert.ok(productionChecklist.includes("[x] アカウント完全削除の実行予定者を `システム責任者 池田知也` と確定（別確認者承認付きで有効化済み・実行スイッチOFF）"), "the checklist must distinguish deletion-only role activation from destructive execution enablement");
assert.ok(productionChecklist.includes("[x] 一般Admin APIへ広がらない削除専用role、Bearer限定認証、実削除時AAL2、原子的な状態更新・監査を実装・ローカル検証"), "the checklist must record the locally verified least-privilege implementation");
assert.ok(productionChecklist.includes("[x] 本番へ削除専用roleと更新済み削除pipelineをmigration"), "the checklist must record the verified production migration");
for (const appliedMigrationLabel of [
  "`supabase/account_delete_executor_role.sql` を実行",
  "`supabase/account_delete_identity_ledger.sql` を1回だけ実行",
  "`supabase/account_deletion_pipeline.sql` を実行",
  "Web更新前に `supabase/notebook_diary_delete.sql` を実行",
  "Web更新前に `supabase/notebook_person_delete.sql` を実行"
]) {
  assert.ok(productionChecklist.includes(`- [x] ${appliedMigrationLabel}`), `the checklist must mark ${appliedMigrationLabel} as applied`);
  assert.ok(!productionChecklist.includes(`- [ ] ${appliedMigrationLabel}`), `the checklist must not also leave ${appliedMigrationLabel} pending`);
}
assert.ok(productionChecklist.includes("[x] `/admin/delete-requests/setup` でverified TOTP 1件と現在のAAL2を本人端末で確認"), "the checklist must record the verified operator MFA result");
assert.ok(productionChecklist.includes("2026-09-05確認: 本番へ1回限り適用。migration適用直後はprivate台帳0件"), "the private ledger production migration must retain its initial empty-ledger verification evidence without contradicting later provisioning");
assert.ok(productionChecklist.includes("[x] 本人画面で選んだ正確な実行者Auth user IDをprivate台帳へ記録し、監査用の最小profileと `active=false` のexecutor行をfamily所有・所属・一般Adminなしで同一transactionにより作成"), "the exact operator subject, minimal profile, and inactive role must be recorded as one completed atomic step");
assert.ok(productionChecklist.includes("本人確認event 1件、最小profile 1件、無効executor 1件だけを同一transactionで作成"), "the checklist must retain the exact non-authorizing production result");
assert.ok(productionChecklist.includes("[x] 上記の無効なexecutor行を、別確認者のAuth・profileと承認記録を照合した後だけ有効化"), "the named operator must be activated only after the separate approval step");
assert.ok(productionChecklist.includes("[x] 削除実行者とは別の確認者を `代表取締役 池田哲也` と指名し、確認済みAuthと一致profileを本番で読み取り確認し、別操作で `activation_approved` eventを作成"), "the separately verified confirmer and approval evidence must be recorded");
assert.ok(productionChecklist.includes("[x] 初回の削除実行権限有効化では、実行者の本人確認eventと別確認者の `activation_approved` eventを分離"), "the initial authority activation must retain separate identity and approval evidence");
assert.ok(productionChecklist.includes("[x] 実際の削除1件ごとに、request ID・target user ID・operator user IDを二人で照合"), "each destructive run must retain its own two-person verification workflow");
assert.ok(operationsRunbook.includes("初回有効化eventとは別の確認"), "per-deletion review must not be confused with the one-time activation approval event");
assert.doesNotMatch(releaseInputs, /無効状態で登録済み|有効化承認は未実施/, "the current release ledger must not regress to the pre-activation state");
assert.doesNotMatch(operationsRunbook, /承認event・有効化・本番削除権限は未付与|有効化承認eventは未作成/, "the current runbook must not regress to the pre-activation state");
const completedDeletionOnlyLoginCheck = "登録済み削除専用実行者本人の個別セッションで `/admin/delete-requests` だけを利用でき、モニター回答・利用状況・本番設定APIは403になることを確認";
assert.ok(productionChecklist.includes(`- [x] ${completedDeletionOnlyLoginCheck}`), "the production checklist must record the completed deletion-only login and scope test");
assert.ok(!productionChecklist.includes(`- [ ] ${completedDeletionOnlyLoginCheck}`), "the completed deletion-only login test must not remain pending");
assert.ok(productionChecklist.includes("削除専用auth-statusと一覧GETが200、モニター回答・AI利用・本番設定APIが各403"), "the checklist must retain the exact read-only production authorization evidence");
assert.ok(operationsRunbook.includes("削除専用ログイン試験は完了し、単独テスト削除は未完了"), "the runbook must distinguish the completed login trial from the pending destructive test");
assert.ok(releaseInputs.includes("削除専用ログイン試験は確認済み。単独テスト削除は未確認"), "the release ledger must distinguish the completed login trial from the pending destructive test");
assert.ok(envExample.includes("ACCOUNT_ERASURE_EXECUTION_ENABLED=false"), "the destructive account-erasure execution switch must remain disabled by default");
assert.ok(productionChecklist.includes("`ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持する"), "production account erasure must remain disabled until its external prerequisites pass");
assert.ok(productionChecklist.includes("`ACCOUNT_ERASURE_EXECUTION_ENABLED=true` を承認"), "the destructive execution switch must remain behind production migration and end-to-end checks");
assert.ok(operationsRunbook.includes("request/job/hash/operator/control epochへの固定"), "the release gate must describe the DB-enforced exact execution approval binding");
assert.ok(operationsRunbook.includes("別確認者が表示された対象を実際に照合したことは運用証跡で補完する"), "technical dual control must not be confused with proof of human review");
assert.ok(operationsRunbook.includes("削除運用はまだ開始しない"), "production migration must not bypass the pending real-world deletion trial");
assert.ok(releaseInputs.includes("| 障害対応責任者・代行者 | **主責任者：代表取締役 池田哲也／代行者：システム責任者 池田知也** |"), "the release input ledger must retain both confirmed incident-response assignees and titles");
assert.ok(operationsRunbook.includes("| 障害対応主責任者 / Incident Commander | **代表取締役 池田哲也**（内部連絡手段は要指定。指定後は制限付き運用台帳に記録） | **システム責任者 池田知也**（責任範囲：主責任者不在時の連絡・初動判断の代行。本番操作は別途権限を持つ担当者が実施。内部連絡手段は要指定） |"), "the operations runbook must retain both assignees, titles, and confirmed delegate scope without inventing contact details");
assert.doesNotMatch(envExample, /LEGAL_RESPONSIBLE_PERSON=システム責任者 池田知也/, "the system title must not replace the confirmed public legal responsible person");
assert.ok(releaseInputs.includes("本番操作は別途権限を持つ担当者が実施"), "the release ledger must keep incident delegation separate from production execution authorization");
assert.ok(operationsRunbook.includes("これは全般的な運用責任者の指名や、Vercel・Supabase・GitHub・Resend・DNS等の実行権限付与を意味しない"), "the incident assignment must not imply broader operations ownership or service authorization");
assert.ok(operationsRunbook.includes("障害対応の正式運用を開始しない"), "incident response must remain operationally closed until delegate, contacts, alerts, on-call, and access are assigned");
assert.ok(operationsRunbook.includes("初動判断」は、暫定的なSEV分類、変更停止・証拠保全の依頼、権限を持つ担当者の招集まで"), "the delegate's initial-decision scope must remain bounded");
assert.ok(operationsRunbook.includes("主責任者不在時に代行者が最終承認できる範囲は未確定"), "delegate scope must not silently grant final approval authority");
assert.ok(operationsRunbook.includes("Incident Commanderの承認権限と、実際にVercelのrollback、SupabaseのDB操作、secret rotation等を実行できるサービス権限は別に管理する"), "incident approval and execution authorization must remain separated");

assert.ok(plans.includes("<PlusUpgrade salesReady={salesReady} />"), "the plans page must pass server-side sale readiness to the client");
assert.ok(plans.includes('plan.name === "Family Plus" && !salesReady'), "closed Plus sales must not render an actionable plan link");
assert.ok(plans.includes('aria-disabled="true"'), "closed Plus sales must be exposed as unavailable to assistive technology");
assert.ok(upgrade.includes("現在は受付準備中です"), "closed Plus sales must be explained before asking for sign-in");
assert.ok(supportPage.includes("<SupportPackClient salesReady={salesReady} />"), "support-pack readiness must come from the server");
assert.ok(supportClient.includes("現在は受付準備中です"), "closed support-pack sales must hide its application form");

const plusReadinessIndex = plusCheckout.indexOf("if (!plusSalesReady())");
const plusRateLimitIndex = plusCheckout.indexOf("const limited = await checkPublicRateLimit");
assert.ok(plusReadinessIndex >= 0 && plusReadinessIndex < plusRateLimitIndex, "closed Plus checkout must stop before rate-limit or database side effects");

const supportReadinessIndex = supportCheckout.indexOf("if (!supportPackSalesReady())");
const supportRateLimitIndex = supportCheckout.indexOf("const rateLimited = await checkPublicRateLimit");
assert.ok(supportReadinessIndex >= 0 && supportReadinessIndex < supportRateLimitIndex, "closed support-pack checkout must stop before rate-limit or database side effects");

assert.doesNotMatch(tokushoho, /\[正式名称を要確定\]|\[代表者または通信販売業務責任者を要確定\]|\[事業者住所を要確定\]/, "public legal page must not expose draft placeholders");
assert.ok(tokushoho.includes("有料サービスは受付準備中です"), "the legal page must clearly disclose when sales are closed");
assert.ok(tokushoho.includes("disclosure.cancellationPolicy"), "open sales must publish cancellation and refund terms");
assert.ok(readiness.includes("getPublicOperatorDisclosure()"), "paid sales must also require the free Web legal identity and effective dates");
assert.ok(readiness.includes("isValidLegalEffectiveDate(current)"), "public legal readiness must require real effective dates instead of non-empty placeholders");
assert.ok(readiness.includes("legalContactHref"), "published contact destinations must reject unsafe URL schemes");
assert.ok(privacy.includes("disclosure.privacyEffectiveDate"), "privacy policy must publish its configured effective date");
assert.ok(terms.includes("disclosure.termsEffectiveDate"), "terms must publish their configured effective date");
assert.ok(tokushoho.includes("disclosure.contactResponseTarget"), "commercial disclosure must publish the configured response target");
for (const page of [privacy, terms]) {
  assert.ok(page.includes("const operator = getPublicOperatorContact()"), "confirmed contact must not require a formal release date");
  assert.ok(page.includes("const disclosure = getPublicOperatorDisclosure()"), "dated legal disclosure must retain full readiness checks");
  assert.ok(page.includes("operator.operatorName"), "formal free Web legal pages must publish the configured operator");
  assert.ok(page.includes("operator.contact"), "formal free Web legal pages must publish the configured contact");
  assert.ok(page.includes("operator.contactResponseTarget"), "formal free Web legal pages must publish the configured response target");
}
assert.ok(layout.includes('href="/legal/privacy#contact"'), "the public footer must provide a direct contact route");
for (const page of [tokushoho, privacy, terms]) {
  assert.ok(page.includes("contactHref ? <a href={contactHref}"), "configured contacts must be actionable when they are safe URLs or email addresses");
}
assert.match(plusCheckout, /family\.owner_user_id !== context\.userId/, "Plus checkout must require the current family owner on the server");

console.log("commercial release gate tests passed");
