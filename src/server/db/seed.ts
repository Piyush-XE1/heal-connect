import { offsetPoint, cityCoordinates } from "@/lib/cities";
import type {
  Availability,
  BloodGroup,
  DonationPreference,
  OrganizationType,
  RequestType,
  ResponseStatus,
  Urgency,
  UserRole,
  VerificationStatus,
} from "@/lib/domain";

import { hashPassword } from "../auth/crypto";
import type { Database } from "./types";

/**
 * Demo dataset.
 *
 * Every seeded record carries `isDemo: true`, which the interface surfaces as a
 * "Demo" badge so sample data can never be confused with real community data.
 * Demo accounts are listed on the sign-in screen with their credentials.
 *
 * Phone numbers are obviously synthetic (+91 90000 0xxxx) so no real person can
 * be reached through the sample data.
 */

export const DEMO_PASSWORD = "demo1234";
export const DEMO_ADMIN_PASSWORD = "admin1234";

type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  city: string;
  area: string;
  age: number;
  bio: string;
  bloodGroup?: BloodGroup;
  availability?: Availability;
  lastDonationDaysAgo?: number;
  preferences?: DonationPreference[];
  verification?: VerificationStatus;
  organizationType?: OrganizationType;
  organizationName?: string;
  isAdmin?: boolean;
  isSuspended?: boolean;
  suspendedReason?: string;
  onboardingComplete?: boolean;
  sharedPhone?: boolean;
  createdDaysAgo: number;
};

