export type ParentStatus =
  | "preparing"
  | "hospitalized"
  | "facility"
  | "cognitive_decline"
  | "end_of_life"
  | "after_death"
  | "after_funeral"
  | "inheritance"
  | "home_clearance"
  | "completed";

export type DiagnosisAnswers = {
  selectedStatus: ParentStatus;
  parentSituation: string;
  familyStructure: string;
  hasHome: "yes" | "no" | "unknown";
  knowsAssets: "mostly" | "some" | "unknown";
  concerns: string[];
  homeClearance: string;
  contactName?: string;
  contactEmail?: string;
  consentToContact?: boolean;
  consentToSensitiveInfo?: boolean;
  consentTextVersion?: string;
};

export type TaskTemplate = {
  status: ParentStatus;
  title: string;
  description: string;
  defaultDueOffsetDays: number;
  priority: 1 | 2 | 3;
  category: string;
  requiresProfessional?: boolean;
};

export type DiagnosisResult = {
  diagnosisType: string;
  summary: string;
  firstSteps: string[];
  tasks: Array<TaskTemplate & { dueDate: string }>;
  familyQuestions: string[];
  registryItems: string[];
  providerCategories: string[];
  warnings: string[];
};

export const STATUSES: Array<{ key: ParentStatus; label: string; tone: string }> = [
  { key: "preparing", label: "元気・準備中", tone: "green" },
  { key: "hospitalized", label: "長期入院", tone: "blue" },
  { key: "facility", label: "施設入居", tone: "teal" },
  { key: "cognitive_decline", label: "認知症・判断能力低下", tone: "amber" },
  { key: "end_of_life", label: "危篤・看取り準備", tone: "rose" },
  { key: "after_death", label: "死亡直後", tone: "slate" },
  { key: "after_funeral", label: "葬儀後", tone: "indigo" },
  { key: "inheritance", label: "相続手続き中", tone: "violet" },
  { key: "home_clearance", label: "実家整理中", tone: "orange" },
  { key: "completed", label: "完了・保管", tone: "gray" }
];

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    status: "preparing",
    title: "家族で連絡先と役割を確認する",
    description: "親本人、兄弟姉妹、近い親族の連絡先と、緊急時に動く人を決めます。",
    defaultDueOffsetDays: 7,
    priority: 2,
    category: "family"
  },
  {
    status: "preparing",
    title: "重要書類の存在と保管場所を聞く",
    description: "通帳、保険証券、年金、実印、権利書などの有無と場所だけを記録します。",
    defaultDueOffsetDays: 14,
    priority: 2,
    category: "registry"
  },
  {
    status: "hospitalized",
    title: "病院の窓口と退院見込みを確認する",
    description: "主治医、医療相談員、退院支援窓口、必要書類を整理します。",
    defaultDueOffsetDays: 3,
    priority: 1,
    category: "medical"
  },
  {
    status: "hospitalized",
    title: "支払いと保険請求に必要な書類を集める",
    description: "限度額適用認定証、診断書、保険証券の保管場所を確認します。",
    defaultDueOffsetDays: 7,
    priority: 2,
    category: "money"
  },
  {
    status: "facility",
    title: "施設契約と費用負担を家族で確認する",
    description: "月額費用、退去条件、身元引受人、緊急連絡先を整理します。",
    defaultDueOffsetDays: 7,
    priority: 1,
    category: "care"
  },
  {
    status: "cognitive_decline",
    title: "判断能力低下時の相談先を確認する",
    description: "地域包括支援センター、ケアマネ、成年後見等の相談先候補を控えます。法的判断は専門家に確認します。",
    defaultDueOffsetDays: 7,
    priority: 1,
    category: "professional",
    requiresProfessional: true
  },
  {
    status: "end_of_life",
    title: "緊急連絡先と看取り方針を共有する",
    description: "病院・施設・家族間で、連絡順と希望を事実ベースで共有します。",
    defaultDueOffsetDays: 1,
    priority: 1,
    category: "urgent"
  },
  {
    status: "after_death",
    title: "死亡診断書と葬儀社連絡を確認する",
    description: "死亡診断書、搬送先、葬儀社、親族連絡の担当を整理します。",
    defaultDueOffsetDays: 1,
    priority: 1,
    category: "funeral"
  },
  {
    status: "after_funeral",
    title: "公的手続きの期限を確認する",
    description: "年金、健康保険、介護保険、世帯主変更など、自治体で必要な手続きを確認します。",
    defaultDueOffsetDays: 7,
    priority: 1,
    category: "public"
  },
  {
    status: "inheritance",
    title: "相続人と財産の一覧を作る",
    description: "相続人、預貯金、不動産、保険、負債の存在を一覧化します。判断は専門家に相談します。",
    defaultDueOffsetDays: 14,
    priority: 1,
    category: "inheritance",
    requiresProfessional: true
  },
  {
    status: "home_clearance",
    title: "実家カルテを作る",
    description: "鍵、ライフライン、空き家状況、家財量、写真を登録します。",
    defaultDueOffsetDays: 7,
    priority: 1,
    category: "home"
  },
  {
    status: "home_clearance",
    title: "家財整理・空き家管理の相談条件を整理する",
    description: "許認可、保険、追加費用、見積明細を確認する前提で候補を比較します。",
    defaultDueOffsetDays: 14,
    priority: 2,
    category: "provider"
  }
];

