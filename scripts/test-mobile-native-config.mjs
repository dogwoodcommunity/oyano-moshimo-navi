import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { checkLocalFiles, localEnvironment, repoRoot } from "./test-stage-a-local.mjs";

// Generate only a disposable copy: no pods/Gradle install, build, signing or provider access.
checkLocalFiles(repoRoot, { sourceOnly: true });
const source = join(repoRoot, "apps/mobile");
const blockedPermissions = ["READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "SYSTEM_ALERT_WINDOW", "USE_BIOMETRIC", "USE_FINGERPRINT"];
const sourceConfig = JSON.parse(readFileSync(join(source, "app.json"), "utf8"));
assert.ok(sourceConfig.expo.plugins.includes("./plugins/withAndroidPageSize"));
const pluginModule = { exports: {} };
vm.runInNewContext(readFileSync(join(source, "plugins/withAndroidPageSize.js"), "utf8"), {
  module: pluginModule,
  require(name) {
    assert.equal(name, "expo/config-plugins");
    return { withProjectBuildGradle: (config, callback) => callback(config) };
  }
}, { timeout: 1000 });
const syntheticGradle = { modResults: { language: "groovy", contents: 'apply plugin: "expo-root-project"\napply plugin: "com.facebook.react.rootproject"' } };
pluginModule.exports(syntheticGradle);
const once = syntheticGradle.modResults.contents;
pluginModule.exports(syntheticGradle);
assert.equal(syntheticGradle.modResults.contents, once, "Page-size plugin is idempotent");
assert.throws(() => pluginModule.exports({ modResults: { language: "kotlin", contents: "" } }), /new Gradle template/);
assert.throws(() => pluginModule.exports({ modResults: { language: "groovy", contents: "changed template" } }), /root plugin order/);
for (const permission of blockedPermissions) {
  const fullName = `android.permission.${permission}`;
  assert.ok(sourceConfig.expo.android.blockedPermissions?.includes(fullName), `${permission} must be explicitly blocked before manifest merging`);
  assert.ok(!(sourceConfig.expo.android.permissions ?? []).some((name) => name === permission || name === fullName), `${permission} must not be explicitly requested`);
}
const copy = mkdtempSync(join(tmpdir(), "oyano-native-config-"));
for (const file of ["app.json", "app.config.js", "package.json", "assets", "plugins"]) {
  cpSync(join(source, file), join(copy, file), { recursive: true });
}
symlinkSync(join(source, "node_modules"), join(copy, "node_modules"), "dir");
const result = spawnSync(process.execPath, [
  join(source, "node_modules/expo/bin/cli"), "prebuild", "--no-install", "--platform", "all",
  "--skip-dependency-update", "react-native,react"
], {
  cwd: copy, env: { ...localEnvironment(), EXPO_OFFLINE: "1", EXPO_NO_TELEMETRY: "1" },
  encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024
});
if (result.status !== 0) {
  console.error(`${result.stdout ?? ""}\n${result.stderr ?? ""}`.slice(-3000));
  process.exit(1);
}
const read = (file) => readFileSync(join(copy, file), "utf8");
const manifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(manifest, /android:fullBackupContent="@xml\/secure_store_backup_rules"/);
assert.match(manifest, /android:dataExtractionRules="@xml\/secure_store_data_extraction_rules"/);
const permissions = manifest.match(/<uses-permission\b[^>]*>/g) ?? [];
for (const permission of blockedPermissions) {
  const entries = permissions.filter((entry) => entry.includes(`android.permission.${permission}"`));
  assert.ok(entries.some((entry) => entry.includes('tools:node="remove"')), `${permission} needs a removal marker for transitive library permissions`);
  assert.ok(!entries.some((entry) => !entry.includes('tools:node="remove"')),
    `unused ${permission} must not be requested`);
}
assert.match(read("android/gradle.properties"), /newArchEnabled=true/);
const rootGradle = read("android/build.gradle");
assert.match(rootGradle, /androidComponents.*finalizeDsl/);
assert.match(rootGradle, /max-page-size=16384 -Wl,-z,common-page-size=16384/);
assert.equal(rootGradle.split("// oyano-16kb-source-linking").length - 1, 1);
assert.ok(rootGradle.indexOf("// oyano-16kb-source-linking") < rootGradle.indexOf('apply plugin: "expo-root-project"'), "Register callbacks before Expo/React evaluate child projects");
const iosDirectory = readdirSync(join(copy, "ios"), { withFileTypes: true })
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .find((name) => readdirSync(join(copy, "ios", name)).includes("Info.plist"));
assert.ok(iosDirectory);
const plist = read(`ios/${iosDirectory}/Info.plist`);
assert.doesNotMatch(plist, /NSCameraUsageDescription|NSPhotoLibraryUsageDescription|NSFaceIDUsageDescription/);
assert.match(plist, /<key>NSAllowsArbitraryLoads<\/key>\s*<false\/>/);
const sdk = Number(JSON.parse(read("package.json")).dependencies.expo.match(/\d+/)?.[0]);
const minimumIos = { 54: "15.1", 55: "15.1", 56: "16.4", 57: "16.4" }[sdk];
assert.ok(minimumIos, "Review the official iOS minimum before testing a new SDK");
assert.ok(read("ios/Podfile").includes(`'${minimumIos}'`), "Generated iOS minimum must match the reviewed SDK requirement");
console.log("PASS generated iOS/Android config: unused permissions, secure-store backup rules, New Architecture, iOS minimum and transport security");
console.log(`Disposable copy: ${copy}`);
console.log("Configuration generation only; not compiled binaries, merged release manifests, real-device or store acceptance.");
