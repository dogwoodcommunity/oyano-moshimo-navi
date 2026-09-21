import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { localEnvironment, repoRoot } from "./test-stage-a-local.mjs";

// Execute the actual runner bodies with synthetic FS/process modules. No temporary
// directory, copy, SDK lookup, child process, network request or compilation occurs.
const ROOT = "/synthetic/repo";
const TMP = "/synthetic/tmp";
const NODE = "/synthetic/node/bin/node";
const SDK = "/synthetic/android-sdk";
const JAVA = "/synthetic/jdk";
const SECRET = "SYNTHETIC_DO_NOT_INHERIT";
const sourceNames = ["app", "components", "lib", "assets", "app.json", "app.config.js", "package.json", "index.js", "metro.config.js", "tsconfig.json", "env.d.ts"];
assert.match(readFileSync(path.join(repoRoot, ".gitignore"), "utf8"), /^\/?\.native-android-qualification-\*\/$/m,
  "Local Android builds must not be committed");
const secretKeys = [
  "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "ANTHROPIC_API_KEY", "EXPO_TOKEN",
  "EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID", "EXPO_OWNER", "NODE_OPTIONS", "HTTPS_PROXY",
  "JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS", "GRADLE_OPTS", "JAVA_OPTS",
  "ORG_GRADLE_PROJECT_STORE_PASSWORD", "ANDROID_KEYSTORE_PASSWORD", "ASC_API_KEY",
  "BUNDLE_GEMFILE", "RUBYOPT", "npm_config_registry", "AWS_ACCESS_KEY_ID"
];
const clean = (value) => JSON.parse(JSON.stringify(value));

