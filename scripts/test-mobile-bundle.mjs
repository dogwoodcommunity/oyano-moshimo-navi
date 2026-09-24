import { mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkLocalFiles, localEnvironment, repoRoot } from "./test-stage-a-local.mjs";

// Offline JS/Hermes only. Does not start an app, sign a binary, or submit a build.
checkLocalFiles(repoRoot, { sourceOnly: true });
const mobile = join(repoRoot, "apps/mobile");
const dist = join(mobile, "dist");
mkdirSync(dist, { recursive: true });
const output = mkdtempSync(join(dist, "qualification-"));
const env = { ...localEnvironment(), EXPO_OFFLINE: "1", EXPO_NO_TELEMETRY: "1" };
for (const platform of ["ios", "android"]) {
  const destination = join(output, platform);
  const result = spawnSync(process.execPath, [
    "node_modules/expo/bin/cli", "export", "--platform", platform,
    "--max-workers", "2", "--output-dir", destination
  ], { cwd: mobile, env, encoding: "utf8", timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0 || !existsSync(join(destination, "metadata.json"))) {
    console.error(`FAIL mobile ${platform} JS/Hermes export (exit=${result.status}, signal=${result.signal})`);
    const log = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const error = log.indexOf("Error");
    console.error(error >= 0 ? log.slice(Math.max(0, error - 100), error + 2400) : log.slice(-2400));
    process.exit(1);
  }
  console.log(`PASS mobile ${platform} JS/Hermes export`);
}
console.log(`Output: ${output}`);
console.log("Native compilation, real-device acceptance, production and store submission are NOT verified.");
