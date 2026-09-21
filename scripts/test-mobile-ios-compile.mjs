import { cpSync, existsSync, mkdtempSync, mkdirSync, openSync, closeSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkLocalFiles, localEnvironment, repoRoot } from "./test-stage-a-local.mjs";

// Unsigned, simulator-only native compilation in a disposable source copy.
// Downloads public build dependencies, but never uploads source or signs/submits a build.
// No production environment, dotenv, saved session, device identifier or app data is copied.
if (process.platform !== "darwin") throw new Error("macOS/Xcode required");
if (process.argv.length > 2) throw new Error("This command accepts no arguments");
checkLocalFiles(repoRoot, { sourceOnly: true });
const source = join(repoRoot, "apps/mobile");
const copy = mkdtempSync(join(tmpdir(), "oyano-ios-compile-"));
for (const name of ["app", "components", "lib", "assets", "app.json", "app.config.js", "package.json", "index.js", "metro.config.js", "tsconfig.json", "env.d.ts"]) {
  cpSync(join(source, name), join(copy, name), { recursive: true });
}
symlinkSync(join(source, "node_modules"), join(copy, "node_modules"), "dir");
const logs = join(copy, "qualification-logs");
mkdirSync(logs);
const env = {
  ...localEnvironment(), EXPO_NO_DOTENV: "1", EXPO_NO_TELEMETRY: "1",
  EXPO_OFFLINE: "1", COCOAPODS_DISABLE_STATS: "true",
  NODE_BINARY: process.execPath, RCT_NO_LAUNCH_PACKAGER: "1"
};
// Allow a caller-selected isolated RubyGems installation, not arbitrary inherited app secrets.
for (const key of ["GEM_HOME", "GEM_PATH", "BUNDLE_PATH"]) if (process.env[key]) env[key] = process.env[key];
env.BUNDLE_GEMFILE = join(repoRoot, "scripts/native-build/Gemfile");
function run(name, command, args, cwd, timeout) {
  const log = join(logs, `${name}.log`);
  const fd = openSync(log, "w", 0o600);
  console.log(`RUN ${name}`);
  const result = spawnSync(command, args, { cwd, env, stdio: ["ignore", fd, fd], timeout });
  closeSync(fd);
  if (result.status !== 0 || result.error || result.signal) {
    console.error(`FAIL ${name}; exit=${result.status}; signal=${result.signal}; log=${log}`);
    console.error(readFileSync(log, "utf8").slice(-2400));
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
console.log(`Disposable copy: ${copy}`);
run("prebuild", process.execPath, [
  join(source, "node_modules/expo/bin/cli"), "prebuild", "--no-install", "--platform", "ios",
  "--skip-dependency-update", "react-native,react"
], copy, 120_000);
run("pods", "bundle", ["exec", "pod", "install"], join(copy, "ios"), 1_200_000);
const workspace = readdirSync(join(copy, "ios")).find((name) => name.endsWith(".xcworkspace"));
const project = readdirSync(join(copy, "ios")).find((name) => name.endsWith(".xcodeproj"));
if (!workspace || !project) throw new Error("Generated Xcode project/workspace missing");
const scheme = project.slice(0, -".xcodeproj".length);
run("compile", "xcodebuild", [
  "-workspace", join(copy, "ios", workspace), "-scheme", scheme,
  "-configuration", "Release", "-sdk", "iphonesimulator",
  "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", join(copy, "DerivedData"),
  "-resultBundlePath", join(copy, "Compile.xcresult"), "-jobs", "2",
  `ARCHS=${process.arch === "arm64" ? "arm64" : "x86_64"}`,
  "CODE_SIGNING_ALLOWED=NO", "CODE_SIGNING_REQUIRED=NO", "build"
], copy, 1_200_000);
const output = join(copy, "DerivedData/Build/Products/Release-iphonesimulator", `${scheme}.app`);
if (!existsSync(output)) throw new Error("Compiled simulator app not found");
console.log(`Simulator app: ${output}`);
console.log("Unsigned simulator compilation only. Real devices, production, IPA, TestFlight and store review are NOT verified.");
