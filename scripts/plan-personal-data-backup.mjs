import path from "node:path";
import { fileURLToPath } from "node:url";

// Offline planning only. Never read credentials, contact AWS/Supabase, create
// resources or accept a backup file. Storage means ALL retained generations.
export function createBackupPlan({ retainedGb = 10, dailyMinutes = 10 } = {}) {
  if (!Number.isFinite(retainedGb) || retainedGb < 0 || retainedGb > 50_000
    || !Number.isFinite(dailyMinutes) || dailyMinutes < 1 || dailyMinutes > 1_440) {
    throw new Error("invalid_size_or_duration");
  }
  const round = (n) => Number(n.toFixed(6));
  const storage = retainedGb * 0.025;
  const keys = 2;
  const taskHours = dailyMinutes * 30 / 60;
  const automation = {
    // Proposed Phase 2 only: one Linux/x86 task, 1 vCPU / 2 GB, not provisioned.
    dailyTaskCompute: round(taskHours * (0.05056 + 2 * 0.00553)),
    twoSecretsStorage: 0.8,
    thirtySchedulerInvocations: 0.0000375,
    taskPublicIpv4: round(taskHours * 0.005)
  };
  return {
    mode: "OFFLINE_DESIGN_ONLY",
    deployment: "NOT_CREATED", productionData: "NOT_ACCESSED", productionAcceptance: "NO_GO",
    region: "ap-northeast-1", currency: "USD", priceCheckedAt: "2026-09-08",
    assumptions: {
      retainedGbAcrossAllVersions: retainedGb, daysPerMonth: 30, dailyTaskMinutes: dailyMinutes,
      customerManagedKeys: keys, rotationsPerKeyIncluded: 0,
      storageIsNotSourceDatabaseSize: true, freeTierAndCreditsApplied: false
    },
    estimatedMonthlyUsd: {
      foundationStorage: round(storage), foundationKeyBase: keys,
      foundationBaseSubtotal: round(storage + keys),
      proposedAutomationOnly: automation,
      baseSubtotalWithProposedAutomation: round(storage + keys + Object.values(automation).reduce((a, b) => a + b, 0)),
      possibleAdditionalKeyMaterialAfterTwoRotationsPerKey: 4
    },
    excludedCosts: [
      "S3 requests and audit/receipt bytes outside retainedGb", "KMS and Secrets Manager API requests",
      "CloudTrail data events and additional management-event copies", "CloudWatch logs, metrics, alarms and SNS",
      "ECR storage and image scanning", "transfer/restore and Supabase egress",
      "independent deletion-journal collection and backup verification runs",
      "NAT Gateway or VPC endpoints if selected", "tax/exchange rate", "retry/long-running jobs and retention drift"
    ],
    notASpendingCap: true,
    infrastructureTemplate: "infra/aws-personal-data/backup-vault.cfn.json",
    foundation: ["private versioned S3 backup/receipt/audit buckets", "separate backup and audit KMS keys",
      "separate writer/restore/audit roles", "CloudTrail object data events"],
    notIncludedInTemplate: ["backup collection worker and container image", "DB and Storage read credentials",
      "daily schedule and independent deletion journal export", "backup failure/freshness notification",
      "budget notifications", "production restore and deletion replay"],
    offlineComponentsImplemented: ["strict generation manifest and streamed byte-integrity verification",
      "conditional manifest completion protocol with injected test adapters only"],
    requiredBeforeAwsCreation: ["confirm AWS account and existing role ARNs", "approve itemized cost and retention",
      "verify MFA and key recovery administration", "review exact CloudFormation change set"],
    requiredBeforePersonalData: ["complete collector and manifest verification", "verify deny/restore behavior with synthetic AWS objects",
      "verify monitoring delivery", "approve data export scope and disclosure"],
    requiredBeforeProductionAcceptance: ["obtain the approved real backup", "complete isolated production-backup restore with deletion replay",
      "verify real-device permissions and operational/legal release gates"],
    priceSources: [
      "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/ap-northeast-1/index.json",
      "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awskms/current/ap-northeast-1/index.json",
      "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSSecretsManager/current/ap-northeast-1/index.json",
      "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSEvents/current/ap-northeast-1/index.json",
      "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/ap-northeast-1/index.json",
      "https://aws.amazon.com/vpc/pricing/", "https://aws.amazon.com/kms/pricing/"
    ]
  };
}

export function parseArguments(argv) {
  if (argv[0] !== "--plan") throw new Error("plan_only");
  const options = {};
  const seen = new Set();
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!["--retained-gb", "--daily-minutes"].includes(flag) || seen.has(flag)
      || !/^\d+(?:\.\d+)?$/.test(argv[index + 1] ?? "")) throw new Error("invalid_argument");
    seen.add(flag);
    options[flag === "--retained-gb" ? "retainedGb" : "dailyMinutes"] = Number(argv[index + 1]);
  }
  return createBackupPlan(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(parseArguments(process.argv.slice(2)), null, 2));
  } catch {
    // Do not echo arbitrary arguments; they may accidentally contain secrets.
    console.error("Usage: node scripts/plan-personal-data-backup.mjs --plan [--retained-gb NUMBER] [--daily-minutes NUMBER]. No apply/export/upload mode exists.");
    process.exitCode = 2;
  }
}
