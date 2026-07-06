const base = require("./app.json");

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const owner = process.env.EXPO_OWNER;
const extra = {
  ...base.expo.extra
};

if (projectId) {
  extra.eas = { projectId };
}

module.exports = {
  expo: {
    ...base.expo,
    description: "親のもしもに備える家族のための保管庫・通知係・家族ボード。",
    ...(owner ? { owner } : {}),
    ios: {
      ...base.expo.ios,
      buildNumber: process.env.IOS_BUILD_NUMBER ?? "1"
    },
    android: {
      ...base.expo.android,
      versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1)
    },
    extra
  }
};
