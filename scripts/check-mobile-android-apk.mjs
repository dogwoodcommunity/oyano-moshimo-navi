import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { localEnvironment } from "./test-stage-a-local.mjs";

// Read-only artifact checks. Never installs, signs, uploads or runs an APK.
// Based on https://developer.android.com/guide/practices/page-sizes .
export function inspectElf(buffer, expectedAbi) {
  assert.ok(Buffer.isBuffer(buffer) && buffer.length >= 64 && buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), "Not ELF");
  assert.equal(buffer[4], 2, "Only ELF64 is qualified");
  assert.equal(buffer[5], 1, "Only little-endian ELF is qualified");
  assert.ok(buffer[6] === 1 && buffer.readUInt32LE(20) === 1, "Invalid ELF version");
  assert.equal(buffer.readUInt16LE(16), 3, "Only ELF shared objects are qualified");
  assert.equal(buffer.readUInt16LE(52), 64, "Invalid ELF header size");
  const machine = buffer.readUInt16LE(18);
  const abi = machine === 183 ? "arm64-v8a" : machine === 62 ? "x86_64" : null;
  assert.ok(abi, "Only ARM64 or x86_64 ELF is qualified");
  if (expectedAbi !== undefined) assert.equal(abi, expectedAbi, "ELF machine does not match APK ABI");
  const offset = Number(buffer.readBigUInt64LE(32));
  const size = buffer.readUInt16LE(54), count = buffer.readUInt16LE(56);
  assert.ok(Number.isSafeInteger(offset) && offset >= 64 && offset % 8 === 0
    && size === 56 && count > 0 && count < 0xffff && offset + size * count <= buffer.length, "Invalid ELF program headers");
  const sectionOffset = Number(buffer.readBigUInt64LE(40));
  const sectionSize = buffer.readUInt16LE(58), sectionCount = buffer.readUInt16LE(60), stringSection = buffer.readUInt16LE(62);
  // Stripped objects may omit sections. Extended-count encodings are not qualified.
  assert.ok(sectionOffset === 0
    ? sectionCount === 0 && stringSection === 0 && [0, 64].includes(sectionSize)
    : Number.isSafeInteger(sectionOffset) && sectionOffset >= 64 && sectionOffset % 8 === 0
      && sectionSize === 64 && sectionCount > 0 && sectionCount < 0xff00
      && stringSection < sectionCount && sectionOffset + sectionSize * sectionCount <= buffer.length,
  "Invalid ELF section headers");
  let loads = 0, relro = 0, relroEndAligned = 0, relroFullLoad = 0;
  const loadRanges = [], relroRanges = [];
  const limit = 1n << 64n;
  const pageStart = (address, page) => address / page * page;
  const pageEnd = (address, page) => (address + page - 1n) / page * page;
  for (let i = 0; i < count; i++) {
    const at = offset + size * i, type = buffer.readUInt32LE(at);
    if (type === 0) continue; // PT_NULL entries have no defined segment fields.
    const fileOffset = buffer.readBigUInt64LE(at + 8), address = buffer.readBigUInt64LE(at + 16);
    const fileSize = buffer.readBigUInt64LE(at + 32), memorySize = buffer.readBigUInt64LE(at + 40);
    const alignment = buffer.readBigUInt64LE(at + 48);
    assert.ok(alignment <= 1n || (alignment & (alignment - 1n)) === 0n, "Segment alignment is not a power of two");
    assert.ok(fileSize === 0n || fileOffset + fileSize <= BigInt(buffer.length), "Segment file range is outside ELF");
    assert.ok(address + memorySize < limit, "Segment memory range overflows ELF64");
    if (type === 1) {
      loads++;
      assert.ok(fileSize <= memorySize, "LOAD file size exceeds memory size");
      assert.ok(alignment >= 16384n, "LOAD alignment is below 16KB");
      assert.equal((address - fileOffset) % alignment, 0n, "LOAD address/offset are not congruent with alignment");
      loadRanges.push({ start: address, end: address + memorySize, fileStart: fileOffset,
        fileEnd: fileOffset + fileSize, flags: buffer.readUInt32LE(at + 4) });
    }
    if (type === 0x6474e552) {
      relro++;
      assert.ok(memorySize > 0n && fileSize <= memorySize, "Invalid GNU_RELRO memory/file size");
      relroRanges.push({ start: address, end: address + memorySize,
        fileStart: fileOffset, fileEnd: fileOffset + fileSize });
    }
  }
  assert.ok(loads > 0, "Missing LOAD segments");
  assert.ok(relro <= 1, "Multiple GNU_RELRO segments are not qualified");
  for (const range of relroRanges) {
    // AOSP normally protects [page_start(vaddr), page_end(vaddr + memsz)),
    // including the minimum supported API24 loader's PAGE_START/PAGE_END:
    // https://android.googlesource.com/platform/bionic/+/android-7.0.0_r1/linker/linker_phdr.cpp
    // https://android.googlesource.com/platform/bionic/+/android16-release/linker/linker_phdr.cpp
    // phdr_table_get_relro_min_align explicitly exempts a whole LOAD from the
    // end-alignment condition (same vaddr, LOAD.memsz <= RELRO.memsz):
    // https://android.googlesource.com/platform/bionic/+/android16-qpr2-release/linker/linker_phdr_16kib_compat.cpp
    // Older LLD pads only RELRO.memsz, beyond the raw LOAD end. Bound that
    // padding to its existing 4KB mapping as well, preserving 4KB compatibility.
    const owner = loadRanges.find((load) => range.start >= load.start && range.start < load.end
      && (range.end <= load.end || (range.start === load.start && range.end <= pageEnd(load.end, 4096n))));
    assert.ok(owner, "GNU_RELRO is outside LOAD memory or bounded page padding");
    assert.ok(range.fileStart >= owner.fileStart && range.fileEnd <= owner.fileEnd
      && range.start - owner.start === range.fileStart - owner.fileStart,
    "GNU_RELRO file range does not match its LOAD");
    const alignedEnd = range.end % 16384n === 0n;
    const fullLoad = range.start === owner.start && range.end >= owner.end
      && range.fileStart === owner.fileStart && range.fileEnd === owner.fileEnd;
    assert.ok(alignedEnd || fullLoad, "GNU_RELRO end is not 16KB aligned and does not cover a whole LOAD");
    // A modulo check alone misses damage at the rounded start and overlapping
    // mappings. Check both supported page sizes, including the host's real RW
    // bytes, so neither full-LOAD nor already-aligned cases can bypass them.
    for (const page of [4096n, 16384n]) {
      const start = pageStart(range.start, page), end = pageEnd(range.end, page);
      assert.ok(end < limit && start >= pageStart(owner.start, page) && end <= pageEnd(owner.end, page),
        "GNU_RELRO protection is outside mapped LOAD pages");
      for (const load of loadRanges) {
        if (load.start === load.end) continue;
        const overlaps = pageStart(load.start, page) < end && pageEnd(load.end, page) > start;
        assert.ok(!overlaps || !(load.flags & 1), "GNU_RELRO protection overlaps executable LOAD pages");
        assert.ok(!overlaps || load === owner, "GNU_RELRO protection overlaps another LOAD mapping");
        if (!(load.flags & 2)) continue;
        assert.ok(!(start < range.start && load.start < range.start && load.end > start)
          && !(range.end < end && load.end > range.end && load.start < end),
        "GNU_RELRO protection covers writable bytes outside RELRO");
      }
    }
    if (alignedEnd) relroEndAligned++;
    else relroFullLoad++;
  }
  return { loads, relro, relroEndAligned, relroFullLoad };
}