function simulate(platform, options = {}) {
  const copy = platform === "android" ? `${ROOT}/.native-android-qualification-fixture` : `${TMP}/oyano-ios-compile-fixture`;
  const inherited = {
    PATH: "/synthetic/bin", HOME: "/synthetic/home", TMPDIR: TMP,
    ANDROID_HOME: SDK, JAVA_HOME: JAVA,
    GRADLE_USER_HOME: "/synthetic/untrusted-gradle-home",
    ANDROID_SDK_ROOT: "/synthetic/untrusted-sdk",
    GEM_HOME: "/synthetic/gems", GEM_PATH: "/synthetic/gem-path", BUNDLE_PATH: "/synthetic/bundle",
    ...Object.fromEntries(secretKeys.map((key) => [key, SECRET])), ...options.env
  };
  const calls = { preflight: [], temporary: [], copies: [], links: [], directories: [], opened: [], closed: [], exists: [], logReads: [], spawned: [], output: [] };
  const modules = {
    "node:fs": {
      cpSync: (...args) => calls.copies.push(clean(args)),
      existsSync(file) { calls.exists.push(file); return !options.missingPath || !file.endsWith(options.missingPath); },
      mkdtempSync(prefix) { calls.temporary.push(prefix); return copy; },
      mkdirSync: (...args) => calls.directories.push(clean(args)),
      openSync(file, flags, mode) { const fd = 100 + calls.opened.length; calls.opened.push({ file, flags, mode, fd }); return fd; },
      closeSync: (fd) => calls.closed.push(fd),
      readdirSync: () => options.noProject ? [] : ["Synthetic.xcworkspace", "Synthetic.xcodeproj"],
      readFileSync(file, encoding) { calls.logReads.push({ file, encoding }); return "Synthetic compiler diagnostic"; },
      symlinkSync: (...args) => calls.links.push(clean(args))
    },
    "node:os": { tmpdir: () => TMP },
    "node:path": { join: path.posix.join, isAbsolute: path.posix.isAbsolute },
    "node:child_process": {
      spawnSync(command, args, spawnOptions) {
        calls.spawned.push(clean({ command, args, ...spawnOptions }));
        return calls.spawned.length === options.failStep ? options.failure ?? { status: 1 } : { status: 0 };
      }
    },
    "./test-stage-a-local.mjs": {
      repoRoot: ROOT,
      localEnvironment: () => localEnvironment(inherited),
      checkLocalFiles(root, settings) {
        calls.preflight.push(clean({ root, settings }));
        if (options.dotenv) throw new Error("dotenv_present: synthetic preflight denial");
      }
    }
  };
  const file = `scripts/test-mobile-${platform}-compile.mjs`;
  const source = readFileSync(path.join(repoRoot, file), "utf8");
  const usedModules = [];
  const body = source.replace(/^import \{([^}]+)\} from "([^"]+)";$/gm, (_match, names, moduleName) => {
    assert.ok(Object.hasOwn(modules, moduleName), `Review new runner import: ${moduleName}`);
    usedModules.push(moduleName);
    return `const {${names}} = __modules[${JSON.stringify(moduleName)}];`;
  });
  assert.equal(usedModules.length, platform === "android" ? 4 : 5, "All runner imports must be replaced by the synthetic harness");
  assert.doesNotMatch(body, /^\s*(?:import|export)\b/m);
  let error;
  try {
    vm.runInNewContext(body, {
      __modules: modules,
      process: {
        platform: options.os ?? "darwin", arch: options.arch ?? "arm64", execPath: NODE,
        argv: [NODE, file, ...(options.args ?? [])], env: inherited,
        exit(code) { throw Object.assign(new Error("synthetic process exit"), { exitCode: code }); }
      },
      console: {
        log: (...args) => calls.output.push(args.join(" ")),
        error: (...args) => calls.output.push(args.join(" "))
      }
    }, { filename: file, timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  } catch (failure) { error = failure; }
  return { calls, error, copy };
}

function assertNoWork(result) {
  assert.ok(result.error, "Invalid prerequisites must fail closed");
  for (const key of ["temporary", "copies", "links", "opened", "spawned"]) assert.equal(result.calls[key].length, 0, key);
}

for (const platform of ["ios", "android"]) {
  assertNoWork(simulate(platform, { args: ["--upload"] }));
  const denied = simulate(platform, { dotenv: true });
  assertNoWork(denied);
  assert.match(denied.error.message, /dotenv_present/);

  const result = simulate(platform);
  assert.equal(result.error, undefined);
  const { calls, copy } = result;
  assert.deepEqual(calls.preflight, [{ root: ROOT, settings: { sourceOnly: true } }]);
  assert.deepEqual(calls.temporary, [platform === "android" ? `${ROOT}/.native-android-qualification-` : `${TMP}/oyano-ios-compile-`]);
  assert.deepEqual(calls.copies, sourceNames.map((name) => [`${ROOT}/apps/mobile/${name}`, `${copy}/${name}`, { recursive: true }]));
  assert.deepEqual(calls.links, [[`${ROOT}/apps/mobile/node_modules`, `${copy}/node_modules`, "dir"]]);
  assert.deepEqual(calls.directories, [[`${copy}/qualification-logs`]]);
  assert.equal(calls.logReads.length, 0);
  assert.equal(calls.opened.length, calls.spawned.length);
  assert.deepEqual(calls.closed, calls.opened.map((log) => log.fd));
  for (const [index, command] of calls.spawned.entries()) {
    assert.ok(command.cwd === copy || command.cwd === `${copy}/${platform}`);
    assert.deepEqual(command.stdio, ["ignore", calls.opened[index].fd, calls.opened[index].fd]);
    assert.ok(command.timeout > 0 && command.timeout <= 1_800_000);
    assert.equal(command.shell, undefined, "No shell interpolation");
    for (const key of secretKeys) {
      if (platform === "ios" && key === "BUNDLE_GEMFILE") continue;
      assert.equal(command.env[key], undefined, `${platform}: ${key} must not reach build commands`);
    }
    assert.equal(command.env.NODE_BINARY, NODE);
    for (const key of ["EXPO_NO_DOTENV", "EXPO_NO_TELEMETRY", "EXPO_OFFLINE", "CI"]) assert.equal(command.env[key], "1");
    assert.equal(command.env.ACCOUNT_ERASURE_EXECUTION_ENABLED, "false");
    assert.equal(command.env.COMMERCIAL_SUPPORT_PACK_SALES_ENABLED, "false");
    assert.equal(command.env.COMMERCIAL_PLUS_SALES_ENABLED, "false");
    assert.equal(command.env.pnpm_config_verify_deps_before_run, "error");
    assert.ok(calls.opened[index].file.startsWith(`${copy}/qualification-logs/`));
    assert.equal(calls.opened[index].mode, 0o600);
    assert.equal(calls.opened[index].flags, "w");
  }
  assert.doesNotMatch(JSON.stringify(calls.spawned), new RegExp(SECRET));
  assert.doesNotMatch(calls.output.join("\n"), new RegExp(SECRET));
  assert.deepEqual(calls.spawned[0].args, [`${ROOT}/apps/mobile/node_modules/expo/bin/cli`, "prebuild", "--no-install", "--platform", platform, "--skip-dependency-update", "react-native,react"]);
  assert.equal(calls.spawned[0].command, NODE);

  if (platform === "ios") {
    assert.deepEqual(calls.spawned.map((item) => item.command), [NODE, "bundle", "xcodebuild"]);
    assert.deepEqual(calls.spawned[1].args, ["exec", "pod", "install"]);
    for (const command of calls.spawned) {
      assert.equal(command.env.BUNDLE_GEMFILE, `${ROOT}/scripts/native-build/Gemfile`);
      assert.equal(command.env.GEM_HOME, "/synthetic/gems");
      assert.equal(command.env.GEM_PATH, "/synthetic/gem-path");
      assert.equal(command.env.BUNDLE_PATH, "/synthetic/bundle");
      assert.equal(command.env.GRADLE_USER_HOME, undefined);
      assert.equal(command.env.COCOAPODS_DISABLE_STATS, "true");
    }
    const args = calls.spawned[2].args;
    assert.equal(args[args.indexOf("-sdk") + 1], "iphonesimulator");
    assert.equal(args[args.indexOf("-destination") + 1], "generic/platform=iOS Simulator");
    assert.equal(args[args.indexOf("-derivedDataPath") + 1], `${copy}/DerivedData`);
    assert.equal(args[args.indexOf("-resultBundlePath") + 1], `${copy}/Compile.xcresult`);
    for (const flag of ["ARCHS=arm64", "CODE_SIGNING_ALLOWED=NO", "CODE_SIGNING_REQUIRED=NO", "build"]) assert.ok(args.includes(flag));
    assert.doesNotMatch(args.join(" "), /archive|exportArchive|allowProvisioning|upload|submit/i);
    assert.match(calls.output.at(-1), /Real devices, production, IPA, TestFlight and store review are NOT verified/);
  } else {
    assert.deepEqual(calls.spawned.map((item) => item.command), [NODE, "./gradlew"]);
    for (const command of calls.spawned) {
      assert.equal(command.env.GRADLE_USER_HOME, `${copy}/.gradle-home`);
      assert.equal(command.env.ANDROID_HOME, SDK);
      assert.equal(command.env.ANDROID_SDK_ROOT, SDK);
      assert.equal(command.env.JAVA_HOME, JAVA);
      for (const key of ["GEM_HOME", "GEM_PATH", "BUNDLE_PATH"]) assert.equal(command.env[key], undefined);
    }
    const args = calls.spawned[1].args;
    assert.deepEqual(args.filter((arg) => !arg.startsWith("-")), [":app:assembleRelease", ":app:bundleRelease"]);
    for (const flag of ["-PreactNativeArchitectures=arm64-v8a", "--no-daemon", "--max-workers=2", "--console=plain"]) assert.ok(args.includes(flag));
    assert.doesNotMatch(args.join(" "), /upload|publish|installRelease|connected|--scan|signing|storePassword|keyPassword|licenses/i);
    for (const file of ["apk/release/app-release.apk", "bundle/release/app-release.aab"]) assert.ok(calls.exists.includes(`${copy}/android/app/build/outputs/${file}`));
    assert.match(calls.output.at(-1), /test-key artifacts only/);
    assert.match(calls.output.at(-1), /16KB runtime, real devices and production acceptance are NOT verified/);
  }

  // Every command failure, timeout, or spawn error stops all subsequent stages.
  for (let step = 1; step <= calls.spawned.length; step++) {
    for (const failure of [{ status: 1 }, { status: null, signal: "SIGTERM" }, { status: 0, error: new Error("synthetic spawn failure") }]) {
      const failed = simulate(platform, { failStep: step, failure });
      assert.equal(failed.error?.exitCode, 1);
      assert.equal(failed.calls.spawned.length, step);
      assert.equal(failed.calls.closed.length, step);
      assert.equal(failed.calls.logReads.length, 1);
      assert.ok(failed.calls.logReads[0].file.startsWith(`${failed.copy}/qualification-logs/`));
      assert.doesNotMatch(failed.calls.output.join("\n"), /NOT verified|Test artifact:|Simulator app:/);
    }
  }
}

assertNoWork(simulate("ios", { os: "linux" }));
assert.ok(simulate("ios", { arch: "x64" }).calls.spawned.at(-1).args.includes("ARCHS=x86_64"));
const noProject = simulate("ios", { noProject: true });
assert.match(noProject.error.message, /project\/workspace missing/);
assert.equal(noProject.calls.spawned.length, 2);
for (const env of [{ ANDROID_HOME: "" }, { JAVA_HOME: "" }, { ANDROID_HOME: "relative/sdk" }, { JAVA_HOME: "relative/java" }]) assertNoWork(simulate("android", { env }));
for (const missingPath of ["platforms/android-36/android.jar", "ndk/27.1.12297006/source.properties", "bin/java"]) assertNoWork(simulate("android", { missingPath }));
for (const [platform, missingPath] of [["ios", "Synthetic.app"], ["android", "app-release.apk"], ["android", "app-release.aab"]]) {
  const missing = simulate(platform, { missingPath });
  assert.match(missing.error.message, /not found|Missing qualification artifact/);
  assert.doesNotMatch(missing.calls.output.join("\n"), /NOT verified/);
}

console.log("PASS native compile runner safety: synthetic-only iOS/Android copies, secret isolation, Gradle home, local build commands, simulator signing flags, API/NDK preflight and fail-fast boundaries (no compilation or binary acceptance)");
