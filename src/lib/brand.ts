export const BRAND = {
  name: "Heal Connect",
  wordmark: "HealConnect",
  tagline: "Give. Receive. Save lives.",
  positioning:
    "One platform to connect people willing to help with people who need legitimate medical donation assistance.",
  supportEmail: "support@healconnect.example",
  shortDescription:
    "Heal Connect links voluntary blood and platelet donors with verified medical donation requests raised by patients and their families — with privacy, dignity and safety built in.",
} as const;

/** Repeated across the product wherever medical boundaries need to be explicit. */
export const MEDICAL_DISCLAIMER =
  "Heal Connect is a coordination platform, not a medical provider. We do not diagnose, screen, approve or reject donors, and we do not replace doctors, hospitals, blood banks or emergency services.";

export const EMERGENCY_DISCLAIMER =
  "In a medical emergency, contact your local emergency services and the hospital blood bank first. Heal Connect cannot provide emergency care or guarantee a donor.";

export const ORGAN_DONATION_NOTICE =
  "Heal Connect does not support organ buying, selling, brokering or any private organ transaction. For organ donation, please use only government-authorised organ donation and transplant systems, and speak with the hospital's transplant coordinator.";

export const PAYMENT_PROHIBITION =
  "Paying for blood, blood components or organs is illegal in many countries and is never allowed here. Requests mentioning payment or compensation are removed, and the account may be suspended.";

export const PRIVACY_PROMISE =
  "Your exact address and contact details are never shown publicly. Contact information is only revealed to a donor or coordinator who is actively matched to a request, and you control what you share.";

export const LEGAL_REVIEW_NOTICE =
  "This document is a working draft prepared for product development and has not been reviewed by legal counsel. It must be reviewed by a qualified lawyer and adapted to your jurisdiction before launch.";

export const SAFETY_RULES: string[] = [
  "Never share medical reports, ID documents or bank details with anyone you met on the platform.",
  "Coordinate through hospital blood banks and licensed blood centres only.",
  "Do not offer or accept any money, gift or favour in exchange for a donation.",
  "Report any request that mentions payment, brokerage or organ trade immediately.",
  "Confirm the hospital and the requirement with the hospital before travelling.",
];
