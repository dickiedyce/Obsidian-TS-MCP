/**
 * Tests for the pure utility functions added to fs-ops in the CLI-free
 * refactor: formatMomentDate, parseFrontmatter, stringifyFrontmatter,
 * extractHeadings, extractTasks, extractWikiLinks, and extractTags.
 */

import { describe, it, expect } from "vitest";
import {
  formatMomentDate,
  parseFrontmatter,
  stringifyFrontmatter,
  extractHeadings,
  extractTasks,
  extractWikiLinks,
  extractTags,
} from "../src/fs-ops.js";

// ── formatMomentDate ────────────────────────────────────────────────────

describe("formatMomentDate", () => {
  const date = new Date(2026, 2, 8, 14, 5, 30); // 2026-03-08 14:05:30

  it("formats YYYY-MM-DD", () => {
    expect(formatMomentDate("YYYY-MM-DD", date)).toBe("2026-03-08");
  });

  it("formats YY-MM-DD", () => {
    expect(formatMomentDate("YY-MM-DD", date)).toBe("26-03-08");
  });

  it("formats YYYY/M/D", () => {
    expect(formatMomentDate("YYYY/M/D", date)).toBe("2026/3/8");
  });

  it("formats MM/DD/YYYY", () => {
    expect(formatMomentDate("MM/DD/YYYY", date)).toBe("03/08/2026");
  });

  it("formats with HH:mm time tokens", () => {
    expect(formatMomentDate("YYYY-MM-DD HH:mm", date)).toBe("2026-03-08 14:05");
  });

  it("prefers longer tokens (MM over M in YYYY-MM-DD)", () => {
    // In "YYYY-MM-DD", 'MM' should match month, not 'M' twice
    expect(formatMomentDate("YYYY-MM-DD", date)).toBe("2026-03-08");
  });

  it("handles single-digit day/month without padding for M/D tokens", () => {
    const jan1 = new Date(2026, 0, 1); // 2026-01-01
    expect(formatMomentDate("M/D/YYYY", jan1)).toBe("1/1/2026");
  });

  it("passes through separator and non-token characters unchanged", () => {
    // Note: single-letter tokens (s=seconds, m=minutes, etc.) do match
    // wherever they appear; use characters that are not token letters.
    expect(formatMomentDate("YYYY/MM/DD", date)).toBe("2026/03/08");
    expect(formatMomentDate("[YYYY]", date)).toBe("[2026]");
  });
});

// ── parseFrontmatter ────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("returns hasFrontmatter=false for plain text", () => {
    const result = parseFrontmatter("# Hello\n\nBody text.");
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe("# Hello\n\nBody text.");
    expect(result.data).toEqual({});
  });

  it("parses simple key-value frontmatter", () => {
    const content = "---\ntitle: My Note\nstatus: active\n---\nBody";
    const result = parseFrontmatter(content);
    expect(result.hasFrontmatter).toBe(true);
    expect(result.data.title).toBe("My Note");
    expect(result.data.status).toBe("active");
    expect(result.body).toBe("Body");
  });

  it("parses YAML list frontmatter", () => {
    const content = "---\ntags:\n  - session\n  - debug\n---\nBody";
    const result = parseFrontmatter(content);
    expect(result.data.tags).toEqual(["session", "debug"]);
  });

  it("returns empty body when no content after frontmatter", () => {
    const content = "---\nkey: val\n---\n";
    const result = parseFrontmatter(content);
    expect(result.body).toBe("");
  });

  it("returns hasFrontmatter=false when closing --- is absent", () => {
    const result = parseFrontmatter("---\ntitle: broken\n");
    expect(result.hasFrontmatter).toBe(false);
  });

  it("returns hasFrontmatter=false on malformed YAML", () => {
    // Malformed YAML (unclosed bracket) -- should not throw
    const result = parseFrontmatter("---\ntags: [a, b\n---\nBody");
    expect(result.hasFrontmatter).toBe(false);
  });
});

// ── stringifyFrontmatter ────────────────────────────────────────────────

