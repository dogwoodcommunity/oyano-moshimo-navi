import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const ts = webRequire("typescript");
const sourcePath = path.join(repoRoot, "apps/web/lib/cronAuth.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
}).outputText;

function loadCronAuth(cronSecret) {
  const moduleRecord = { exports: {} };
  const processStub = { env: {} };
  if (cronSecret !== undefined) processStub.env.CRON_SECRET = cronSecret;

  const mockRequire = (specifier) => {
    if (specifier === "crypto") return crypto;
    if (specifier === "next/server") {
      return {
        NextResponse: {
          json(body, init = {}) {
            return { body, status: init.status ?? 200 };
          }
        }
      };
    }
    throw new Error(`Unexpected runtime import in cronAuth.ts: ${specifier}`);
  };

  const load = new Function("exports", "require", "module", "process", compiled);
  load(moduleRecord.exports, mockRequire, moduleRecord, processStub);
  return moduleRecord.exports.verifyCron;
}

function requestWithAuthorization(value) {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === "authorization" ? value ?? null : null;
      }
    }
  };
}

for (const missingSecret of [undefined, "", "   "]) {
  const verifyCron = loadCronAuth(missingSecret);
  const response = verifyCron(requestWithAuthorization("Bearer anything"));
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Cron authorization is not configured" });
}

const verifyCron = loadCronAuth("correct-secret");
assert.equal(verifyCron(requestWithAuthorization("Bearer correct-secret")), null);

for (const authorization of [undefined, "Basic correct-secret", "Bearer wrong-secret!", "Bearer correct-secreu"]) {
  const response = verifyCron(requestWithAuthorization(authorization));
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Invalid cron token" });
}

console.log("cron auth fail-closed checks: ok");
