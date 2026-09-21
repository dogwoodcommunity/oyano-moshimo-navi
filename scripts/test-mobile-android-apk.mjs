import assert from "node:assert/strict";
import { inspectElf, inspectPermissions } from "./check-mobile-android-apk.mjs";

function fixture(alignment = 16384n, relroEnd = 32768n) {
  const b = Buffer.alloc(32768);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]).copy(b);
  b.writeUInt16LE(3, 16); b.writeUInt16LE(183, 18); b.writeUInt32LE(1, 20); b.writeUInt16LE(64, 52);
  b.writeBigUInt64LE(64n, 32); b.writeUInt16LE(56, 54); b.writeUInt16LE(2, 56);
  b.writeUInt32LE(1, 64); b.writeBigUInt64LE(alignment, 64 + 48);
  b.writeBigUInt64LE(32768n, 64 + 32); b.writeBigUInt64LE(32768n, 64 + 40);
  b.writeUInt32LE(0x6474e552, 120); b.writeBigUInt64LE(16384n, 120 + 8); b.writeBigUInt64LE(16384n, 120 + 16);
  b.writeBigUInt64LE(16384n, 120 + 32); b.writeBigUInt64LE(relroEnd - 16384n, 120 + 40);
  return b;
}
assert.deepEqual(inspectElf(fixture()), { loads: 1, relro: 1 });
assert.deepEqual(inspectElf(fixture(), "arm64-v8a"), { loads: 1, relro: 1 });
const x64 = fixture(); x64.writeUInt16LE(62, 18);
assert.deepEqual(inspectElf(x64, "x86_64"), { loads: 1, relro: 1 });
assert.throws(() => inspectElf(x64, "arm64-v8a"), /machine does not match/);
assert.throws(() => inspectElf(fixture(), "armeabi-v7a"), /machine does not match/);
assert.throws(() => inspectElf(fixture(4096n)), /LOAD alignment/);
assert.throws(() => inspectElf(fixture(24576n)), /power of two/);
assert.throws(() => inspectElf(fixture(0n)), /LOAD alignment/);
assert.deepEqual(inspectElf(fixture(65536n)), { loads: 1, relro: 1 });
assert.throws(() => inspectElf(fixture(16384n, 20480n)), /GNU_RELRO end/);
const incongruent = fixture(); incongruent.writeBigUInt64LE(4096n, 64 + 16);
assert.throws(() => inspectElf(incongruent), /congruent/);
const largerAlignment = fixture(65536n); largerAlignment.writeBigUInt64LE(16384n, 64 + 16);
assert.throws(() => inspectElf(largerAlignment), /congruent/, "Congruence must match the declared alignment, not only 16KB");
const truncated = fixture().subarray(0, 100);
assert.throws(() => inspectElf(truncated), /program headers/);
assert.throws(() => inspectElf(Buffer.alloc(64)), /Not ELF/);
assert.throws(() => inspectElf(null), /Not ELF/);
for (const [offset, value, message] of [[4, 1, /ELF64/], [5, 2, /little-endian/], [6, 0, /version/]]) {
  const b = fixture(); b[offset] = value;
  assert.throws(() => inspectElf(b), message);
}
for (const [offset, value, message] of [
  [16, 2, /shared objects/], [18, 40, /ARM64 or x86_64/], [52, 0, /header size/],
  [54, 64, /program headers/], [56, 0, /program headers/], [56, 0xffff, /program headers/]
]) {
  const b = fixture(); b.writeUInt16LE(value, offset);
  assert.throws(() => inspectElf(b), message);
}
const badVersion = fixture(); badVersion.writeUInt32LE(2, 20);
assert.throws(() => inspectElf(badVersion), /version/);
for (const offset of [0n, 65n, 32768n, 1n << 63n]) {
  const b = fixture(); b.writeBigUInt64LE(offset, 32);
  assert.throws(() => inspectElf(b), /program headers/);
}
const outsideFile = fixture(); outsideFile.writeBigUInt64LE(32768n, 64 + 8);
assert.throws(() => inspectElf(outsideFile), /file range/);
const truncatedSegment = fixture().subarray(0, 32767);
assert.throws(() => inspectElf(truncatedSegment), /file range/);
const tooSmallMemory = fixture(); tooSmallMemory.writeBigUInt64LE(16384n, 64 + 40);
assert.throws(() => inspectElf(tooSmallMemory), /file size exceeds memory/);
const overflow = fixture(); overflow.writeBigUInt64LE((1n << 64n) - 16384n, 64 + 16);
assert.throws(() => inspectElf(overflow), /memory range overflows/);
const relroOutsideLoad = fixture(); relroOutsideLoad.writeBigUInt64LE(32768n, 120 + 16);
assert.throws(() => inspectElf(relroOutsideLoad), /outside LOAD memory/);
const noRelro = fixture(); noRelro.writeUInt32LE(0, 120);
assert.deepEqual(inspectElf(noRelro), { loads: 1, relro: 0 });
const noLoad = fixture(); noLoad.writeUInt32LE(0, 64);
assert.throws(() => inspectElf(noLoad), /Missing LOAD/);
const bss = fixture(); bss.writeBigUInt64LE(65536n, 64 + 40);
assert.deepEqual(inspectElf(bss), { loads: 1, relro: 1 }, "Zero-filled memory beyond file data is valid");
const sections = fixture(); sections.writeBigUInt64LE(32000n, 40); sections.writeUInt16LE(64, 58); sections.writeUInt16LE(2, 60); sections.writeUInt16LE(1, 62);
assert.deepEqual(inspectElf(sections), { loads: 1, relro: 1 });
for (const mutate of [
  (b) => b.writeBigUInt64LE(32768n, 40), (b) => b.writeBigUInt64LE(65n, 40),
  (b) => b.writeUInt16LE(0, 58), (b) => b.writeUInt16LE(0, 60),
  (b) => b.writeUInt16LE(2, 62), (b) => b.writeBigUInt64LE(0n, 40)
]) {
  const b = Buffer.from(sections); mutate(b);
  assert.throws(() => inspectElf(b), /section headers/);
}

