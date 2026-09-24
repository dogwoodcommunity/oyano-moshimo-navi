import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Offline, declared-dependency checks only. Never creates a build or contacts a provider.
// Source compatibility cannot establish a binary's SDK/alignment or store acceptance.
export const POLICY_REVIEW_DATE = "2026-09-20";
const sdkDependencies = {
  54: { native: [0, 81], react: [19, 1] },
  55: { native: [0, 83], react: [19, 2] },
  56: { native: [0, 85], react: [19, 2] },
  57: { native: [0, 86], react: [19, 2] }
};
const version = (value) => typeof value === "string"
  ? /^[~^]?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number) ?? null
  : null;

export function assessMobileStoreSource({ mobilePackage, app, eas }) {
  const failures = [];
  const warnings = [];
  const dependencies = mobilePackage.dependencies ?? {};
  const sdk = version(dependencies.expo)?.[0];
  const expected = sdkDependencies[sdk];
  if (sdk !== undefined && sdk < 54) {
    failures.push(`Expo SDK ${sdk}: このプロジェクトの申請用SDK移行が未完了です。API 36 / iOS 26対応をnative buildで確認してください。`);
  } else if (!expected) {
    failures.push("Expoバージョンをこの確認表では判定できません。公式対応表と移行記録を更新してください。");
  } else {
    for (const [name, pair] of [["react-native", expected.native], ["react", expected.react]]) {
      const actual = version(dependencies[name]);
      if (!actual || actual[0] !== pair[0] || actual[1] !== pair[1]) {
        failures.push(`Expo SDK ${sdk} と ${name} の宣言バージョンが不整合です。`);
      }
    }
    if (sdk === 54) warnings.push("SDK 54は段階移行の確認地点です。保守期間と最終採用SDKを再確認してください。");
    if (sdk >= 55 && app.newArchEnabled === false) failures.push("SDK 55以降で旧Architectureは使用できません。");
    if (sdk === 57) warnings.push("SDK 57はNode 22.13以降 / iOS 16.4以降が必要です。CI・EAS・対象端末を確認してください。");
  }

  const plist = app.ios?.infoPlist ?? {};
  if (plist.NSCameraUsageDescription && !dependencies["expo-camera"] && !dependencies["expo-image-picker"]) {
    failures.push("カメラ用途宣言に対応する実装依存がありません。使用しない権限は削除してください。");
  }
  if (plist.NSPhotoLibraryUsageDescription && !dependencies["expo-image-picker"] && !dependencies["expo-media-library"]) {
    failures.push("写真ライブラリ用途宣言に対応する実装依存がありません。");
  }
  if (Object.values(eas.build ?? {}).some((profile) => profile.developmentClient)
      && !dependencies["expo-dev-client"]) {
    warnings.push("developmentClient用のexpo-dev-clientが未導入です。開発ビルドを作る前にSDK適合版を追加してください。");
  }
  warnings.push("宣言バージョンのみの検査です。lockfile・生成binary・実機・管理画面・審査結果は未検証です。");
  return {
    policyReviewDate: POLICY_REVIEW_DATE,
    sourceStatus: failures.length ? "BLOCKED" : "SOURCE_CHECKS_ONLY",
    submissionStatus: "NOT_VERIFIED",
    failures,
    warnings,
    requiredEvidence: [
      "iOS: 署名済み実buildのXcode 26+ / iOS 26 SDK+、privacy manifestと使用権限",
      "Android: 実AABのtarget API 36+、16KB ZIP/ELF alignmentと実行確認",
      "iPhone/Android: 本人確認から復帰、別人分離、記録保存/再起動、AI同意/履歴、ログアウト後通知",
      "AI回答のアプリ内通報受付、アカウント削除/バックアップ復元の実運用",
      "所有者/契約/審査用ログイン/実機画像/Data Safety・Privacy回答/提出承認"
    ]
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = fileURLToPath(new URL("../", import.meta.url));
  const read = (path) => JSON.parse(readFileSync(resolve(repo, path), "utf8"));
  const report = assessMobileStoreSource({
    mobilePackage: read("apps/mobile/package.json"),
    app: read("apps/mobile/app.json").expo,
    eas: read("apps/mobile/eas.json")
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}