const approvedPermissions = new Set([
  "android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.VIBRATE", "android.permission.WAKE_LOCK",
  "android.permission.POST_NOTIFICATIONS", "android.permission.RECEIVE_BOOT_COMPLETED",
  "com.google.android.c2dm.permission.RECEIVE",
  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
  "jp.beech.oyanomoshimo.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",
  // Exact badge permissions observed in the merged manifest from
  // expo-notifications -> ShortcutBadger 1.1.22. No vendor-prefix wildcards.
  "com.sec.android.provider.badge.permission.READ",
  "com.sec.android.provider.badge.permission.WRITE",
  "com.htc.launcher.permission.READ_SETTINGS",
  "com.htc.launcher.permission.UPDATE_SHORTCUT",
  "com.sonyericsson.home.permission.BROADCAST_BADGE",
  "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
  "com.anddoes.launcher.permission.UPDATE_COUNT",
  "com.majeur.launcher.permission.UPDATE_BADGE",
  "com.huawei.android.launcher.permission.CHANGE_BADGE",
  "com.huawei.android.launcher.permission.READ_SETTINGS",
  "com.huawei.android.launcher.permission.WRITE_SETTINGS",
  "android.permission.READ_APP_BADGE",
  "com.oppo.launcher.permission.READ_SETTINGS",
  "com.oppo.launcher.permission.WRITE_SETTINGS",
  "me.everything.badger.permission.BADGE_COUNT_READ",
  "me.everything.badger.permission.BADGE_COUNT_WRITE"
]);

