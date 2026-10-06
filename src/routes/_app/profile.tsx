import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  Camera,
  Droplet,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  BloodGroupChip,
  DemoBadge,
  InfoNote,
  PageHeader,
  Pill,
  SkeletonCard,
  StatTile,
  SuccessNote,
  VerificationBadge,
} from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import { AVAILABILITY_LABELS, ROLE_LABELS } from "@/lib/labels";
import {
  AVAILABILITY_STATES,
  BLOOD_GROUPS,
  DONATION_PREFERENCES,
  type Availability,
  type BloodGroup,
} from "@/lib/domain";
import { PRIVACY_PROMISE } from "@/lib/brand";
import { areasForCity, cityOptions, findCity } from "@/lib/cities";
import { formatDate, formatFileSize, initials, todayIsoDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage, fieldErrors, unwrapAction } from "@/lib/actions";
import { fetchMyProfile, updateDonorProfile, updateProfile } from "@/server/api/profile";
import type { DonationPreference } from "@/lib/domain";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/profile")({
  head: () =>
    pageHead({
      title: "Donor profile — Heal Connect",
      description:
        "Manage your donor profile: blood group, availability, donation preferences, travel distance and privacy settings.",
      noIndex: true,
    }),
  component: ProfilePage,
});

const PREFERENCE_LABELS: Record<DonationPreference, string> = {
  whole_blood: "Whole blood",
  platelets: "Platelets",
  plasma: "Plasma",
};