const approved = [
  "android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.VIBRATE", "android.permission.WAKE_LOCK",
  "android.permission.POST_NOTIFICATIONS", "android.permission.RECEIVE_BOOT_COMPLETED",
  "com.google.android.c2dm.permission.RECEIVE",
  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
  "jp.beech.oyanomoshimo.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"
];
assert.deepEqual(inspectPermissions(approved), approved);
assert.deepEqual(inspectPermissions([...approved, approved[0]]), approved);
assert.deepEqual(inspectPermissions([]), []);
const badgePermissions = [
  "com.sec.android.provider.badge.permission.READ", "com.sec.android.provider.badge.permission.WRITE",
  "com.htc.launcher.permission.READ_SETTINGS", "com.htc.launcher.permission.UPDATE_SHORTCUT",
  "com.sonyericsson.home.permission.BROADCAST_BADGE", "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
  "com.anddoes.launcher.permission.UPDATE_COUNT", "com.majeur.launcher.permission.UPDATE_BADGE",
  "com.huawei.android.launcher.permission.CHANGE_BADGE", "com.huawei.android.launcher.permission.READ_SETTINGS",
  "com.huawei.android.launcher.permission.WRITE_SETTINGS", "android.permission.READ_APP_BADGE",
  "com.oppo.launcher.permission.READ_SETTINGS", "com.oppo.launcher.permission.WRITE_SETTINGS",
  "me.everything.badger.permission.BADGE_COUNT_READ", "me.everything.badger.permission.BADGE_COUNT_WRITE"
];
assert.equal(new Set(badgePermissions).size, 16);
assert.deepEqual(inspectPermissions([...approved, ...badgePermissions]), [...approved, ...badgePermissions]);
for (const permission of badgePermissions) {
  assert.throws(() => inspectPermissions([`${permission}_NEW`]), /Unapproved permission/, "A known vendor badge permission must not authorize a prefix wildcard");
}
for (const name of [
  "READ_CONTACTS", "SEND_SMS", "READ_CALENDAR", "READ_PHONE_STATE", "USE_BIOMETRIC", "USE_FINGERPRINT",
  "CAMERA", "RECORD_AUDIO", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES",
  "SYSTEM_ALERT_WINDOW", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "BLUETOOTH_SCAN",
  "ACTIVITY_RECOGNITION", "BODY_SENSORS", "UNKNOWN_NEW_PERMISSION"
]) assert.throws(() => inspectPermissions([approved[0], `android.permission.${name}`]), /Unapproved permission/);
for (const name of [
  "com.google.android.gms.permission.AD_ID", "android.permission.ACCESS_ADSERVICES_AD_ID",
  "other.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION", "android.permission.WRITE_SETTINGS",
  "com.android.launcher.permission.READ_SETTINGS", "com.android.launcher.permission.WRITE_SETTINGS",
  "com.android.launcher.permission.INSTALL_SHORTCUT", "com.android.launcher.permission.UNINSTALL_SHORTCUT",
  "com.sec.android.provider.badge.permission.DELETE", "com.htc.launcher.permission.WRITE_SETTINGS", "", null, 1
]) {
  assert.throws(() => inspectPermissions([name]), /Unapproved permission/);
}
assert.throws(() => inspectPermissions(null), /array/);
assert.throws(() => inspectPermissions("android.permission.INTERNET"), /array/);
console.log("PASS APK checker: ELF64 header/ABI/segment bounds/power-of-two alignment/RELRO and exact permission allowlist (synthetic only; no APK, device or store acceptance)");
