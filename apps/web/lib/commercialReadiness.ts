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

export type PublicOperatorDisclosure = {
  operatorName: string;
  responsiblePerson: string;
  contact: string;
  contactResponseTarget: string;
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

const freeWebLegalEnvKeys = [
  "LEGAL_BUSINESS_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_CONTACT",
  "LEGAL_CONTACT_RESPONSE_TARGET",
  "LEGAL_TERMS_EFFECTIVE_DATE",
  "LEGAL_PRIVACY_EFFECTIVE_DATE"
] as const;

function value(key: string) {
  return process.env[key]?.trim() ?? "";
}

function enabled(key: string) {
  return value(key).toLowerCase() === "true";
}

export function legalContactHref(contact: string) {
  const normalized = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return `mailto:${normalized}`;
  }
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
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

export function getPublicOperatorDisclosure(): PublicOperatorDisclosure | null {
  if (freeWebLegalEnvKeys.some((key) => !value(key))) return null;
  return {
    operatorName: value("LEGAL_BUSINESS_NAME"),
    responsiblePerson: value("LEGAL_RESPONSIBLE_PERSON"),
    contact: value("LEGAL_CONTACT"),
    contactResponseTarget: value("LEGAL_CONTACT_RESPONSE_TARGET"),
    termsEffectiveDate: value("LEGAL_TERMS_EFFECTIVE_DATE"),
    privacyEffectiveDate: value("LEGAL_PRIVACY_EFFECTIVE_DATE")
  };
}

export function missingFreeWebLegalKeys() {
  return freeWebLegalEnvKeys.filter((key) => !value(key));
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
