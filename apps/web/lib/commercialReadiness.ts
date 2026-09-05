import "server-only";

export type LegalDisclosure = {
  businessName: string;
  responsiblePerson: string;
  address: string;
  phone: string;
  phoneHours: string;
  contact: string;
  contactResponseTarget: string;
  priceDescription: string;
  serviceDelivery: string;
  cancellationPolicy: string;
};

export type PublicOperatorContact = {
  operatorName: string;
  responsiblePerson: string;
  contact: string;
  contactResponseTarget: string;
};

export type PublicOperatorDisclosure = PublicOperatorContact & {
  termsEffectiveDate: string;
  privacyEffectiveDate: string;
};

const legalEnvKeys = [
  "LEGAL_BUSINESS_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_ADDRESS",
  "LEGAL_PHONE",
  "LEGAL_PHONE_HOURS",
  "LEGAL_CONTACT",
  "LEGAL_CONTACT_RESPONSE_TARGET",
  "LEGAL_PRICE_DESCRIPTION",
  "LEGAL_SERVICE_DELIVERY",
  "LEGAL_CANCELLATION_POLICY"
] as const;

const publicOperatorContactEnvKeys = [
  "LEGAL_BUSINESS_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_CONTACT",
  "LEGAL_CONTACT_RESPONSE_TARGET"
] as const;

const freeWebLegalEnvKeys = [
  ...publicOperatorContactEnvKeys,
  "LEGAL_TERMS_EFFECTIVE_DATE",
  "LEGAL_PRIVACY_EFFECTIVE_DATE"
] as const;

function value(key: string) {
  return process.env[key]?.trim() ?? "";
}

function enabled(key: string) {
  return value(key).toLowerCase() === "true";
}

export function isValidLegalEffectiveDate(input: string) {
  const match = /^(20\d{2})年([1-9]|1[0-2])月([1-9]|[12]\d|3[01])日$/.exec(input.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function freeWebLegalValueReady(key: (typeof freeWebLegalEnvKeys)[number]) {
  const current = value(key);
  if (key === "LEGAL_TERMS_EFFECTIVE_DATE" || key === "LEGAL_PRIVACY_EFFECTIVE_DATE") {
    return isValidLegalEffectiveDate(current);
  }
  if (key === "LEGAL_CONTACT") return Boolean(legalContactHref(current));
  return Boolean(current);
}

export function legalContactHref(contact: string) {
  const normalized = contact.trim();
  if (/[\r\n]/.test(normalized)) return null;
  // Accept a conservative business-mailbox form, not mailto query fragments
  // or URLs containing user-info that happen to contain an @ sign.
  if (/^[A-Za-z0-9._+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(normalized)) {
    return `mailto:${normalized}`;
  }
  try {
    const url = new URL(normalized);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getLegalDisclosure(): LegalDisclosure | null {
  if (legalEnvKeys.some((key) => !value(key))) return null;
  return {
    businessName: value("LEGAL_BUSINESS_NAME"),
    responsiblePerson: value("LEGAL_RESPONSIBLE_PERSON"),
    address: value("LEGAL_ADDRESS"),
    phone: value("LEGAL_PHONE"),
    phoneHours: value("LEGAL_PHONE_HOURS"),
    contact: value("LEGAL_CONTACT"),
    contactResponseTarget: value("LEGAL_CONTACT_RESPONSE_TARGET"),
    priceDescription: value("LEGAL_PRICE_DESCRIPTION"),
    serviceDelivery: value("LEGAL_SERVICE_DELIVERY"),
    cancellationPolicy: value("LEGAL_CANCELLATION_POLICY")
  };
}

export function missingLegalDisclosureKeys() {
  return legalEnvKeys.filter((key) => !value(key));
}

// A confirmed contact must not disappear while the formal release date is
// still pending. This is not the readiness check for paid or formal release.
export function getPublicOperatorContact(): PublicOperatorContact | null {
  if (publicOperatorContactEnvKeys.some((key) => !freeWebLegalValueReady(key))) return null;
  return {
    operatorName: value("LEGAL_BUSINESS_NAME"),
    responsiblePerson: value("LEGAL_RESPONSIBLE_PERSON"),
    contact: value("LEGAL_CONTACT"),
    contactResponseTarget: value("LEGAL_CONTACT_RESPONSE_TARGET")
  };
}

export function getPublicOperatorDisclosure(): PublicOperatorDisclosure | null {
  const operator = getPublicOperatorContact();
  if (!operator || freeWebLegalEnvKeys.some((key) => !freeWebLegalValueReady(key))) return null;
  return {
    ...operator,
    termsEffectiveDate: value("LEGAL_TERMS_EFFECTIVE_DATE"),
    privacyEffectiveDate: value("LEGAL_PRIVACY_EFFECTIVE_DATE")
  };
}

export function missingFreeWebLegalKeys() {
  return freeWebLegalEnvKeys.filter((key) => !freeWebLegalValueReady(key));
}

export function plusSalesReady() {
  return Boolean(
    enabled("COMMERCIAL_PLUS_SALES_ENABLED")
    && getLegalDisclosure()
    && getPublicOperatorDisclosure()
    && value("STRIPE_SECRET_KEY")
    && value("STRIPE_PLUS_PRICE_ID")
    && value("STRIPE_WEBHOOK_SECRET")
    && value("NEXT_PUBLIC_PLUS_PRICE_LABEL")
  );
}

export function supportPackSalesReady() {
  return Boolean(
    enabled("COMMERCIAL_SUPPORT_PACK_SALES_ENABLED")
    && getLegalDisclosure()
    && getPublicOperatorDisclosure()
    && value("STRIPE_SECRET_KEY")
    && value("STRIPE_SUPPORT_PACK_PRICE_ID")
    && value("STRIPE_WEBHOOK_SECRET")
  );
}
