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
    this.ok = status >= 200 && status < 300;
  }

  static json(body, init = {}) {
    return new MockNextResponse(body, init.status ?? 200);
  }

  async json() {
    return this.body;
  }
}

function compile(sourcePath) {
  return ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  }).outputText;
}

function loadCommonJs(sourcePath, mockRequire) {
  const moduleRecord = { exports: {} };
  const load = new Function("exports", "require", "module", "__filename", "__dirname", compile(sourcePath));
  load(moduleRecord.exports, mockRequire, moduleRecord, sourcePath, path.dirname(sourcePath));
  return moduleRecord.exports;
}

function queryResult(data, error = null) {
  const query = {
    eq() { return query; },
    in() { return query; },
    limit() { return query; },
    maybeSingle() { return Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }); },
    select() { return query; },
    single() { return Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }); },
    then(resolve, reject) {
      return Promise.resolve({ data, error }).then(resolve, reject);
    }
  };
  return query;
}

function request(body) {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === "authorization" ? "Bearer valid-token" : null;
      }
    },
    async json() {
      return body;
    }
  };
}

const homeRoutePath = path.join(repoRoot, "apps/web/app/api/storage/home-photo-upload-url/route.ts");
const homeRouteSource = fs.readFileSync(homeRoutePath, "utf8");
assert.match(homeRouteSource, /status:\s*410/, "legacy home-photo POST must remain retired");
assert.match(homeRouteSource, /\/api\/notebook\/photo-upload-url/, "legacy response must direct callers to the current notebook photo flow");
assert.doesNotMatch(homeRouteSource, /getServerSupabase|createSignedUploadUrl|request\.json/, "retired route must not parse input, authenticate, or create a signed URL");

const homeRoute = loadCommonJs(homeRoutePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  throw new Error(`Unexpected home-photo route import: ${specifier}`);
});

{
  const response = await homeRoute.POST({
    get headers() {
      throw new Error("retired route must not inspect authentication headers");
    },
    async json() {
      throw new Error("retired route must not parse the request body");
    }
  });
  const body = await response.json();
  assert.equal(response.status, 410, "legacy home-photo POST must fail closed for every caller");
  assert.equal(body.error, "legacy_home_photo_upload_retired");
  assert.match(body.message, /手帳画面の「写真を追加」/, "retirement message must explain the current user flow");
  assert.equal(body.currentEndpoint, "/api/notebook/photo-upload-url");
}

let notebookRole = "viewer";
let notebookSignedUrlCalls = 0;
const notebookSupabase = {
  auth: {
    async getUser(token) {
      assert.equal(token, "valid-token");
      return { data: { user: { id: "user-1" } }, error: null };
    }
  },
  from(table) {
    if (table === "family_members") {
      return queryResult([{ family_id: "family-1", role: notebookRole }]);
    }
    if (table === "families") {
      return queryResult([{ plan: "free" }]);
    }
    throw new Error(`Unexpected notebook-photo table: ${table}`);
  },
  async rpc(name) {
    assert.equal(name, "check_public_api_rate_limit");
    return { data: { allowed: true }, error: null };
  },
  storage: {
    from(bucket) {
      assert.equal(bucket, "home-photos");
      return {
        async createSignedUploadUrl(storagePath) {
          notebookSignedUrlCalls += 1;
          return { data: { signedUrl: `https://upload.test/${storagePath}`, token: "signed-token" }, error: null };
        },
        async list() {
          return { data: [], error: null };
        }
      };
    }
  }
};

const notebookRoutePath = path.join(repoRoot, "apps/web/app/api/notebook/photo-upload-url/route.ts");
const notebookRoute = loadCommonJs(notebookRoutePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/publicRateLimit") return { checkPublicRateLimit: async () => null };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => notebookSupabase };
  throw new Error(`Unexpected notebook-photo route import: ${specifier}`);
});

notebookRole = "viewer";
notebookSignedUrlCalls = 0;
{
  const response = await notebookRoute.POST(request({
    fileName: "diary.jpg",
    contentType: "image/jpeg",
    fileSizeBytes: 100
  }));
  assert.equal(response.status, 403, "viewer-only user must not receive a notebook-photo signed upload URL");
  assert.equal(notebookSignedUrlCalls, 0, "viewer-only denial must happen before signed URL creation");
}

for (const role of ["owner", "admin", "member"]) {
  notebookRole = role;
  notebookSignedUrlCalls = 0;
  const response = await notebookRoute.POST(request({
    fileName: `${role}-diary.jpg`,
    contentType: "image/jpeg",
    fileSizeBytes: 100
  }));
  assert.equal(response.status, 200, `${role} should receive a notebook-photo signed upload URL`);
  assert.equal(notebookSignedUrlCalls, 1, `${role} should create exactly one notebook-photo signed URL`);
}

const notifySupabase = {
  auth: {
    async getUser(token) {
      assert.equal(token, "valid-token");
      return { data: { user: { id: "user-1" } }, error: null };
    }
  },
  from(table) {
    if (table === "people") {
      return queryResult({ family_id: "family-1", display_name: "親" });
    }
    if (table === "family_members") {
      return queryResult([
        { user_id: "user-1", relationship: "閲覧者", role: "viewer" },
        { user_id: "user-2", relationship: "家族代表", role: "owner" }
      ]);
    }
    throw new Error(`Viewer notification reached forbidden table: ${table}`);
  }
};

const notifyRoutePath = path.join(repoRoot, "apps/web/app/api/family/notify/route.ts");
const notifyRoute = loadCommonJs(notifyRoutePath, (specifier) => {
  if (specifier === "next/server") return { NextResponse: MockNextResponse };
  if (specifier === "@/lib/publicRateLimit") return { checkPublicRateLimit: async () => null };
  if (specifier === "@/lib/serverSupabase") return { getServerSupabase: () => notifySupabase };
  throw new Error(`Unexpected family-notify route import: ${specifier}`);
});

{
  const response = await notifyRoute.POST(request({ personId: "person-1", kind: "record" }));
  assert.equal(response.status, 403, "viewer must not trigger a family update notification");
  assert.equal((await response.json()).error, "viewer_cannot_notify");
}

const storageSetup = fs.readFileSync(path.join(repoRoot, "supabase/storage_setup.sql"), "utf8");
const storageUpdatePolicy = storageSetup.match(/create policy "home photos update own family"[\s\S]*?\n\);/)?.[0] ?? "";
const storageDeletePolicy = storageSetup.match(/create policy "home photos delete own family"[\s\S]*?\n\);/)?.[0] ?? "";
assert.match(storageUpdatePolicy, /family_members\.role in \('owner', 'admin', 'member'\)/);
assert.match(storageDeletePolicy, /family_members\.role in \('owner', 'admin', 'member'\)/);

const productionRls = fs.readFileSync(path.join(repoRoot, "supabase/production_rls.sql"), "utf8");
assert.match(productionRls, /revoke all on function is_family_editor\(uuid\) from public, anon/);
assert.match(productionRls, /grant execute on function is_family_editor\(uuid\) to authenticated, service_role/);

console.log("family role, retired legacy upload, and signed upload security checks: ok");
