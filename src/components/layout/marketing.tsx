import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

const SECTION_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#participate", label: "Donors & recipients" },
  { href: "/#trust", label: "Trust & safety" },
  { href: "/#emergency-assistance", label: "Emergency" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function MarketingHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled ? "border-b border-border bg-background/90 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="Heal Connect home" className="flex items-center">
          <Logo />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/notifications">Notifications</Link>
              </Button>
              <Button asChild>
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
