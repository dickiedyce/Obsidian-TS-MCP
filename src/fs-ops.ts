/**
 * @module fs-ops
 *
 * Direct filesystem operations for vault file management.
 *
 * All interaction with the Obsidian vault happens through this module:
 * file reads and writes, directory walking, fuzzy file resolution,
 * YAML frontmatter parsing/serialisation, tag/link/task/heading extraction,
 * and daily-note / template configuration.
 */

import { mkdir, readFile, writeFile, access, readdir, stat, rename } from "node:fs/promises";
import { join, dirname, basename, relative } from "node:path";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

// ── Vault path ────────────────────────────────────────────────────────────

/** Cached vault root directory path (resolved once per process). */
let cachedVaultPath: string | undefined;

/**
 * Resolve the vault root directory path from the OBSIDIAN_VAULT_PATH
 * environment variable. Throws a descriptive error if the variable is unset.
 */
export async function getVaultPath(): Promise<string> {
  if (cachedVaultPath) return cachedVaultPath;

  const envPath = process.env.OBSIDIAN_VAULT_PATH;
  if (envPath) {
    cachedVaultPath = envPath;
    return envPath;
  }

  throw new Error(
    "Vault path not configured. Set the OBSIDIAN_VAULT_PATH environment " +
      "variable to the absolute path of your Obsidian vault.",
  );
}

/**
 * Clear the cached vault path. Intended for tests.
 */
export function resetVaultPathCache(): void {
  cachedVaultPath = undefined;
}

/**
 * Resolve a vault-relative path to an absolute filesystem path.
 */
export async function resolveVaultPath(relativePath: string): Promise<string> {
  const vaultRoot = await getVaultPath();
  return join(vaultRoot, relativePath);
}

// ── Basic file operations ─────────────────────────────────────────────────

/**
 * Write a file in the vault, creating parent directories as needed.
 * Refuses to overwrite an existing file unless `{ overwrite: true }` is passed.
 */
export async function writeVaultFile(
  relativePath: string,
  content: string,
  options?: { overwrite?: boolean },
): Promise<void> {
  const fullPath = await resolveVaultPath(relativePath);
  await mkdir(dirname(fullPath), { recursive: true });

  try {
    const flag = options?.overwrite ? "w" : "wx";
    await writeFile(fullPath, content, { encoding: "utf-8", flag });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`File already exists: ${relativePath}`);
    }
    throw err;
  }
}

/**
 * Read a file from the vault by exact vault-relative path.
 */
export async function readVaultFile(relativePath: string): Promise<string> {
  const fullPath = await resolveVaultPath(relativePath);
  return readFile(fullPath, "utf-8");
}

/**
 * Check whether a file exists in the vault.
 */
