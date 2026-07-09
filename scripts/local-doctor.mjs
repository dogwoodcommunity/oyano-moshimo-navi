import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "apps/web/app/start/page.tsx",
  "apps/web/app/diagnosis/page.tsx",
  "apps/web/app/result/[caseId]/page.tsx",
  "apps/web/app/result/[caseId]/share/page.tsx",
  "apps/web/app/invite/[token]/page.tsx",
  "apps/web/app/guides/page.tsx",
  "apps/web/app/guides/[slug]/page.tsx",
  "apps/web/lib/guides.ts",
  "apps/web/app/checklists/page.tsx",
  "apps/web/lib/checklists.ts",
  "apps/web/app/safety/page.tsx",
  "apps/web/app/plans/page.tsx",
  "apps/web/app/sitemap.ts",
  "apps/web/app/robots.ts",
  "apps/web/app/support-pack/page.tsx",
  "apps/web/app/admin/page.tsx",
  "apps/web/app/admin/delete-requests/page.tsx",
  "apps/web/app/admin/env/page.tsx",
  "apps/web/app/api/handoff/consume/route.ts",
  "apps/web/app/api/stripe/checkout/route.ts",
  "apps/web/app/api/stripe/webhook/route.ts",
  "apps/web/app/api/cron/send-due-notifications/route.ts",
  "apps/web/app/api/notifications/opened/route.ts",
  "apps/web/app/api/account/delete-request/route.ts",
  "apps/web/app/api/admin/delete-requests/route.ts",
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
  "supabase/handoff_consume_rpc.sql",
  "supabase/product_seed.sql",
  "supabase/indexes.sql",
  "supabase/api_grants.sql",
  "supabase/production_rls.sql",
  "supabase/family_invite_rpc.sql",
  "supabase/admin_auth_hardening.sql",
  "supabase/family_owner_succession.sql",
  "supabase/account_deletion_pipeline.sql",
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
  "docs/SESSION_HANDOFF.md"
];

const envFiles = {
  "apps/web/.env.example": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_ACCESS_TOKEN",
    "STRIPE_SECRET_KEY",
    "STRIPE_SUPPORT_PACK_PRICE_ID",
    "STRIPE_WEBHOOK_SECRET",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_SCHEME",
    "NEXT_PUBLIC_WEB_BASE_URL"
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
  "handoff_consume_rpc.sql",
  "product_seed.sql",
  "indexes.sql",
  "api_grants.sql",
  "production_rls.sql",
  "family_invite_rpc.sql",
  "admin_auth_hardening.sql",
  "family_owner_succession.sql",
  "account_deletion_pipeline.sql",
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

const vercelConfig = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
check("vercel build command", vercelConfig.buildCommand === "pnpm --filter web run build");
check("vercel cron route", vercelConfig.crons?.some((cron) => cron.path === "/api/cron/send-due-notifications"));

if (failed) {
  process.exit(1);
}

console.log("Local doctor passed.");