const DEMO_USERS: DemoUser[] = [
  {
    id: "usr_demo_donor",
    name: "Aditi Rao",
    email: "donor@healconnect.demo",
    role: "donor",
    city: "Ghaziabad",
    area: "Indirapuram",
    age: 29,
    bio: "Software engineer, regular whole-blood donor. Happy to travel across Ghaziabad and Noida.",
    bloodGroup: "O+",
    availability: "available",
    lastDonationDaysAgo: 132,
    preferences: ["whole_blood"],
    verification: "verified",
    organizationType: "individual_donor",
    sharedPhone: true,
    createdDaysAgo: 96,
  },
  {
    id: "usr_demo_recipient",
    name: "Rahul Deshmukh",
    email: "recipient@healconnect.demo",
    role: "recipient",
    city: "Ghaziabad",
    area: "Vaishali",
    age: 41,
    bio: "Coordinating donation support for my father's treatment at a Ghaziabad hospital.",
    verification: "verified",
    organizationType: "individual_donor",
    sharedPhone: true,
    createdDaysAgo: 42,
  },
  {
    id: "usr_demo_both",
    name: "Ishaan Kulkarni",
    email: "both@healconnect.demo",
    role: "both",
    city: "Noida",
    area: "Sector 62",
    age: 34,
    bio: "Recovered patient who now donates platelets every few months. Also coordinating for a family member.",
    bloodGroup: "B+",
    availability: "on_hold",
    lastDonationDaysAgo: 38,
    preferences: ["platelets", "whole_blood"],
    verification: "verified",
    organizationType: "individual_donor",
    sharedPhone: true,
    createdDaysAgo: 120,
  },
  {
    id: "usr_demo_admin",
    name: "Platform Admin",
    email: "admin@healconnect.demo",
    role: "both",
    verification: "verified",
    organizationType: "patient_support_org",
    organizationName: "Heal Connect Trust & Safety",
    isAdmin: true,
    city: "Ghaziabad",
    area: "Raj Nagar Extension",
    age: 35,
    bio: "Operations and trust & safety team account for the demo workspace.",
    sharedPhone: false,
    createdDaysAgo: 180,
  },
  {
    id: "usr_demo_aarav",
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    role: "donor",
    city: "Ghaziabad",
    area: "Kavi Nagar",
    age: 26,
    bio: "Final-year student. Available on weekends.",
    bloodGroup: "O-",
    availability: "available",
    lastDonationDaysAgo: 210,
    preferences: ["whole_blood"],
    verification: "verified",
    organizationType: "individual_donor",
    createdDaysAgo: 150,
  },
  {
    id: "usr_demo_priya",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    role: "both",
    city: "Noida",
    area: "Sector 137",
    age: 31,
    bio: "Nurse coordinating platelet donations for paediatric patients.",
    bloodGroup: "B+",
    availability: "available",
    lastDonationDaysAgo: 61,
    preferences: ["platelets", "plasma"],
    verification: "verified",
    organizationType: "blood_bank",
    organizationName: "Lifeline Blood Centre (Noida)",
    createdDaysAgo: 210,
  },
  {
    id: "usr_demo_kabir",
    name: "Kabir Khan",
    email: "kabir.khan@example.com",
    role: "donor",
    city: "Delhi",
    area: "Saket",
    age: 38,
    bio: "O negative donor — reachable for emergencies across Delhi NCR.",
    bloodGroup: "O-",
    availability: "available",
    lastDonationDaysAgo: 118,
    preferences: ["whole_blood", "platelets"],
    verification: "verified",
    organizationType: "individual_donor",
    createdDaysAgo: 260,
  },
  {
    id: "usr_demo_ananya",
    name: "Ananya Iyer",
    email: "ananya.iyer@example.com",
    role: "donor",
    city: "Chennai",
    area: "Adyar",
    age: 24,
    bio: "First-time donor, learning how donation works.",
    bloodGroup: "A+",
    availability: "on_hold",
    preferences: ["whole_blood"],
    verification: "unverified",
    createdDaysAgo: 18,
  },
  {
    id: "usr_demo_meera",
    name: "Meera Kapoor",
    email: "meera.kapoor@example.com",
    role: "recipient",
    city: "Mumbai",
    area: "Andheri",
    age: 47,
    bio: "Coordinating for my sister's surgery. Verification submitted, waiting for review.",
    verification: "pending",
    organizationType: "individual_donor",
    createdDaysAgo: 9,
  },
  {
    id: "usr_demo_arjun",
    name: "Arjun Mehta",
    email: "arjun.mehta@example.com",
    role: "both",
    city: "Hyderabad",
    area: "Gachibowli",
    age: 36,
    bio: "IT professional. Regular donor, and I coordinate for a dialysis support group.",
    bloodGroup: "A-",
    availability: "available",
    lastDonationDaysAgo: 96,
    preferences: ["whole_blood", "plasma"],
    verification: "verified",
    organizationType: "ngo",
    organizationName: "Hyderabad Dialysis Support Circle",
    createdDaysAgo: 300,
  },
  {
    id: "usr_demo_fatima",
    name: "Fatima Sheikh",
    email: "fatima.sheikh@example.com",
    role: "donor",
    city: "Bengaluru",
    area: "Jayanagar",
    age: 33,
    bio: "AB negative donor. Also happy to help with plasma requests.",
    bloodGroup: "AB-",
    availability: "available",
    lastDonationDaysAgo: 172,
    preferences: ["whole_blood"],
    verification: "verified",
    organizationType: "individual_donor",
    createdDaysAgo: 175,
  },
  {
    id: "usr_demo_sanjay",
    name: "Sanjay Rao",
    email: "sanjay.rao@example.com",
    role: "donor",
    city: "Pune",
    area: "Baner",
    age: 45,
    bio: "Donating since college. Prefer hospital blood centres.",
    bloodGroup: "B+",
    availability: "available",
    lastDonationDaysAgo: 240,
    preferences: ["whole_blood"],
    verification: "verified",
    organizationType: "individual_donor",
    createdDaysAgo: 320,
  },
  {
    id: "usr_demo_nisha",
    name: "Nisha Patel",
    email: "nisha.patel@example.com",
    role: "recipient",
    city: "Ahmedabad",
    area: "Satellite",
    age: 39,
    bio: "Blood bank coordinator verifying community requests for thalassaemia patients.",
    verification: "verified",
    organizationType: "blood_bank",
    organizationName: "Sabarmati Blood Centre",
    createdDaysAgo: 140,
  },
  {
    id: "usr_demo_divya",
    name: "Divya Menon",
    email: "divya.menon@example.com",
    role: "recipient",
    city: "Kochi",
    area: "Kakkanad",
    age: 28,
    bio: "Helping a colleague's family find donors in Kochi.",
    verification: "unverified",
    createdDaysAgo: 6,
  },
  {
    id: "usr_demo_rakesh",
    name: "Rakesh Gupta",
    email: "rakesh.gupta@example.com",
    role: "donor",
    city: "Lucknow",
    area: "Gomti Nagar",
    age: 52,
    bio: "Available on weekends for blood donation drives in Lucknow.",
    bloodGroup: "O+",
    availability: "unavailable",
    lastDonationDaysAgo: 40,
    preferences: ["whole_blood"],
    verification: "unverified",
    createdDaysAgo: 70,
  },
  {
    id: "usr_demo_spam",
    name: "QuickCure Services",
    email: "quickcure.services@example.com",
    role: "recipient",
    city: "Kanpur",
    area: "Swaroop Nagar",
    age: 30,
    bio: "Guaranteed blood available on payment.",
    verification: "rejected",
    organizationType: "patient_support_org",
    organizationName: "QuickCure",
    isSuspended: true,
    suspendedReason: "Requested payment for blood, which is prohibited on Heal Connect.",
    createdDaysAgo: 34,
  },
];

