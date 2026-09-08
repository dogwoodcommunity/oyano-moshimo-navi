import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createBackupPlan, parseArguments } from "./plan-personal-data-backup.mjs";

// Fixed source files and synthetic identities only. No AWS SDK, credentials,
// dotenv, real backup files, network calls, or infrastructure mutations.
// The small condition matcher below is NOT an IAM simulator: it does not model
// SCPs, boundaries, session policies, service context propagation, S3 state,
// actual conditional-write races, KMS cryptography, or CloudTrail delivery.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "infra/aws-personal-data/backup-vault.cfn.json");
const plannerPath = path.join(root, "scripts/plan-personal-data-backup.mjs");
const account = "111122223333";
const parameters = {
  "AWS::Partition": "aws", "AWS::AccountId": account,
  "AWS::Region": "ap-northeast-1", "AWS::URLSuffix": "amazonaws.com",
  TargetRegion: "ap-northeast-1", BackupBucketName: "synthetic-backup-vault",
  ReceiptBucketName: "synthetic-receipt-vault", AuditBucketName: "synthetic-audit-vault",
  TrailName: "synthetic-vault-trail",
  ...Object.fromEntries(["Collector", "RestoreOperator", "AuditOperator", "Admin"]
    .map((name) => [`${name}RoleArn`, `arn:aws:iam::${account}:role/synthetic-${name}`]))
};
const list = (value) => Array.isArray(value) ? value : [value];
const resourceTypes = {
  BackupWriterRole: "AWS::IAM::Role", RestoreReaderRole: "AWS::IAM::Role", AuditReaderRole: "AWS::IAM::Role",
  BackupKmsKey: "AWS::KMS::Key", AuditKmsKey: "AWS::KMS::Key",
  BackupBucket: "AWS::S3::Bucket", ReceiptBucket: "AWS::S3::Bucket", AuditBucket: "AWS::S3::Bucket",
  BackupBucketPolicy: "AWS::S3::BucketPolicy", ReceiptBucketPolicy: "AWS::S3::BucketPolicy",
  AuditBucketPolicy: "AWS::S3::BucketPolicy", BackupWriterPolicy: "AWS::IAM::Policy",
  RestoreReaderPolicy: "AWS::IAM::Policy", AuditReaderPolicy: "AWS::IAM::Policy", AuditTrail: "AWS::CloudTrail::Trail"
};

function resolve(value, values = parameters) {
  if (Array.isArray(value)) return value.map((item) => resolve(item, values));
  if (!value || typeof value !== "object") return value;
  if (value.Ref) {
    if (Object.hasOwn(values, value.Ref)) return values[value.Ref];
    assert(Object.hasOwn(resourceTypes, value.Ref), "unknown fixture reference");
    return value.Ref.endsWith("Bucket") ? values[`${value.Ref}Name`] : value.Ref;
  }
  if (value["Fn::GetAtt"]) {
    const [name, attribute] = value["Fn::GetAtt"];
    assert.equal(attribute, "Arn");
    if (name.endsWith("Bucket")) return `arn:aws:s3:::${values[`${name}Name`]}`;
    if (name.endsWith("Role")) return `arn:aws:iam::${account}:role/${name}`;
    if (name.endsWith("KmsKey")) return `arn:aws:kms:ap-northeast-1:${account}:key/synthetic-${name}`;
    if (name === "AuditTrail") return `arn:aws:cloudtrail:ap-northeast-1:${account}:trail/${values.TrailName}`;
    assert.fail("unknown fixture attribute");
  }
  if (value["Fn::Sub"]) {
    assert.equal(typeof value["Fn::Sub"], "string", "only string Sub supported in fixtures");
    return value["Fn::Sub"].replace(/\$\{([^}]+)\}/g, (_, name) => resolve(
      name.includes(".") ? { "Fn::GetAtt": name.split(".") } : { Ref: name }, values));
  }
  if (value["Fn::Equals"]) {
    const [left, right] = resolve(value["Fn::Equals"], values);
    return left === right;
  }
  if (value["Fn::Not"]) return !resolve(value["Fn::Not"][0], values);
  if (value["Fn::And"]) return value["Fn::And"].every((item) => resolve(item, values));
  assert(!Object.keys(value).some((key) => key.startsWith("Fn::")), "unsupported fixture intrinsic");
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, values)]));
}

