import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceTests = [
  "stage-a-local-runner", "monitor-timeline", "monitor-retention", "monitor-submission-gate",
  "cron-auth", "notebook-sync-safety", "notebook-sync-runtime", "memory-book-export",
  "free-first-redesign", "home-overview-reachability", "web-account-deletion",
  "account-delete-executor-auth", "delete-operator-mfa-setup", "commercial-release-gates",
  "admin-delete-access-check", "public-operator-disclosure",
  "family-role-security", "family-invite-permissions", "family-context-selection",
  "family-management", "handoff-security", "consult-memory", "consult-route",
  "diary-deletion", "notebook-person-deletion"
];
const sqlTests = [
  "account-erasure", "family-role-rls", "family-management", "handoff-ownership",
  "ai-consult-memory", "consult-daily-claim", "notebook-diary-delete", "notebook-person-delete",
  "monthly-checkin"
];

export function createPlan({ sourceOnly = false, sqlOnly = false } = {}) {
  const steps = sourceTests.map((name) => ({
    id: `source:${name}`, command: process.execPath, args: [`scripts/test-${name}.mjs`]
  }));
  const databaseSteps = sqlTests.map((name) => ({
    id: `sql:${name}`, command: "bash", args: [`scripts/test-${name}-sql.sh`]
  }));
  if (sourceOnly) return steps;
  if (sqlOnly) return databaseSteps;
  return [
    ...steps,
    { id: "lint:web", command: "pnpm", args: ["--filter", "web", "run", "lint"] },
    ...["web", "mobile"].map((app) => ({
      id: `typecheck:${app}`, command: "pnpm", args: ["--filter", app, "run", "typecheck"]
    })),
    ...databaseSteps,
    { id: "build:web", command: "pnpm", args: ["--filter", "web", "run", "build"] }
  ];
}

// No inherited credentials, NODE_OPTIONS, app URLs, PG*, cloud flags, proxies,
// or package-manager install hooks. Build uses fonts over read-only HTTPS;
// this is a fixed local test plan, not an operating-system network sandbox.
export function localEnvironment(parent = process.env) {
  const env = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SystemRoot", "SYSTEMROOT", "COMSPEC"]) {
    if (parent[key]) env[key] = parent[key];
  }
  return {
    ...env,
    CI: "1",
    // pnpm 11 can otherwise run an implicit install before `run`/`exec`.
    // A qualification command must stop on stale dependencies, never repair them.
    pnpm_config_verify_deps_before_run: "error",
    TZ: "Asia/Tokyo",
    LANG: "en_US.UTF-8",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_WEB_BASE_URL: "http://localhost:3000",
    ACCOUNT_ERASURE_EXECUTION_ENABLED: "false",
    COMMERCIAL_SUPPORT_PACK_SALES_ENABLED: "false",
    COMMERCIAL_PLUS_SALES_ENABLED: "false"
  };
}

export function checkLocalFiles(root = repoRoot, { sourceOnly = false, sqlOnly = false } = {}) {
  // Next automatically loads dotenv files even after process.env was scrubbed.
  // Refuse by filename only; never read, move, modify, or print their values.
  for (const relative of ["", "apps/web", "apps/mobile"]) {
    const directory = path.join(root, relative);
    for (const name of fs.readdirSync(directory)) {
      if (/^\.env(?:\.|$)/.test(name) && !/\.(?:example|sample|template)$/.test(name)) {
        throw new Error("dotenv_present: run from a clean source checkout without runtime .env files; no files were changed");
      }
    }
  }
  for (const step of createPlan({ sourceOnly, sqlOnly })) {
    if (step.command === process.execPath || step.command === "bash") {
      if (!fs.existsSync(path.join(root, step.args[0]))) throw new Error(`missing_script:${step.id}`);
    }
  }
  if (!sourceOnly && !sqlOnly) {
    const web = path.join(root, "apps/web");
    const configured = [".eslintrc.json", ".eslintrc.cjs", ".eslintrc.js", "eslint.config.mjs", "eslint.config.js"]
      .some((name) => fs.existsSync(path.join(web, name)));
    if (!configured) throw new Error("lint_not_configured: configure non-interactive Web lint before the full run");
  }
}

