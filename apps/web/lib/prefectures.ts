export const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県"
] as const;

export const SPONSOR_CATEGORIES = [
  "葬儀",
  "相続士業",
  "家族信託",
  "ホーム紹介",
  "保険",
  "遺品整理"
] as const;

export const SPONSOR_APPLICATION_CATEGORIES = [
  ...SPONSOR_CATEGORIES,
  "その他"
] as const;

export type Prefecture = typeof PREFECTURES[number];
export type SponsorCategory = typeof SPONSOR_CATEGORIES[number];

export const PUBLIC_PREFECTURE_USAGE_THRESHOLD_DEFAULT = 100;

export function publicPrefectureUsageThreshold() {
  const raw = process.env.PUBLIC_PREFECTURE_USAGE_THRESHOLD
    ?? process.env.NEXT_PUBLIC_PREFECTURE_USAGE_THRESHOLD;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return PUBLIC_PREFECTURE_USAGE_THRESHOLD_DEFAULT;
  }
  return Math.round(parsed);
}
