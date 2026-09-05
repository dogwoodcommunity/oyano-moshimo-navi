import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "apps/web/app/start/page.tsx",
  "apps/web/app/diagnosis/page.tsx",
  "apps/web/app/result/[caseId]/page.tsx",
  "apps/web/app/result/[caseId]/share/page.tsx",
  "apps/web/app/invite/[token]/page.tsx",
  "apps/web/app/api/family/invite/preview/route.ts",
  "apps/web/app/api/family/invite/accept/route.ts",
  "apps/web/components/InviteAccept.tsx",
  "apps/web/lib/familyInvitePermissions.ts",
  "apps/web/app/guides/page.tsx",
  "apps/web/app/guides/[slug]/page.tsx",
  "apps/web/lib/guides.ts",
  "apps/web/app/checklists/page.tsx",
  "apps/web/lib/checklists.ts",
  "apps/web/app/safety/page.tsx",
  "apps/web/app/install/page.tsx",
  "apps/web/app/offline/page.tsx",
  "apps/web/components/PwaInstallPanel.tsx",
  "apps/web/app/plans/page.tsx",
  "apps/web/app/sitemap.ts",
  "apps/web/app/robots.ts",
  "apps/web/components/PwaRegister.tsx",
  "apps/web/public/manifest.webmanifest",
  "apps/web/public/sw.js",
  "apps/web/public/brand/logo-mark.png",
  "apps/web/public/brand/pwa-icon-192.png",
  "apps/web/public/brand/apple-touch-icon.png",
  "apps/web/app/support-pack/page.tsx",
  "apps/web/app/admin/page.tsx",
  "apps/web/app/admin/delete-requests/page.tsx",
  "apps/web/app/admin/delete-requests/setup/page.tsx",
  "apps/web/components/DeleteOperatorMfaSetup.tsx",
  "apps/web/app/admin/env/page.tsx",
  "apps/web/app/api/handoff/consume/route.ts",
  "apps/web/app/api/stripe/checkout/route.ts",
  "apps/web/app/api/stripe/webhook/route.ts",
  "apps/web/app/api/cron/send-due-notifications/route.ts",
  "apps/web/app/api/cron/purge-anonymous-cases/route.ts",
  "apps/web/app/api/cron/cleanup-notebook-storage/route.ts",
  "apps/web/app/api/cron/cleanup-person-notebook-storage/route.ts",
  "apps/web/app/api/notifications/opened/route.ts",
  "apps/web/app/api/account/delete-request/route.ts",
  "apps/web/app/api/admin/delete-requests/route.ts",
  "apps/web/app/api/admin/delete-requests/auth-status/route.ts",
  "apps/web/app/api/admin/delete-requests/execute/route.ts",
  "apps/web/lib/adminAuth.ts",
  "apps/web/lib/adminClientAuth.ts",
  "apps/web/app/api/notebook/diary/route.ts",
  "apps/web/app/api/notebook/person/route.ts",
  "apps/mobile/app/(auth)/welcome.tsx",
  "apps/mobile/app/(tabs)/dashboard.tsx",
  "apps/mobile/app/(tabs)/plan.tsx",
  "apps/mobile/app/(tabs)/settings.tsx",
  "apps/mobile/app/account/delete.tsx",
  "apps/mobile/app/invite.tsx",
  "apps/mobile/app/people/[id]/tasks.tsx",
  "apps/mobile/app/people/[id]/assets.tsx",
  "apps/mobile/app/notifications.tsx",
  "supabase/schema.sql",
  "supabase/task_template_seed.sql",
  "supabase/task_generation.sql",
  "supabase/notification_delivery_hardening.sql",
  "supabase/task_notification_generation.sql",
  "supabase/monthly_checkin_notifications.sql",
  "supabase/notification_email_delivery.sql",
  "supabase/handoff_consume_rpc.sql",
  "supabase/anonymous_diagnosis_rpc.sql",
  "supabase/create_initial_family_person.sql",
  "supabase/product_seed.sql",
  "supabase/indexes.sql",
  "supabase/api_grants.sql",
  "supabase/production_rls.sql",
  "supabase/notebook_atomic_sync_v2.sql",
  "supabase/ai_consult_memory.sql",
  "supabase/notebook_diary_delete.sql",
  "supabase/notebook_person_delete.sql",
  "supabase/family_invite_rpc.sql",
  "supabase/admin_auth_hardening.sql",
  "supabase/account_delete_executor_role.sql",
  "supabase/account_delete_identity_ledger.sql",
  "supabase/account_delete_operator_provisioning_regression_bootstrap.sql",
  "supabase/family_owner_succession.sql",
  "supabase/family_management_rpc.sql",
  "supabase/account_deletion_pipeline.sql",
  "supabase/account_delete_identity_ledger_regression.sql",
  "supabase/account_delete_operator_provisioning_regression.sql",
  "supabase/account_erasure_regression.sql",
  "supabase/account_erasure_regression_bootstrap.sql",
  "supabase/notebook_diary_delete_regression.sql",
  "supabase/notebook_person_delete_regression.sql",
  "scripts/test-diary-deletion.mjs",
  "scripts/test-notebook-diary-delete-sql.sh",
  "scripts/test-notebook-person-deletion.mjs",
  "scripts/test-notebook-person-delete-sql.sh",
  "scripts/test-family-invite-permissions.mjs",
  "scripts/test-account-erasure-sql.sh",
  "scripts/render-delete-operator-policy-sql.mjs",
  "scripts/test-account-delete-executor-auth.mjs",
  "scripts/test-delete-operator-mfa-setup.mjs",
  "scripts/test-web-account-deletion.mjs",
  "supabase/public_api_rate_limits.sql",
  "supabase/anonymous_case_retention.sql",
  "supabase/storage_setup.sql",
  "supabase/verify_setup.sql",
  "supabase/verify_compact.sql",
  "vercel.json",
  "apps/mobile/eas.json",
  "docs/PRODUCTION_CHECKLIST.md",
  "docs/DEPLOYMENT.md",
  "docs/ENVIRONMENT_MATRIX.md",
  "docs/ADMIN_AUTH_POLICY.md",
  "docs/PRIVACY_AND_REVIEW_GUARDRAILS.md",
  "docs/FAMILY_SUCCESSION_POLICY.md",
  "docs/FAMILY_TEST_COOPERATION_REQUEST.md",
  "docs/COMMERCIAL_RELEASE_PLAN_2026-09-03.md",
  "docs/COMMERCIAL_RELEASE_INPUTS.md",
  "docs/COMMERCIAL_OPERATIONS_RUNBOOK.md",
  "docs/SESSION_HANDOFF.md"
];

