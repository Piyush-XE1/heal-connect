import { z } from "zod";

import {
  ACCOUNT_STATUSES,
  AVAILABILITY_STATES,
  BLOOD_GROUPS,
  DONATION_PREFERENCES,
  ORGANIZATION_TYPES,
  REPORT_REASONS,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  URGENCIES,
  USER_ROLES,
  VERIFICATION_STATUSES,
} from "./domain";

const todayIso = () => new Date().toISOString().slice(0, 10);

export const phoneSchema = z
  .string()
  .trim()
  .min(8, "Enter a contact number with at least 8 digits")
  .max(18, "Contact number looks too long")
  .regex(/^[+0-9()\s-]+$/, "Use digits, spaces, + or - only")
  .refine((value) => value.replace(/\D/g, "").length >= 8, {
    message: "Enter a contact number with at least 8 digits",
  });

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your full name")
  .max(80, "Name is too long");

export const citySchema = z.string().trim().min(2, "Select or enter a city").max(60);
export const areaSchema = z.string().trim().max(60).optional().or(z.literal(""));

export const roleSchema = z.enum(USER_ROLES);

export const profileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  city: citySchema,
  area: areaSchema,
  bio: z.string().trim().max(500, "Keep your introduction under 500 characters").optional(),
  age: z.coerce
    .number({ invalid_type_error: "Enter your age" })
    .int("Age must be a whole number")
    .min(18, "Donors and recipients must be 18 or older")
    .max(100, "Enter a valid age")
    .optional(),
  approxLat: z.number().min(-90).max(90).nullable().optional(),
  approxLng: z.number().min(-180).max(180).nullable().optional(),
  sharePhoneWithMatches: z.boolean().default(true),
  avatarUrl: z
    .string()
    .trim()
    .max(400_000, "Image is too large — try a smaller photo")
    .nullable()
    .optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const donorProfileSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: "Select your blood group" }) }),
  availability: z.enum(AVAILABILITY_STATES).default("available"),
  preferences: z
    .array(z.enum(DONATION_PREFERENCES as [string, ...string[]]))
    .min(1, "Choose at least one donation preference"),
  maxTravelKm: z.coerce
    .number({ invalid_type_error: "Enter a travel distance" })
    .int()
    .min(1, "Distance must be at least 1 km")
    .max(500, "Distance must be 500 km or less"),
  lastDonationDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .refine((value) => value <= todayIso(), "Last donation date cannot be in the future")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(300, "Keep notes under 300 characters").optional(),
  isVisibleToRecipients: z.boolean().default(true),
});
export type DonorProfileInput = z.infer<typeof donorProfileSchema>;

export const onboardingSchema = z.object({
  role: roleSchema,
  city: citySchema,
  area: areaSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  availability: z.enum(AVAILABILITY_STATES).optional(),
  sharePhoneWithMatches: z.boolean().default(true),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const requestBaseSchema = z.object({
  requestType: z.enum(REQUEST_TYPES, {
    errorMap: () => ({ message: "Choose what kind of help is needed" }),
  }),
  bloodGroup: z.enum(BLOOD_GROUPS).optional().nullable(),
  unitsRequired: z.coerce
    .number({ invalid_type_error: "Enter the number of units" })
    .int("Units must be a whole number")
    .min(1, "At least 1 unit is required")
    .max(20, "For more than 20 units, coordinate directly with the hospital blood bank"),
  hospitalName: z
    .string()
    .trim()
    .min(3, "Enter the hospital or blood bank name")
    .max(120, "Hospital name is too long"),
  city: citySchema,
  area: areaSchema,
  requiredBy: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date help is needed")
    .refine((value) => value >= todayIso(), "Choose today or a future date"),
  urgency: z.enum(URGENCIES, { errorMap: () => ({ message: "Select the urgency" }) }),
  additionalInfo: z.string().trim().max(1000, "Keep the note under 1000 characters").optional(),
  contactName: nameSchema,
  contactPhone: phoneSchema,
  contactInstructions: z
    .string()
    .trim()
    .max(300, "Keep coordination notes under 300 characters")
    .optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please confirm the accuracy and consent statements" }),
  }),
});

/** Creating a request adds cross-field rules on top of the base shape. */
export const requestSchema = requestBaseSchema.superRefine((value, ctx) => {
  if (value.requestType !== "medical_assistance" && !value.bloodGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bloodGroup"],
      message: "Select the blood group needed",
    });
  }
  if (value.urgency === "emergency" && !value.additionalInfo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["additionalInfo"],
      message:
        "For emergency requests, add a short note (ward, department or coordinating person).",
    });
  }
});
export type RequestInput = z.infer<typeof requestSchema>;

/** Editing a request accepts any subset of the base fields. */
export const requestUpdateSchema = requestBaseSchema
  .partial()
  .extend({ id: z.string().trim().min(1), status: z.enum(REQUEST_STATUSES).optional() });
export type RequestUpdateInput = z.infer<typeof requestUpdateSchema>;

export const responseSchema = z.object({
  requestId: z.string().trim().min(1),
  message: z.string().trim().max(400, "Keep your message under 400 characters").optional(),
  shareContact: z.boolean().default(false),
});
export type ResponseInput = z.infer<typeof responseSchema>;

export const reportSchema = z.object({
  targetType: z.enum(["user", "request"]),
  targetId: z.string().trim().min(1),
  reason: z.enum(REPORT_REASONS, { errorMap: () => ({ message: "Choose a reason" }) }),
  details: z.string().trim().max(600, "Keep details under 600 characters").optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const verificationSchema = z.object({
  organizationType: z.enum(ORGANIZATION_TYPES, {
    errorMap: () => ({ message: "Choose the type of account" }),
  }),
  organizationName: z.string().trim().max(120).optional().or(z.literal("")),
  evidenceNote: z
    .string()
    .trim()
    .min(20, "Add at least a short description so a reviewer can verify you")
    .max(600, "Keep the note under 600 characters"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please confirm the declaration" }),
  }),
});
export type VerificationInput = z.infer<typeof verificationSchema>;

export const searchFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  city: z.string().trim().max(60).optional(),
  area: z.string().trim().max(60).optional(),
  urgency: z.enum(URGENCIES).optional(),
  requestType: z.enum(REQUEST_TYPES).optional(),
  requiredFrom: z.string().trim().optional(),
  requiredTo: z.string().trim().optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  includeIncompatible: z.boolean().optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  sort: z.enum(["match", "recent", "urgency", "distance"]).optional(),
  page: z.coerce.number().min(1).max(50).optional(),
  perPage: z.coerce.number().min(6).max(48).optional(),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const adminUserActionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum([
    "verify",
    "reject_verification",
    "suspend",
    "reactivate",
    "grant_admin",
    "revoke_admin",
    "make_demo_verified",
  ]),
  note: z.string().trim().max(300).optional(),
});

export const adminModerationSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    "resolve_request",
    "mark_in_progress",
    "remove_request",
    "restore_request",
    "dismiss_report",
    "review_report",
    "resolve_report",
  ]),
  note: z.string().trim().max(300).optional(),
});

export const notificationActionSchema = z.object({
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
});

export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);
export const accountStatusSchema = z.enum(ACCOUNT_STATUSES);

export function formatZodError(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
