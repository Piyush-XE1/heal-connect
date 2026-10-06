import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { CITIES, areasForCity, cityCoordinates, findCity } from "@/lib/cities";
import {
  AVAILABILITY_STATES,
  BLOOD_GROUPS,
  type Availability,
  type BloodGroup,
  type VolunteerSummary,
  type SessionUser,
} from "@/lib/domain";
import { distanceKm, roundCoord } from "@/lib/geo";
import { donorProfileSchema, profileSchema } from "@/lib/validation";

import { requireUser } from "../auth/session";
import { getDb, mutate, nowIso } from "../db/store";
import { invalid, notFound } from "../errors";
import { toVolunteerSummary } from "../services/views";
import { action } from "./result";

export const fetchMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const database = await getDb();
  const session = await requireUser();
  const fresh = database.users.find((row) => row.id === session.id);
  if (!fresh) throw notFound("We could not find your account. Please sign in again.");
  const { buildSessionUser } = await import("../services/views");
  return buildSessionUser(database, session.id);
});

export const updateProfile = createServerFn({ method: "POST" })
  .validator(profileSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireUser();
      const timestamp = nowIso();
      let cityChanged = false;

      await mutate((db) => {
        const user = db.users.find((row) => row.id === session.id);
        if (!user) throw notFound("We could not find your account. Please sign in again.");
        user.name = data.name;
        user.avatarUrl = data.avatarUrl === undefined ? user.avatarUrl : data.avatarUrl;
        user.updatedAt = timestamp;

        const profile = db.profiles.find((row) => row.userId === session.id);
        if (!profile) throw notFound("We could not find this profile.");
        cityChanged = profile.city !== data.city;
        profile.city = data.city;
        profile.area = data.area ? data.area : null;
        profile.phone = data.phone ? data.phone : null;
        profile.bio = data.bio ? data.bio : null;
        profile.age = data.age ?? null;
        profile.sharePhoneWithMatches = data.sharePhoneWithMatches;

        if (typeof data.approxLat === "number" && typeof data.approxLng === "number") {
          profile.approxLat = roundCoord(data.approxLat);
          profile.approxLng = roundCoord(data.approxLng);
        } else if (cityChanged) {
          const point = cityCoordinates(data.city);
          if (point) {
            profile.approxLat = point.lat;
            profile.approxLng = point.lng;
          }
        }

        profile.updatedAt = timestamp;
      });

      return { updatedAt: timestamp };
    }),
  );

export const updateDonorProfile = createServerFn({ method: "POST" })
  .validator(donorProfileSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireUser();
      const timestamp = nowIso();
      const preferences = data.preferences as ("whole_blood" | "platelets" | "plasma")[];

      await mutate((db) => {
        const user = db.users.find((row) => row.id === session.id);
        if (!user) throw notFound("We could not find your account. Please sign in again.");
        if (user.role === "recipient") {
          throw invalid("Switch your role to Donor or Donor & Recipient to save donor details.");
        }

        const existing = db.donorProfiles.find((row) => row.userId === session.id);
        if (existing) {
          existing.bloodGroup = data.bloodGroup;
          existing.availability = data.availability;
          existing.preferences = preferences;
          existing.maxTravelKm = data.maxTravelKm;
          existing.lastDonationDate = data.lastDonationDate ? data.lastDonationDate : null;
          existing.notes = data.notes ? data.notes : null;
          existing.isVisibleToRecipients = data.isVisibleToRecipients;
          existing.updatedAt = timestamp;
        } else {
          db.donorProfiles.push({
            userId: session.id,
            bloodGroup: data.bloodGroup,
            lastDonationDate: data.lastDonationDate ? data.lastDonationDate : null,
            availability: data.availability,
            preferences,
            maxTravelKm: data.maxTravelKm,
            isVisibleToRecipients: data.isVisibleToRecipients,
            notes: data.notes ? data.notes : null,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      });

      return { updatedAt: timestamp };
    }),
  );

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Stores a coarse location after the user explicitly grants browser geolocation
 * permission. Coordinates are rounded to ~1 km and never exposed to others.
 */
export const updateLocation = createServerFn({ method: "POST" })
  .validator(locationSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const session = await requireUser();
      const timestamp = nowIso();
      const approxLat = roundCoord(data.lat);
      const approxLng = roundCoord(data.lng);

      let nearest: { city: string; distance: number } | null = null;
      for (const record of CITIES) {
        const km = distanceKm(
          { lat: data.lat, lng: data.lng },
          { lat: record.lat, lng: record.lng },
        );
        if (!nearest || km < nearest.distance)
          nearest = { city: record.city, distance: Math.round(km) };
      }

      await mutate((db) => {
        const profile = db.profiles.find((row) => row.userId === session.id);
        if (!profile) throw notFound("We could not find this profile.");
        profile.approxLat = approxLat;
        profile.approxLng = approxLng;
        if (!profile.city && nearest && nearest.distance <= 150) {
          profile.city = nearest.city;
          profile.area = profile.area ?? areasForCity(nearest.city)[0] ?? null;
        }
        profile.updatedAt = timestamp;
      });

      return {
        approxLat,
        approxLng,
        suggestedCity: nearest && nearest.distance <= 150 ? nearest.city : null,
        suggestedAreas: nearest ? areasForCity(nearest.city) : [],
      };
    }),
  );

const volunteerFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  city: z.string().trim().max(60).optional(),
  area: z.string().trim().max(60).optional(),
  availability: z.enum(AVAILABILITY_STATES).optional(),
  verifiedOnly: z.boolean().optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().min(1).max(50).optional(),
  perPage: z.coerce.number().min(6).max(48).optional(),
});

export type VolunteerDirectoryResult = {
  items: VolunteerSummary[];
  total: number;
  page: number;
  perPage: number;
  bloodGroupFilterSupport: string;
};

export const listVolunteers = createServerFn({ method: "GET" })
  .validator(volunteerFiltersSchema)
  .handler(async ({ data }): Promise<VolunteerDirectoryResult> => {
    const session = await requireUser();
    const database = await getDb();

    const viewerPoint =
      typeof data.lat === "number" && typeof data.lng === "number"
        ? { lat: data.lat, lng: data.lng }
        : (() => {
            const profile = database.profiles.find((row) => row.userId === session.id);
            return profile?.approxLat != null && profile?.approxLng != null
              ? { lat: profile.approxLat, lng: profile.approxLng }
              : null;
          })();

    const blockedIds = new Set(
      database.blocks
        .filter((row) => row.userId === session.id || row.blockedUserId === session.id)
        .map((row) => (row.userId === session.id ? row.blockedUserId : row.userId)),
    );

    const perPage = data.perPage ?? 12;
    const page = data.page ?? 1;

    let items = database.users
      .filter((user) => {
        if (user.accountStatus !== "active") return false;
        if (user.role === "recipient") return false;
        if (blockedIds.has(user.id)) return false;
        const donorProfile = database.donorProfiles.find((row) => row.userId === user.id);
        if (!donorProfile || !donorProfile.isVisibleToRecipients) return false;
        if (data.bloodGroup && donorProfile.bloodGroup !== data.bloodGroup) return false;
        if (data.availability && donorProfile.availability !== data.availability) return false;
        return true;
      })
      .map((user) => toVolunteerSummary(user, database, viewerPoint));

    if (data.q) {
      const needle = data.q.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          (item.city ?? "").toLowerCase().includes(needle) ||
          (item.area ?? "").toLowerCase().includes(needle),
      );
    }
    if (data.city) {
      items = items.filter((item) => (item.city ?? "").toLowerCase() === data.city!.toLowerCase());
    }
    if (data.area) {
      const needle = data.area.toLowerCase();
      items = items.filter((item) => (item.area ?? "").toLowerCase().includes(needle));
    }
    if (data.verifiedOnly) {
      items = items.filter((item) => item.verificationStatus === "verified");
    }
    if (data.radiusKm && viewerPoint) {
      items = items.filter((item) => item.distanceKm == null || item.distanceKm <= data.radiusKm!);
    }

    items.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return a.name.localeCompare(b.name);
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    const total = items.length;
    return {
      items: items.slice((page - 1) * perPage, page * perPage),
      total,
      page,
      perPage,
      bloodGroupFilterSupport:
        "Compatibility for a specific patient must always be confirmed by the treating hospital or blood bank.",
    };
  });

export type PublicProfileView = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: "donor" | "recipient" | "both";
  city: string | null;
  area: string | null;
  bloodGroup: BloodGroup | null;
  availability: Availability | null;
  lastDonationDate: string | null;
  isDemo: boolean;
  memberSince: string;
  verificationStatus: SessionUser["verificationStatus"];
  organizationType: SessionUser["organizationType"];
  organizationName: string | null;
  completedDonations: number;
  activeRequests: number;
  bio: string | null;
  /** Explicit reminder that private fields are omitted by design. */
  privacyNote: string;
};

export const fetchPublicProfile = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().trim().min(1) }))
  .handler(async ({ data }): Promise<PublicProfileView> => {
    await requireUser();
    const database = await getDb();
    const user = database.users.find((row) => row.id === data.userId);
    if (!user) throw notFound("This member could not be found.");

    const profile = database.profiles.find((row) => row.userId === user.id);
    const donorProfile = database.donorProfiles.find((row) => row.userId === user.id);
    const verification = database.verifications
      .filter((row) => row.userId === user.id)
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
    const city = findCity(profile?.city);

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      city: profile?.city ?? null,
      area: profile?.area ?? null,
      bloodGroup: donorProfile?.bloodGroup ?? null,
      availability: donorProfile?.availability ?? null,
      lastDonationDate: donorProfile?.lastDonationDate ?? null,
      isDemo: user.isDemo,
      memberSince: user.createdAt,
      verificationStatus: verification?.status ?? "unverified",
      organizationType: verification?.organizationType ?? null,
      organizationName: verification?.organizationName ?? null,
      completedDonations: database.donorResponses.filter(
        (row) => row.donorId === user.id && row.status === "completed",
      ).length,
      activeRequests: database.helpRequests.filter(
        (row) =>
          row.requesterId === user.id && (row.status === "open" || row.status === "in_progress"),
      ).length,
      bio: profile?.bio ?? null,
      privacyNote: `Phone number, exact address${city ? ` and precise location in ${city.city}` : ""} are never shown publicly on Heal Connect.`,
    };
  });

export const fetchCityOptions = createServerFn({ method: "GET" }).handler(async () => {
  return {
    cities: CITIES.map((record) => ({ city: record.city, state: record.state })),
  };
});
