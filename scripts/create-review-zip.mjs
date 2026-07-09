import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const outputDir = "review_exports";
const date = new Date().toISOString().slice(0, 10);
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const zipName = `oyano-moshimo-navi-code-review-${date}-${commit}.zip`;
const zipPath = join(outputDir, zipName);

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

execFileSync("git", ["archive", "--format=zip", "-o", zipPath, "HEAD"], { stdio: "inherit" });

const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
const suspiciousLines = listing
  .split("\n")
  .filter((line) => /(^|\/)(\.env|\.env\.local|env\.local|secret|service_role|SUPABASE_SERVICE_ROLE_KEY)/i.test(line))
  .filter((line) => !/\/\.env\.example$/.test(line));

if (suspiciousLines.length > 0) {
  console.error("Review ZIP may contain secret-related files:");
  for (const line of suspiciousLines) {
    console.error(line);
  }
  process.exit(1);
}

const sizeMb = (statSync(zipPath).size / 1024 / 1024).toFixed(1);

console.log(`OK review ZIP created: ${zipPath}`);
console.log(`OK base commit: ${commit}`);
console.log(`OK size: ${sizeMb}MB`);
console.log("OK no secret env files detected; .env.example is allowed.");
