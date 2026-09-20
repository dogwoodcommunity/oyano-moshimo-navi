import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkLocalFiles, localEnvironment, repoRoot } from "./test-stage-a-local.mjs";

// Generate only a disposable copy: no pods/Gradle install, build, signing or provider access.
checkLocalFiles(repoRoot, { sourceOnly: true });
const source = join(repoRoot, "apps/mobile");
const copy = mkdtempSync(join(tmpdir(), "oyano-native-config-"));
for (const file of ["app.json", "app.config.js", "package.json", "assets"]) {
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
for (const permission of ["READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "SYSTEM_ALERT_WINDOW"]) {
  assert.ok(!permissions.some((entry) => entry.includes(`android.permission.${permission}"`) && !entry.includes('tools:node="remove"')),
    `unused ${permission} must not be requested`);
}
assert.match(read("android/gradle.properties"), /newArchEnabled=true/);
const iosDirectory = readdirSync(join(copy, "ios"), { withFileTypes: true })
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .find((name) => readdirSync(join(copy, "ios", name)).includes("Info.plist"));
assert.ok(iosDirectory);
const plist = read(`ios/${iosDirectory}/Info.plist`);
assert.doesNotMatch(plist, /NSCameraUsageDescription|NSPhotoLibraryUsageDescription|NSFaceIDUsageDescription/);
assert.match(plist, /<key>NSAllowsArbitraryLoads<\/key>\s*<false\/>/);
assert.match(read("ios/Podfile"), /'15\.1'/);
console.log("PASS generated iOS/Android config: unused permissions, secure-store backup rules, New Architecture, iOS minimum and transport security");
console.log(`Disposable copy: ${copy}`);
console.log("Configuration generation only; not compiled binaries, merged release manifests, real-device or store acceptance.");
