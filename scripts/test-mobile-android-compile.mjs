import { cpSync, existsSync, mkdtempSync, mkdirSync, openSync, closeSync, readFileSync, symlinkSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import { checkLocalFiles, localEnvironment, repoRoot } from "./test-stage-a-local.mjs";

// Local ARM64 Release qualification, using only Expo's public test signing key.
// This is NOT a store-signed artifact. Never uploads source or accesses production.
// A fresh Gradle home excludes the user's global init scripts/credentials.
if (process.argv.length > 2) throw new Error("This command accepts no arguments");
checkLocalFiles(repoRoot, { sourceOnly: true });
const sdk = process.env.ANDROID_HOME;
const java = process.env.JAVA_HOME;
if (!sdk || !java || !isAbsolute(sdk) || !isAbsolute(java)
  || !existsSync(join(sdk, "platforms/android-36/android.jar"))
  || !existsSync(join(sdk, "ndk/27.1.12297006/source.properties"))
  || !existsSync(join(java, "bin/java"))) {
  throw new Error("Set ANDROID_HOME (API36 + NDK27.1.12297006 installed) and JAVA_HOME (JDK17+). No SDK licenses are accepted by this runner.");
}
const source = join(repoRoot, "apps/mobile");
// Keep asset paths relative to this workspace. A /tmp copy symlinked to this
// deep pnpm store produces >255-byte Android resource names (ENAMETOOLONG).
// This ignored directory is outside apps/*, so it is not a duplicate workspace.
const copy = mkdtempSync(join(repoRoot, ".native-android-qualification-"));
for (const name of ["app", "components", "lib", "assets", "app.json", "app.config.js", "package.json", "index.js", "metro.config.js", "tsconfig.json", "env.d.ts"]) {
  cpSync(join(source, name), join(copy, name), { recursive: true });
}
symlinkSync(join(source, "node_modules"), join(copy, "node_modules"), "dir");
const logs = join(copy, "qualification-logs");
mkdirSync(logs);
const env = {
  ...localEnvironment(), ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: java,
  GRADLE_USER_HOME: join(copy, ".gradle-home"), EXPO_NO_DOTENV: "1", EXPO_NO_TELEMETRY: "1",
  EXPO_OFFLINE: "1", NODE_BINARY: process.execPath
};
function run(name, command, args, cwd, timeout) {
  const log = join(logs, `${name}.log`);
  const fd = openSync(log, "w", 0o600);
  console.log(`RUN ${name}`);
  const result = spawnSync(command, args, { cwd, env, stdio: ["ignore", fd, fd], timeout });
  closeSync(fd);
  if (result.status !== 0 || result.error || result.signal) {
    console.error(`FAIL ${name}; exit=${result.status}; signal=${result.signal}; log=${log}`);
    console.error(readFileSync(log, "utf8").slice(-3200));
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
console.log(`Disposable copy: ${copy}`);
run("prebuild", process.execPath, [join(source, "node_modules/expo/bin/cli"), "prebuild", "--no-install", "--platform", "android", "--skip-dependency-update", "react-native,react"], copy, 120_000);
run("compile", "./gradlew", [":app:assembleRelease", ":app:bundleRelease", "-PreactNativeArchitectures=arm64-v8a", "--no-daemon", "--max-workers=2", "--console=plain", "-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g"], join(copy, "android"), 1_800_000);
for (const artifact of ["apk/release/app-release.apk", "bundle/release/app-release.aab"]) {
  const file = join(copy, "android/app/build/outputs", artifact);
  if (!existsSync(file)) throw new Error(`Missing qualification artifact: ${artifact}`);
  console.log(`Test artifact: ${file}`);
}
console.log("ARM64 test-key artifacts only. Store signing, other ABIs, 16KB runtime, real devices and production acceptance are NOT verified.");