export async function vaultFileExists(relativePath: string): Promise<boolean> {
  const fullPath = await resolveVaultPath(relativePath);
  try {
    await access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Move (rename) a file within the vault, creating the destination directory
 * as needed.
 */
export async function moveVaultFile(from: string, to: string): Promise<void> {
  const fromFull = await resolveVaultPath(from);
  const toFull = await resolveVaultPath(to);
  await mkdir(dirname(toFull), { recursive: true });
  await rename(fromFull, toFull);
}

// ── Directory walking ─────────────────────────────────────────────────────

/**
 * Recursively collect file paths under `dir`, returning paths relative to
 * `vaultRoot`. Hidden entries (starting with `.`) are skipped.
 */
async function walkDir(
  dir: string,
  vaultRoot: string,
  extFilter?: string,
): Promise<string[]> {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    const relPath = relative(vaultRoot, fullPath).replace(/\\/g, "/");

    let st;
    try {
      st = await stat(fullPath);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      const children = await walkDir(fullPath, vaultRoot, extFilter);
      results.push(...children);
    } else if (!extFilter || relPath.endsWith(`.${extFilter}`)) {
      results.push(relPath);
    }
  }

  return results;
}

/**
 * List files in the vault, optionally filtered by folder prefix and
 * file extension. Returns vault-relative paths.
 */
export async function listVaultFiles(opts?: {
  folder?: string;
  ext?: string;
}): Promise<string[]> {
  const vaultRoot = await getVaultPath();
  const startDir = opts?.folder ? join(vaultRoot, opts.folder) : vaultRoot;
  return walkDir(startDir, vaultRoot, opts?.ext);
}

/**
 * Resolve a note name to a vault-relative path by scanning the vault for a
 * matching `.md` file. Prefers the shallowest match; ties broken alphabetically.
 * Returns `null` if no matching file is found.
 */
export async function findFileByName(name: string): Promise<string | null> {
  const files = await listVaultFiles({ ext: "md" });
  const target = name.toLowerCase().replace(/\.md$/i, "");

  const matches = files.filter(
    (f) => basename(f, ".md").toLowerCase() === target,
  );

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const diff = a.split("/").length - b.split("/").length;
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  return matches[0];
}

// ── Vault configuration ───────────────────────────────────────────────────

/** Obsidian daily-notes plugin configuration. */
export interface DailyNoteConfig {
  folder: string;
  format: string;
  template?: string;
}

/**
 * Read the Obsidian daily-notes plugin configuration from
 * `.obsidian/daily-notes.json`. Falls back to sensible defaults when the
 * file is absent or malformed.
 */
export async function getDailyNoteConfig(): Promise<DailyNoteConfig> {
  try {
    const configPath = await resolveVaultPath(".obsidian/daily-notes.json");
    const raw = await readFile(configPath, "utf-8");
    const data = JSON.parse(raw) as Partial<DailyNoteConfig>;
    return {
      folder: typeof data.folder === "string" ? data.folder : "",
      format: typeof data.format === "string" ? data.format : "YYYY-MM-DD",
      template: typeof data.template === "string" ? data.template : undefined,
    };
  } catch {
    return { folder: "", format: "YYYY-MM-DD" };
  }
}

/**
 * Read the Obsidian templates plugin configuration. Returns the configured
 * folder (default: `"Templates"`).
 */
export async function getTemplatesFolder(): Promise<string> {
  try {
    const configPath = await resolveVaultPath(".obsidian/templates.json");
    const raw = await readFile(configPath, "utf-8");
    const data = JSON.parse(raw) as { folder?: string };
    return typeof data.folder === "string" ? data.folder : "Templates";
  } catch {
    return "Templates";
  }
}

/**
 * Format a date using a moment.js-compatible format string.
 * Supported tokens: YYYY, YY, MM, M, DD, D, HH, H, mm, m, ss, s.
 * Longer tokens are matched before shorter ones so "MM" beats "M".
 */
export function formatMomentDate(format: string, date: Date): string {
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(2),
    MM: String(date.getMonth() + 1).padStart(2, "0"),
    M: String(date.getMonth() + 1),
    DD: String(date.getDate()).padStart(2, "0"),
    D: String(date.getDate()),
    HH: String(date.getHours()).padStart(2, "0"),
    H: String(date.getHours()),
    mm: String(date.getMinutes()).padStart(2, "0"),
    m: String(date.getMinutes()),
    ss: String(date.getSeconds()).padStart(2, "0"),
    s: String(date.getSeconds()),
  };
  return format.replace(
    /YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g,
    (tok) => tokens[tok] ?? tok,
  );
}

/**
 * Compute the vault-relative path of a daily note for a given date
 * (defaults to today).
 */
export async function getDailyNotePath(date?: Date): Promise<string> {
  const config = await getDailyNoteConfig();
  const d = date ?? new Date();
  const dateStr = formatMomentDate(config.format, d);
  return config.folder ? `${config.folder}/${dateStr}.md` : `${dateStr}.md`;
}

// ── Frontmatter parsing ───────────────────────────────────────────────────

