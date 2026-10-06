import { cn } from "@/lib/utils";

/**
 * The mark: a rounded gradient tile with a heart carrying a pulse line —
 * "care" and "connection" in one shape. Reused for the PWA icons.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("size-9 shrink-0", className)}
    >
      <defs>
        <linearGradient id="hc-mark-gradient" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1FA8A0" />
          <stop offset="0.55" stopColor="#0E8C86" />
          <stop offset="1" stopColor="#1B6FA8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#hc-mark-gradient)" />
      <path
        d="M32 49.5c-7.6-5.9-15.2-12.4-15.2-20.2A9.1 9.1 0 0 1 32 22.6a9.1 9.1 0 0 1 15.2 6.7c0 7.8-7.6 14.3-15.2 20.2Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 31.5h6.2l3.1-6.6 4.6 13.2 3.2-6.6h8.4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
  showTagline = false,
}: {
  className?: string;
  compact?: boolean;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={compact ? "size-8" : "size-9"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-extrabold tracking-tight",
            compact ? "text-lg" : "text-xl",
          )}
        >
          Heal<span className="text-primary">Connect</span>
        </span>
        {showTagline ? (
          <span className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Give. Receive. Save lives.
          </span>
        ) : null}
      </span>
    </span>
  );
}
