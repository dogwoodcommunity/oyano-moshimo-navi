export type Guide = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  concern: string;
  firstActions: string[];
  familyQuestions: string[];
  avoid: string[];
  providers: string[];
  ctaStatus: string;
  tags: string[];
  readTime: string;
};

const coreGuides: Guide[] = [
  {
    slug: "hospitalized",
    title: "親が入院した時に、家族が最初に確認すること",
    category: "入院・退院",
    summary: "支払い、保険、退院後の生活、家族の連絡役を先に整理すると、急な判断が減ります。",
    concern: "病院から急に説明を受けても、家族内で誰が何を決めるのか分からず不安になりやすい時期です。",
    firstActions: [
      "病院の窓口、主治医、退院支援担当の連絡先を控える",
      "入院費の支払い方法、保険証、限度額適用認定証の必要性を確認する",
      "退院後に自宅へ戻るか、施設や一時滞在が必要かを家族で話す"
    ],
    familyQuestions: [
      "本人が普段飲んでいる薬と通院先を誰が把握しているか",
      "家の鍵、保険証、診察券、印鑑がどこにあるか",
      "退院後の見守りを誰がどの曜日に担えるか"
    ],
    avoid: [
      "病院で聞いた話を一人だけで抱え込む",
      "銀行暗証番号やパスワードをサービスに保存する",
      "退院後の住まいを家族の雰囲気だけで決める"
    ],
    providers: ["地域包括支援センター", "医療ソーシャルワーカー", "ケアマネジャー候補"],
    ctaStatus: "hospitalized",
    tags: ["入院", "退院", "支払い", "家族共有"],
    readTime: "3分"
  },
  {
    slug: "care",
    title: "介護が始まりそうな時に、揉めないための準備",
    category: "介護",
    summary: "介護認定、通院、生活費、家族の役割を見える化して、誰か一人に負担が寄らない形を作ります。",
    concern: "本人の状態が少しずつ変わる時ほど、家族の認識差が大きくなります。",
    firstActions: [
      "生活で困っている動作をメモする",
      "地域包括支援センターへ相談する準備をする",
      "通院、服薬、買い物、支払いの担当を仮決めする"
    ],
    familyQuestions: [
      "本人は何を自分で続けたいと思っているか",
      "遠方の家族は何なら協力できるか",
      "介護費用をどこから支払う想定か"
    ],
    avoid: [
      "介護する人を空気で決める",
      "本人の希望を確認しないまま進める",
      "費用や通帳の話を後回しにしすぎる"
    ],
    providers: ["地域包括支援センター", "ケアマネジャー", "訪問介護・デイサービス"],
    ctaStatus: "facility",
    tags: ["介護", "役割分担", "費用", "本人希望"],
    readTime: "4分"
  },
  {
    slug: "cognitive-decline",
    title: "認知症かもしれないと感じた時の家族メモ",
    category: "認知症",
    summary: "受診、本人確認、金銭管理、家族共有を急ぎすぎず、記録を残しながら進めます。",
    concern: "本人の尊厳を守りながら、事故や支払い遅れを防ぐバランスが難しい場面です。",
    firstActions: [
      "困りごとの頻度と具体例を日付つきで残す",
      "かかりつけ医や地域包括支援センターへ相談する",
      "重要書類の場所を本人に確認できる範囲で聞く"
    ],
    familyQuestions: [
      "最近変わった行動を誰が見ているか",
      "支払い遅れや契約トラブルがないか",
      "本人が嫌がること、安心する説明は何か"
    ],
    avoid: [
      "本人を責める言い方で確認する",
      "暗証番号やパスワードを家族外の場所に保存する",
      "法律判断を自己判断で断定する"
    ],
    providers: ["地域包括支援センター", "もの忘れ外来", "司法書士・弁護士"],
    ctaStatus: "cognitive_decline",
    tags: ["認知症", "記録", "受診", "金銭管理"],
    readTime: "4分"
  },
  {
    slug: "after-death",
    title: "親が亡くなった直後に、家族が慌てないための確認",
    category: "死亡直後",
    summary: "死亡診断書、葬儀、親族連絡、役所手続きなど、最初の数日で確認することを整理します。",
    concern: "悲しみの中で短期間に連絡と手続きが重なり、判断疲れが起きやすい時期です。",
    firstActions: [
      "死亡診断書の受け取りと提出先を確認する",
      "葬儀社、親族連絡、宗教者の有無を整理する",
      "家族内の連絡担当と支払い担当を分ける"
    ],
    familyQuestions: [
      "本人の希望やエンディングノートがあるか",
      "連絡すべき親族・友人の一覧はどこにあるか",
      "葬儀費用を誰が一時的に立て替えるか"
    ],
    avoid: [
      "一人で親族連絡と支払いを抱える",
      "相続や税務判断をその場で断定する",
      "重要書類を捨てる"
    ],
    providers: ["葬儀社", "市区町村窓口", "司法書士・税理士"],
    ctaStatus: "after_death",
    tags: ["死亡直後", "葬儀", "親族連絡", "役所"],
    readTime: "3分"
  },
  {
    slug: "inheritance",
    title: "相続前に、まず一覧化しておく情報",
    category: "相続前整理",
    summary: "財産の評価や税務判断ではなく、書類の所在、負債、不動産、相談先を見える化します。",
    concern: "何があるか分からない状態で専門家に相談すると、家族も専門家も確認に時間がかかります。",
    firstActions: [
      "通帳、保険、年金、不動産、借入の存在だけを一覧にする",
      "固定資産税通知書や登記関係の書類を探す",
      "相続人になりそうな家族関係をメモする"
    ],
    familyQuestions: [
      "親が管理していた口座や保険は誰が知っているか",
      "借入、保証人、未払いがありそうか",
      "実家を残す・売る・貸す希望が家族で違わないか"
    ],
    avoid: [
      "税額や法的結論をサービス上で断定する",
      "通帳画像や暗証番号を保存する",
      "一部の家族だけで話を進める"
    ],
    providers: ["司法書士", "税理士", "弁護士", "不動産相談"],
    ctaStatus: "inheritance",
    tags: ["相続", "書類", "不動産", "専門家"],
    readTime: "4分"
  },
  {
    slug: "home-clearance",
    title: "実家じまいを始める前に、写真で残すべきこと",
    category: "実家じまい",
    summary: "片付けや売却の前に、鍵、ライフライン、家財、重要書類、近隣情報を記録します。",
    concern: "片付けを始めた後に、必要な書類や思い出の品を戻せなくなることがあります。",
    firstActions: [
      "玄関、各部屋、押し入れ、物置、庭、メーター類を写真で残す",
      "鍵、郵便物、固定電話、電気・ガス・水道の契約を確認する",
      "家財整理前に重要書類らしきものを分ける"
    ],
    familyQuestions: [
      "残したい写真・仏壇・形見があるか",
      "近隣への連絡や管理を誰がするか",
      "売却、賃貸、管理、解体の希望があるか"
    ],
    avoid: [
      "写真を残さずに一気に処分する",
      "見積もりの追加費用条件を確認しない",
      "空き家の鍵管理を曖昧にする"
    ],
    providers: ["家財整理・遺品整理", "空き家管理", "不動産相談", "解体"],
    ctaStatus: "home_clearance",
    tags: ["実家じまい", "写真", "鍵", "家財"],
    readTime: "3分"
  }
];