describe("stringifyFrontmatter", () => {
  it("wraps data in ---...--- delimiters", () => {
    const result = stringifyFrontmatter({ title: "Test" }, "Body");
    expect(result).toMatch(/^---\n/);
    expect(result).toContain("title: Test");
    expect(result).toMatch(/\n---\n/);
    expect(result).toContain("Body");
  });

  it("returns body unchanged when data is empty", () => {
    expect(stringifyFrontmatter({}, "Body here")).toBe("Body here");
  });

  it("round-trips through parseFrontmatter", () => {
    const original = { status: "active", tags: ["a", "b"] };
    const doc = stringifyFrontmatter(original, "# Heading\n");
    const parsed = parseFrontmatter(doc);
    expect(parsed.data.status).toBe("active");
    expect(parsed.data.tags).toEqual(["a", "b"]);
    expect(parsed.body).toBe("# Heading\n");
  });
});

// ── extractHeadings ─────────────────────────────────────────────────────

describe("extractHeadings", () => {
  it("extracts ATX headings with correct level and text", () => {
    const body = "# H1\n\nSome text\n\n## H2\n\n### H3";
    const result = extractHeadings(body);
    expect(result).toEqual([
      { level: 1, text: "H1", line: 1 },
      { level: 2, text: "H2", line: 5 },
      { level: 3, text: "H3", line: 7 },
    ]);
  });

  it("returns empty array when no headings present", () => {
    expect(extractHeadings("Just plain text\nNo headings here")).toEqual([]);
  });

  it("does not match #hashtag as a heading", () => {
    // '#tag' without a space after is not a heading
    const result = extractHeadings("#tag inline text");
    expect(result).toHaveLength(0);
  });
});

// ── extractTasks ────────────────────────────────────────────────────────

describe("extractTasks", () => {
  it("extracts open and checked tasks", () => {
    const content = "- [ ] Open task\n- [x] Done task\nNormal text";
    const result = extractTasks(content);
    expect(result).toEqual([
      { line: 1, checked: false, text: "Open task" },
      { line: 2, checked: true, text: "Done task" },
    ]);
  });

  it("handles capital X as checked", () => {
    const result = extractTasks("- [X] Done");
    expect(result[0].checked).toBe(true);
  });

  it("ignores non-task lines", () => {
    expect(extractTasks("No tasks here\nJust text")).toHaveLength(0);
  });

  it("captures task text without leading checkbox", () => {
    expect(extractTasks("- [ ] Buy milk")[0].text).toBe("Buy milk");
  });
});

// ── extractWikiLinks ────────────────────────────────────────────────────

describe("extractWikiLinks", () => {
  it("extracts bare wikilinks", () => {
    expect(extractWikiLinks("See [[MyNote]] for details")).toContain("MyNote");
  });

  it("extracts wikilinks with alias", () => {
    const links = extractWikiLinks("Click [[MyNote|here]]");
    expect(links).toContain("MyNote");
    expect(links).not.toContain("here");
  });

  it("extracts wikilinks with heading anchors", () => {
    const links = extractWikiLinks("See [[MyNote#Section 1]]");
    expect(links).toContain("MyNote");
  });

  it("extracts markdown file links", () => {
    const links = extractWikiLinks("See [this](notes/other.md) file");
    expect(links).toContain("notes/other.md");
  });

  it("returns unique links (deduplicates)", () => {
    const links = extractWikiLinks("[[A]] and [[A]] again");
    expect(links.filter((l) => l === "A")).toHaveLength(1);
  });
});

// ── extractTags ─────────────────────────────────────────────────────────

describe("extractTags", () => {
  it("extracts frontmatter tags array", () => {
    const tags = extractTags("", { tags: ["session", "debug"] });
    expect(tags).toContain("session");
    expect(tags).toContain("debug");
  });

  it("extracts inline #tags from body", () => {
    const tags = extractTags("This has #important and #todo tags", {});
    expect(tags).toContain("important");
    expect(tags).toContain("todo");
  });

  it("strips # prefix from frontmatter string tags", () => {
    const tags = extractTags("", { tags: ["#project"] });
    expect(tags).toContain("project");
    expect(tags).not.toContain("#project");
  });

  it("lowercases all tags", () => {
    const tags = extractTags("Body with #MyTag", { tags: ["SESSION"] });
    expect(tags).toContain("mytag");
    expect(tags).toContain("session");
  });

  it("deduplicates tags", () => {
    const tags = extractTags("#dup text #dup more", { tags: ["dup"] });
    expect(tags.filter((t) => t === "dup")).toHaveLength(1);
  });

  it("handles tag as a plain string in frontmatter", () => {
    const tags = extractTags("", { tag: "single-tag" });
    expect(tags).toContain("single-tag");
  });
});


