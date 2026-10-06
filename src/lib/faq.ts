export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: "general" | "donors" | "recipients" | "safety";
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-heal-connect",
    category: "general",
    question: "What exactly does Heal Connect do?",
    answer:
      "Heal Connect connects people who are willing to help with people who need legitimate medical donation assistance. Recipients (or their family, friends or hospital coordinators) raise a clear request for blood, platelets or other medical assistance. Donors who may be relevant are shown matching requests, can offer help, and then coordinate directly with the requesting hospital or blood bank. Everything medical — screening, eligibility, cross-matching, the donation itself — stays with licensed professionals.",
  },
  {
    id: "medical-decision",
    category: "general",
    question: "Does Heal Connect decide whether I can donate?",
    answer:
      "No. Heal Connect never makes a medical eligibility decision. We only use general red-blood-cell compatibility information to show potentially relevant requests, and we clearly mark it as general information. The hospital or blood bank always confirms compatibility and eligibility before any donation.",
  },
  {
    id: "emergency",
    category: "general",
    question: "Can I use Heal Connect for a medical emergency?",
    answer:
      "Emergency requests are supported and are highlighted with priority, but they are not a substitute for emergency care. In an emergency, first contact your local emergency services and the hospital blood bank. Heal Connect cannot dispatch help, provide treatment or guarantee that a donor will be available.",
  },
  {
    id: "cost",
    category: "safety",
    question: "Is there any cost to use the platform?",
    answer:
      "No. Heal Connect is free to use for both donors and recipients. Paying for blood, blood components or organs is illegal in many jurisdictions and is never allowed here. Any request asking for payment, compensation or brokerage is removed and the account may be suspended.",
  },
  {
    id: "organs",
    category: "safety",
    question: "Can I find or offer an organ donation here?",
    answer:
      "No. Heal Connect does not support organ buying, selling, brokering or any private organ transaction. If you need information about organ donation, we direct you to government-authorised organ donation and transplant systems and the hospital's transplant coordinator only.",
  },
  {
    id: "donor-eligibility",
    category: "donors",
    question: "How do I know if I can donate blood?",
    answer:
      "Only a qualified medical professional can answer that. Blood banks check haemoglobin, weight, blood pressure, medication, recent travel and other factors. Our donor profile asks about preferences and availability so we can show relevant requests — it is not a medical screening and it never replaces the blood bank's assessment.",
  },
  {
    id: "donation-interval",
    category: "donors",
    question: "Is there a minimum gap between blood donations?",
    answer:
      "Blood banks in most countries require an interval between whole-blood donations (commonly around three months, and shorter for platelets or plasma). If your last donation was recent, we show a reminder — but the blood bank's rule for your case is the one that applies.",
  },
  {
    id: "privacy",
    category: "safety",
    question: "Will my phone number and address be public?",
    answer:
      "No. Your exact address is never stored on a request or shown publicly. Requests show a city and area only. Contact details are shared with a donor or coordinator only when a request is connected to them, and you control whether your phone number is shareable from Settings.",
  },
  {
    id: "verification",
    category: "safety",
    question: "What does the verified badge mean?",
    answer:
      "A verified badge means the account was reviewed by our trust & safety team (in this MVP, by an administrator). It distinguishes verified information — for example, a hospital, blood bank or NGO account — from self-reported details. It is not a medical certification of a donor, and it does not guarantee a successful donation.",
  },
  {
    id: "request-help",
    category: "recipients",
    question: "How do I raise a request for someone else?",
    answer:
      "You can raise a request for a family member, friend or patient you are coordinating for. We ask for the patient's blood group requirement, hospital, city and area, the date help is needed and how the donor should coordinate. Please get consent from the patient or their family before sharing any of their details.",
  },
  {
    id: "no-donors",
    category: "recipients",
    question: "What if no donor responds to my request?",
    answer:
      "Matching donors nearby are notified automatically, and you can share the request reference with people you trust. Our team also monitors emergency and extended requests in the admin workspace. In a clinical emergency, the hospital blood bank and emergency services remain your fastest route.",
  },
  {
    id: "data",
    category: "general",
    question: "What data does Heal Connect store?",
    answer:
      "We store your account details, the profile information you provide (city, area, blood group, availability and preferences) and the requests and offers you make. We never ask for ID documents, medical reports or bank details. You can review exactly what is stored in Settings, and the Privacy Policy explains the retention approach in detail.",
  },
];

export const LANDING_FAQ_IDS = [
  "what-is-heal-connect",
  "medical-decision",
  "emergency",
  "cost",
  "privacy",
  "verification",
];
