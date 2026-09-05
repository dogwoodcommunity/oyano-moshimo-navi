import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
const markers = {
  provision: "次の初回登録は",
  activate: "未有効・未失効の初回行を1件に限定して有効化する"
};

if (!Object.hasOwn(markers, mode)) {
  throw new Error("usage: render-delete-operator-policy-sql.mjs provision|activate");
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = fs.readFileSync(path.join(repoRoot, "docs/ADMIN_AUTH_POLICY.md"), "utf8");
const markerIndex = policy.indexOf(markers[mode]);
const openingFence = policy.indexOf("```sql", markerIndex);
const sqlStart = openingFence + "```sql".length;
const closingFence = policy.indexOf("```", sqlStart);

if (markerIndex < 0 || openingFence < 0 || closingFence < 0) {
  throw new Error(`SQL policy block was not found for ${mode}`);
}

const operatorId = "ae000000-0000-4000-8000-000000000001";
const approverId = "ae000000-0000-4000-8000-000000000002";
let sql = policy.slice(sqlStart, closingFence);

const disposableGuard = `
do $regression_environment$
begin
  if not exists (
    select 1
    from regression_support.delete_operator_policy_guard
    where marker
  ) then
    raise exception 'refusing to run policy fixtures outside the disposable regression database';
  end if;
end;
$regression_environment$;`;

sql = sql.replace("begin;", `begin;${disposableGuard}`);

sql = sql
  .replaceAll("<delete_operator_user_id>", operatorId)
  .replaceAll("<approver_user_id>", approverId)
  .replaceAll("<本人確認証跡の非秘密参照>", "regression-identity-001")
  .replaceAll("<別確認者承認証跡の非秘密参照>", "regression-approval-001");

if (mode === "activate") {
  sql = sql.replace(
    "'<identity_ledger_record_id>'",
    `(select record_id
      from account_delete_private.operator_identity_events
      where operator_user_id = '${operatorId}'
        and record_kind = 'identity_verified')`
  );
}

if (/'<[^'<>]+>'/.test(sql)) {
  throw new Error(`an unresolved placeholder remains in the ${mode} SQL policy block`);
}

process.stdout.write(`${sql.trim()}\n`);