function ProfilePage() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => unwrapAction(await fetchMyProfile()),
    ...(user ? { initialData: user } : {}),
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sharePhone, setSharePhone] = useState(true);
  const [photoError, setPhotoError] = useState("");

  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [availability, setAvailability] = useState<Availability>("available");
  const [preferences, setPreferences] = useState<DonationPreference[]>(["whole_blood"]);
  const [maxTravelKm, setMaxTravelKm] = useState("30");
  const [lastDonationDate, setLastDonationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [visibleToRecipients, setVisibleToRecipients] = useState(true);
  const [donorErrors, setDonorErrors] = useState<Record<string, string>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedDonor, setSavedDonor] = useState(false);

  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setPhone(session.profile.phone ?? "");
    setCity(session.profile.city ?? "");
    setArea(session.profile.area ?? "");
    setAge(session.profile.age ? String(session.profile.age) : "");
    setBio(session.profile.bio ?? "");
    setAvatarUrl(session.avatarUrl);
    setSharePhone(session.profile.sharePhoneWithMatches);
    if (session.donorProfile) {
      setBloodGroup(session.donorProfile.bloodGroup);
      setAvailability(session.donorProfile.availability);
      setPreferences(session.donorProfile.preferences);
      setMaxTravelKm(String(session.donorProfile.maxTravelKm));
      setLastDonationDate(session.donorProfile.lastDonationDate ?? "");
      setNotes(session.donorProfile.notes ?? "");
      setVisibleToRecipients(session.donorProfile.isVisibleToRecipients);
    }
  }, [session]);

  const profileMutation = useMutation({
    mutationFn: async () =>
      unwrapAction(
        await updateProfile({
          data: {
            name,
            city,
            area: area || "",
            phone: phone || "",
            bio: bio || "",
            ...(age ? { age: Number(age) } : {}),
            avatarUrl,
            sharePhoneWithMatches: sharePhone,
            ...(session?.profile.approxLat != null && session?.profile.approxLng != null
              ? { approxLat: session.profile.approxLat, approxLng: session.profile.approxLng }
              : {}),
          },
        }),
      ),
    onSuccess: async () => {
      setProfileErrors({});
      setSavedProfile(true);
      toast.success("Profile updated");
      await refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) => {
      setSavedProfile(false);
      setProfileErrors(fieldErrors(error));
      toast.error("Could not save your profile", { description: errorMessage(error) });
    },
  });

  const donorMutation = useMutation({
    mutationFn: async () =>
      unwrapAction(
        await updateDonorProfile({
          data: {
            bloodGroup: bloodGroup as BloodGroup,
            availability,
            preferences: preferences as string[],
            maxTravelKm: Number(maxTravelKm || 0),
            lastDonationDate: lastDonationDate || "",
            notes: notes || "",
            isVisibleToRecipients: visibleToRecipients,
          },
        }),
      ),
    onSuccess: async () => {
      setDonorErrors({});
      setSavedDonor(true);
      toast.success("Donor profile saved", {
        description: "Matching uses these details to decide which requests reach you.",
      });
      await refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: ["volunteers"] });
    },
    onError: (error) => {
      setSavedDonor(false);
      setDonorErrors(fieldErrors(error));
      toast.error("Could not save donor details", { description: errorMessage(error) });
    },
  });

  const handlePhoto = async (file: File) => {
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file (PNG or JPG).");
      return;
    }
    if (file.size > 250 * 1024) {
      setPhotoError(`That image is ${formatFileSize(file.size)}. Please choose one under 250 KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setPhotoError("We could not read that image. Try a different file.");
    reader.readAsDataURL(file);
  };

  const togglePreference = (preference: DonationPreference) => {
    setPreferences((current) =>
      current.includes(preference)
        ? current.filter((item) => item !== preference)
        : [...current, preference],
    );
  };

  const isDonorRole = session ? session.role === "donor" || session.role === "both" : false;
  const cities = cityOptions();
  const areas = areasForCity(city);

  if (isLoading && !session) {
    return (
      <div className="page-shell max-w-4xl py-8">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="page-shell max-w-4xl space-y-6 py-8">
      <PageHeader
        title="Donor profile"
        description="Your details decide which requests reach you. Sensitive fields stay private — we never publish your phone number, address or exact location."
        actions={
          <Button asChild variant="outline">
            <Link to="/settings">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Privacy settings
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="primary">
            <UserRound className="size-3.5" aria-hidden="true" />
            {session ? ROLE_LABELS[session.role] : "Member"}
          </Pill>
          <VerificationBadge status={session?.verificationStatus ?? "unverified"} />
          {session?.isDemo ? <DemoBadge /> : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Profile completion"
          value={`${session?.profileCompletion ?? 0}%`}
          hint="Complete profiles match faster"
          icon={Star}
        />
        <StatTile
          label="Blood group"
          value={session?.donorProfile?.bloodGroup ?? "Not set"}
          hint={
            session?.donorProfile
              ? AVAILABILITY_LABELS[session.donorProfile.availability]
              : "Add donor details below"
          }
          icon={Droplet}
          tone="blood"
        />
        <StatTile
          label="Last donation"
          value={
            session?.donorProfile?.lastDonationDate
              ? formatDate(session.donorProfile.lastDonationDate)
              : "—"
          }
          hint="Used for interval reminders only"
          icon={CalendarClock}
          tone="info"
        />
      </div>

      <Progress value={session?.profileCompletion ?? 0} aria-label="Profile completion" />

      {/* Personal details */}
      <section className="surface space-y-5 p-6" aria-labelledby="personal-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="personal-heading" className="font-display text-lg font-extrabold">
            Personal details
          </h2>
          {savedProfile ? <SuccessNote>Saved</SuccessNote> : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Your profile photo"
              className="size-20 rounded-3xl object-cover"
            />
          ) : (
            <span className="grid size-20 place-items-center rounded-3xl bg-primary-soft font-display text-xl font-extrabold text-primary">
              {initials(name || "You")}
            </span>
          )}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handlePhoto(file);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="size-4" aria-hidden="true" />
                {avatarUrl ? "Change photo" : "Add photo"}
              </Button>
              {avatarUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(null)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Stored with your account only. Images under 250 KB work best.
            </p>
            {photoError ? (
              <p className="text-xs font-medium text-destructive">{photoError}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name *</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(profileErrors["name"])}
            />
            {profileErrors["name"] ? (
              <p className="text-xs font-medium text-destructive">{profileErrors["name"]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={session?.email ?? ""} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Email comes from your sign-in provider and cannot be edited here.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-age">Age</Label>
            <Input
              id="profile-age"
              type="number"
              inputMode="numeric"
              min={18}
              max={100}
              value={age}
              onChange={(event) => setAge(event.target.value)}
              aria-invalid={Boolean(profileErrors["age"])}
            />
            {profileErrors["age"] ? (
              <p className="text-xs font-medium text-destructive">{profileErrors["age"]}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Shown as a number only where relevant. Donors must be 18 or older.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Contact number (private)</Label>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-invalid={Boolean(profileErrors["phone"])}
              placeholder="+91 90000 00000"
            />
            {profileErrors["phone"] ? (
              <p className="text-xs font-medium text-destructive">{profileErrors["phone"]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-city">City *</Label>
            <Input
              id="profile-city"
              list="profile-city-options"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setArea("");
              }}
              aria-invalid={Boolean(profileErrors["city"])}
            />
            <datalist id="profile-city-options">
              {cities.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            {profileErrors["city"] ? (
              <p className="text-xs font-medium text-destructive">{profileErrors["city"]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-area">Area</Label>
            {areas.length > 0 ? (
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger id="profile-area">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="profile-area"
                value={area}
                onChange={(event) => setArea(event.target.value)}
              />
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-bio">Short introduction</Label>
            <Textarea
              id="profile-bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="e.g. Regular donor, available on weekends, can travel across the city."
            />
            <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-input accent-primary"
            checked={sharePhone}
            onChange={(event) => setSharePhone(event.target.checked)}
          />
          <span>
            <span className="font-semibold">Share my contact number when I am matched</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              When off, coordinators can still reach you through the platform but your number stays
              hidden.
            </span>
          </span>
        </label>

        {session?.profile.approxLat != null ? (
          <InfoNote tone="primary" icon={MapPin} title="Your stored location is coarse">
            We keep approximately {session.profile.approxLat.toFixed(2)},{" "}
            {session.profile.approxLng?.toFixed(2)} — rounded to about a kilometre
            {findCity(city) ? ` around ${findCity(city)!.city}` : ""}. It is used for distance
            ranking only and is never shown to anyone else.
          </InfoNote>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
            {profileMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Save personal details
          </Button>
        </div>
      </section>

      {/* Donor details */}
      <section className="surface space-y-5 p-6" aria-labelledby="donor-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="donor-heading" className="font-display text-lg font-extrabold">
            Donation details
          </h2>
          {savedDonor ? <SuccessNote>Saved</SuccessNote> : null}
        </div>

        {!isDonorRole ? (
          <InfoNote tone="warning" title="Your current role is Recipient">
            Switch to Donor or Donor and Recipient in{" "}
            <Link to="/settings" className="font-semibold underline">
              Settings
            </Link>{" "}
            to store donor details and receive matched requests.
          </InfoNote>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="donor-blood">Blood group *</Label>
            <Select
              value={bloodGroup || ""}
              onValueChange={(value) => setBloodGroup(value as BloodGroup)}
              disabled={!isDonorRole}
            >
              <SelectTrigger id="donor-blood" aria-invalid={Boolean(donorErrors["bloodGroup"])}>
                <SelectValue placeholder="Select your group" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {donorErrors["bloodGroup"] ? (
              <p className="text-xs font-medium text-destructive">{donorErrors["bloodGroup"]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="donor-availability">Availability</Label>
            <Select
              value={availability}
              onValueChange={(value) => setAvailability(value as Availability)}
              disabled={!isDonorRole}
            >
              <SelectTrigger id="donor-availability">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_STATES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {AVAILABILITY_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set this to “not available” if you are travelling, unwell or recently donated.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="donor-last">Last donation date</Label>
            <Input
              id="donor-last"
              type="date"
              max={todayIsoDate()}
              value={lastDonationDate}
              onChange={(event) => setLastDonationDate(event.target.value)}
              disabled={!isDonorRole}
              aria-invalid={Boolean(donorErrors["lastDonationDate"])}
            />
            {donorErrors["lastDonationDate"] ? (
              <p className="text-xs font-medium text-destructive">
                {donorErrors["lastDonationDate"]}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                We only use this to remind you about donation intervals. The blood bank's rules
                always apply.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="donor-travel">Maximum travel distance (km)</Label>
            <Input
              id="donor-travel"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={maxTravelKm}
              onChange={(event) => setMaxTravelKm(event.target.value)}
              disabled={!isDonorRole}
              aria-invalid={Boolean(donorErrors["maxTravelKm"])}
            />
            {donorErrors["maxTravelKm"] ? (
              <p className="text-xs font-medium text-destructive">{donorErrors["maxTravelKm"]}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Requests beyond this distance are shown with a caution instead of being hidden.
              </p>
            )}
          </div>

          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="text-sm font-semibold">Donation preferences *</legend>
            <div className="flex flex-wrap gap-2">
              {DONATION_PREFERENCES.map((preference) => {
                const active = preferences.includes(preference);
                return (
                  <button
                    key={preference}
                    type="button"
                    aria-pressed={active}
                    disabled={!isDonorRole}
                    onClick={() => togglePreference(preference)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {PREFERENCE_LABELS[preference]}
                  </button>
                );
              })}
            </div>
            {donorErrors["preferences"] ? (
              <p className="text-xs font-medium text-destructive">{donorErrors["preferences"]}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Preferences influence matching only — the blood bank decides what you are eligible
                to donate.
              </p>
            )}
          </fieldset>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="donor-notes">Notes for coordinators (optional)</Label>
            <Textarea
              id="donor-notes"
              rows={2}
              maxLength={300}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!isDonorRole}
              placeholder="e.g. Weekday evenings only. Prefer hospital blood centres."
            />
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input accent-primary"
              checked={visibleToRecipients}
              onChange={(event) => setVisibleToRecipients(event.target.checked)}
              disabled={!isDonorRole}
            />
            <span>
              <span className="font-semibold">Show me in the donor directory</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Your name, area, blood group and availability are listed — never your phone number
                or address. Turning this off stops new matched notifications too.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="ghost">
            <Link to="/verify">
              <BadgeCheck className="size-4" aria-hidden="true" />
              Verification status
            </Link>
          </Button>
          <Button
            onClick={() => donorMutation.mutate()}
            disabled={donorMutation.isPending || !isDonorRole}
          >
            {donorMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Save donation details
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
          <BloodGroupChip group={bloodGroup || null} />
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">This is what recipients see</p>
            <p>Name, city, area, blood group, availability and verified status. Nothing else.</p>
          </div>
        </div>
      </section>

      <InfoNote tone="info" title="Privacy promise">
        {PRIVACY_PROMISE}
      </InfoNote>
    </div>
  );
}
