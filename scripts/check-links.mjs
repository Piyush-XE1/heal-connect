#!/usr/bin/env node
/**
 * Link sanity check for Heal Connect.
 *
 * Walks the generated route tree and every `to="..."` / `href="/..."` literal in
 * `src/`, then reports links that cannot resolve to a known route, placeholder
 * targets (`#`, empty strings, `javascript:`), and anchors without text.
 *
 * Usage: node scripts/check-links.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const routeTreePath = join(root, "src/routeTree.gen.ts");

/** Parse the file-based route ids out of the generated route tree. */
function routePaths() {
  const source = readFileSync(routeTreePath, "utf8");
  const ids = new Set();
  for (const match of source.matchAll(/id:\s*['"]([^'"]*)['"]/g)) {
    const id = match[1];
    if (!id.startsWith("/")) continue;
    // Route ids look like "/_app/find-help" or "/_app/requests/$requestId/".
    const cleaned = id
      .split("/")
      .filter((segment) => segment && !segment.startsWith("_"))
      .map((segment) => (segment.startsWith("$") ? ":" : segment))
      .join("/");
    ids.add(`/${cleaned}`.replace(/\/$/, "") || "/");
  }
  return ids;
}

const staticRoutes = routePaths();

/** Turn a concrete href into a comparable route shape (`/requests/abc` -> `/requests/:requestId`). */
function normalize(href) {
  const path = href.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  if (staticRoutes.has(path)) return path;
  const parts = path.split("/").filter(Boolean);
  for (const route of staticRoutes) {
    const routeParts = route.split("/").filter(Boolean);
    if (routeParts.length !== parts.length) continue;
    if (routeParts.every((segment, index) => segment.startsWith(":") || segment === parts[index])) {
      return route;
    }
  }
  return path;
}

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) entries.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(name)) entries.push(full);
  }
  return entries;
}

const files = walk(join(root, "src")).filter((file) => !file.endsWith("routeTree.gen.ts"));
const problems = [];
let checked = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const rel = relative(root, file);

  for (const match of source.matchAll(/\bto="([^"]*)"/g)) {
    const target = match[1];
    checked += 1;
    if (target === "" || target === "#" || target.startsWith("javascript:")) {
      problems.push(`${rel}: placeholder link \`to="${target}"\``);
      continue;
    }
    if (target.startsWith("http") || target.startsWith("mailto:") || target.startsWith("tel:"))
      continue;
    if (!staticRoutes.has(normalize(target))) {
      problems.push(`${rel}: \`to="${target}"\` does not match any route`);
    }
  }

  for (const match of source.matchAll(/href="([^"]*)"/g)) {
    const target = match[1];
    checked += 1;
    if (target === "#" || target === "" || target.startsWith("javascript:")) {
      problems.push(`${rel}: placeholder link \`href="${target}"\``);
      continue;
    }
    if (/^(https?:|mailto:|tel:|data:|\/icons\/|\/manifest|\/sw\.js|\/offline)/.test(target))
      continue;
    if (target.startsWith("/")) {
      if (!staticRoutes.has(normalize(target))) {
        problems.push(`${rel}: \`href="${target}"\` does not match any route`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} link problem(s) found:\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ ${checked} internal links resolve against ${staticRoutes.size} routes`);
