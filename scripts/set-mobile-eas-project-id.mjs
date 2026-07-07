import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "apps/mobile/.env.local");
const projectId = process.argv[2]?.trim();

if (!projectId) {
  console.error("Usage: pnpm run eas:mobile:set-project-id -- <expo-project-id>");
  process.exit(1);
}

if (!/^[0-9a-f-]{20,}$/i.test(projectId)) {
  console.error("Project ID does not look like an Expo UUID.");
  process.exit(1);
}

const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const line = `EXPO_PUBLIC_EAS_PROJECT_ID=${projectId}`;
const next = current.includes("EXPO_PUBLIC_EAS_PROJECT_ID=")
  ? current.replace(/^EXPO_PUBLIC_EAS_PROJECT_ID=.*$/m, line)
  : `${current.trimEnd()}\n${line}\n`;

writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`);
console.log(`Updated apps/mobile/.env.local with EXPO_PUBLIC_EAS_PROJECT_ID=${projectId}`);