type DemoRequest = {
  id: string;
  reference: string;
  requesterId: string;
  requestType: RequestType;
  bloodGroup?: BloodGroup;
  unitsRequired: number;
  unitsFulfilled?: number;
  hospitalName: string;
  city: string;
  area: string;
  requiredInDays: number;
  requiredHour?: number;
  urgency: Urgency;
  status?: "open" | "in_progress" | "fulfilled" | "cancelled" | "expired" | "removed";
  additionalInfo: string;
  contactName: string;
  contactPhone: string;
  contactInstructions?: string;
  createdDaysAgo: number;
  resolutionNote?: string;
};

const DEMO_REQUESTS: DemoRequest[] = [
  {
    id: "req_demo_1",
    reference: "REQ-1042",
    requesterId: "usr_demo_recipient",
    requestType: "blood",
    bloodGroup: "O+",
    unitsRequired: 2,
    hospitalName: "Sanjeevani Multispeciality Hospital",
    city: "Ghaziabad",
    area: "Indirapuram",
    requiredInDays: 1,
    urgency: "emergency",
    additionalInfo:
      "My father is admitted in the ICU after surgery and needs 2 units of O+ blood. The hospital blood bank has asked us to arrange donors. Coordinating nurse is available at the ward reception.",
    contactName: "Rahul Deshmukh",
    contactPhone: "+91 90000 00101",
    contactInstructions: "Please call between 8 AM and 9 PM. Patient name: Suresh Deshmukh, ICU-3.",
    createdDaysAgo: 0,
  },
  {
    id: "req_demo_2",
    reference: "REQ-1041",
    requesterId: "usr_demo_priya",
    requestType: "platelets",
    bloodGroup: "B+",
    unitsRequired: 1,
    hospitalName: "Meridian Children's Hospital",
    city: "Noida",
    area: "Sector 62",
    requiredInDays: 2,
    urgency: "urgent",
    additionalInfo:
      "Paediatric thalassaemia patient needs a single-donor platelet unit. Hospital blood bank will handle screening and apheresis.",
    contactName: "Priya Nair",
    contactPhone: "+91 90000 00102",
    contactInstructions: "Day-care ward, 2nd floor. Ask for the transfusion desk.",
    createdDaysAgo: 1,
  },
  {
    id: "req_demo_3",
    reference: "REQ-1040",
    requesterId: "usr_demo_meera",
    requestType: "blood",
    bloodGroup: "A+",
    unitsRequired: 3,
    hospitalName: "Seaview Multispeciality Hospital",
    city: "Mumbai",
    area: "Andheri",
    requiredInDays: 3,
    urgency: "urgent",
    additionalInfo:
      "Elective surgery scheduled and the blood bank has asked for replacement donors. All units will be cross-matched at the hospital.",
    contactName: "Meera Kapoor",
    contactPhone: "+91 90000 00103",
    createdDaysAgo: 2,
  },
  {
    id: "req_demo_4",
    reference: "REQ-1039",
    requesterId: "usr_demo_arjun",
    requestType: "medical_assistance",
    unitsRequired: 1,
    hospitalName: "Hyderabad Dialysis Support Circle",
    city: "Hyderabad",
    area: "Kukatpally",
    requiredInDays: 6,
    urgency: "normal",
    additionalInfo:
      "Looking for volunteers who can help patients travel to and from dialysis sessions twice a week. No medical tasks involved — only accompaniment and coordination.",
    contactName: "Arjun Mehta",
    contactPhone: "+91 90000 00104",
    contactInstructions: "Volunteer coordination happens over call in the evening.",
    createdDaysAgo: 3,
  },
  {
    id: "req_demo_5",
    reference: "REQ-1038",
    requesterId: "usr_demo_nisha",
    requestType: "blood",
    bloodGroup: "O+",
    unitsRequired: 4,
    hospitalName: "Sabarmati Blood Centre",
    city: "Ahmedabad",
    area: "Satellite",
    requiredInDays: 4,
    urgency: "urgent",
    additionalInfo:
      "Thalassaemia day-care requires four units for scheduled transfusions this week. Blood centre will complete all screening.",
    contactName: "Nisha Patel",
    contactPhone: "+91 90000 00105",
    createdDaysAgo: 3,
  },
  {
    id: "req_demo_6",
    reference: "REQ-1037",
    requesterId: "usr_demo_divya",
    requestType: "blood",
    bloodGroup: "A-",
    unitsRequired: 2,
    hospitalName: "Backwater Medical Centre",
    city: "Kochi",
    area: "Kakkanad",
    requiredInDays: 5,
    urgency: "normal",
    additionalInfo:
      "A colleague's mother is undergoing treatment and will need two units. Hospital blood bank will confirm the donor eligibility.",
    contactName: "Divya Menon",
    contactPhone: "+91 90000 00106",
    createdDaysAgo: 4,
  },
  {
    id: "req_demo_7",
    reference: "REQ-1036",
    requesterId: "usr_demo_both",
    requestType: "blood",
    bloodGroup: "AB-",
    unitsRequired: 1,
    hospitalName: "Nova Superspeciality Hospital",
    city: "Noida",
    area: "Sector 18",
    requiredInDays: 1,
    urgency: "emergency",
    additionalInfo:
      "Urgent requirement for a single AB negative unit after an accident. Hospital is arranging transport for donors if needed.",
    contactName: "Ishaan Kulkarni",
    contactPhone: "+91 90000 00107",
    contactInstructions: "Call any time — emergency desk is staffed 24x7.",
    createdDaysAgo: 4,
  },
  {
    id: "req_demo_8",
    reference: "REQ-1035",
    requesterId: "usr_demo_rakesh",
    requestType: "blood",
    bloodGroup: "B-",
    unitsRequired: 2,
    hospitalName: "Awadh Medical College Hospital",
    city: "Lucknow",
    area: "Hazratganj",
    requiredInDays: 8,
    urgency: "normal",
    additionalInfo:
      "Planned transfusion for a cancer patient in the oncology ward. Appointment letter available with the family.",
    contactName: "Rakesh Gupta",
    contactPhone: "+91 90000 00108",
    createdDaysAgo: 6,
  },
  {
    id: "req_demo_9",
    reference: "REQ-1034",
    requesterId: "usr_demo_ananya",
    requestType: "blood",
    bloodGroup: "A+",
    unitsRequired: 1,
    unitsFulfilled: 1,
    hospitalName: "Marina Health City Hospital",
    city: "Chennai",
    area: "T. Nagar",
    requiredInDays: -2,
    urgency: "urgent",
    status: "fulfilled",
    additionalInfo: "Requirement was met by two volunteers from this platform. Thank you!",
    contactName: "Ananya Iyer",
    contactPhone: "+91 90000 00109",
    createdDaysAgo: 12,
    resolutionNote: "Marked fulfilled by the requester after the transfusion.",
  },
  {
    id: "req_demo_10",
    reference: "REQ-1033",
    requesterId: "usr_demo_sanjay",
    requestType: "platelets",
    bloodGroup: "O+",
    unitsRequired: 2,
    hospitalName: "Sahyadri Blood Centre",
    city: "Pune",
    area: "Kothrud",
    requiredInDays: 4,
    urgency: "urgent",
    status: "in_progress",
    additionalInfo:
      "Dengue patient with falling platelet count — the blood centre will decide whether platelets are required.",
    contactName: "Sanjay Rao",
    contactPhone: "+91 90000 00110",
    createdDaysAgo: 7,
  },
  {
    id: "req_demo_11",
    reference: "REQ-1032",
    requesterId: "usr_demo_recipient",
    requestType: "medical_assistance",
    unitsRequired: 1,
    hospitalName: "Sanjeevani Multispeciality Hospital",
    city: "Ghaziabad",
    area: "Raj Nagar Extension",
    requiredInDays: 15,
    urgency: "normal",
    additionalInfo:
      "Looking for volunteer support to arrange home-care equipment and to help with hospital paperwork for a post-surgery patient. No money is requested — only time and guidance.",
    contactName: "Rahul Deshmukh",
    contactPhone: "+91 90000 00101",
    createdDaysAgo: 9,
  },
  {
    id: "req_demo_12",
    reference: "REQ-1031",
    requesterId: "usr_demo_priya",
    requestType: "blood",
    bloodGroup: "B+",
    unitsRequired: 1,
    hospitalName: "Tricity Blood Bank",
    city: "Gurugram",
    area: "Sohna Road",
    requiredInDays: 20,
    urgency: "normal",
    additionalInfo: "Blood donation camp planned for the upcoming month. Volunteers welcome.",
    contactName: "Priya Nair",
    contactPhone: "+91 90000 00102",
    createdDaysAgo: 14,
  },
  {
    id: "req_demo_13",
    reference: "REQ-1030",
    requesterId: "usr_demo_divya",
    requestType: "blood",
    bloodGroup: "AB+",
    unitsRequired: 2,
    hospitalName: "Backwater Medical Centre",
    city: "Kochi",
    area: "Edappally",
    requiredInDays: 10,
    urgency: "normal",
    status: "cancelled",
    additionalInfo: "Surgery was postponed, so this request was cancelled.",
    contactName: "Divya Menon",
    contactPhone: "+91 90000 00106",
    createdDaysAgo: 16,
  },
  {
    id: "req_demo_14",
    reference: "REQ-1029",
    requesterId: "usr_demo_spam",
    requestType: "blood",
    bloodGroup: "O+",
    unitsRequired: 5,
    hospitalName: "Unverified private clinic",
    city: "Kanpur",
    area: "Swaroop Nagar",
    requiredInDays: 2,
    urgency: "emergency",
    status: "removed",
    additionalInfo:
      "Guaranteed blood available for a service charge. Contact on WhatsApp for the rate card.",
    contactName: "QuickCure Services",
    contactPhone: "+91 90000 00199",
    createdDaysAgo: 21,
    resolutionNote: "Removed by moderators: requesting payment for blood is prohibited.",
  },
  {
    id: "req_demo_15",
    reference: "REQ-1028",
    requesterId: "usr_demo_fatima",
    requestType: "blood",
    bloodGroup: "AB-",
    unitsRequired: 2,
    hospitalName: "Garden City Blood Centre",
    city: "Bengaluru",
    area: "Indiranagar",
    requiredInDays: 6,
    urgency: "urgent",
    additionalInfo:
      "Rare group requirement for a patient in the transplant ward. Blood centre is coordinating screening.",
    contactName: "Fatima Sheikh",
    contactPhone: "+91 90000 00111",
    createdDaysAgo: 1,
  },
];