const envFiles = {
  "apps/web/.env.example": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_ACCESS_TOKEN",
    "ACCOUNT_ERASURE_EXECUTION_ENABLED",
    "COMMERCIAL_SUPPORT_PACK_SALES_ENABLED",
    "COMMERCIAL_PLUS_SALES_ENABLED",
    "STRIPE_SECRET_KEY",
    "STRIPE_SUPPORT_PACK_PRICE_ID",
    "STRIPE_PLUS_PRICE_ID",
    "STRIPE_WEBHOOK_SECRET",
    "CRON_SECRET",
    "RESEND_API_KEY",
    "NOTIFICATION_EMAIL_FROM",
    "ANONYMOUS_CASE_RETENTION_DAYS",
    "ANONYMOUS_CASE_PURGE_LIMIT",
    "NEXT_PUBLIC_APP_SCHEME",
    "NEXT_PUBLIC_WEB_BASE_URL",
    "NEXT_PUBLIC_PLUS_PRICE_LABEL",
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
  ],
  "apps/mobile/.env.example": [
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_APP_SCHEME",
    "EXPO_PUBLIC_WEB_BASE_URL",
    "EXPO_PUBLIC_EAS_PROJECT_ID"
  ]
};

const sqlOrder = [
  "schema.sql",
  "task_template_seed.sql",
  "task_generation.sql",
  "notification_delivery_hardening.sql",
  "task_notification_generation.sql",
  "monthly_checkin_notifications.sql",
  "notification_email_delivery.sql",
  "handoff_consume_rpc.sql",
  "anonymous_diagnosis_rpc.sql",
  "create_initial_family_person.sql",
  "product_seed.sql",
  "indexes.sql",
  "api_grants.sql",
  "production_rls.sql",
  "notebook_atomic_sync_v2.sql",
  "ai_consult_memory.sql",
  "notebook_diary_delete.sql",
  "consult_daily_claim.sql",
  "notebook_person_delete.sql",
  "family_invite_rpc.sql",
  "admin_auth_hardening.sql",
  "account_delete_executor_role.sql",
  "account_delete_identity_ledger.sql",
  "family_owner_succession.sql",
  "family_management_rpc.sql",
  "account_deletion_pipeline.sql",
  "public_api_rate_limits.sql",
  "anonymous_case_retention.sql",
  "storage_setup.sql",
  "verify_setup.sql",
  "verify_compact.sql"
];

let failed = false;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`OK   ${label}${detail ? `: ${detail}` : ""}`);
    return;
  }

  failed = true;
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

for (const file of requiredFiles) {
  check(file, existsSync(join(root, file)));
}

for (const [file, keys] of Object.entries(envFiles)) {
  const fullPath = join(root, file);
  const body = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
  check(`${file} exists`, Boolean(body));
  for (const key of keys) {
    check(`${file} ${key}`, body.includes(`${key}=`));
  }
}

check("web dependencies", existsSync(join(root, "apps/web/node_modules")));
check("mobile dependencies", existsSync(join(root, "apps/mobile/node_modules")));
check("root lockfile", existsSync(join(root, "pnpm-lock.yaml")));

const supabaseReadme = readFileSync(join(root, "supabase/README.md"), "utf8");
for (const sqlFile of sqlOrder) {
  check(`supabase README order ${sqlFile}`, supabaseReadme.includes(sqlFile));
}

const deploymentDoc = readFileSync(join(root, "docs/DEPLOYMENT.md"), "utf8");
check("deployment mentions smoke", deploymentDoc.includes("scripts/smoke-web.mjs"));
check(
  "deployment mentions EAS",
  deploymentDoc.includes("eas build") || deploymentDoc.includes("eas:mobile:build"),
);
check("deployment warns service role", deploymentDoc.includes("SUPABASE_SERVICE_ROLE_KEY"));

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
check(
  "account deletion operator auth test script",
  packageJson.scripts?.["test:account-delete-executor"] === "node scripts/test-account-delete-executor-auth.mjs"
);
const ciWorkflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
check(
  "CI runs account deletion operator auth test",
  ciWorkflow.includes("pnpm run test:account-delete-executor")
);

const vercelConfig = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
check("vercel build command", vercelConfig.buildCommand === "pnpm --filter web run build");
check("vercel cron route", vercelConfig.crons?.some((cron) => cron.path === "/api/cron/send-due-notifications"));
check("vercel anonymous purge cron route", vercelConfig.crons?.some((cron) => cron.path === "/api/cron/purge-anonymous-cases"));
check("vercel diary storage cleanup cron route", vercelConfig.crons?.some((cron) => cron.path === "/api/cron/cleanup-notebook-storage"));
check("vercel person storage cleanup cron route", vercelConfig.crons?.some((cron) => cron.path === "/api/cron/cleanup-person-notebook-storage"));

if (failed) {
  process.exit(1);
}

console.log("Local doctor passed.");
