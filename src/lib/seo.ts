import { BRAND } from "./brand";

/**
 * Canonical site origin used for absolute URLs (Open Graph, canonical links).
 * Override with `VITE_SITE_URL` at build time when deploying to a custom domain.
 * Trailing slashes are trimmed so paths can be joined safely.
 */
const env = import.meta.env as Record<string, string | undefined>;
const configured = env["VITE_SITE_URL"];
export const SITE_URL = (configured && configured.trim()) || "https://healconnect.app";

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http")) return path;
  const origin = SITE_URL.replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageMetaInput = {
  title: string;
  description: string;
  /** Route path used for the canonical and Open Graph URL. Required for indexable pages. */
  path?: string;
  /** Open Graph object type — `website` unless the page is an article-style page. */
  type?: "website" | "article" | "profile";
  /** Set for authenticated or utility pages that must stay out of search indexes. */
  noIndex?: boolean;
};

type MetaTag =
  { title: string } | { name: string; content: string } | { property: string; content: string };

/**
 * Single source of truth for page metadata so every route ships a title,
 * description, canonical URL and social preview card without drift.
 */
export function pageHead({
  title,
  description,
  path,
  type = "website",
  noIndex = false,
}: PageMetaInput) {
  const image = absoluteUrl("/icons/icon-512.png");
  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
  const links: { rel: string; href: string }[] = [];
  if (path) {
    const url = absoluteUrl(path);
    meta.push({ property: "og:url", content: url });
    links.push({ rel: "canonical", href: url });
  }
  if (noIndex) meta.push({ name: "robots", content: "noindex, nofollow" });
  return { meta, links };
}

/**
 * FAQPage structured data (schema.org). Search engines use this to render
 * expandable Q&A results; the answers are the same copy the page already shows,
 * so there is nothing extra to keep in sync.
 */
export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    }),
  };
}