export const SENSITIVE_INFO_CONSENT_VERSION = "sensitive-info-v1";

export const SENSITIVE_INFO_CONSENT_TEXT =
  "親の入院・認知症・危篤・死亡などの情報が要配慮情報に該当し得ることを理解し、本人に説明できる場合は説明したうえで、家族の支援に必要な範囲で入力します。暗証番号、パスワード、マイナンバー画像は入力しません。";

const providerByStatus: Record<ParentStatus, string[]> = {
  preparing: ["行政書士", "司法書士"],
  hospitalized: ["地域包括支援センター", "医療相談員"],
  facility: ["ケアマネジャー", "行政書士"],
  cognitive_decline: ["地域包括支援センター", "司法書士", "弁護士"],
  end_of_life: ["葬儀社", "行政書士"],
  after_death: ["葬儀社", "行政書士"],
  after_funeral: ["司法書士", "税理士", "行政書士"],
  inheritance: ["司法書士", "税理士", "弁護士"],
  home_clearance: ["家財整理・遺品整理", "空き家管理", "不動産相談"],
  completed: ["行政書士"]
};

export function addDays(base: Date, days: number): string {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function statusLabel(status: ParentStatus): string {
  return STATUSES.find((item) => item.key === status)?.label ?? status;
}

export function buildDiagnosisResult(answers: DiagnosisAnswers, baseDate = new Date()): DiagnosisResult {
  const status = answers.selectedStatus;
  const statusTasks = TASK_TEMPLATES.filter((task) => task.status === status).slice(0, 4);
  const homeTask = answers.hasHome === "yes" && status !== "home_clearance"
    ? TASK_TEMPLATES.find((task) => task.status === "home_clearance")
    : undefined;
  const tasks = [...statusTasks, ...(homeTask ? [homeTask] : [])].map((task) => ({
    ...task,
    dueDate: addDays(baseDate, task.defaultDueOffsetDays)
  }));

  const concerns = answers.concerns.length > 0 ? answers.concerns.join("、") : "家族内の未整理事項";
  return {
    diagnosisType: `${statusLabel(status)}タイプ`,
    summary: `現在は「${statusLabel(status)}」として、${concerns}を先にほどく状態です。期限のある手続きと、家族で確認する情報を分けて進めましょう。`,
    firstSteps: tasks.slice(0, 3).map((task) => task.title),
    tasks,
    familyQuestions: [
      "緊急時に最初に連絡を受ける人は誰か",
      "親本人の希望として確認済みのことは何か",
      "通帳・保険証券・実印・権利書などの保管場所を誰が知っているか"
    ],
    registryItems: [
      "銀行・保険・年金は存在と保管場所のみ",
      "不動産・実家の鍵とライフライン",
      "葬儀・墓・重要書類の所在",
      "スマホ・PC・主要アカウントの存在"
    ],
    providerCategories: providerByStatus[status],
    warnings: [
      "銀行暗証番号・パスワード・マイナンバー画像は保存しないでください。",
      "法律・税務・登記の判断は、必ず専門家に確認してください。"
    ]
  };
}

export function createHandoffToken(caseId: string): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `handoff_${caseId.replace(/-/g, "").slice(0, 12)}_${randomPart}`;
}