/** Result of parsing a markdown document's YAML frontmatter. */
export interface FrontmatterResult {
  data: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

/**
 * Parse YAML frontmatter delimited by `---` from a markdown document.
 * Returns the parsed data object, the body after the closing `---`, and a
 * flag indicating whether frontmatter was present.
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { data: {}, body: content, hasFrontmatter: false };
  }

  const endIdx = content.indexOf("\n---", 4);
  if (endIdx === -1) {
    return { data: {}, body: content, hasFrontmatter: false };
  }

  const rawYaml = content.slice(4, endIdx);
  const after = content.slice(endIdx + 4);
  const body = after.startsWith("\n") ? after.slice(1) : after;

  let data: Record<string, unknown> = {};
  try {
    const parsed = yamlLoad(rawYaml);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed YAML -- return without frontmatter
    return { data: {}, body: content, hasFrontmatter: false };
  }

  return { data, body, hasFrontmatter: true };
}

/**
 * Serialise a frontmatter data object and body back into a complete markdown
 * document. When `data` is empty, returns the body unchanged (no frontmatter
 * block is added).
 */
export function stringifyFrontmatter(
  data: Record<string, unknown>,
  body: string,
): string {
  if (Object.keys(data).length === 0) return body;
  const yamlStr = yamlDump(data, { lineWidth: -1 }).trimEnd();
  return `---\n${yamlStr}\n---\n${body}`;
}

/**
 * Coerce a string value to the appropriate JavaScript type for a given
 * Obsidian property type tag.
 */
export function coercePropertyValue(value: string, type?: string): unknown {
  switch (type) {
    case "number":
      return Number(value);
    case "checkbox":
      return value === "true" || value === "1";
    case "list":
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    default:
      return value;
  }
}

// ── Markdown content utilities ────────────────────────────────────────────

/** A heading extracted from a markdown document. */
export interface Heading {
  level: number;
  text: string;
  line: number;
}

/**
 * Extract all ATX-style headings (`# Heading`) from document body content.
 * Line numbers are 1-based and relative to the body (not the full document).
 */
export function extractHeadings(body: string): Heading[] {
  const headings: Heading[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
    }
  }
  return headings;
}

/** A task checkbox item extracted from a markdown document. */
export interface TaskEntry {
  line: number;
  checked: boolean;
  text: string;
}

/**
 * Extract all task checkbox lines from a markdown document.
 * Line numbers are 1-based.
 */
export function extractTasks(content: string): TaskEntry[] {
  const tasks: TaskEntry[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const checked = lines[i].match(/^\s*-\s+\[x\]\s+(.*)$/i);
    const open = lines[i].match(/^\s*-\s+\[ \]\s+(.*)$/);
    if (checked) {
      tasks.push({ line: i + 1, checked: true, text: checked[1] });
    } else if (open) {
      tasks.push({ line: i + 1, checked: false, text: open[1] });
    }
  }
  return tasks;
}

/**
 * Extract all outgoing links from a markdown document body.
 * Collects `[[wikilink]]` / `[[wikilink|alias]]` targets and
 * `[text](file.md)` markdown link targets.
 */
export function extractWikiLinks(body: string): string[] {
  const links = new Set<string>();
  const wikiRe = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiRe.exec(body)) !== null) {
    const t = m[1].trim();
    if (t) links.add(t);
  }
  const mdRe = /\[[^\]]*\]\(([^)#]+\.md)[^)]*\)/g;
  while ((m = mdRe.exec(body)) !== null) {
    const t = m[1].trim();
    if (t) links.add(t);
  }
  return [...links];
}

/**
 * Extract all tags from a markdown document.
 * Collects frontmatter `tags:` / `tag:` array entries and inline `#tag`
 * patterns from the body text.
 */
export function extractTags(
  body: string,
  frontmatter: Record<string, unknown>,
): string[] {
  const tags = new Set<string>();

  const fmTags = frontmatter.tags ?? frontmatter.tag;
  if (Array.isArray(fmTags)) {
    for (const t of fmTags) {
      if (typeof t === "string") tags.add(t.replace(/^#/, "").toLowerCase());
    }
  } else if (typeof fmTags === "string") {
    tags.add(fmTags.replace(/^#/, "").toLowerCase());
  }

  // Inline tags: #word not preceded by alphanumeric (avoids matching URLs)
  const tagRe = /(?:^|[\s,({\[;])#([a-zA-Z][a-zA-Z0-9_/\-]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body)) !== null) {
    tags.add(m[1].toLowerCase());
  }

  return [...tags];
}

