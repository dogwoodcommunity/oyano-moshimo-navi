import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "apps/web/app/start/page.tsx",
  "apps/web/app/diagnosis/page.tsx",
  "apps/web/app/result/[caseId]/page.tsx",
  "apps/web/app/api/handoff/consume/route.ts",
  "apps/mobile/app/(auth)/welcome.tsx",
  "apps/mobile/app/(tabs)/dashboard.tsx",
  "apps/mobile/app/people/[id]/tasks.tsx",
  "supabase/schema.sql",
  "supabase/task_generation.sql",
  "supabase/task_notification_generation.sql",
  "docs/SESSION_HANDOFF.md"
];

const envFiles = [
  "apps/web/.env.example",
  "apps/mobile/.env.example"
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

for (const file of envFiles) {
  const fullPath = join(root, file);
  const body = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
  check(`${file} exists`, Boolean(body));
  check(`${file} Supabase URL`, body.includes("SUPABASE_URL"));
}

check("web dependencies", existsSync(join(root, "apps/web/node_modules")));
check("mobile dependencies", existsSync(join(root, "apps/mobile/node_modules")));
check("root lockfile", existsSync(join(root, "pnpm-lock.yaml")));

if (failed) {
  process.exit(1);
}

console.log("Local doctor passed.");

