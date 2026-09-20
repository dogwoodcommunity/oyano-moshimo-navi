import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Exercise the real screen functions with synthetic hooks and data APIs.
// No native runtime, network, provider, or persisted user data is used.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");
const dashboardFile = "apps/mobile/app/(tabs)/dashboard.tsx";
const personFile = "apps/mobile/app/people/[id]/index.tsx";
const emptyDashboardData = () => ({
  person: { id: "", displayName: "未登録", currentStatus: "preparing" },
  people: [], tasks: [], registryItems: [], firstSteps: [], source: "empty"
});
const person = { id: "person-a", displayName: "確認用の本人", currentStatus: "preparing", profile: { displayName: "確認用の本人" } };
const task = { id: "task-a", title: "確認用の手続き", status: "todo", priority: 1 };
const dashboard = { person, people: [person], tasks: [task], registryItems: [], firstSteps: [], source: "supabase" };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

function screen(file, overrides = {}, initialId = person.id) {
  let currentId = initialId;
  let cursor = 0;
  let dirty = false;
  let mounted = true;
  let tree;
  const slots = [];
  const queuedEffects = [];
  const api = {
    emptyDashboardData,
    fetchDashboardData: async () => dashboard,
    fetchPerson: async (id) => ({ ...person, id }),
    fetchTasks: async () => [task],
    fetchTimelineEntries: async () => [],
    updatePersonProfile: async (id, profile) => ({ source: "supabase", person: { ...person, id, profile } }),
    ...overrides
  };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props: props ?? {} };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (value) => {
        assert.equal(mounted, true, "unmounted screens cannot receive late request state");
        slots[index].value = typeof value === "function" ? value(slots[index].value) : value;
        dirty = true;
      }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        queuedEffects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    },
    useMemo: (calculate) => calculate()
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.doesNotMatch(source, /demoDashboardData/, `${file} must not initialize or recover with demo data`);
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText;
  vm.runInNewContext(js, {
    module, exports: module.exports, Date,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react-native") return {
        ImageBackground: "ImageBackground", Pressable: "Pressable", ScrollView: "ScrollView",
        Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (styles) => styles }
      };
      if (name === "expo-router") return { Link: "Link", useRouter: () => ({ push() {} }), useLocalSearchParams: () => ({ id: currentId }) };
      if (name === "@expo/vector-icons") return { MaterialCommunityIcons: "Icon" };
      if (name === "@oyano/shared") return { statusLabel: () => "備え中" };
      if (name === "@/lib/mobileData") return api;
      if (name === "@/lib/theme") return { colors: {}, radius: {}, shadow: {} };
      if (name === "@/components/MascotGuide") return { MascotGuide: "MascotGuide", MascotMark: "MascotMark" };
      if (name.endsWith(".png")) return "synthetic-asset";
      throw Error(`Unexpected screen dependency: ${name}`);
    }
  });
  function render() {
    cursor = 0;
    dirty = false;
    tree = module.exports.default();
    while (queuedEffects.length) queuedEffects.shift()();
    return tree;
  }
  function nodes(value = tree) {
    if (Array.isArray(value)) return value.flatMap((entry) => nodes(entry));
    if (!value || typeof value !== "object") return [];
    return [value, ...nodes(value.props.children ?? null)];
  }
  function text(value = tree) {
    if (Array.isArray(value)) return value.map((entry) => text(entry)).join("");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value?.props ? text(value.props.children ?? null) : "";
  }
  render();
  return {
    api, text,
    inputs: () => nodes().filter((node) => node.type === "TextInput"),
    button: (label) => nodes().find((node) => node.type === "Pressable" && text(node) === label),
    navigate(id) { currentId = id; render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); mounted = false; },
    async flush() {
      for (let i = 0; i < 12; i++) {
        await Promise.resolve();
        if (dirty) render();
      }
    }
  };
}

{
  const request = deferred();
  const ui = screen(dashboardFile, { fetchDashboardData: () => request.promise });
  assert.match(ui.text(), /読み込んでいます/);
  assert.doesNotMatch(ui.text(), /確認用|まず親を1人/);
  request.reject(Error("synthetic offline"));
  await ui.flush();
  assert.match(ui.text(), /家族ボードを読み込めませんでした/);
  assert.doesNotMatch(ui.text(), /確認用|まず親を1人|担当が決まっていない/);
  ui.api.fetchDashboardData = async () => dashboard;
  ui.button("もう一度読み込む").props.onPress();
  await ui.flush();
  assert.match(ui.text(), /確認用の本人/);
  assert.match(ui.text(), /確認用の手続き/);
  assert.doesNotMatch(ui.text(), /読み込めませんでした/);
}
{
  const ui = screen(dashboardFile, { fetchDashboardData: async () => emptyDashboardData() });
  assert.doesNotMatch(ui.text(), /まず親を1人/);
  await ui.flush();
  assert.match(ui.text(), /まず親を1人登録/);
}
{
  const request = deferred();
  const ui = screen(dashboardFile, { fetchDashboardData: () => request.promise });
  ui.unmount();
  request.resolve(dashboard);
  await ui.flush();
}
for (const failedMethod of ["fetchPerson", "fetchTasks", "fetchTimelineEntries"]) {
  const ui = screen(personFile, { [failedMethod]: async () => { throw Error("synthetic denied"); } });
  assert.match(ui.text(), /手帳を読み込んでいます/);
  assert.equal(ui.inputs().length, 0, "profile form waits for all real data");
  await ui.flush();
  assert.match(ui.text(), /手帳を読み込めませんでした/);
  assert.equal(ui.inputs().length, 0, "failed reads cannot produce an editable fabricated profile");
  assert.doesNotMatch(ui.text(), /確認用|未完了|まだ記録はありません/);
}
{
  const request = deferred();
  const ui = screen(personFile, { fetchPerson: () => request.promise });
  request.reject(Error("synthetic offline"));
  await ui.flush();
  ui.api.fetchPerson = async () => person;
  ui.button("もう一度読み込む").props.onPress();
  await ui.flush();
  assert.match(ui.text(), /確認用の本人さんの管理手帳/);
  assert.ok(ui.inputs().length > 0);
  const displayName = ui.inputs().find((input) => input.props.value === person.displayName);
  displayName.props.onChangeText("編集中の呼び名");
  await ui.flush();
  ui.api.updatePersonProfile = async () => { throw Error("synthetic offline"); };
  await ui.button("プロフィールを保存する").props.onPress();
  await ui.flush();
  assert.match(ui.text(), /保存できませんでした。入力内容は残っています/);
  assert.ok(ui.inputs().some((input) => input.props.value === "編集中の呼び名"));
  assert.equal(ui.button("プロフィールを保存する").props.disabled, false);
  assert.doesNotMatch(ui.text(), /プロフィールを保存しました/);
}
{
  const oldRequest = deferred();
  const nextPerson = { ...person, id: "person-b", displayName: "別の本人", profile: {} };
  const ui = screen(personFile, { fetchPerson: (id) => id === person.id ? oldRequest.promise : Promise.resolve(nextPerson) });
  ui.navigate(nextPerson.id);
  await ui.flush();
  assert.match(ui.text(), /別の本人/);
  oldRequest.resolve(person);
  await ui.flush();
  assert.match(ui.text(), /別の本人/);
  assert.doesNotMatch(ui.text(), /確認用の本人/);
}
console.log("PASS mobile empty states: loading, real empty data, read failures, retry, save failure, and stale read isolation (synthetic only)");