function wildcard(pattern, value, flags = "") {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*").replace(/\?/g, ".")}$`, flags).test(String(value));
}

function conditionsMatch(conditions, context) {
  return Object.entries(conditions ?? {}).every(([operator, entries]) => Object.entries(entries).every(([key, wanted]) => {
    const present = Object.hasOwn(context, key);
    const actual = context[key];
    const expected = list(wanted).map(String);
    switch (operator) {
      case "Null": return expected.includes(String(!present));
      case "Bool": return present && expected.includes(String(actual));
      case "StringEquals": case "ArnEquals": return present && expected.includes(String(actual));
      case "StringNotEquals": return !present || !expected.includes(String(actual));
      case "StringLike": return present && expected.some((pattern) => wildcard(pattern, actual));
      case "NumericLessThan": return present && expected.some((number) => Number(actual) < Number(number));
      default: assert.fail("unsupported fixture condition operator");
    }
  }));
}

function fixtureDecision(statements, request) {
  const applicable = statements.filter((statement) => {
    assert(!statement.NotAction && !statement.NotResource && !statement.NotPrincipal, "unsupported fixture policy form");
    const principal = statement.Principal;
    const principalMatches = !principal || principal === "*"
      || list(principal.AWS ?? principal.Service).includes(request.principal);
    return principalMatches
      && list(statement.Action).some((action) => wildcard(action, request.action, "i"))
      && list(statement.Resource ?? "*").some((resource) => wildcard(resource, request.resource))
      && conditionsMatch(statement.Condition, request.context);
  });
  if (applicable.some((statement) => statement.Effect === "Deny")) return "Deny";
  return applicable.some((statement) => statement.Effect === "Allow") ? "Allow" : "ImplicitDeny";
}

