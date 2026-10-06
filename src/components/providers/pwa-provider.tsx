import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * PWA plumbing: service worker registration, connectivity awareness and the
 * deferred install prompt. Kept behind a provider so any screen can offer the
 * "Install app" affordance without duplicating browser quirks.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaContextValue = {
  isOnline: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  installDismissed: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismissInstall: () => void;
  isIos: boolean;
  updateReady: boolean;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

const DISMISS_KEY = "heal-connect:install-dismissed";

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    setInstallDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;
        setRegistration(reg);
        if (reg.waiting) setUpdateReady(true);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      } catch (error) {
        console.warn("[heal-connect] service worker registration failed", error);
      }
    };

    void register();

    const handleControllerChange = () => {
      // A new worker took control: reload once so the shell matches.
      if (document.visibilityState === "visible") {
        setTimeout(() => window.location.reload(), 300);
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "dismissed") {
      setInstallDismissed(true);
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    return choice.outcome;
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setInstallDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      setUpdateReady(false);
    } else {
      window.location.reload();
    }
  }, [registration]);

  const value = useMemo<PwaContextValue>(
    () => ({
      isOnline,
      isStandalone,
      canInstall: Boolean(deferredPrompt) && !isStandalone,
      installDismissed,
      promptInstall,
      dismissInstall,
      isIos,
      updateReady,
      applyUpdate,
    }),
    [
      applyUpdate,
      deferredPrompt,
      dismissInstall,
      installDismissed,
      isIos,
      isOnline,
      isStandalone,
      promptInstall,
      updateReady,
    ],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaContextValue {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa must be used inside PwaProvider");
  return context;
}
