import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { SessionUser } from "@/lib/domain";
import { fetchSession, signOut } from "@/server/api/auth";

type AuthContextValue = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refresh: () => Promise<SessionUser | null>;
  setUser: (user: SessionUser | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const navigate = useNavigate();

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await fetchSession();
      setUser(next);
      return next;
    } catch {
      return user;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // Ignore network failures on sign-out — the cookie is cleared server-side
      // when possible and the UI still returns to a signed-out state.
    }
    setUser(null);
    await router.invalidate();
    await navigate({ to: "/", replace: true });
    toast.success("Signed out. See you soon!");
  }, [navigate, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      refresh,
      setUser,
      signOut: handleSignOut,
    }),
    [handleSignOut, isLoading, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
