import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BellRing,
  ClipboardList,
  Download,
  Droplet,
  HeartHandshake,
  Home,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  UserRound,
  WifiOff,
  X,
  CheckCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Logo, LogoMark } from "@/components/common/logo";
import { Pill } from "@/components/common/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/components/providers/auth-provider";
import { usePwa } from "@/components/providers/pwa-provider";
import {
  BRAND,
  EMERGENCY_DISCLAIMER,
  MEDICAL_DISCLAIMER,
  ORGAN_DONATION_NOTICE,
  PAYMENT_PROHIBITION,
} from "@/lib/brand";
import { initials, relativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { unwrapAction } from "@/lib/actions";
import { listNotifications, markNotifications } from "@/server/api/notifications";

/**
 * One query key, one request: the bell badge and the popover list share the
 * same feed payload, so opening the popover never fires a duplicate call.
 */
function useNotifications(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications("bell"),
    queryFn: async () => unwrapAction(await listNotifications({ data: { limit: 8 } })),
    enabled: Boolean(user) && enabled,
    staleTime: 60_000,
    // Poll only while the tab is visible — background tabs stay quiet.
    refetchInterval: (query) => (query.state.data ? 120_000 : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data } = useNotifications(true);
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const markAll = useMutation({
    mutationFn: async () => unwrapAction(await markNotifications({ data: { all: true } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative grid size-10 place-items-center rounded-full border border-border bg-card text-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BellRing className="size-5" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-bold">Notifications</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto scroll-thin">
          {items.length ? (
            items.map((item) => (
              <Link
                key={item.id}
                to={item.link ?? "/notifications"}
                onClick={() => setOpen(false)}
                className={cn(
                  "block border-b border-border/60 px-4 py-3 transition last:border-b-0 hover:bg-accent/60",
                  !item.read && "bg-primary-soft/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {!item.read ? (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {relativeTime(item.createdAt)}
                </p>
              </Link>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet. We will let you know when something needs your attention.
            </p>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" className="w-full justify-center">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InstallButton({ compact = false }: { compact?: boolean }) {
  const { canInstall, installDismissed, promptInstall } = usePwa();
  if (!canInstall || installDismissed) return null;

  return (
    <Button
      variant="outline"
      size={compact ? "sm" : "default"}
      onClick={async () => {
        const outcome = await promptInstall();
        if (outcome === "accepted") {
          toast.success("Installing Heal Connect", {
            description: "The app will appear on your home screen in a moment.",
          });
        }
      }}
    >
      <Download className="size-4" aria-hidden="true" />
      Install app
    </Button>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild>
          <Link to="/register">Get started</Link>
        </Button>
      </div>
    );
  }

  const roleLabel =
    user.role === "donor" ? "Donor" : user.role === "recipient" ? "Recipient" : "Donor & Recipient";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full border border-border bg-card p-1 pr-3 transition hover:bg-accent"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(user.name)}
            </span>
          )}
          <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">
            {user.name.split(" ")[0]}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            <Pill tone="primary">{roleLabel}</Pill>
            {user.verificationStatus === "verified" ? <Pill tone="success">Verified</Pill> : null}
            {user.isAdmin ? <Pill tone="info">Admin</Pill> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <Home className="size-4" aria-hidden="true" /> Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/my-requests">
            <ClipboardList className="size-4" aria-hidden="true" /> My requests
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/activity">
            <Activity className="size-4" aria-hidden="true" /> My activity
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound className="size-4" aria-hidden="true" /> Donor profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="size-4" aria-hidden="true" /> Settings
          </Link>
        </DropdownMenuItem>
        {user.isAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <UserCog className="size-4" aria-hidden="true" /> Admin dashboard
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const DESKTOP_LINKS = [
  { to: "/", label: "Home", exact: true },
  { to: "/find-help", label: "Find Help" },
  { to: "/donors", label: "Donate" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/emergency", label: "Emergency" },
] as const;

function DesktopNav() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <nav className="hidden items-center gap-0.5 md:flex lg:gap-1" aria-label="Primary">
      {DESKTOP_LINKS.map((link) => {
        const target = link.to === "/dashboard" && !user ? "/login" : link.to;
        const active =
          link.to === "/" ? location.pathname === "/" : location.pathname.startsWith(link.to);
        return (
          <Link
            key={link.to}
            to={target}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-2.5 py-2 text-sm font-semibold whitespace-nowrap transition lg:px-3.5",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
      {user?.isAdmin ? (
        <Link
          to="/admin"
          aria-current={location.pathname.startsWith("/admin") ? "page" : undefined}
          className={cn(
            "rounded-full px-2.5 py-2 text-sm font-semibold transition lg:px-3.5",
            location.pathname.startsWith("/admin")
              ? "bg-primary-soft text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Admin
        </Link>
      ) : null}
    </nav>
  );
}

function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  const items = [
    { to: user ? "/dashboard" : "/", label: "Home", icon: Home },
    { to: "/find-help", label: "Find help", icon: Search },
    { to: "/donors", label: "Donate", icon: Droplet },
    { to: "/notifications", label: "Alerts", icon: BellRing, authOnly: true },
    { to: "/profile", label: "Profile", icon: UserRound, authOnly: true },
  ];

  return (
    <nav
      aria-label="Primary"
      className="sticky-bar-solid fixed inset-x-0 bottom-0 z-40 safe-bottom md:hidden"
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-between px-1.5 pt-1 pb-1">
        {items.map((item) => {
          if (item.authOnly && !user) {
            return (
              <Link
                key={item.to}
                to="/login"
                className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold text-muted-foreground"
              >
                <item.icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          }
          const active =
            item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold transition",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon
                className={cn("size-5", active && "scale-110 transition-transform")}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          );
        })}
      </div>
      {user ? (
        <Link
          to="/requests/new"
          aria-label="Request help"
          className="absolute -top-5 left-1/2 grid size-12 -translate-x-1/2 place-items-center rounded-full gradient-life text-white shadow-glow transition active:scale-95"
        >
          <Plus className="size-6" aria-hidden="true" strokeWidth={2.6} />
        </Link>
      ) : null}
    </nav>
  );
}

function OfflineBanner() {
  const { isOnline } = usePwa();
  if (isOnline) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-warning/20 px-4 py-2 text-center text-xs font-semibold text-warning-foreground">
      <WifiOff className="size-4" aria-hidden="true" />
      You are offline. Cached pages still work — actions will retry when the connection returns.
    </div>
  );
}

export function InstallBanner() {
  const { canInstall, installDismissed, dismissInstall, promptInstall, isIos, isStandalone } =
    usePwa();
  const [hidden, setHidden] = useState(false);

  if (hidden || isStandalone) return null;
  if (!canInstall && !isIos) return null;
  if (installDismissed && !isIos) return null;

  return (
    <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <LogoMark className="size-10" />
        <div>
          <p className="font-display text-sm font-bold">Install Heal Connect</p>
          <p className="text-xs text-muted-foreground">
            {isIos
              ? "Tap Share, then “Add to Home Screen” for the full app experience."
              : "Add it to your home screen for faster access and offline support."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canInstall ? (
          <Button
            size="sm"
            onClick={async () => {
              const outcome = await promptInstall();
              if (outcome !== "unavailable") setHidden(true);
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            Install
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          aria-label="Dismiss install prompt"
          onClick={() => {
            dismissInstall();
            setHidden(true);
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function UpdateReadyBanner() {
  const { updateReady, applyUpdate } = usePwa();
  if (!updateReady) return null;
  return (
    <div className="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
      A new version of Heal Connect is ready.
      <button type="button" onClick={applyUpdate} className="underline underline-offset-2">
        Update now
      </button>
    </div>
  );
}

export function SuspendedBanner() {
  const { user } = useAuth();
  if (!user || user.accountStatus !== "suspended") return null;
  return (
    <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3">
      <div className="page-shell flex items-start gap-3 text-sm text-destructive">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Your account is suspended</p>
          <p className="text-destructive/90">
            You can still browse, but publishing requests and offers is disabled. Contact{" "}
            <a className="underline underline-offset-2" href={`mailto:${BRAND.supportEmail}`}>
              {BRAND.supportEmail}
            </a>{" "}
            to appeal.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border bg-muted/40 sm:mt-16">
      <div className="page-shell grid grid-cols-2 gap-x-6 gap-y-7 py-8 sm:grid-cols-3 sm:gap-8 sm:py-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10 lg:py-12">
        <div className="col-span-2 space-y-3 sm:col-span-3 lg:col-span-1">
          <Logo showTagline />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {BRAND.positioning}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Pill tone="primary">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Privacy-first
            </Pill>
            <Pill tone="success">No payments for donation</Pill>
          </div>
        </div>
        <nav aria-label="Platform" className="space-y-2 text-sm sm:space-y-3">
          <p className="font-display text-sm font-bold">Platform</p>
          <ul className="text-muted-foreground">
            <li>
              <Link to="/find-help" className="tap-link hover:text-primary">
                Find help
              </Link>
            </li>
            <li>
              <Link to="/donors" className="tap-link hover:text-primary">
                Become a donor
              </Link>
            </li>
            <li>
              <Link to="/requests/new" className="tap-link hover:text-primary">
                Request help
              </Link>
            </li>
            <li>
              <Link to="/emergency" className="tap-link hover:text-primary">
                Emergency requests
              </Link>
            </li>
            <li>
              <Link to="/verify" className="tap-link hover:text-primary">
                Get verified
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Trust and safety" className="space-y-2 text-sm sm:space-y-3">
          <p className="font-display text-sm font-bold">Trust &amp; safety</p>
          <ul className="text-muted-foreground">
            <li>
              <Link to="/safety" className="tap-link hover:text-primary">
                Safety guidelines
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="tap-link hover:text-primary">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="tap-link hover:text-primary">
                Terms &amp; conditions
              </Link>
            </li>
            <li>
              <Link to="/settings" className="tap-link hover:text-primary">
                Report or block someone
              </Link>
            </li>
          </ul>
        </nav>
        <div className="space-y-2 text-sm sm:space-y-3">
          <p className="font-display text-sm font-bold">Support</p>
          <ul className="text-muted-foreground">
            <li>
              <a className="tap-link hover:text-primary" href={`mailto:${BRAND.supportEmail}`}>
                {BRAND.supportEmail}
              </a>
            </li>
            <li>
              <Link to="/faq" className="tap-link hover:text-primary">
                FAQ
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="page-shell space-y-2 border-t border-border py-5 text-[11px] leading-relaxed text-muted-foreground sm:space-y-3 sm:py-6 sm:text-xs">
        <p>{MEDICAL_DISCLAIMER}</p>
        <p>{EMERGENCY_DISCLAIMER}</p>
        <p>{ORGAN_DONATION_NOTICE}</p>
        <p>{PAYMENT_PROHIBITION}</p>
        <p className="pt-2">
          © {new Date().getFullYear()} {BRAND.name}. Demo product build — legal pages are
          placeholders awaiting legal review.
        </p>
      </div>
    </footer>
  );
}

export function AppShell({
  children,
  showFooter = false,
  className,
}: {
  children: ReactNode;
  showFooter?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <UpdateReadyBanner />
      <OfflineBanner />
      <SuspendedBanner />
      <header className="safe-top sticky top-0 z-40 sticky-bar">
        <div className="page-shell flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-3">
          <Link
            to={user ? "/dashboard" : "/"}
            className="-ml-1 flex items-center p-1"
            aria-label={`${BRAND.name} home`}
          >
            <Logo compact className="hidden sm:inline-flex" />
            <LogoMark className="size-8 sm:hidden" />
          </Link>
          <DesktopNav />
          <div className="flex items-center gap-1.5 sm:gap-2">
            {user ? (
              <Button
                size="sm"
                className="hidden gradient-life text-white hover:opacity-95 md:inline-flex"
                onClick={() => void navigate({ to: "/requests/new" })}
              >
                <HeartHandshake className="size-4" aria-hidden="true" />
                Request help
              </Button>
            ) : (
              <InstallButton compact />
            )}
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className={cn("flex-1 pb-mobile-nav", className)}>{children}</main>

      {showFooter ? <SiteFooter /> : null}
      <MobileBottomNav />
    </div>
  );
}