type StageSeed = {
  key: string;
  label: string;
  category: string;
  ctaStatus: string;
  concern: string;
  providers: string[];
};

type ThemeSeed = {
  key: string;
  title: string;
  subject: string;
  concern: string;
  firstActions: string[];
  questions: string[];
  avoid: string[];
  providers: string[];
  tags: string[];
};

const guideStages: StageSeed[] = [
  {
    key: "preparing",
    label: "元気なうちに備える時",
    category: "準備",
    ctaStatus: "preparing",
    concern: "まだ急ぎではない時ほど、家族が話を切り出しにくく後回しになります。",
    providers: ["地域包括支援センター", "かかりつけ医", "行政窓口"]
  },
  {
    key: "cognitive",
    label: "もの忘れが心配な時",
    category: "認知症",
    ctaStatus: "cognitive_decline",
    concern: "本人の尊厳を守りながら、事故や支払い遅れを防ぐ準備が必要です。",
    providers: ["もの忘れ外来", "地域包括支援センター", "司法書士"]
  },
  {
    key: "hospital",
    label: "入院した時",
    category: "入院・退院",
    ctaStatus: "hospitalized",
    concern: "短い期間で説明、支払い、退院後の生活を同時に考えることになります。",
    providers: ["医療ソーシャルワーカー", "病院窓口", "ケアマネジャー候補"]
  },
  {
    key: "post-discharge",
    label: "退院後に家で過ごす時",
    category: "退院後の在宅",
    ctaStatus: "post_discharge_home",
    concern: "病院から生活の場へ戻ると、通院、見守り、服薬、家事の負担が見え始めます。",
    providers: ["訪問看護", "ケアマネジャー", "地域包括支援センター"]
  },
  {
    key: "facility",
    label: "介護・施設を考える時",
    category: "介護・施設",
    ctaStatus: "facility",
    concern: "本人の希望、家族の負担、費用、施設候補を同時に整理する必要があります。",
    providers: ["ケアマネジャー", "施設相談員", "地域包括支援センター"]
  },
  {
    key: "end-of-life",
    label: "看取りが近づいた時",
    category: "看取り",
    ctaStatus: "end_of_life",
    concern: "医療判断を家族だけで抱えず、本人の希望と連絡体制を落ち着いて確認する時期です。",
    providers: ["主治医", "訪問看護", "緩和ケア相談"]
  },
  {
    key: "after-death",
    label: "亡くなった直後",
    category: "死亡直後",
    ctaStatus: "after_death",
    concern: "悲しみの中で、死亡診断書、葬儀、親族連絡、役所手続きが重なります。",
    providers: ["葬儀社", "市区町村窓口", "行政書士"]
  },
  {
    key: "after-funeral",
    label: "葬儀が終わった後",
    category: "葬儀後",
    ctaStatus: "after_funeral",
    concern: "年金、保険、口座、名義変更など、期限の違う手続きが長く続きます。",
    providers: ["司法書士", "税理士", "行政書士"]
  },
  {
    key: "inheritance",
    label: "相続前に整理する時",
    category: "相続前整理",
    ctaStatus: "inheritance",
    concern: "財産評価や税務判断の前に、何がどこにあるかを家族で共有する必要があります。",
    providers: ["司法書士", "税理士", "弁護士"]
  },
  {
    key: "home-clearance",
    label: "実家じまいを考える時",
    category: "実家じまい",
    ctaStatus: "home_clearance",
    concern: "片付けを始める前に、写真、鍵、契約、近隣情報を残しておくと後戻りが減ります。",
    providers: ["家財整理", "空き家管理", "不動産相談"]
  }
];