type DemoResponse = {
  id: string;
  requestId: string;
  donorId: string;
  status: ResponseStatus;
  message: string;
  createdHoursAgo: number;
};

const DEMO_RESPONSES: DemoResponse[] = [
  {
    id: "res_demo_1",
    requestId: "req_demo_1",
    donorId: "usr_demo_aarav",
    status: "pending",
    message: "I am O negative and can reach the hospital within an hour. Please confirm the ward.",
    createdHoursAgo: 3,
  },
  {
    id: "res_demo_2",
    requestId: "req_demo_1",
    donorId: "usr_demo_donor",
    status: "pending",
    message: "Available today after 6 PM. I live 4 km away.",
    createdHoursAgo: 2,
  },
  {
    id: "res_demo_3",
    requestId: "req_demo_2",
    donorId: "usr_demo_both",
    status: "accepted",
    message: "I donate platelets regularly. Can come to the day-care ward tomorrow morning.",
    createdHoursAgo: 20,
  },
  {
    id: "res_demo_4",
    requestId: "req_demo_3",
    donorId: "usr_demo_kabir",
    status: "pending",
    message: "A negative here. I can travel to Andheri on any weekday morning.",
    createdHoursAgo: 30,
  },
  {
    id: "res_demo_5",
    requestId: "req_demo_5",
    donorId: "usr_demo_donor",
    status: "declined",
    message: "Happy to help if the date shifts — travelling this week.",
    createdHoursAgo: 40,
  },
  {
    id: "res_demo_6",
    requestId: "req_demo_7",
    donorId: "usr_demo_fatima",
    status: "pending",
    message: "AB negative donor. I can be at the hospital in about 3 hours.",
    createdHoursAgo: 12,
  },
  {
    id: "res_demo_7",
    requestId: "req_demo_9",
    donorId: "usr_demo_ananya",
    status: "completed",
    message: "Donated at the hospital blood bank on request. Marking this complete.",
    createdHoursAgo: 200,
  },
  {
    id: "res_demo_8",
    requestId: "req_demo_10",
    donorId: "usr_demo_both",
    status: "accepted",
    message: "Can support with a platelet donation if the blood centre confirms.",
    createdHoursAgo: 60,
  },
  {
    id: "res_demo_9",
    requestId: "req_demo_15",
    donorId: "usr_demo_arjun",
    status: "pending",
    message: "A negative — happy to help if travel to Bengaluru is useful. Currently in Hyderabad.",
    createdHoursAgo: 5,
  },
  {
    id: "res_demo_10",
    requestId: "req_demo_8",
    donorId: "usr_demo_rakesh",
    status: "withdrawn",
    message: "Withdrawing as I am unwell this week.",
    createdHoursAgo: 90,
  },
];

