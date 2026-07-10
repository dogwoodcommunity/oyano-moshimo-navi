import { spawnSync } from "node:child_process";

const adb = process.env.ADB_PATH ?? "/Users/ikedatetsuya/Library/Android/sdk/platform-tools/adb";
const url = process.argv[2];

if (!url) {
  console.error("FAIL usage: node scripts/adb-open-url.mjs <url>");
  process.exit(1);
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const command = [
  "am",
  "start",
  "-W",
  "-a",
  "android.intent.action.VIEW",
  "-d",
  shellQuote(url)
].join(" ");

const result = spawnSync(adb, ["shell", command], {
  encoding: "utf8"
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
