import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkDocker, checkLocalFiles, createPlan, executePlan, localEnvironment, repoRoot } from "./test-stage-a-local.mjs";

const env = localEnvironment({
  PATH: "/local/bin", HOME: "/local/home", TMPDIR: "/local/tmp",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-secret", ANTHROPIC_API_KEY: "fixture-secret",
  DATABASE_URL: "postgres://fixture-secret", NOTEBOOK_ACCESS_TOKEN: "fixture-secret",
  NEXT_PUBLIC_SUPABASE_URL: "https://production.invalid", DOCKER_HOST: "tcp://production.invalid",
  NODE_OPTIONS: "--require malicious.cjs", HTTPS_PROXY: "https://production.invalid",
  ACCOUNT_ERASURE_EXECUTION_ENABLED: "true",
  pnpm_config_verify_deps_before_run: "install"
});
for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL", "NOTEBOOK_ACCESS_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "DOCKER_HOST", "NODE_OPTIONS", "HTTPS_PROXY"]) {
  assert.equal(env[key], undefined, `${key} must not reach local child processes`);
}
assert.equal(env.ACCOUNT_ERASURE_EXECUTION_ENABLED, "false");
assert.equal(env.COMMERCIAL_PLUS_SALES_ENABLED, "false");
assert.equal(env.CI, "1");
assert.equal(env.pnpm_config_verify_deps_before_run, "error", "never auto-install dependencies before a qualification step");

const plan = createPlan();
assert.equal(new Set(plan.map((step) => step.id)).size, plan.length);
assert.equal(createPlan({ sourceOnly: true }).length, 29);
assert.ok(plan.some((step) => step.id === "source:readable-design-b"));
assert.equal(plan.filter((step) => step.id.startsWith("sql:")).length, 10);
assert.ok(plan.some((step) => step.id === "source:family-role-security"));
assert.ok(plan.some((step) => step.id === "source:notebook-sync-runtime"));
assert.ok(plan.some((step) => step.id === "lint:web"));
assert.equal(plan.at(-1).id, "build:web");
assert.ok(createPlan({ sourceOnly: true }).every((step) => step.id.startsWith("source:")));
assert.equal(createPlan({ sqlOnly: true }).length, 10);
assert.ok(createPlan({ sqlOnly: true }).every((step) => step.id.startsWith("sql:")));
assert.doesNotMatch(JSON.stringify(plan), /smoke-|vercel|deploy|supabase (?:db|link)|https:\/\//);
for (const step of createPlan({ sqlOnly: true })) {
  const script = fs.readFileSync(path.join(repoRoot, step.args[0]), "utf8");
  assert.match(script, /docker run --pull=never --network=none/, `${step.id} must never pull or give its fixture database network access`);
  assert.match(script, /docker\.io\/library\/postgres:16-bookworm/, `${step.id} must use the canonical cached PostgreSQL image`);
  assert.doesNotMatch(script, /DATABASE_URL|SUPABASE_DB|docker pull|--publish|--volume|--mount/, `${step.id} must not use production DB variables, published ports, or host volumes`);
}
const ci = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
assert.match(ci, /docker pull docker\.io\/library\/postgres:16-bookworm/, "fresh CI must explicitly prepare the image before offline SQL scripts");
assert.ok(ci.indexOf("docker pull docker.io/library/postgres:16-bookworm") < ci.indexOf("pnpm run test:account-erasure:sql"), "CI image preparation must precede the first offline SQL suite");

const called = [];
const failed = executePlan(plan, {
  env,
  execute: (command, args, options) => {
    called.push({ command, args, env: options.env });
    return { status: called.length === 2 ? 1 : 0, stdout: "fixture-secret", stderr: "fixture-secret" };
  }
});
assert.equal(called.length, 2, "stop on the first failing command");
assert.equal(failed.passed, false);
assert.deepEqual(failed.results.map((step) => step.status), ["PASS", "FAIL"]);
assert.doesNotMatch(JSON.stringify(failed), /fixture-secret|stdout|stderr/);
assert.ok(called.every((step) => step.env === env));
const timedOut = executePlan(plan, { env, execute: () => ({ status: null, signal: "SIGTERM" }) });
assert.equal(timedOut.results.length, 1);
assert.equal(timedOut.passed, false);
assert.equal(executePlan(plan, { env, execute: () => ({ status: 0 }) }).passed, true);

let dockerCalls = 0;
assert.throws(() => checkDocker(env, () => {
  dockerCalls += 1;
  return { status: 0, stdout: "tcp://production.invalid:2376" };
}), /local_docker_required/);
assert.equal(dockerCalls, 1, "remote Docker must fail before any connection/image request");
const localDocker = checkDocker(env, (command, args, options) => {
  assert.equal(command, "docker");
  if (args[0] === "context") return { status: 0, stdout: "unix:///tmp/local-docker.sock\n" };
  assert.deepEqual(args, ["image", "inspect", "docker.io/library/postgres:16-bookworm"]);
  assert.equal(options.env.DOCKER_HOST, "unix:///tmp/local-docker.sock");
  return { status: 0 };
});
assert.equal(localDocker.DOCKER_HOST, "unix:///tmp/local-docker.sock");
assert.throws(() => checkDocker(env, (command, args) => args[0] === "context"
  ? { status: 0, stdout: "unix:///tmp/local-docker.sock" } : { status: 1 }), /postgres_image_required/);

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "oyano-stage-a-runner-test-"));
try {
  fs.mkdirSync(path.join(fixture, "apps/web"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "apps/mobile"), { recursive: true });
  fs.writeFileSync(path.join(fixture, ".env.local"), "DO_NOT_READ=fixture-secret\n");
  assert.throws(() => checkLocalFiles(fixture), /dotenv_present/);
  assert.equal(fs.readFileSync(path.join(fixture, ".env.local"), "utf8"), "DO_NOT_READ=fixture-secret\n");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

console.log("Stage A local runner safety and fail-fast checks: ok");