type DemoNotification = {
  userId: string;
  title: string;
  body: string;
  type:
    | "matching_request"
    | "donor_response"
    | "response_update"
    | "request_update"
    | "request_cancelled"
    | "verification_update"
    | "system";
  link?: string;
  read: boolean;
  hoursAgo: number;
};

const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    userId: "usr_demo_donor",
    title: "Emergency O+ request near you",
    body: "Sanjeevani Multispeciality Hospital, Ghaziabad · 2 units needed · Emergency",
    type: "matching_request",
    link: "/requests/req_demo_1",
    read: false,
    hoursAgo: 1,
  },
  {
    userId: "usr_demo_donor",
    title: "Your offer was received",
    body: "Rahul Deshmukh has your offer to help with REQ-1042 and will confirm the ward details.",
    type: "response_update",
    link: "/activity",
    read: false,
    hoursAgo: 2,
  },
  {
    userId: "usr_demo_donor",
    title: "Verification complete",
    body: "Your individual donor verification is approved. You now appear as a verified donor.",
    type: "verification_update",
    link: "/profile",
    read: true,
    hoursAgo: 72,
  },
  {
    userId: "usr_demo_recipient",
    title: "2 donors offered to help",
    body: "REQ-1042 has new donor offers waiting for your confirmation.",
    type: "donor_response",
    link: "/my-requests",
    read: false,
    hoursAgo: 2,
  },
  {
    userId: "usr_demo_recipient",
    title: "Request marked as emergency",
    body: "REQ-1042 is now highlighted as an emergency request with priority ordering.",
    type: "request_update",
    link: "/requests/req_demo_1",
    read: true,
    hoursAgo: 20,
  },
  {
    userId: "usr_demo_both",
    title: "Your offer was accepted",
    body: "Priya Nair accepted your platelet offer for REQ-1041. Coordination details are now visible.",
    type: "response_update",
    link: "/activity",
    read: false,
    hoursAgo: 18,
  },
  {
    userId: "usr_demo_both",
    title: "New emergency request for AB-",
    body: "Nova Superspeciality Hospital, Noida · 1 unit needed · Emergency",
    type: "matching_request",
    link: "/requests/req_demo_7",
    read: false,
    hoursAgo: 8,
  },
  {
    userId: "usr_demo_priya",
    title: "Donor offer accepted",
    body: "Ishaan Kulkarni will donate platelets for REQ-1041 tomorrow morning.",
    type: "donor_response",
    link: "/my-requests",
    read: true,
    hoursAgo: 16,
  },
  {
    userId: "usr_demo_divya",
    title: "Request cancelled",
    body: "REQ-1030 was cancelled because the surgery was postponed.",
    type: "request_cancelled",
    link: "/my-requests",
    read: true,
    hoursAgo: 100,
  },
  {
    userId: "usr_demo_meera",
    title: "Verification under review",
    body: "Our trust & safety team is reviewing your verification details. This usually takes 1–2 days.",
    type: "verification_update",
    link: "/verify",
    read: false,
    hoursAgo: 48,
  },
  {
    userId: "usr_demo_arjun",
    title: "Request needs attention",
    body: "REQ-1028 in Bengaluru may be outside your travel range. Update your preferences if needed.",
    type: "matching_request",
    link: "/requests/req_demo_15",
    read: false,
    hoursAgo: 4,
  },
  {
    userId: "usr_demo_priya",
    title: "Volunteer support needed",
    body: "A new medical assistance request in Ghaziabad is looking for volunteer time.",
    type: "matching_request",
    link: "/find-help",
    read: false,
    hoursAgo: 9,
  },
];

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function daysAgoIso(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
}