function checkStructure(template) {
  assert.equal(template.AWSTemplateFormatVersion, "2010-09-09");
  assert.deepEqual(Object.keys(template.Resources).sort(), Object.keys(resourceTypes).sort());
  for (const [name, resource] of Object.entries(template.Resources)) {
    assert.equal(resource.Type, resourceTypes[name]);
    assert.equal(resource.Condition, "TokyoOnly");
  }
  assert.deepEqual(template.Parameters.TargetRegion.AllowedValues, ["ap-northeast-1"]);
  assert.equal(resolve(template.Conditions.TokyoOnly), true);
  assert.equal(resolve(template.Conditions.TokyoOnly, { ...parameters, "AWS::Region": "us-east-1" }), false);
  const validateRules = (values) => Object.values(template.Rules)
    .every((rule) => rule.Assertions.every((entry) => resolve(entry.Assert, values)));
  assert.equal(validateRules(parameters), true);
  for (const keys of [["BackupBucketName", "ReceiptBucketName", "AuditBucketName"],
    ["CollectorRoleArn", "RestoreOperatorRoleArn", "AuditOperatorRoleArn", "AdminRoleArn"]]) {
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      assert.equal(validateRules({ ...parameters, [keys[j]]: parameters[keys[i]] }), false, "identities must remain distinct");
    }
  }
  for (const [name, days, key] of [["BackupBucket", 30, "BackupKmsKey"],
    ["ReceiptBucket", 180, "BackupKmsKey"], ["AuditBucket", 180, "AuditKmsKey"]]) {
    const resource = template.Resources[name];
    const properties = resource.Properties;
    assert.equal(resource.DeletionPolicy, "Retain");
    assert.equal(resource.UpdateReplacePolicy, "Retain");
    assert.deepEqual(properties.PublicAccessBlockConfiguration, {
      BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true
    });
    assert.deepEqual(properties.OwnershipControls.Rules, [{ ObjectOwnership: "BucketOwnerEnforced" }]);
    assert.equal(properties.VersioningConfiguration.Status, "Enabled");
    assert(!properties.AccessControl && !properties.WebsiteConfiguration && !properties.CorsConfiguration);
    assert.deepEqual(properties.BucketEncryption.ServerSideEncryptionConfiguration, [{
      BucketKeyEnabled: true, ServerSideEncryptionByDefault: { SSEAlgorithm: "aws:kms", KMSMasterKeyID: { "Fn::GetAtt": [key, "Arn"] } }
    }]);
    const rules = properties.LifecycleConfiguration.Rules;
    assert(rules.every((rule) => rule.Status === "Enabled"));
    assert(rules.some((rule) => rule.ExpirationInDays === days && rule.NoncurrentVersionExpiration?.NoncurrentDays === 1));
    assert(rules.some((rule) => rule.AbortIncompleteMultipartUpload?.DaysAfterInitiation === 1));
    assert(rules.some((rule) => rule.ExpiredObjectDeleteMarker === true));
  }
  assert.equal(template.Resources.BackupBucket.Properties.ObjectLockEnabled, true);
  assert.deepEqual(template.Resources.BackupBucket.Properties.ObjectLockConfiguration.Rule.DefaultRetention, { Mode: "GOVERNANCE", Days: 7 });
  for (const name of ["ReceiptBucket", "AuditBucket"]) assert(!template.Resources[name].Properties.ObjectLockEnabled);
  for (const name of ["BackupKmsKey", "AuditKmsKey"]) {
    const resource = template.Resources[name];
    assert.equal(resource.DeletionPolicy, "Retain");
    assert.equal(resource.UpdateReplacePolicy, "Retain");
    assert.equal(resource.Properties.EnableKeyRotation, true);
    assert.equal(resource.Properties.MultiRegion, false);
    assert.equal(resource.Properties.KeySpec, "SYMMETRIC_DEFAULT");
    assert.equal(resource.Properties.PendingWindowInDays, 30);
  }
  for (const [name, source] of [["BackupWriterRole", "CollectorRoleArn"],
    ["RestoreReaderRole", "RestoreOperatorRoleArn"], ["AuditReaderRole", "AuditOperatorRoleArn"]]) {
    const properties = template.Resources[name].Properties;
    assert.equal(properties.MaxSessionDuration, 3600);
    assert.equal(properties.Policies, undefined, "permissions belong in inspected standalone policies");
    assert.equal(properties.ManagedPolicyArns, undefined);
    assert.deepEqual(properties.AssumeRolePolicyDocument.Statement.map(({ Sid: _sid, ...statement }) => statement),
      [{ Effect: "Allow", Principal: { AWS: { Ref: source } }, Action: "sts:AssumeRole" }]);
  }
  const graph = Object.fromEntries(Object.entries(template.Resources).map(([name, resource]) => {
    const dependencies = new Set(list(resource.DependsOn ?? []).filter(Boolean));
    function visit(value) {
      if (!value || typeof value !== "object") return;
      if (value.Ref && template.Resources[value.Ref]) dependencies.add(value.Ref);
      if (value["Fn::GetAtt"]) dependencies.add(value["Fn::GetAtt"][0]);
      if (typeof value["Fn::Sub"] === "string") for (const match of value["Fn::Sub"].matchAll(/\$\{([\w]+)(?:\.[^}]+)?\}/g)) {
        if (template.Resources[match[1]]) dependencies.add(match[1]);
      }
      Object.values(value).forEach(visit);
    }
    visit(resource);
    return [name, dependencies];
  }));
  const done = new Set();
  const active = new Set();
  function walk(name) {
    assert(!active.has(name), "resource dependency cycle");
    if (done.has(name)) return;
    assert(graph[name], "unknown resource dependency");
    active.add(name); graph[name].forEach(walk); active.delete(name); done.add(name);
  }
  Object.keys(graph).forEach(walk);
}