export function inspectPermissions(permissions) {
  assert.ok(Array.isArray(permissions), "Permissions must be an array");
  for (const permission of permissions) {
    assert.ok(typeof permission === "string" && approvedPermissions.has(permission), `Unapproved permission: ${String(permission)}`);
  }
  return [...new Set(permissions)];
}

export function inspectApk(apk, sdk, java) {
  assert.ok(existsSync(apk) && existsSync(join(sdk, "build-tools/36.0.0/aapt")), "APK and API36 build-tools required");
  const env = { ...localEnvironment(), JAVA_HOME: java };
  const run = (command, args, binary = false) => {
    const result = spawnSync(command, args, { env, encoding: binary ? undefined : "utf8", maxBuffer: 128 * 1024 * 1024, timeout: 120_000 });
    assert.equal(result.status, 0, `${command} failed: ${String(result.stderr ?? "").slice(-600)}`);
    return result.stdout;
  };
  const tool = (name) => join(sdk, "build-tools/36.0.0", name);
  const badging = run(tool("aapt"), ["dump", "badging", apk]);
  const target = Number(/targetSdkVersion:'(\d+)'/.exec(badging)?.[1]);
  assert.ok(target >= 36, "targetSdk must be at least 36");
  assert.match(badging, /package: name='jp\.beech\.oyanomoshimo'/);
  assert.doesNotMatch(badging, /application-debuggable/);
  const permissions = inspectPermissions([...badging.matchAll(/uses-permission(?:-sdk-\d+)?: name='([^']+)'/g)].map((m) => m[1]));
  run(tool("zipalign"), ["-c", "-P", "16", "4", apk]);
  const certificates = run(tool("apksigner"), ["verify", "--print-certs", apk]);
  const testKey = /CN=Android Debug|CN=Android,/.test(certificates);
  const entries = run("unzip", ["-Z1", apk]).trim().split("\n");
  const libraries = entries.filter((name) => /^lib\/(arm64-v8a|x86_64)\/[\w.+-]+\.so$/.test(name));
  assert.ok(libraries.length, "No 64-bit native libraries found");
  const failures = [];
  const elf = libraries.map((name) => {
    try { return { name, ...inspectElf(run("unzip", ["-p", apk, name], true), name.split("/")[1]) }; }
    catch (error) { failures.push({ library: name, reason: String(error.message).split("\n")[0] }); return null; }
  });
  assert.equal(failures.length, 0, `16KB ELF checks failed: ${JSON.stringify(failures)}`);
  return { targetSdk: target, permissions, zip16KB: "PASS", elf16KB: "PASS", libraryCount: elf.length,
    relro16KB: { endAligned: elf.reduce((sum, entry) => sum + entry.relroEndAligned, 0),
      fullLoadPageProtected: elf.reduce((sum, entry) => sum + entry.relroFullLoad, 0) },
    abis: [...new Set(libraries.map((name) => name.split("/")[1]))],
    signature: testKey ? "PUBLIC_TEST_KEY_NOT_FOR_STORE" : "VERIFIED_NOT_CLASSIFIED",
    realDeviceAcceptance: "NOT_TESTED", storeSubmission: "NOT_VERIFIED" };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, "Usage: node scripts/check-mobile-android-apk.mjs /absolute/test.apk");
  console.log(JSON.stringify(inspectApk(resolve(process.argv[2]), process.env.ANDROID_HOME ?? "", process.env.JAVA_HOME ?? ""), null, 2));
}