function dateInDays(days: number, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function demoPhone(index: number): string {
  return `+91 90000 0${String(200 + index).slice(-4)}`;
}

export async function seedDemoData(database: Database): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const adminHash = await hashPassword(DEMO_ADMIN_PASSWORD);

  DEMO_USERS.forEach((spec, index) => {
    const cityPoint = cityCoordinates(spec.city);
    const point = cityPoint ? offsetPoint(cityPoint, spec.id, 8) : null;
    const createdAt = daysAgoIso(spec.createdDaysAgo, 11);

    database.users.push({
      id: spec.id,
      email: spec.email,
      name: spec.name,
      passwordHash: spec.isAdmin ? adminHash : passwordHash,
      provider: "demo",
      providerId: null,
      avatarUrl: null,
      role: spec.role,
      isAdmin: Boolean(spec.isAdmin),
      isDemo: true,
      accountStatus: spec.isSuspended ? "suspended" : "active",
      suspendedReason: spec.suspendedReason ?? null,
      onboardingComplete: spec.onboardingComplete ?? true,
      createdAt,
      updatedAt: createdAt,
      lastLoginAt: hoursAgoIso(6 + index),
    });

    database.profiles.push({
      userId: spec.id,
      phone: demoPhone(index),
      city: spec.city,
      area: spec.area,
      approxLat: point?.lat ?? null,
      approxLng: point?.lng ?? null,
      bio: spec.bio,
      age: spec.age,
      sharePhoneWithMatches: spec.sharedPhone ?? false,
      createdAt,
      updatedAt: createdAt,
    });

    if (spec.bloodGroup) {
      database.donorProfiles.push({
        userId: spec.id,
        bloodGroup: spec.bloodGroup,
        lastDonationDate:
          spec.lastDonationDaysAgo != null
            ? new Date(Date.now() - spec.lastDonationDaysAgo * 86400000).toISOString().slice(0, 10)
            : null,
        availability: spec.availability ?? "available",
        preferences: spec.preferences ?? ["whole_blood"],
        maxTravelKm: 40,
        isVisibleToRecipients: true,
        notes: null,
        createdAt,
        updatedAt: createdAt,
      });
    }

    if (spec.verification && spec.verification !== "unverified") {
      database.verifications.push({
        id: `ver_demo_${index}`,
        userId: spec.id,
        organizationType: spec.organizationType ?? "individual_donor",
        organizationName: spec.organizationName ?? null,
        evidenceNote:
          spec.verification === "verified"
            ? "Demo verification record created with the sample dataset."
            : "Demo verification awaiting review.",
        status: spec.verification,
        reviewNote:
          spec.verification === "verified"
            ? "Approved as part of the demo dataset."
            : spec.verification === "rejected"
              ? "Payment-based listing violates platform policy."
              : null,
        reviewedBy: spec.verification === "pending" ? null : "usr_demo_admin",
        submittedAt: daysAgoIso(Math.max(1, spec.createdDaysAgo - 2), 9),
        reviewedAt: spec.verification === "pending" ? null : daysAgoIso(Math.max(1, spec.createdDaysAgo - 3), 15),
        isDemo: true,
      });
    }
  });

  DEMO_REQUESTS.forEach((spec, index) => {
    const cityPoint = cityCoordinates(spec.city);
    const point = cityPoint ? offsetPoint(cityPoint, spec.id, 10) : null;
    const createdAt = daysAgoIso(spec.createdDaysAgo, 9 + (index % 8));
    database.helpRequests.push({
      id: spec.id,
      reference: spec.reference,
      requesterId: spec.requesterId,
      requestType: spec.requestType,
      bloodGroup: spec.bloodGroup ?? null,
      unitsRequired: spec.unitsRequired,
      unitsFulfilled: spec.unitsFulfilled ?? 0,
      hospitalName: spec.hospitalName,
      city: spec.city,
      area: spec.area,
      approxLat: point?.lat ?? null,
      approxLng: point?.lng ?? null,
      requiredBy: dateInDays(spec.requiredInDays, spec.requiredHour ?? 9),
      urgency: spec.urgency,
      status: spec.status ?? "open",
      additionalInfo: spec.additionalInfo,
      contactName: spec.contactName,
      contactPhone: spec.contactPhone,
      contactInstructions: spec.contactInstructions ?? null,
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
      resolvedAt: spec.status === "fulfilled" ? daysAgoIso(2, 18) : null,
      moderationNote: spec.resolutionNote ?? null,
      removedBy: spec.status === "removed" ? "usr_demo_admin" : null,
    });
  });

  DEMO_RESPONSES.forEach((spec, index) => {
    const createdAt = hoursAgoIso(spec.createdHoursAgo);
    database.donorResponses.push({
      id: spec.id,
      requestId: spec.requestId,
      donorId: spec.donorId,
      message: spec.message,
      status: spec.status,
      shareContact: spec.status === "accepted" || spec.status === "completed",
      createdAt,
      updatedAt: createdAt,
      withdrawnAt: spec.status === "withdrawn" ? hoursAgoIso(spec.createdHoursAgo - 2) : null,
    });
    void index;
  });

  DEMO_NOTIFICATIONS.forEach((spec, index) => {
    database.notifications.push({
      id: `not_demo_${index}`,
      userId: spec.userId,
      type: spec.type,
      title: spec.title,
      body: spec.body,
      link: spec.link ?? null,
      readAt: spec.read ? hoursAgoIso(Math.max(1, spec.hoursAgo - 1)) : null,
      createdAt: hoursAgoIso(spec.hoursAgo),
    });
  });

  database.reports.push(
    {
      id: "rep_demo_1",
      reporterId: "usr_demo_divya",
      targetType: "request",
      targetId: "req_demo_14",
      reason: "payment_or_compensation_request",
      details:
        "This listing asks for a service charge for blood and shares a WhatsApp number for a rate card.",
      status: "open",
      resolutionNote: null,
      handledBy: null,
      createdAt: hoursAgoIso(48),
      updatedAt: hoursAgoIso(48),
    },
    {
      id: "rep_demo_2",
      reporterId: "usr_demo_fatima",
      targetType: "user",
      targetId: "usr_demo_spam",
      reason: "organ_trade_or_brokerage",
      details: "The profile description implies paid organ arrangements. Please review.",
      status: "open",
      resolutionNote: null,
      handledBy: null,
      createdAt: hoursAgoIso(30),
      updatedAt: hoursAgoIso(30),
    },
    {
      id: "rep_demo_3",
      reporterId: "usr_demo_kabir",
      targetType: "request",
      targetId: "req_demo_13",
      reason: "spam_or_duplicate",
      details: "Duplicate of an earlier request that was already cancelled.",
      status: "resolved",
      resolutionNote: "Requester confirmed and cancelled the duplicate.",
      handledBy: "usr_demo_admin",
      createdAt: hoursAgoIso(140),
      updatedAt: hoursAgoIso(120),
    },
  );

  database.blocks.push({
    id: "blk_demo_1",
    userId: "usr_demo_fatima",
    blockedUserId: "usr_demo_spam",
    createdAt: hoursAgoIso(26),
  });

  database.auditLog.push(
    {
      id: "aud_demo_1",
      actorId: "usr_demo_admin",
      action: "request.removed",
      targetType: "request",
      targetId: "req_demo_14",
      note: "Requesting payment for blood is prohibited by policy.",
      createdAt: hoursAgoIso(20),
    },
    {
      id: "aud_demo_2",
      actorId: "usr_demo_admin",
      action: "user.suspended",
      targetType: "user",
      targetId: "usr_demo_spam",
      note: "Suspended after a payment-for-blood report.",
      createdAt: hoursAgoIso(19),
    },
  );

  database.counters.requestReference = 1042;
  database.seeded = true;
}
