/**
 * Webは入口で、本体はアプリ。
 * ストアURLが未設定の間は、アプリへの導線そのものを出さない。
 * 押しても何も起きないボタンを置くほうが、置かないより悪い。
 */
export type AppLinks = {
  ios?: string;
  android?: string;
  available: boolean;
};

export function getAppLinks(): AppLinks {
  const ios = process.env.NEXT_PUBLIC_IOS_APP_URL?.trim() || undefined;
  const android = process.env.NEXT_PUBLIC_ANDROID_APP_URL?.trim() || undefined;
  return { ios, android, available: Boolean(ios || android) };
}