const guideThemes: ThemeSeed[] = [
  {
    key: "contacts",
    title: "連絡先を迷わない形にする",
    subject: "家族、病院、相談先、親族の連絡先",
    concern: "連絡先が一人のスマホにしかないと、急な時に家族全員が止まります。",
    firstActions: ["主担当と予備担当を決める", "電話番号と受付時間を一か所に集める", "夜間や休日の連絡先も分けて残す"],
    questions: ["誰に最初に連絡するか", "親族へ伝える順番はあるか", "本人が知らせてほしくない人はいるか"],
    avoid: ["連絡役を空気で決める", "LINEだけに情報を残す", "本人の希望を確認しないまま一斉連絡する"],
    providers: ["病院窓口", "施設相談員"],
    tags: ["連絡先", "家族共有"]
  },
  {
    key: "care-window",
    title: "病院・介護の窓口を整理する",
    subject: "主治医、相談員、ケアマネ、施設担当の窓口",
    concern: "誰に何を聞けばよいか分からないと、同じ説明を何度も聞くことになります。",
    firstActions: ["担当者名と部署を控える", "次の面談日を記録する", "家族側の質問を3つに絞る"],
    questions: ["医療面の窓口は誰か", "生活面の相談先は誰か", "家族の代表者として誰が話すか"],
    avoid: ["医療判断をアプリで断定する", "窓口を家族内で共有しない", "質問をその場で思いつきにする"],
    providers: ["主治医", "医療ソーシャルワーカー", "ケアマネジャー"],
    tags: ["病院", "介護窓口"]
  },
  {
    key: "money",
    title: "支払いと立て替えを揉めないようにする",
    subject: "入院費、介護費、葬儀費、家の維持費",
    concern: "支払い担当が曖昧だと、あとから立て替えや精算で揉めやすくなります。",
    firstActions: ["支払い先と期限を一覧にする", "立て替えた人と金額を記録する", "領収書や請求書の保管場所を決める"],
    questions: ["誰が一時的に払うか", "本人の口座から払える費用か", "家族で精算する予定があるか"],
    avoid: ["暗証番号を保存する", "領収書を写真に残さず捨てる", "一人の家族だけに支払いを寄せる"],
    providers: ["病院会計", "施設事務", "税理士"],
    tags: ["支払い", "領収書"]
  },
  {
    key: "insurance-pension",
    title: "保険・年金の確認を後回しにしない",
    subject: "健康保険、介護保険、生命保険、年金",
    concern: "保険や年金は期限や窓口が分かれており、思い出した時には書類が足りないことがあります。",
    firstActions: ["保険証券や通知書の場所を探す", "問い合わせ先を記録する", "期限があるものだけ先に分ける"],
    questions: ["加入している保険を誰が知っているか", "年金手帳や通知書はどこにあるか", "請求済みか未請求か分かるか"],
    avoid: ["受給可否を自己判断で断定する", "証券番号を不用意に共有する", "期限つき書類を後回しにする"],
    providers: ["保険会社", "年金事務所", "市区町村窓口"],
    tags: ["保険", "年金"]
  },
  {
    key: "medicine",
    title: "薬・通院の記録を家族で見られるようにする",
    subject: "薬、通院先、検査予定、体調変化",
    concern: "薬や通院の情報は本人だけが覚えていることが多く、状態変化時に確認が難しくなります。",
    firstActions: ["お薬手帳の場所を控える", "通院先と次回予約を記録する", "飲み忘れや副作用らしき変化を日付で残す"],
    questions: ["普段の薬は誰が確認しているか", "かかりつけ医はどこか", "最近変わった薬や症状はあるか"],
    avoid: ["服薬変更を家族だけで判断する", "症状を記憶だけで伝える", "薬の写真だけで満足する"],
    providers: ["かかりつけ医", "薬局", "訪問看護"],
    tags: ["薬", "通院"]
  },
  {
    key: "home-keys",
    title: "家の鍵とライフラインを確認する",
    subject: "鍵、電気、ガス、水道、固定電話、郵便物",
    concern: "家に入れない、契約先が分からない、郵便物が止まるなど、生活周りの小さな困りごとが重なります。",
    firstActions: ["鍵の本数と保管者を確認する", "ライフラインの契約名義を控える", "郵便物の確認担当を決める"],
    questions: ["合鍵は誰が持っているか", "家を空ける期間はどれくらいか", "止める契約と残す契約は何か"],
    avoid: ["鍵の所在を口約束だけにする", "空き家状態を広く知らせる", "契約番号や個人情報を不用意に共有する"],
    providers: ["電力会社", "ガス会社", "空き家管理"],
    tags: ["鍵", "ライフライン"]
  },
  {
    key: "documents",
    title: "大事な書類の置き場所を見える化する",
    subject: "保険証、診察券、印鑑、契約書、登記関係書類",
    concern: "書類そのものより、どこにあるかを家族が知らないことで手続きが止まります。",
    firstActions: ["書類の種類と保管場所だけを記録する", "危ない情報は画像で保存しない", "家族が探せる棚や箱の写真を残す"],
    questions: ["本人が普段しまう場所はどこか", "捨ててはいけない書類は何か", "専門家に見せる可能性がある書類は何か"],
    avoid: ["マイナンバー画像を保存する", "通帳全ページを撮影する", "整理中に重要書類を処分する"],
    providers: ["行政窓口", "司法書士", "税理士"],
    tags: ["書類", "保管場所"]
  },
  {
    key: "roles",
    title: "家族の役割分担を決める",
    subject: "連絡、支払い、通院、片付け、専門家相談の担当",
    concern: "良かれと思って動く人に負担が集中し、後から家族間の不満が残ることがあります。",
    firstActions: ["主担当を1つずつ決める", "未割当のまま残すタスクを見える化する", "遠方家族ができることも書く"],
    questions: ["平日に動ける人は誰か", "お金の確認を誰が担当するか", "家族会議の連絡役は誰か"],
    avoid: ["長男・長女などで自動的に決める", "未割当を放置する", "できないことを責める"],
    providers: ["家族会議", "ケアマネジャー"],
    tags: ["役割分担", "未割当"]
  },
  {
    key: "wishes",
    title: "本人の希望を残す",
    subject: "暮らし方、会いたい人、避けたいこと、大切にしたい習慣",
    concern: "本人の希望は、急な判断の時に家族の迷いを減らす大事な材料になります。",
    firstActions: ["本人が嫌がらない聞き方で一つだけ聞く", "会いたい人や大事な物を記録する", "変わったら更新できる形にする"],
    questions: ["家で続けたい習慣は何か", "誰に会いたいか", "家族に任せたいこと・任せたくないことは何か"],
    avoid: ["一度聞いた希望を絶対視する", "家族の都合だけで決める", "医療判断を希望メモだけで断定する"],
    providers: ["主治医", "ケアマネジャー", "家族会議"],
    tags: ["本人希望", "家族会議"]
  },
  {
    key: "photos-belongings",
    title: "写真・持ち物を記録する",
    subject: "部屋、持ち物、思い出の品、処分前に残す写真",
    concern: "あとで見返したい物ほど、片付けが始まると戻せなくなります。",
    firstActions: ["部屋全体を先に撮る", "残したい物を家族に聞く", "写真に短いメモを添える"],
    questions: ["誰に確認してから処分するか", "形見として残したい物は何か", "保管場所を変えた物はあるか"],
    avoid: ["写真を撮らずに処分する", "家族に確認せず形見を分ける", "空き家の場所が分かる写真を広く共有する"],
    providers: ["家財整理", "写真整理", "空き家管理"],
    tags: ["写真", "持ち物"]
  },
  {
    key: "neighbors",
    title: "近所・親族への伝え方を整理する",
    subject: "親族、近所、町内会、親しい友人への連絡",
    concern: "知らせる範囲や順番を間違えると、家族が説明に追われることがあります。",
    firstActions: ["知らせる人、まだ知らせない人を分ける", "連絡文の下書きを作る", "近所対応の担当を決める"],
    questions: ["親しい友人は誰か", "近所で鍵や見守りに関わる人はいるか", "連絡してほしくない相手はいるか"],
    avoid: ["SNSで先に広く知らせる", "親族連絡を一人で抱える", "空き家情報を不用意に伝える"],
    providers: ["親族代表", "町内会", "葬儀社"],
    tags: ["親族連絡", "近所"]
  },
  {
    key: "professional",
    title: "専門家に相談する前に整理する",
    subject: "相談内容、書類、家族の希望、期限",
    concern: "準備なしで相談すると、専門家に確認されることが多く、時間と費用が増えやすくなります。",
    firstActions: ["相談したいことを3つに絞る", "書類の所在だけ先にまとめる", "家族で合意できていない点を分ける"],
    questions: ["法律・税務・不動産のどれに近い相談か", "期限がある手続きか", "家族内で意見が割れている点は何か"],
    avoid: ["アプリの情報だけで法的判断をする", "専門家に見せる書類を一人で隠す", "費用条件を確認しない"],
    providers: ["司法書士", "税理士", "弁護士", "不動産相談"],
    tags: ["専門家", "相談準備"]
  }
];

const generatedGuides = guideStages.flatMap((stage) =>
  guideThemes.map((theme): Guide => ({
    slug: `${stage.key}-${theme.key}`,
    title: `${stage.label}の${theme.title}`,
    category: stage.category,
    summary: `${stage.label}に、${theme.subject}を家族で迷わないよう短く整理します。手帳に残すと、あとから見返せます。`,
    concern: `${stage.concern} ${theme.concern}`,
    firstActions: theme.firstActions,
    familyQuestions: theme.questions,
    avoid: theme.avoid,
    providers: Array.from(new Set([...stage.providers, ...theme.providers])).slice(0, 5),
    ctaStatus: stage.ctaStatus,
    tags: Array.from(new Set([stage.category, ...theme.tags])),
    readTime: theme.key === "professional" || theme.key === "money" ? "4分" : "3分"
  }))
);

export const guides: Guide[] = [...coreGuides, ...generatedGuides].slice(0, 100);

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