function checkPolicies(template) {
  const resources = resolve(template.Resources);
  const statements = (name) => resources[name].Properties.PolicyDocument.Statement;
  const keyStatements = (name) => resources[name].Properties.KeyPolicy.Statement;
  const arn = (name) => resolve({ "Fn::GetAtt": [name, "Arn"] });
  const secure = { "aws:SecureTransport": "true", "aws:PrincipalIsAWSService": "false", "s3:TlsVersion": 1.2 };
  let fixtureCount = 0;
  function expect(policy, request, result) { fixtureCount++; assert.equal(fixtureDecision(policy, request), result); }
  for (const [bucket, prefix] of [["BackupBucket", "backups"], ["ReceiptBucket", "receipts"]]) {
    const bucketPolicy = statements(`${bucket}Policy`);
    const policy = [...statements("BackupWriterPolicy"), ...bucketPolicy];
    const request = { principal: arn("BackupWriterRole"), action: "s3:PutObject", resource: `${arn(bucket)}/${prefix}/opaque-run/file`,
      context: { ...secure, "aws:PrincipalArn": arn("BackupWriterRole"), "s3:ObjectCreationOperation": "true", "s3:if-none-match": "*" } };
    const change = (context) => ({ ...request, context: { ...request.context, ...context } });
    const withoutConditional = { ...request.context }; delete withoutConditional["s3:if-none-match"];
    expect(policy, request, "Allow"); // Only policy matching, not a successful S3 write.
    expect(policy, { ...request, context: withoutConditional }, "Deny");
    expect(policy, change({ "s3:if-none-match": "some-etag" }), "Deny");
    expect(policy, { ...request, context: { ...withoutConditional, "s3:ObjectCreationOperation": "false" } }, "Allow");
    expect(policy, change({ "aws:SecureTransport": "false" }), "Deny");
    expect(policy, change({ "s3:TlsVersion": 1.1 }), "Deny");
    expect(policy, change({ "s3:x-amz-server-side-encryption": "AES256" }), "Deny");
    expect(policy, change({ "s3:x-amz-server-side-encryption": "aws:kms" }), "Deny");
    expect(policy, change({ "s3:x-amz-server-side-encryption": "aws:kms", "s3:x-amz-server-side-encryption-aws-kms-key-id": arn("BackupKmsKey") }), "Allow");
    expect(policy, change({ "s3:x-amz-server-side-encryption": "aws:kms", "s3:x-amz-server-side-encryption-aws-kms-key-id": arn("AuditKmsKey") }), "Deny");
    expect(policy, change({ "s3:x-amz-server-side-encryption-customer-algorithm": "AES256" }), "Deny");
    expect(policy, { ...request, resource: `${arn(bucket)}/outside-prefix/file` }, "ImplicitDeny");
    for (const action of ["s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject", "s3:DeleteObjectVersion",
      "s3:PutObjectRetention", "s3:PutObjectLegalHold", "s3:BypassGovernanceRetention"]) {
      // Add a synthetic broad identity grant so an omitted explicit Deny cannot
      // pass merely because the actual writer has no matching Allow.
      expect([...bucketPolicy, { Effect: "Allow", Action: "s3:*", Resource: "*" }], { ...request, action }, "Deny");
    }
    for (const action of ["s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]) expect(policy, { ...request, action }, "Allow");
    expect(policy, { ...request, action: "s3:ListBucket", resource: arn(bucket), context: { ...secure, "s3:prefix": `${prefix}/` } }, "Allow");
    expect(policy, { ...request, action: "s3:ListBucket", resource: arn(bucket), context: { ...secure, "s3:prefix": "" } }, "ImplicitDeny");
    expect([...statements("RestoreReaderPolicy"), ...bucketPolicy], {
      ...request, principal: arn("RestoreReaderRole"), action: "s3:GetObjectVersion",
      context: { ...secure, "aws:PrincipalArn": arn("RestoreReaderRole") }
    }, "Allow");
  }
  const allowedActions = {
    BackupWriterPolicy: ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts", "s3:ListBucket", "kms:GenerateDataKey", "kms:Decrypt"],
    RestoreReaderPolicy: ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket", "s3:ListBucketVersions", "kms:Decrypt"],
    AuditReaderPolicy: ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket", "s3:ListBucketVersions", "kms:Decrypt"]
  };
  for (const [name, allowed] of Object.entries(allowedActions)) for (const statement of statements(name)) {
    assert.equal(statement.Effect, "Allow");
    assert(list(statement.Action).every((action) => allowed.includes(action)), "unexpected identity action");
    assert(!list(statement.Resource).includes("*"), "identity resources must be scoped");
  }
  for (const [role, policyName] of [["BackupWriterRole", "BackupWriterPolicy"], ["RestoreReaderRole", "RestoreReaderPolicy"]]) {
    const policy = [...keyStatements("BackupKmsKey"), ...statements(policyName)];
    const request = { principal: arn(role), action: "kms:Decrypt", resource: arn("BackupKmsKey"), context: {
      "kms:ViaService": "s3.ap-northeast-1.amazonaws.com", "kms:CallerAccount": account,
      "kms:EncryptionContext:aws:s3:arn": arn("BackupBucket")
    } };
    expect(policy, request, "Allow");
    expect(policy, { ...request, context: { ...request.context, "kms:EncryptionContext:aws:s3:arn": arn("AuditBucket") } }, "ImplicitDeny");
    const direct = { ...request.context }; delete direct["kms:ViaService"];
    expect(policy, { ...request, context: direct }, "ImplicitDeny");
  }
  const trail = resources.AuditTrail.Properties;
  assert.equal(trail.IsLogging, true); assert.equal(trail.EnableLogFileValidation, true);
  assert.equal(trail.IsMultiRegionTrail, false); assert.equal(trail.IncludeGlobalServiceEvents, true);
  assert.equal(trail.KMSKeyId, arn("AuditKmsKey")); assert.equal(trail.S3BucketName, parameters.AuditBucketName);
  assert(template.Resources.AuditTrail.DependsOn.includes("AuditBucketPolicy"));
  const selection = (bucket) => trail.EventSelectors.filter((selector) => selector.DataResources
    .some((data) => data.Type === "AWS::S3::Object" && data.Values.includes(`${arn(bucket)}/`)));
  for (const bucket of ["BackupBucket", "ReceiptBucket"]) {
    assert.equal(selection(bucket).length, 1); assert.equal(selection(bucket)[0].ReadWriteType, "All");
    assert.equal(selection(bucket)[0].IncludeManagementEvents, true);
  }
  assert.equal(selection("AuditBucket").length, 1);
  assert.equal(selection("AuditBucket")[0].ReadWriteType, "ReadOnly");
  assert.equal(selection("AuditBucket")[0].IncludeManagementEvents, false);
  const delivery = { principal: "cloudtrail.amazonaws.com", action: "s3:PutObject",
    resource: `${arn("AuditBucket")}/cloudtrail/AWSLogs/${account}/CloudTrail/synthetic.json.gz`,
    context: { "aws:PrincipalIsAWSService": "true", "s3:x-amz-acl": "bucket-owner-full-control",
      "aws:SourceAccount": account, "aws:SourceArn": arn("AuditTrail"), "s3:x-amz-server-side-encryption": "AES256" } };
  expect(statements("AuditBucketPolicy"), delivery, "Allow");
  expect(statements("AuditBucketPolicy"), { ...delivery, context: { ...delivery.context, "aws:SourceArn": "arn:aws:cloudtrail:ap-northeast-1:999999999999:trail/other" } }, "ImplicitDeny");
  const auditRead = { principal: arn("AuditReaderRole"), action: "kms:Decrypt", resource: arn("AuditKmsKey"), context: {
    "kms:ViaService": "s3.ap-northeast-1.amazonaws.com", "kms:CallerAccount": account,
    "kms:EncryptionContext:aws:cloudtrail:arn": arn("AuditTrail")
  } };
  const auditPolicy = [...keyStatements("AuditKmsKey"), ...statements("AuditReaderPolicy")];
  expect(auditPolicy, auditRead, "Allow");
  expect(auditPolicy, { ...auditRead, context: { ...auditRead.context, "kms:ViaService": "s3.us-east-1.amazonaws.com" } }, "ImplicitDeny");
  expect(auditPolicy, { ...auditRead, context: { "kms:ViaService": "s3.ap-northeast-1.amazonaws.com",
    "kms:CallerAccount": account, "kms:EncryptionContext:aws:s3:arn": arn("AuditBucket") } }, "Allow");
  return fixtureCount;
}

function checkPlanner() {
  const plan = createBackupPlan();
  assert.equal(plan.mode, "OFFLINE_DESIGN_ONLY"); assert.equal(plan.deployment, "NOT_CREATED");
  assert.equal(plan.productionData, "NOT_ACCESSED"); assert.equal(plan.productionAcceptance, "NO_GO");
  assert.equal(plan.notASpendingCap, true); assert.equal(plan.assumptions.customerManagedKeys, 2);
  assert.equal(plan.assumptions.freeTierAndCreditsApplied, false);
  assert.equal(plan.estimatedMonthlyUsd.foundationBaseSubtotal, 2.25);
  assert.equal(plan.estimatedMonthlyUsd.possibleAdditionalKeyMaterialAfterTwoRotationsPerKey, 4);
  assert(plan.requiredBeforePersonalData.some((item) => item.includes("approve data export scope")));
  assert(!plan.requiredBeforePersonalData.some((item) => item.includes("production-backup restore")));
  assert(plan.requiredBeforeProductionAcceptance.some((item) => item.includes("production-backup restore with deletion replay")));
  assert.equal(parseArguments(["--plan", "--retained-gb", "100"]).estimatedMonthlyUsd.foundationBaseSubtotal, 4.5);
  assert.equal(createBackupPlan({ retainedGb: 300 }).estimatedMonthlyUsd.foundationStorage, 7.5);
  for (const args of [[], ["--apply"], ["--upload"], ["--plan", "--input", "synthetic.dump"],
    ["--plan", "--retained-gb"], ["--plan", "--retained-gb", "NaN"], ["--plan", "--retained-gb", "-1"],
    ["--plan", "--daily-minutes", "0"], ["--plan", "--daily-minutes", "1441"],
    ["--plan", "--retained-gb", "1", "--retained-gb", "2"]]) assert.throws(() => parseArguments(args));
  for (const options of [{ retainedGb: Infinity }, { retainedGb: 50_001 }, { dailyMinutes: NaN }]) {
    assert.throws(() => createBackupPlan(options));
  }
  // Run only the fixed local planner with an empty credential environment. Never
  // pass parent environment variables or echo child output when assertions fail.
  const run = (args) => spawnSync(process.execPath, [plannerPath, ...args], {
    cwd: root, env: { TZ: "UTC" }, encoding: "utf8", timeout: 5_000,
    stdio: ["ignore", "pipe", "pipe"], maxBuffer: 128 * 1024
  });
  const valid = run(["--plan"]);
  assert.equal(valid.error, undefined); assert.equal(valid.status, 0);
  assert.equal(JSON.parse(valid.stdout).deployment, "NOT_CREATED");
  const marker = "SYNTHETIC_DO_NOT_ECHO_9182";
  const invalid = run(["--apply", marker]);
  assert.equal(invalid.error, undefined); assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, ""); assert(!invalid.stderr.includes(marker));
  assert(invalid.stderr.startsWith("Usage: node scripts/plan-personal-data-backup.mjs --plan"));
}

let phase = "read-fixed-template";
try {
  assert.equal(process.argv.length, 2, "this test accepts no input paths or modes");
  const templateSource = fs.readFileSync(templatePath, "utf8");
  assert(Buffer.byteLength(templateSource, "utf8") <= 51_200, "template must fit CloudFormation TemplateBody limit");
  const template = JSON.parse(templateSource);
  phase = "structure-and-region"; checkStructure(template);
  phase = "policy-fixtures"; const policyFixtures = checkPolicies(template);
  const mutations = [
    ["public-access-block-disabled", (copy) => { copy.Resources.BackupBucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy = false; }],
    ["region-guard-removed", (copy) => { delete copy.Resources.ReceiptBucket.Condition; }],
    ["trust-principal-widened", (copy) => { copy.Resources.BackupWriterRole.Properties.AssumeRolePolicyDocument.Statement[0].Principal.AWS = "*"; }],
    ["retention-shortened", (copy) => { copy.Resources.BackupBucket.Properties.LifecycleConfiguration.Rules[0].ExpirationInDays = 1; }],
    ["writer-deny-removed", (copy) => { copy.Resources.BackupBucketPolicy.Properties.PolicyDocument.Statement = copy.Resources.BackupBucketPolicy.Properties.PolicyDocument.Statement.filter((item) => item.Sid !== "DenyWriterReadDeleteAndRetentionChanges"); }],
    ["conditional-denies-removed", (copy) => { copy.Resources.ReceiptBucketPolicy.Properties.PolicyDocument.Statement = copy.Resources.ReceiptBucketPolicy.Properties.PolicyDocument.Statement.filter((item) => !item.Sid.startsWith("DenyObjectCreation")); }],
    ["multipart-exemption-removed", (copy) => { for (const statement of copy.Resources.BackupBucketPolicy.Properties.PolicyDocument.Statement) if (statement.Sid.startsWith("DenyObjectCreation")) delete statement.Condition.Bool; }],
    ["tls-floor-removed", (copy) => { copy.Resources.BackupBucketPolicy.Properties.PolicyDocument.Statement = copy.Resources.BackupBucketPolicy.Properties.PolicyDocument.Statement.filter((item) => item.Sid !== "DenyTlsBelow12"); }],
    ["audit-self-writes-enabled", (copy) => { copy.Resources.AuditTrail.Properties.EventSelectors[1].ReadWriteType = "All"; }],
    ["dependency-cycle-added", (copy) => { copy.Resources.BackupWriterRole.DependsOn = ["BackupKmsKey"]; }]
  ];
  for (const [name, mutate] of mutations) {
    phase = `negative-control:${name}`;
    const copy = structuredClone(template); mutate(copy);
    assert.throws(() => { checkStructure(copy); checkPolicies(copy); }, "intentional security regression was not detected");
  }
  phase = "offline-planner"; checkPlanner();
  console.log(JSON.stringify({ result: "OFFLINE_INFRA_REGRESSION_PASS", resources: 15,
    policyFixtures, mutationNegativeControls: mutations.length, planner: "PASS",
    scope: "SOURCE_AND_SYNTHETIC_CONDITION_MATCHING_ONLY", awsIamBehavior: "NOT_TESTED",
    cloudTrailDelivery: "NOT_TESTED", actualConditionalWrites: "NOT_TESTED", deployment: "NOT_CREATED",
    productionData: "NOT_ACCESSED", networkCalls: 0, credentialsRead: false }));
} catch {
  // No template content, arbitrary CLI arguments, child output, or credentials.
  console.error(JSON.stringify({ result: "OFFLINE_INFRA_REGRESSION_FAIL", phase, awsIamBehavior: "NOT_TESTED" }));
  process.exitCode = 1;
}
