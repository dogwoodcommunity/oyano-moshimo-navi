export const FAMILY_INVITE_ROLES = ["viewer", "member"] as const;
export const FAMILY_MEMBER_ROLES = ["owner", "admin", ...FAMILY_INVITE_ROLES] as const;

export type FamilyInviteRole = (typeof FAMILY_INVITE_ROLES)[number];
export type FamilyMemberRole = (typeof FAMILY_MEMBER_ROLES)[number];

export type FamilyInvitePermission = {
  label: string;
  shortDescription: string;
  fullDescription: string;
};

const permissions: Record<FamilyInviteRole, FamilyInvitePermission> = {
  viewer: {
    label: "見るだけ",
    shortDescription: "手帳の内容を見られます。追加・変更・削除はできません。",
    fullDescription:
      "親の基本情報、日々の記録、確認リスト、写真を見られます。記録の追加・変更・削除やAI相談はできません。"
  },
  member: {
    label: "記録・確認リスト・写真を編集",
    shortDescription: "日々の記録、確認リスト、写真を一緒に追加・変更・削除できます。",
    fullDescription:
      "親の基本情報、日々の記録、確認リスト、写真を見られます。日々の記録、確認リスト、写真は一緒に追加・変更・削除できます。親の基本情報と家族管理は変更できません。"
  }
};

export function parseFamilyInviteRole(value: unknown): FamilyInviteRole | null {
  return value === "viewer" || value === "member" ? value : null;
}

export function parseFamilyMemberRole(value: unknown): FamilyMemberRole | null {
  return value === "owner" || value === "admin" || value === "viewer" || value === "member" ? value : null;
}

export function familyInvitePermission(role: FamilyInviteRole): FamilyInvitePermission {
  return permissions[role];
}

export function isWellFormedFamilyInviteToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{24,128}$/.test(value);
}
