import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");

class MockNextResponse {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
  }

  static json(body, init = {}) {
    return new MockNextResponse(body, init.status ?? 200);
  }
}

const sourcePath = path.join(repoRoot, "apps/web/lib/family.ts");
const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
}).outputText;

const moduleRecord = { exports: {} };
const load = new Function("exports", "require", "module", "__filename", "__dirname", output);
load(moduleRecord.exports, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@oyano/shared") return { FREE_PLAN_MEMBER_LIMIT: 1 };
  if (specifier === "@/lib/serverSupabase") {
    return { getServerSupabase: () => null, getUserSupabase: () => null };
  }
  throw new Error(`Unexpected family helper import: ${specifier}`);
}, moduleRecord, sourcePath, path.dirname(sourcePath));

const { resolveFamilyId, familySelectionErrorResponse } = moduleRecord.exports;

function membershipQuery(rows, error = null) {
  const query = {
    select() { return query; },
    eq() { return query; },
    order() { return Promise.resolve({ data: rows, error }); }
  };
  return query;
}

function contextWithMemberships(rows, error = null) {
  return {
    userId: "user-1",
    email: "user@example.test",
    service: {
      from(table) {
        assert.equal(table, "family_members");
        return membershipQuery(rows, error);
      }
    },
    user: {}
  };
}

assert.equal(
  await resolveFamilyId(contextWithMemberships([{ family_id: "family-a" }])),
  "family-a",
  "a single membership should remain the safe default"
);

const multiple = contextWithMemberships([
  { family_id: "family-a" },
  { family_id: "family-b" }
]);

await assert.rejects(
  () => resolveFamilyId(multiple),
  (error) => error?.code === "family_selection_required"
);
assert.equal(await resolveFamilyId(multiple, "family-b"), "family-b");

let denied;
try {
  await resolveFamilyId(multiple, "family-other");
} catch (error) {
  denied = error;
}
assert.equal(denied?.code, "family_access_denied");
assert.equal(familySelectionErrorResponse(denied)?.status, 403);

let notReady;
try {
  await resolveFamilyId(contextWithMemberships([]));
} catch (error) {
  notReady = error;
}
assert.equal(notReady?.code, "family_not_ready");
assert.equal(familySelectionErrorResponse(notReady)?.status, 409);

const familyRoute = fs.readFileSync(path.join(repoRoot, "apps/web/app/api/family/route.ts"), "utf8");
const inviteRoute = fs.readFileSync(path.join(repoRoot, "apps/web/app/api/family/invite/route.ts"), "utf8");
const plusRoute = fs.readFileSync(path.join(repoRoot, "apps/web/app/api/stripe/plus-checkout/route.ts"), "utf8");
const familyUi = fs.readFileSync(path.join(repoRoot, "apps/web/components/FamilyShare.tsx"), "utf8");
const plusUi = fs.readFileSync(path.join(repoRoot, "apps/web/components/PlusUpgrade.tsx"), "utf8");

assert.match(familyRoute, /searchParams\.get\("familyId"\)/);
assert.match(inviteRoute, /familyId:\s*summary\?\.familyId|payload\.familyId/);
assert.match(plusRoute, /resolveFamilyId\(context, body\.familyId\)/);
assert.match(familyUi, /readNotebookCloudBinding/);
assert.match(familyUi, /familyId:\s*summary\?\.familyId/);
assert.match(plusUi, /body:\s*JSON\.stringify\(\{ familyId \}\)/);

console.log("family context selection checks: ok");
