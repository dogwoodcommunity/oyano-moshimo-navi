import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = requireFromWeb("typescript");
function loadTs(relativePath, dependencies = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, URL,
    require(specifier) {
      assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected runtime dependency: ${specifier}`);
      return dependencies[specifier];
    }
  }, { filename: relativePath });
  return module.exports;
}

const prefectures = loadTs("../apps/web/lib/prefectures.ts");
const {
  PROVIDER_CATEGORIES, getPublicProviderListings, matchProviderListings,
  normalizeProviderCity, validateProviderQuery
} = loadTs("../apps/web/lib/providerDirectory.ts", { "./prefectures": prefectures });
const plain = (value) => JSON.parse(JSON.stringify(value));
const now = Date.parse("2026-09-19T03:00:00.000Z");
const query = { prefecture: "神奈川県", city: "横浜市", categoryId: "cleanup" };
const record = (changes = {}) => ({
  id: "synthetic-provider", name: "架空の掲載テスト事業者", description: "検証用の架空情報です。",
  website: "https://example.com/service/", categoryIds: ["cleanup"],
  areas: [{ prefecture: "神奈川県", cities: ["横浜市"] }],
  reviewStatus: "approved", reviewedAt: "2026-09-18T09:00:00+09:00",
  publishFrom: "2026-09-19T00:00:00+09:00", publishUntil: "2026-10-01T00:00:00+09:00",
  placement: "sponsored", ...changes
});
const publish = (records, clock = now) => getPublicProviderListings(records, clock);
const match = (records, search = query, clock = now) => matchProviderListings(publish(records, clock), search, clock);
const ids = (listings) => Array.from(listings, (listing) => listing.id);
const empty = (result) => assert.deepEqual(plain(result), { sponsored: [], general: [] });
let checks = 0;
function check(name, run) {
  try { run(); checks += 1; } catch (error) { console.error(`FAIL ${name}`); throw error; }
}

check("ten explicit service categories", () => {
  assert.deepEqual(Array.from(PROVIDER_CATEGORIES, (category) => category.id), [
    "cleanup", "vacant-home", "real-estate", "demolition", "funeral", "care-home",
    "judicial-scrivener", "tax-accountant", "lawyer", "administrative-scrivener"
  ]);
  assert.ok(PROVIDER_CATEGORIES.every((category) => category.label && category.checks));
});
check("exact prefecture/category/city and separate placement", () => {
  const result = match([record(), record({ id: "general", placement: "general" })]);
  assert.deepEqual(ids(result.sponsored), ["synthetic-provider"]);
  assert.deepEqual(ids(result.general), ["general"]);
});
check("wrong and unknown prefecture, city, category never match", () => {
  for (const changes of [{ prefecture: "東京都" }, { prefecture: "神奈川" }, { city: "川崎市" },
    { city: "架空市" }, { categoryId: "funeral" }, { categoryId: "unknown" }]) empty(match([record()], { ...query, ...changes }));
});
check("blank and partial queries are not nationwide searches", () => {
  for (const search of [null, {}, [], 123, { ...query, prefecture: "" }, { ...query, city: "" },
    { ...query, categoryId: "" }, { ...query, city: 123 }, { ...query, city: "区" }]) {
    assert.equal(typeof validateProviderQuery(search), "string");
    empty(match([record()], search));
  }
});
check("NFKC and whitespace normalization handles kana without broadening area", () => {
  assert.equal(normalizeProviderCity(" 横 浜　市 "), "横浜市");
  assert.equal(normalizeProviderCity("ｱｲﾇ町"), "アイヌ町");
  assert.equal(validateProviderQuery({ ...query, city: " 茅ヶ崎市 " }), null);
  assert.equal(match([record()], { ...query, city: " 横 浜　市 " }).sponsored.length, 1);
  assert.equal(match([record({ areas: [{ prefecture: "神奈川県", cities: [" 横 浜　市 "] }] })]).sponsored.length, 1);
});
check("street addresses, digits, punctuation and invisible markers fail closed", () => {
  for (const city of ["横浜市中区1丁目", "横浜市１丁目", "横浜市中区一丁目", "Yokohama市", "横浜市/川崎市",
    "横浜市、川崎市", "横浜市\u200b", "横浜市\u202e", "横浜市-中区", "＊市"]) {
    assert.equal(typeof validateProviderQuery({ ...query, city }), "string", city);
  }
});
check("no prefix matching, ward expansion or cross-prefecture expansion", () => {
  empty(match([record()], { ...query, city: "横浜市中区" }));
  empty(match([record({ areas: [{ prefecture: "神奈川県", cities: ["横浜市中区"] }] })]));
  const tokyoProvider = record({ id: "tokyo", areas: [{ prefecture: "東京都", cities: ["世田谷区", "新宿区"] }] });
  empty(match([record(), tokyoProvider], { ...query, prefecture: "東京都", city: "横浜市" }));
  assert.equal(match([tokyoProvider], { ...query, prefecture: "東京都", city: "世田谷区" }).sponsored.length, 1);
  const explicitCities = record({ areas: [{ prefecture: "神奈川県", cities: ["横浜市", "川崎市"] }] });
  assert.equal(match([explicitCities], { ...query, city: "川崎市" }).sponsored.length, 1);
  empty(match([explicitCities], { ...query, city: "相模原市" }));
});
check("prefecture-wide wildcard is rejected at publication and search", () => {
  for (const prefecture of ["神奈川県", "東京都"]) {
    const wildcard = record({ areas: [{ prefecture, cities: "all" }] });
    assert.equal(publish([wildcard]).length, 0);
    const publicWildcard = { ...publish([record()])[0], areas: wildcard.areas };
    empty(matchProviderListings([publicWildcard], { ...query, prefecture, city: "横浜市" }, now));
  }
  assert.equal(publish([record({ areas: [
    { prefecture: "神奈川県", cities: ["横浜市"] }, { prefecture: "東京都", cities: "all" }
  ] })]).length, 0);
});
check("only approved records pass and duplicate identities stay hidden", () => {
  for (const reviewStatus of ["draft", "paused", "Approved", "", null, undefined]) assert.equal(publish([record({ reviewStatus })]).length, 0);
  assert.equal(publish([record(), record()]).length, 0);
  assert.equal(publish([record(), record({ reviewStatus: "paused" })]).length, 0);
  assert.equal(publish([record(), record({ name: "" }), record({ id: "unique" })]).length, 1);
  const listing = publish([record()])[0];
  empty(matchProviderListings([listing, listing], query, now));
  empty(matchProviderListings([{ ...listing, reviewStatus: "paused" }], query, now));
});
check("start inclusive, end exclusive at JST midnight", () => {
  const from = Date.parse("2026-09-19T00:00:00+09:00");
  const until = Date.parse("2026-10-01T00:00:00+09:00");
  assert.equal(publish([record()], from - 1).length, 0);
  assert.equal(publish([record()], from).length, 1);
  assert.equal(publish([record()], until - 1).length, 1);
  assert.equal(publish([record()], until).length, 0);
});
check("expired cached public catalog cannot match later", () => {
  const catalog = publish([record()]);
  empty(matchProviderListings(catalog, query, Date.parse("2026-10-01T00:00:00+09:00")));
  empty(matchProviderListings(catalog, query, Date.parse("2026-09-18T23:59:59+09:00")));
});
check("date fields reject missing timezone, impossible dates and nonfinite values", () => {
  for (const invalid of ["", null, undefined, 123, "NaN", "Infinity", "2026-09-19", "2026-09-19T00:00:00",
    "2026-02-30T00:00:00Z", "2026-02-29T00:00:00Z", "2026-09-31T00:00:00Z", "2026-00-01T00:00:00Z",
    "2026-09-19T24:00:00Z", "2026-09-19T00:60:00Z", "2026-09-19T00:00:60Z", "2026-09-19T00:00:00+15:00",
    "2026-09-19T00:00:00+09:60", "2026-09-19T00:00:00-00:00", "2026-09-19T00:00:00Z "]) {
    for (const field of ["reviewedAt", "publishFrom", "publishUntil"]) assert.equal(publish([record({ [field]: invalid })]).length, 0, `${field}: ${invalid}`);
  }
  assert.equal(publish([record({ reviewedAt: "2024-02-29T00:00:00Z" })]).length, 1);
  assert.equal(publish([record({ reviewedAt: "2026-09-19T03:00:00.001Z" })]).length, 0);
  assert.equal(publish([record({ reviewedAt: "2026-09-19T03:00:00Z" })]).length, 1);
  assert.equal(publish([record({ publishFrom: "2026-10-02T00:00:00Z" })]).length, 0);
  assert.equal(publish([record({ publishFrom: "2026-10-01T00:00:00+09:00" })]).length, 0);
});
check("invalid clocks and malformed input collections fail closed", () => {
  for (const clock of [NaN, Infinity, -Infinity, Number.MAX_VALUE, "2026-09-19", null, undefined]) {
    assert.equal(getPublicProviderListings([record()], clock).length, 0);
    empty(matchProviderListings(publish([record()]), query, clock));
  }
  for (const values of [null, undefined, {}, "listings"]) {
    assert.equal(publish(values).length, 0);
    empty(matchProviderListings(values, query, now));
  }
  assert.equal(publish([null, undefined, [], "record", {}, record()]).length, 1);
});
check("unsafe URLs cannot publish, including canonicalized IP spellings", () => {
  for (const website of ["", "http://example.com/", "javascript:alert(1)", "data:text/html,hello", "//example.com/",
    "https://user@example.com/", "https://user:password@example.com/", "https://@example.com/", "https://:@example.com/", "https://example.com/?utm_source=test",
    "https://example.com/?", "https://example.com/#", "https://example.com/#tracking", "https://localhost/",
    "https://a.localhost/", "https://printer.local/", "https://intranet/", "https://127.0.0.1/", "https://192.168.1.1/",
    "https://8.8.8.8/", "https://2130706433/", "https://0x7f000001/", "https://127.1/", "https://[::1]/",
    "https://[2606:4700:4700::1111]/", "https://example.com:444/", "https://example.com\\@evil.com/",
    "https://example.com/\npath", "https://example.com/ path", "https://example.com./"]) {
    assert.equal(publish([record({ website })]).length, 0, website);
  }
  assert.equal(publish([record({ website: "https://example.co.jp/service/" })]).length, 1);
});
check("all categories and areas are validated, even an unused area", () => {
  for (const changes of [{ categoryIds: [] }, { categoryIds: ["cleanup", "unknown"] }, { categoryIds: ["cleanup", "cleanup"] },
    { categoryIds: ["cleanup", ,] },
    { categoryIds: "cleanup" }, { areas: [] }, { areas: "all" },
    { areas: [{ prefecture: "神奈川県", cities: ["横浜市"] }, { prefecture: "invalid", cities: "all" }] },
    { areas: [{ prefecture: "神奈川県", cities: ["横浜市"] }, { prefecture: "東京都", cities: ["東京1市"] }] },
    { areas: [{ prefecture: "神奈川県", cities: [] }] }, { areas: [{ prefecture: "神奈川県", cities: ["横浜市", ,] }] },
    { areas: [{ prefecture: "神奈川県", cities: "全国" }] },
    { areas: [{ prefecture: "神奈川県", cities: ["横浜市", " 横 浜市"] }] },
    { areas: [{ prefecture: "神奈川県", cities: ["川崎市"] }, { prefecture: "神奈川県", cities: ["横浜市"] }] }]) {
    assert.equal(publish([record(changes)]).length, 0, JSON.stringify(changes));
  }
});
check("text, placement and unused sponsor priority reject malformed values", () => {
  for (const changes of [{ id: "" }, { id: "<script>" }, { name: "" }, { name: "\u202e架空" }, { description: "" },
    { description: "private\u0000data" }, { placement: "recommended" }, { sponsorPriority: -1 }, { sponsorPriority: 0.5 },
    { sponsorPriority: "1" }, { sponsorPriority: NaN }, { sponsorPriority: Infinity },
    { placement: "general", sponsorPriority: -1 }]) assert.equal(publish([record(changes)]).length, 0);
});
check("explicit public projection strips private fields and copies nested arrays", () => {
  const original = record({ email: "private@example.com", phone: "TEST-NOT-A-PHONE", application: { internalNote: "PRIVATE" },
    areas: [{ prefecture: "神奈川県", cities: ["横浜市"], contact: "PRIVATE" }] });
  const published = publish([original])[0];
  assert.deepEqual(Object.keys(published).sort(), ["id", "name", "description", "website", "categoryIds", "areas", "reviewedAt",
    "publishFrom", "publishUntil", "placement"].sort());
  assert.deepEqual(Object.keys(published.areas[0]).sort(), ["cities", "prefecture"]);
  assert.ok(!JSON.stringify(published).includes("PRIVATE"));
  published.categoryIds.push("funeral");
  published.areas[0].cities.push("川崎市");
  assert.deepEqual(original.categoryIds, ["cleanup"]);
  assert.deepEqual(original.areas[0].cities, ["横浜市"]);
  const publicWithExtra = { ...publish([record()])[0], email: "private@example.com" };
  assert.equal(Object.hasOwn(matchProviderListings([publicWithExtra], query, now).sponsored[0], "email"), false);
});
check("paid order is priority then name/id; organic order ignores payments", () => {
  const records = [
    record({ id: "paid-last", name: "A", sponsorPriority: 9 }),
    record({ id: "paid-b", name: "B" }),
    record({ id: "paid-a2", name: "A", sponsorPriority: 0 }),
    record({ id: "paid-a1", name: "A", sponsorPriority: 0 }),
    record({ id: "general-b", name: "B", placement: "general", sponsorPriority: 0 }),
    record({ id: "general-a", name: "A", placement: "general", sponsorPriority: 999 })
  ];
  for (const input of [records, [...records].reverse()]) {
    const result = match(input);
    assert.deepEqual(ids(result.sponsored), ["paid-a1", "paid-a2", "paid-b", "paid-last"]);
    assert.deepEqual(ids(result.general), ["general-a", "general-b"]);
  }
  const before = JSON.stringify(records);
  match(records);
  assert.equal(JSON.stringify(records), before);
});
check("sponsorship never bypasses geography, category, approval or publication dates", () => {
  const candidates = [record({ id: "other-city", sponsorPriority: 0, areas: [{ prefecture: "神奈川県", cities: ["川崎市"] }] }),
    record({ id: "other-category", sponsorPriority: 0, categoryIds: ["funeral"] }),
    record({ id: "draft", sponsorPriority: 0, reviewStatus: "draft" }),
    record({ id: "expired", sponsorPriority: 0, publishUntil: "2026-09-19T00:00:00Z" })];
  empty(match(candidates));
});

console.log(`PASS provider-directory: ${checks} synthetic checks (no network, storage, AI calls or real provider records)`);
