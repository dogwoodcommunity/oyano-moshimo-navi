import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Execute the actual native components and handlers with synthetic state and
// mocked dependencies. No device, backend, file upload, or external API is used.
// This verifies behavior, not native layout, persistence, or store readiness.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireWeb = createRequire(path.join(root, 'apps/web/package.json'));
const ts = requireWeb('typescript');
const jsx = requireWeb('react/jsx-runtime');
const shared = { FREE_PLAN_MEMBER_LIMIT: 1, FREE_PLAN_NOTEBOOK_LIMIT: 1 };

function harness(relative, initial = {}, dependencies = {}, params = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stateNames = [];
  const scan = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)
      && node.initializer && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(ast) === 'useState') stateNames.push(node.name.elements[0].name.getText(ast));
    ts.forEachChild(node, scan);
  };
  scan(ast);
  let cursor = 0;
  const state = { ...initial };
  const effects = [];
  const module = { exports: {} };
  const react = {
    useState(value) {
      const name = stateNames[cursor++];
      assert.ok(name);
      if (!(name in state)) state[name] = typeof value === 'function' ? value() : value;
      return [state[name], (next) => { state[name] = typeof next === 'function' ? next(state[name]) : next; }];
    },
    useEffect(fn) { effects.push(fn); }
  };
  const native = Object.fromEntries(['Text', 'View', 'ScrollView', 'Pressable', 'ImageBackground', 'Modal', 'TextInput'].map((name) => [name, name]));
  native.StyleSheet = { create: (styles) => styles, absoluteFillObject: {} };
  const compiled = ts.transpileModule(source, { fileName: relative, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  }}).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, Date,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return jsx;
      if (name === 'react-native') return native;
      if (name === 'expo-router') return { Link: 'Link', useLocalSearchParams: () => ({ id: 'synthetic-person', ...params }) };
      if (name === '@expo/vector-icons') return { MaterialCommunityIcons: 'Icon' };
      if (name === '@oyano/shared') return shared;
      if (name === '@/lib/theme') return { colors: {}, radius: {}, shadow: {} };
      if (name === '@/components/MascotGuide') return { MascotGuide: 'MascotGuide', MascotMark: 'MascotMark' };
      if (name === '@/lib/mobileData') return dependencies;
      if (name === '@/lib/supabase') return dependencies;
      if (name.endsWith('.png')) return 'synthetic-image';
      throw Error(`Unexpected dependency: ${name}`);
    }
  });
  return {
    state, effects,
    render() { cursor = 0; return module.exports.default(); }
  };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree && typeof tree === 'object') return text(typeof tree.type === 'function' ? tree.type(tree.props) : tree.props?.children);
  return String(tree ?? '');
}
function summary(tree, label) {
  const matches = nodes(tree).filter((node) => node.type === 'View' && Array.isArray(node.props.children)
    && node.props.children.length === 2 && node.props.children[0]?.type === 'Text'
    && Number.isFinite(Number(text(node.props.children[0]))) && text(node.props.children[1]) === label);
  assert.equal(matches.length, 1);
  return Number(text(matches[0].props.children[0]));
}

const taskPath = 'apps/mobile/app/people/[id]/tasks.tsx';
const tasks = ['todo', 'doing', 'done', 'skipped'].map((status, i) => ({ id: `task-${i}`, title: `Task ${status}`, priority: 1, status }));
const mixed = harness(taskPath, { tasks });
const mixedTree = mixed.render();
assert.equal(summary(mixedTree, '未完了'), 2);
assert.equal(summary(mixedTree, '担当未定'), 2);
assert.ok(!text(mixedTree).includes('Task skipped'));
const skippedOnly = harness(taskPath, { tasks: [tasks[3]] }).render();
assert.equal(summary(skippedOnly, '未完了'), 0);
assert.equal(summary(skippedOnly, '担当未定'), 0);
assert.ok(text(skippedOnly).includes('この条件に当てはまるタスクはありません。'));
const loading = harness(taskPath, {}, {
  fetchTasks: async () => { throw Error('synthetic offline'); },
  fetchFamilyMembers: async () => []
});
assert.equal(summary(loading.render(), '未完了'), 0);
loading.effects[0]();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(loading.state.tasks.length, 0);
assert.ok(text(loading.render()).includes('確認リストを読み込めませんでした'));

const homeText = text(harness('apps/mobile/app/people/[id]/home.tsx').render());
assert.ok(homeText.includes('この家の保存済み情報ではありません'));
assert.ok(!homeText.includes('長男が保管'));
assert.ok(!homeText.includes('現在のメモ'));

for (const file of ['apps/mobile/app/(tabs)/plan.tsx', 'apps/mobile/app/account/plan.tsx']) {
  const copy = text(harness(file).render());
  assert.ok(copy.includes('無料'));
  assert.ok(!/Family Plus|980円|9,800円|10枚目安|現在のプラン|現在の利用状態|現在の状態/.test(copy));
}

