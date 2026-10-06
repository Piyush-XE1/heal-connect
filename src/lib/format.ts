const DEFAULT_LOCALE = "en-IN";

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined, fallback = "Not set"): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(DEFAULT_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(value: string | Date | null | undefined, fallback = "—"): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(DEFAULT_LOCALE, { day: "numeric", month: "short" });
}

export function formatDateTime(value: string | Date | null | undefined, fallback = "—"): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString(DEFAULT_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(value: string | Date | null | undefined, fallback = ""): string {
  const date = toDate(value);
  if (!date) return fallback;
  const diffMs = date.getTime() - Date.now();
  const absSeconds = Math.abs(diffMs) / 1000;
  const formatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: "auto" });

  if (absSeconds < 45) return "just now";
  if (absSeconds < 3600) return formatter.format(Math.round(diffMs / 60000), "minute");
  if (absSeconds < 86400) return formatter.format(Math.round(diffMs / 3600000), "hour");
  if (absSeconds < 2592000) return formatter.format(Math.round(diffMs / 86400000), "day");
  if (absSeconds < 31536000) return formatter.format(Math.round(diffMs / 2592000000), "month");
  return formatter.format(Math.round(diffMs / 31536000000), "year");
}

/** Human phrasing for how soon a need is, relative to now. */
export function dueLabel(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "Date not set";
  const hours = (date.getTime() - Date.now()) / 3600000;
  if (hours < 0) return `Was needed ${relativeTime(date)}`;
  if (hours <= 12) return `Needed within ${Math.max(1, Math.round(hours))} hours`;
  const days = Math.round(hours / 24);
  if (days <= 1) return "Needed within a day";
  if (days <= 7) return `Needed in ${days} days`;
  return `Needed by ${formatDate(date)}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function daysBetween(from: string | Date, to: string | Date = new Date()): number {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function isPast(value: string | Date | null | undefined): boolean {
  const date = toDate(value);
  return date ? date.getTime() < Date.now() : false;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/** Shows only the last digits so phone numbers are not splashed across screens. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "Not shared";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return `••••${digits}`;
  return `••••••${digits.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

export function truncate(value: string, max = 140): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function formatUnits(units: number): string {
  return `${units} ${pluralize(units, "unit")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
