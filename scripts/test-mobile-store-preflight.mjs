import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessMobileStoreSource } from "./mobile-store-preflight.mjs";

const input = (sdk = "^57.0.23", native = "0.86.0", react = "19.2.3") => ({
  mobilePackage: { dependencies: { expo: sdk, "react-native": native, react } },
  app: { ios: { infoPlist: {} } }, eas: { build: {} }
});
const old = assessMobileStoreSource(input("^51.0.0", "0.74.5", "18.2.0"));
assert.equal(old.sourceStatus, "BLOCKED");
assert.equal(old.submissionStatus, "NOT_VERIFIED");
assert.match(old.failures.join(), /SDK 51/);
for (const sdk of ["latest", "^58.0.0", "57.0.0-canary", undefined]) {
  assert.equal(assessMobileStoreSource(input(sdk === undefined ? null : sdk)).sourceStatus, "BLOCKED");
}
assert.equal(assessMobileStoreSource(input("^57.0.23", "0.74.5")).sourceStatus, "BLOCKED");
assert.equal(assessMobileStoreSource(input("^57.0.23", "0.86.0", "18.2.0")).sourceStatus, "BLOCKED");
const compatible = assessMobileStoreSource(input());
assert.equal(compatible.sourceStatus, "SOURCE_CHECKS_ONLY");
assert.equal(compatible.submissionStatus, "NOT_VERIFIED", "dependency checks never imply review readiness");
assert.ok(compatible.requiredEvidence.length >= 5);
const transitional = assessMobileStoreSource(input("~54.0.0", "0.81.5", "19.1.0"));
assert.equal(transitional.failures.length, 0);
assert.match(transitional.warnings.join(), /段階移行/);
const legacy = input(); legacy.app.newArchEnabled = false;
assert.match(assessMobileStoreSource(legacy).failures.join(), /Architecture/);
for (const permission of ["NSCameraUsageDescription", "NSPhotoLibraryUsageDescription"]) {
  const unused = input(); unused.app.ios.infoPlist[permission] = "unused";
  assert.equal(assessMobileStoreSource(unused).sourceStatus, "BLOCKED");
}
const dev = input(); dev.eas.build.development = { developmentClient: true };
assert.match(assessMobileStoreSource(dev).warnings.join(), /expo-dev-client/);
const app = JSON.parse(readFileSync(new URL("../apps/mobile/app.json", import.meta.url))).expo;
assert.equal(app.ios.infoPlist.NSCameraUsageDescription, undefined);
assert.equal(app.ios.infoPlist.NSPhotoLibraryUsageDescription, undefined);
console.log("PASS mobile store preflight: SDK/dependency/permission failures and no false submission-ready result (offline)");
