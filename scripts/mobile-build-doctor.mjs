import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const mobileRoot = join(root, "apps/mobile");

let failed = false;

function ok(label) {
  console.log(`OK   ${label}`);
}

function warn(label) {
  console.log(`WARN ${label}`);
}

function fail(label) {
  failed = true;
  console.error(`FAIL ${label}`);
}

function requireFile(path) {
  if (existsSync(join(root, path))) ok(path);
  else fail(`${path} missing`);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

const appJson = readJson("apps/mobile/app.json").expo;
const easJson = readJson("apps/mobile/eas.json");

[
  "apps/mobile/app.config.js",
  "apps/mobile/app.json",
  "apps/mobile/eas.json",
  "apps/mobile/assets/icon.png",
  "apps/mobile/assets/adaptive-icon.png",
  "apps/mobile/assets/splash.png",
  "apps/mobile/assets/notification-icon.png"
].forEach(requireFile);

if (appJson.name === "親のもしもナビ") ok("app name");
else fail("app name should be 親のもしもナビ");

if (appJson.scheme === "oyanomoshimo") ok("deep link scheme");
else fail("scheme should be oyanomoshimo");

if (appJson.ios?.bundleIdentifier === "jp.beech.oyanomoshimo") ok("iOS bundle identifier");
else fail("iOS bundle identifier mismatch");

if (appJson.android?.package === "jp.beech.oyanomoshimo") ok("Android package");
else fail("Android package mismatch");

if (appJson.icon && appJson.splash?.image && appJson.notification?.icon) ok("icon/splash/notification configured");
else fail("icon/splash/notification config incomplete");

for (const profile of ["development", "preview", "production"]) {
  if (easJson.build?.[profile]) ok(`EAS ${profile} profile`);
  else fail(`EAS ${profile} profile missing`);
}

if (easJson.build?.preview?.distribution === "internal") ok("preview internal distribution");
else fail("preview profile should use internal distribution");

if (easJson.build?.preview?.env?.EXPO_PUBLIC_WEB_BASE_URL?.startsWith("https://")) ok("preview Web base URL");
else fail("preview Web base URL missing");

if (process.env.EXPO_PUBLIC_EAS_PROJECT_ID) ok("EXPO_PUBLIC_EAS_PROJECT_ID set");
else warn("EXPO_PUBLIC_EAS_PROJECT_ID not set yet; run eas init and save the project id before push notification testing");

if (process.env.EXPO_OWNER) ok("EXPO_OWNER set");
else warn("EXPO_OWNER not set; set it only after the Expo account/team is confirmed");

console.log(`Mobile root: ${mobileRoot}`);

if (failed) process.exit(1);