const runProcess = (command, args, options) => spawnSync(command, args, {
  ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024
});

export function checkDocker(env, execute = runProcess) {
  // Resolve the user's selected context locally, but never connect to a remote
  // engine. Pin all child commands to that exact Unix socket, not a later context.
  const context = execute("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], {
    cwd: repoRoot, env, timeout: 15_000
  });
  const endpoint = (context.stdout ?? "").trim();
  if (context.status !== 0 || !/^unix:\/\/\/[^\r\n]+$/.test(endpoint)) {
    throw new Error("local_docker_required: select an available local Unix-socket Docker context");
  }
  const dockerEnv = { ...env, DOCKER_HOST: endpoint };
  const image = execute("docker", ["image", "inspect", "docker.io/library/postgres:16-bookworm"], {
    cwd: repoRoot, env: dockerEnv, timeout: 15_000
  });
  if (image.status !== 0) {
    throw new Error("postgres_image_required: verify local Docker access and cached postgres:16-bookworm; no image was pulled");
  }
  return dockerEnv;
}

export function executePlan(plan, {
  env,
  root = repoRoot,
  execute = runProcess,
  now = Date.now,
  notify = () => {}
} = {}) {
  const results = [];
  for (const step of plan) {
    notify(`RUN ${step.id}`);
    const start = now();
    const result = execute(step.command, step.args, { cwd: root, env, timeout: 10 * 60_000 });
    const success = result.status === 0 && !result.error && !result.signal;
    results.push({
      id: step.id,
      status: success ? "PASS" : "FAIL",
      exitCode: result.status ?? null,
      durationMs: Math.max(0, now() - start)
    });
    // Keep raw child stdout/stderr and error messages out of stored evidence.
    // A failing command can be rerun from this same clean checkout for diagnosis.
    notify(`${success ? "PASS" : "FAIL"} ${step.id}`);
    if (!success) break;
  }
  return { passed: results.length === plan.length && results.every((item) => item.status === "PASS"), results };
}

export function main(argv = process.argv.slice(2)) {
  const allowed = new Set(["--plan", "--source-only", "--sql-only"]);
  if (argv.some((arg) => !allowed.has(arg)) || new Set(argv).size !== argv.length ||
      (argv.includes("--source-only") && argv.includes("--sql-only"))) {
    console.error("Usage: node scripts/test-stage-a-local.mjs [--plan] [--source-only | --sql-only]");
    return 2;
  }
  const sourceOnly = argv.includes("--source-only");
  const sqlOnly = argv.includes("--sql-only");
  const scope = sourceOnly ? "source-only" : sqlOnly ? "sql-only" : "local-full";
  const plan = createPlan({ sourceOnly, sqlOnly });
  if (argv.includes("--plan")) {
    console.log(JSON.stringify({ scope, steps: plan }, null, 2));
    return 0;
  }
  try {
    checkLocalFiles(repoRoot, { sourceOnly, sqlOnly });
    let env = localEnvironment();
    if (!sourceOnly) env = checkDocker(env);
    const result = executePlan(plan, { env, notify: (message) => console.error(message) });
    console.log(JSON.stringify({
      scope,
      status: result.passed ? (sourceOnly || sqlOnly ? "PARTIAL_PASS" : "LOCAL_PASS") : "FAIL",
      productionAcceptance: "NOT_TESTED",
      realDeviceAcceptance: "NOT_TESTED",
      ...result
    }, null, 2));
    return result.passed ? 0 : 1;
  } catch (error) {
    // Only the fixed, credential-free preflight messages above are emitted.
    const message = error instanceof Error && /^(?:dotenv_present|missing_script|lint_not_configured|local_docker_required|postgres_image_required):/.test(error.message)
      ? error.message : "local_preflight_failed: check local dependencies and file access";
    console.error(message);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