const timelinePath = 'apps/mobile/app/people/[id]/timeline.tsx';
const timelineSource = fs.readFileSync(path.join(root, timelinePath), 'utf8');
const timelineAst = ts.createSourceFile(timelinePath, timelineSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const todayFunction = timelineAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'todayString');
assert.ok(todayFunction);
const previousTimezone = process.env.TZ;
process.env.TZ = 'Asia/Tokyo';
try {
for (const [instant, expected] of [
  ['2026-09-19T14:59:59Z', '2026-09-19'],
  ['2026-09-19T15:00:00Z', '2026-09-20'],
  ['2026-09-19T23:00:00Z', '2026-09-20'],
  ['2026-09-20T00:00:00Z', '2026-09-20']
]) {
  class FixedDate extends Date { constructor() { super(instant); } }
  assert.equal(vm.runInNewContext(`(${todayFunction.getText(timelineAst)})()`, { Date: FixedDate }), expected, instant);
}
} finally {
  if (previousTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimezone;
}
const offlineTimeline = harness(timelinePath, {}, {
  fetchPerson: async () => { throw Error('synthetic offline'); },
  fetchTimelineEntries: async () => []
});
offlineTimeline.render();
offlineTimeline.effects[0]();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(offlineTimeline.state.entries.length, 0);
assert.ok(text(offlineTimeline.render()).includes('日記を読み込めませんでした'));
const saved = [];
const timeline = harness(timelinePath, {}, {
  addTimelineEntry: async (input) => {
    saved.push(input);
    return { source: 'supabase', entry: { ...input, id: 'synthetic-entry', attachments: [] } };
  }
});
let timelineTree = timeline.render();
const saveButton = (tree) => nodes(tree).find((node) => node.type === 'Pressable' && text(node).includes('記録を保存する'));
assert.equal(saveButton(timelineTree).props.disabled, true);
assert.ok(!nodes(timelineTree).some((node) => node.type === 'Pressable' && /写真|PDF/.test(text(node))));
assert.ok(text(timelineTree).includes('写真・PDFファイルは添付できません'));
const tagButton = nodes(timelineTree).find((node) => node.type === 'Pressable' && text(node) === '食事はとれた');
tagButton.props.onPress();
timelineTree = timeline.render();
assert.equal(saveButton(timelineTree).props.disabled, false);
await saveButton(timelineTree).props.onPress();
assert.equal(saved.length, 1);
assert.equal(saved[0].body, '・食事はとれた');
assert.ok(!('attachments' in saved[0]));
assert.equal(timeline.state.body, '');
assert.equal(timeline.state.selectedTags.length, 0);
assert.ok(text(timeline.render()).includes('今日の記録を保存しました'));

const failed = harness(timelinePath, { body: 'keep this note' }, {
  addTimelineEntry: async () => ({ error: 'synthetic save failure' })
});
await saveButton(failed.render()).props.onPress();
assert.equal(failed.state.body, 'keep this note');
assert.equal(failed.state.message, 'synthetic save failure');
const thrown = harness(timelinePath, { body: 'keep my unsaved note' }, {
  addTimelineEntry: async () => { throw Error('synthetic network exception'); }
});
await saveButton(thrown.render()).props.onPress();
assert.equal(thrown.state.body, 'keep my unsaved note');
assert.equal(thrown.state.saving, false);
assert.match(thrown.state.message, /入力内容は残っています/);

const assetsPath = 'apps/mobile/app/people/[id]/assets.tsx';
const assetInitial = harness(assetsPath, {}, { getSupabase: () => null });
assetInitial.render();
assert.equal(assetInitial.state.title, '');
assert.equal(assetInitial.state.location, '', 'input examples must not become saved facts');
for (const client of [null, { from: () => ({ insert: async () => { throw Error('offline'); } }) }]) {
  const assets = harness(assetsPath, { title: 'my document', location: 'my drawer' }, { getSupabase: () => client });
  const tree = assets.render();
  await nodes(tree).find((node) => node.type === 'Pressable' && text(node) === '保存する').props.onPress();
  assert.match(assets.state.message, /保存できませんでした/);
  assert.doesNotMatch(assets.state.message, /保存しました/);
  assert.equal(assets.state.location, 'my drawer');
  assert.equal(assets.state.saving, false);
}

const historical = harness(timelinePath, { entries: [{
  id: 'old', title: 'old note', date: '2026-09-20', attachments: [
    { name: '写真を追加予定 1', type: 'photo' },
    { name: 'real.jpg', storagePath: 'synthetic/photo.jpg' }
  ]
}] }).render();
assert.ok(text(historical).includes('写真を追加予定 1（文字メモのみ・ファイルなし）'));
assert.ok(text(historical).includes('real.jpg（この画面ではファイルを開けません）'));
console.log('PASS: synthetic native screen regression (task counts/empty/offline, home examples, free scope, timeline text save/error/old attachment metadata/JST date boundaries). No external APIs.');
