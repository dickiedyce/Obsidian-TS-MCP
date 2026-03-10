import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTool } from "../src/handlers.js";

// Mock only I/O functions from fs-ops; pure functions (parseFrontmatter,
// extractTags, etc.) are left real via importOriginal spread.
vi.mock("../src/fs-ops.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/fs-ops.js")>();
  return {
    ...actual,
    readVaultFile: vi.fn().mockResolvedValue(""),
    writeVaultFile: vi.fn().mockResolvedValue(undefined),
    vaultFileExists: vi.fn().mockResolvedValue(false),
    getVaultPath: vi.fn().mockResolvedValue("/mock/vault"),
    resolveVaultPath: vi.fn().mockImplementation((p: string) =>
      Promise.resolve(`/mock/vault/${p}`),
    ),
    moveVaultFile: vi.fn().mockResolvedValue(undefined),
    listVaultFiles: vi.fn().mockResolvedValue([]),
    findFileByName: vi.fn().mockResolvedValue(null),
    getDailyNotePath: vi.fn().mockResolvedValue("Daily Notes/2026-01-01.md"),
    getDailyNoteConfig: vi.fn().mockResolvedValue({
      folder: "Daily Notes",
      format: "YYYY-MM-DD",
      template: undefined,
    }),
    getTemplatesFolder: vi.fn().mockResolvedValue("Templates"),
  };
});

import {
  readVaultFile,
  writeVaultFile,
  vaultFileExists,
  getVaultPath,
  moveVaultFile,
  listVaultFiles,
  findFileByName,
  getDailyNotePath,
  getDailyNoteConfig,
  getTemplatesFolder,
} from "../src/fs-ops.js";

const mockRead = vi.mocked(readVaultFile);
const mockWrite = vi.mocked(writeVaultFile);
const mockExists = vi.mocked(vaultFileExists);
const mockGetVaultPath = vi.mocked(getVaultPath);
const mockMove = vi.mocked(moveVaultFile);
const mockListFiles = vi.mocked(listVaultFiles);
const mockFindFile = vi.mocked(findFileByName);
const mockDailyPath = vi.mocked(getDailyNotePath);
const mockDailyConfig = vi.mocked(getDailyNoteConfig);
const mockTemplatesFolder = vi.mocked(getTemplatesFolder);

beforeEach(() => {
  vi.resetAllMocks();
  mockRead.mockResolvedValue("");
  mockWrite.mockResolvedValue(undefined);
  mockExists.mockResolvedValue(false);
  mockGetVaultPath.mockResolvedValue("/mock/vault");
  mockMove.mockResolvedValue(undefined);
  mockListFiles.mockResolvedValue([]);
  mockFindFile.mockResolvedValue(null);
  mockDailyPath.mockResolvedValue("Daily Notes/2026-01-01.md");
  mockDailyConfig.mockResolvedValue({
    folder: "Daily Notes",
    format: "YYYY-MM-DD",
    template: undefined,
  });
  mockTemplatesFolder.mockResolvedValue("Templates");
});

// ── create_note ──────────────────────────────────────────────────────────

describe("create_note", () => {
  it("creates a root-level note by name", async () => {
    const result = await handleTool("create_note", { name: "MyNote" });
    expect(mockWrite).toHaveBeenCalledWith("MyNote.md", "", {
      overwrite: undefined,
    });
    expect(result).toBe("Created: MyNote.md");
  });

  it("creates note at explicit path", async () => {
    const result = await handleTool("create_note", {
      name: "overview",
      path: "Projects/Test/overview.md",
      content: "# Test",
    });
    expect(mockWrite).toHaveBeenCalledWith(
      "Projects/Test/overview.md",
      "# Test",
      { overwrite: undefined },
    );
    expect(result).toBe("Created: Projects/Test/overview.md");
  });

  it("appends .md to path when missing", async () => {
    await handleTool("create_note", { name: "Note", path: "Folder/Note" });
    expect(mockWrite).toHaveBeenCalledWith("Folder/Note.md", "", {
      overwrite: undefined,
    });
  });

  it("treats name with slash as a path", async () => {
    const result = await handleTool("create_note", { name: "Folder/Note" });
    expect(mockWrite).toHaveBeenCalledWith("Folder/Note.md", "", {
      overwrite: undefined,
    });
    expect(result).toBe("Created: Folder/Note.md");
  });

  it("passes overwrite flag when true", async () => {
    await handleTool("create_note", { name: "Note", overwrite: true });
    expect(mockWrite).toHaveBeenCalledWith("Note.md", "", { overwrite: true });
  });

  it("omits overwrite when not provided", async () => {
    await handleTool("create_note", { name: "Note" });
    const [, , opts] = mockWrite.mock.calls[0] as [
      string,
      string,
      { overwrite?: boolean },
    ];
    expect(opts.overwrite).toBeUndefined();
  });

  it("uses provided content", async () => {
    await handleTool("create_note", { name: "Note", content: "Hello" });
    expect(mockWrite).toHaveBeenCalledWith("Note.md", "Hello", {
      overwrite: undefined,
    });
  });

  it("prepends template content when template specified without content", async () => {
    mockRead.mockResolvedValueOnce("Template body");
    await handleTool("create_note", { name: "Note", template: "daily" });
    expect(mockRead).toHaveBeenCalledWith("Templates/daily.md");
    expect(mockWrite).toHaveBeenCalledWith("Note.md", "Template body", {
      overwrite: undefined,
    });
  });

  it("combines template and content with newline separator", async () => {
    mockRead.mockResolvedValueOnce("Template body");
    await handleTool("create_note", {
      name: "Note",
      template: "daily",
      content: "Extra",
    });
    expect(mockWrite).toHaveBeenCalledWith("Note.md", "Template body\nExtra", {
      overwrite: undefined,
    });
  });
});

// ── read_note ────────────────────────────────────────────────────────────

describe("read_note", () => {
  it("reads by explicit path", async () => {
    mockRead.mockResolvedValueOnce("note content");
    const result = await handleTool("read_note", { path: "Notes/MyNote.md" });
    expect(mockRead).toHaveBeenCalledWith("Notes/MyNote.md");
    expect(result).toBe("note content");
  });

  it("resolves bare file name via findFileByName", async () => {
    mockFindFile.mockResolvedValueOnce("Notes/MyNote.md");
    mockRead.mockResolvedValueOnce("found content");
    const result = await handleTool("read_note", { file: "MyNote" });
    expect(mockFindFile).toHaveBeenCalledWith("MyNote");
    expect(mockRead).toHaveBeenCalledWith("Notes/MyNote.md");
    expect(result).toBe("found content");
  });

  it("falls back to name.md when findFileByName returns null", async () => {
    mockFindFile.mockResolvedValueOnce(null);
    await handleTool("read_note", { file: "MyNote" });
    expect(mockRead).toHaveBeenCalledWith("MyNote.md");
  });

  it("treats file with slash as a path (no findFileByName call)", async () => {
    await handleTool("read_note", { file: "Notes/MyNote.md" });
    expect(mockRead).toHaveBeenCalledWith("Notes/MyNote.md");
    expect(mockFindFile).not.toHaveBeenCalled();
  });
});

// ── append_to_note ───────────────────────────────────────────────────────

describe("append_to_note", () => {
  it("appends content separated by newline when existing does not end in one", async () => {
    mockRead.mockResolvedValueOnce("existing");
    const result = await handleTool("append_to_note", {
      path: "Notes/Test.md",
      content: "new line",
    });
    expect(mockWrite).toHaveBeenCalledWith(
      "Notes/Test.md",
      "existing\nnew line",
      { overwrite: true },
    );
    expect(result).toBe("Appended to: Notes/Test.md");
  });

  it("does not add extra newline when existing ends in one", async () => {
    mockRead.mockResolvedValueOnce("existing\n");
    await handleTool("append_to_note", {
      path: "Notes/Test.md",
      content: "new",
    });
    expect(mockWrite).toHaveBeenCalledWith("Notes/Test.md", "existing\nnew", {
      overwrite: true,
    });
  });
});

// ── prepend_to_note ──────────────────────────────────────────────────────

describe("prepend_to_note", () => {
  it("prepends to file without frontmatter", async () => {
    mockRead.mockResolvedValueOnce("existing content");
    const result = await handleTool("prepend_to_note", {
      path: "Notes/Test.md",
      content: "prepended",
    });
    expect(mockWrite).toHaveBeenCalledWith(
      "Notes/Test.md",
      "prepended\nexisting content",
      { overwrite: true },
    );
    expect(result).toBe("Prepended to: Notes/Test.md");
  });

  it("inserts after frontmatter block when present", async () => {
    mockRead.mockResolvedValueOnce("---\ntitle: Test\n---\nbody content");
    await handleTool("prepend_to_note", {
      path: "Notes/Test.md",
      content: "inserted",
    });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("---");
    expect(written).toContain("title: Test");
    const insertIdx = written.indexOf("inserted");
    const bodyIdx = written.indexOf("body content");
    expect(insertIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeLessThan(bodyIdx);
  });
});

// ── str_replace_in_note ───────────────────────────────────────────────────

describe("str_replace_in_note", () => {
  it("replaces a unique occurrence of old_str with new_str", async () => {
    mockRead.mockResolvedValueOnce("Hello world, this is a test.");
    const result = await handleTool("str_replace_in_note", {
      path: "Notes/Test.md",
      old_str: "world",
      new_str: "universe",
    });
    expect(mockWrite).toHaveBeenCalledWith(
      "Notes/Test.md",
      "Hello universe, this is a test.",
      { overwrite: true },
    );
    expect(result).toBe("Replaced in: Notes/Test.md");
  });

  it("throws when old_str is not found in the note", async () => {
    mockRead.mockResolvedValueOnce("Hello world");
    await expect(
      handleTool("str_replace_in_note", {
        path: "Notes/Test.md",
        old_str: "missing",
        new_str: "replacement",
      }),
    ).rejects.toThrow("not found");
  });

  it("throws when old_str appears more than once", async () => {
    mockRead.mockResolvedValueOnce("foo bar foo baz");
    await expect(
      handleTool("str_replace_in_note", {
        path: "Notes/Test.md",
        old_str: "foo",
        new_str: "qux",
      }),
    ).rejects.toThrow("multiple");
  });

  it("handles multi-line old_str and new_str", async () => {
    mockRead.mockResolvedValueOnce("line1\nline2\nline3");
    const result = await handleTool("str_replace_in_note", {
      path: "Notes/Test.md",
      old_str: "line1\nline2",
      new_str: "replaced1\nreplaced2",
    });
    expect(mockWrite).toHaveBeenCalledWith(
      "Notes/Test.md",
      "replaced1\nreplaced2\nline3",
      { overwrite: true },
    );
    expect(result).toBe("Replaced in: Notes/Test.md");
  });

  it("resolves file by name via findFileByName", async () => {
    mockFindFile.mockResolvedValueOnce("Notes/MyNote.md");
    mockRead.mockResolvedValueOnce("old content");
    const result = await handleTool("str_replace_in_note", {
      file: "MyNote",
      old_str: "old content",
      new_str: "new content",
    });
    expect(mockFindFile).toHaveBeenCalledWith("MyNote");
    expect(mockWrite).toHaveBeenCalledWith(
      "Notes/MyNote.md",
      "new content",
      { overwrite: true },
    );
    expect(result).toBe("Replaced in: Notes/MyNote.md");
  });
});

// ── search_vault ─────────────────────────────────────────────────────────

describe("search_vault", () => {
  it("returns JSON matches from files containing query text", async () => {
    mockListFiles.mockResolvedValueOnce(["Notes/A.md", "Notes/B.md"]);
    mockRead.mockResolvedValueOnce("hello world\nfoo bar");
    mockRead.mockResolvedValueOnce("no match here");
    const result = await handleTool("search_vault", { query: "hello" });
    const parsed = JSON.parse(result) as Array<{
      path: string;
      matches: Array<{ line: number; text: string }>;
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe("Notes/A.md");
    expect(parsed[0].matches[0].text).toBe("hello world");
  });

  it("performs tag search when query starts with #", async () => {
    mockListFiles.mockResolvedValueOnce(["Notes/A.md"]);
    mockRead.mockResolvedValueOnce("#mytag inline content");
    const result = await handleTool("search_vault", { query: "#mytag" });
    const parsed = JSON.parse(result) as unknown[];
    expect(parsed).toHaveLength(1);
  });

  it("limits results to the provided limit count", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md", "c.md"]);
    mockRead.mockResolvedValue("match");
    const result = await handleTool("search_vault", {
      query: "match",
      limit: 2,
    });
    const parsed = JSON.parse(result) as unknown[];
    expect(parsed).toHaveLength(2);
  });

  it("returns text format when format=text", async () => {
    mockListFiles.mockResolvedValueOnce(["Notes/A.md"]);
    mockRead.mockResolvedValueOnce("matching line");
    const result = await handleTool("search_vault", {
      query: "matching",
      format: "text",
    });
    expect(result).toContain("Notes/A.md");
    expect(result[0]).not.toBe("[");
  });
});

// ── daily_note ───────────────────────────────────────────────────────────

describe("daily_note", () => {
  it("returns daily note path when file already exists", async () => {
    mockExists.mockResolvedValueOnce(true);
    const result = await handleTool("daily_note", {});
    expect(result).toBe("Daily Notes/2026-01-01.md");
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("creates an empty daily note when it does not exist (no template)", async () => {
    mockExists.mockResolvedValueOnce(false);
    await handleTool("daily_note", {});
    expect(mockWrite).toHaveBeenCalledWith("Daily Notes/2026-01-01.md", "");
  });

  it("creates daily note from template when config specifies one", async () => {
    mockExists.mockResolvedValueOnce(false);
    mockDailyConfig.mockResolvedValueOnce({
      folder: "Daily Notes",
      format: "YYYY-MM-DD",
      template: "daily-template",
    });
    mockRead.mockResolvedValueOnce("Template content {{date}}");
    const result = await handleTool("daily_note", {});
    expect(result).toBe("Daily Notes/2026-01-01.md");
    expect(mockWrite).toHaveBeenCalled();
    const [, written] = mockWrite.mock.calls[0] as [string, string];
    expect(written).not.toContain("{{date}}");
  });
});

// ── daily_append ─────────────────────────────────────────────────────────

describe("daily_append", () => {
  it("appends to existing daily note", async () => {
    mockRead.mockResolvedValueOnce("existing");
    const result = await handleTool("daily_append", { content: "new entry" });
    expect(mockWrite).toHaveBeenCalledWith(
      "Daily Notes/2026-01-01.md",
      "existing\nnew entry",
      { overwrite: true },
    );
    expect(result).toContain("Daily Notes/2026-01-01.md");
  });

  it("creates daily note when read fails (new file)", async () => {
    mockRead.mockRejectedValueOnce(new Error("ENOENT"));
    await handleTool("daily_append", { content: "first entry" });
    expect(mockWrite).toHaveBeenCalledWith(
      "Daily Notes/2026-01-01.md",
      "first entry",
    );
  });
});

// ── daily_read ───────────────────────────────────────────────────────────

describe("daily_read", () => {
  it("returns content of existing daily note", async () => {
    mockExists.mockResolvedValueOnce(true);
    mockRead.mockResolvedValueOnce("daily content");
    const result = await handleTool("daily_read", {});
    expect(mockRead).toHaveBeenCalledWith("Daily Notes/2026-01-01.md");
    expect(result).toBe("daily content");
  });

  it("creates empty daily note if it does not exist", async () => {
    mockExists.mockResolvedValueOnce(false);
    mockRead.mockResolvedValueOnce("");
    await handleTool("daily_read", {});
    expect(mockWrite).toHaveBeenCalledWith("Daily Notes/2026-01-01.md", "");
  });
});

// ── daily_prepend ────────────────────────────────────────────────────────

describe("daily_prepend", () => {
  it("prepends to existing daily note", async () => {
    mockRead.mockResolvedValueOnce("existing body");
    const result = await handleTool("daily_prepend", { content: "header" });
    expect(result).toContain("Daily Notes/2026-01-01.md");
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written.startsWith("header")).toBe(true);
    expect(written).toContain("existing body");
  });

  it("inserts after frontmatter when daily note has it", async () => {
    mockRead.mockResolvedValueOnce("---\ndate: 2026-01-01\n---\nbody");
    await handleTool("daily_prepend", { content: "NEW" });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    const fmEnd = written.lastIndexOf("---\n");
    const insertedIdx = written.indexOf("NEW");
    expect(insertedIdx).toBeGreaterThan(fmEnd);
  });

  it("creates daily note when it does not exist", async () => {
    mockRead.mockRejectedValueOnce(new Error("ENOENT"));
    await handleTool("daily_prepend", { content: "first prepend" });
    expect(mockWrite).toHaveBeenCalled();
    const [, written] = mockWrite.mock.calls[0] as [string, string];
    expect(written).toContain("first prepend");
  });
});

// ── get_vault_info ───────────────────────────────────────────────────────

describe("get_vault_info", () => {
  it("returns summary with name, path, files, folders by default", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "folder/b.md"]);
    const result = await handleTool("get_vault_info", {});
    expect(result).toContain("name:");
    expect(result).toContain("path: /mock/vault");
    expect(result).toContain("files: 2");
  });

  it("returns vault path when info=path", async () => {
    const result = await handleTool("get_vault_info", { info: "path" });
    expect(result).toBe("/mock/vault");
  });

  it("returns vault basename when info=name", async () => {
    const result = await handleTool("get_vault_info", { info: "name" });
    expect(result).toBe("vault");
  });

  it("returns file count as string when info=files", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md", "c.md"]);
    const result = await handleTool("get_vault_info", { info: "files" });
    expect(result).toBe("3");
  });

  it("returns folder count when info=folders", async () => {
    mockListFiles.mockResolvedValueOnce([
      "a.md",
      "folder1/b.md",
      "folder2/c.md",
    ]);
    const result = await handleTool("get_vault_info", { info: "folders" });
    expect(result).toBe("2");
  });
});

// ── list_files ───────────────────────────────────────────────────────────

describe("list_files", () => {
  it("returns files joined by newline", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md"]);
    const result = await handleTool("list_files", {});
    expect(result).toBe("a.md\nb.md");
  });

  it("returns count as string when total=true", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md", "c.md"]);
    const result = await handleTool("list_files", { total: true });
    expect(result).toBe("3");
  });

  it("passes folder and ext filters to listVaultFiles", async () => {
    mockListFiles.mockResolvedValueOnce([]);
    await handleTool("list_files", { folder: "Projects", ext: "md" });
    expect(mockListFiles).toHaveBeenCalledWith({
      folder: "Projects",
      ext: "md",
    });
  });
});

// ── get_tags ─────────────────────────────────────────────────────────────

describe("get_tags", () => {
  it("returns alphabetically sorted tags with counts", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md"]);
    mockRead.mockResolvedValueOnce("#apple\n#banana");
    mockRead.mockResolvedValueOnce("#apple");
    const result = await handleTool("get_tags", {});
    const lines = result.split("\n");
    expect(lines.some((l) => l.includes("apple (2)"))).toBe(true);
    expect(lines.some((l) => l.includes("banana (1)"))).toBe(true);
    expect(lines.findIndex((l) => l.includes("apple"))).toBeLessThan(
      lines.findIndex((l) => l.includes("banana")),
    );
  });

  it("sorts by count descending when sort=count", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md"]);
    mockRead.mockResolvedValueOnce("#aaa\n#bbb");
    mockRead.mockResolvedValueOnce("#aaa");
    const result = await handleTool("get_tags", { sort: "count" });
    expect(result.split("\n")[0]).toContain("aaa (2)");
  });
});

// ── get_backlinks ────────────────────────────────────────────────────────

describe("get_backlinks", () => {
  it("finds files that contain a wiki-link to the target", async () => {
    mockListFiles.mockResolvedValueOnce(["Notes/A.md", "Notes/Target.md"]);
    mockRead.mockResolvedValueOnce("See [[Target]] for details");
    const result = await handleTool("get_backlinks", {
      path: "Notes/Target.md",
    });
    expect(result).toContain("Notes/A.md");
  });

  it("returns no-backlinks message when none found", async () => {
    mockListFiles.mockResolvedValueOnce(["Notes/Other.md"]);
    mockRead.mockResolvedValueOnce("no links here");
    const result = await handleTool("get_backlinks", {
      path: "Notes/Target.md",
    });
    expect(result).toContain("No backlinks found");
  });
});

// ── get_outline ──────────────────────────────────────────────────────────

describe("get_outline", () => {
  it("returns headings in tree format by default", async () => {
    mockRead.mockResolvedValueOnce("# Title\n## Section\n### Sub");
    const result = await handleTool("get_outline", { path: "Notes/Test.md" });
    expect(result).toContain("Title");
    expect(result).toContain("Section");
    expect(result).toContain("Sub");
  });

  it("returns no-headings message when file has none", async () => {
    mockRead.mockResolvedValueOnce("content without headings");
    const result = await handleTool("get_outline", { path: "Notes/Test.md" });
    expect(result).toBe("No headings found");
  });

  it("returns markdown headings when format=md", async () => {
    mockRead.mockResolvedValueOnce("# Title\n## Section");
    const result = await handleTool("get_outline", {
      path: "Notes/Test.md",
      format: "md",
    });
    expect(result).toMatch(/^# Title/m);
    expect(result).toMatch(/^## Section/m);
  });
});

// ── set_property ─────────────────────────────────────────────────────────

describe("set_property", () => {
  it("updates an existing frontmatter property", async () => {
    mockRead.mockResolvedValueOnce("---\ntitle: Old\n---\nbody");
    const result = await handleTool("set_property", {
      path: "Notes/Test.md",
      name: "title",
      value: "New",
    });
    expect(mockWrite).toHaveBeenCalled();
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("title: New");
    expect(result).toBe("Set title in Notes/Test.md");
  });

  it("creates frontmatter when file has none", async () => {
    mockRead.mockResolvedValueOnce("just body");
    await handleTool("set_property", {
      path: "Notes/Test.md",
      name: "status",
      value: "active",
    });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("---");
    expect(written).toContain("status: active");
  });
});

// ── read_property ────────────────────────────────────────────────────────

describe("read_property", () => {
  it("returns the value of an existing property", async () => {
    mockRead.mockResolvedValueOnce("---\nstatus: active\n---\nbody");
    const result = await handleTool("read_property", {
      path: "Notes/Test.md",
      name: "status",
    });
    expect(result).toBe("active");
  });

  it("returns not-found message for a missing property", async () => {
    mockRead.mockResolvedValueOnce("---\ntitle: Test\n---\n");
    const result = await handleTool("read_property", {
      path: "Notes/Test.md",
      name: "missing",
    });
    expect(result).toContain("not found");
  });

  it("joins array values with comma-space", async () => {
    mockRead.mockResolvedValueOnce("---\ntags:\n  - a\n  - b\n---\n");
    const result = await handleTool("read_property", {
      path: "Notes/Test.md",
      name: "tags",
    });
    expect(result).toBe("a, b");
  });
});

// ── remove_property ──────────────────────────────────────────────────────

describe("remove_property", () => {
  it("removes a property and writes updated content", async () => {
    mockRead.mockResolvedValueOnce(
      "---\ntitle: Test\nstatus: active\n---\nbody",
    );
    const result = await handleTool("remove_property", {
      path: "Notes/Test.md",
      name: "status",
    });
    expect(result).toContain("Removed property");
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).not.toContain("status:");
  });

  it("returns not-found message and does not write when property is absent", async () => {
    mockRead.mockResolvedValueOnce("---\ntitle: Test\n---\nbody");
    const result = await handleTool("remove_property", {
      path: "Notes/Test.md",
      name: "missing",
    });
    expect(result).toContain("not found");
    expect(mockWrite).not.toHaveBeenCalled();
  });
});

// ── list_properties ──────────────────────────────────────────────────────

describe("list_properties", () => {
  it("lists properties for a single file", async () => {
    mockRead.mockResolvedValueOnce(
      "---\ntitle: Test\nstatus: active\n---\nbody",
    );
    const result = await handleTool("list_properties", {
      path: "Notes/Test.md",
    });
    expect(result).toContain("title");
    expect(result).toContain("status");
  });

  it("aggregates property counts across all files when no file specified", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md"]);
    mockRead.mockResolvedValueOnce("---\ntitle: A\n---\n");
    mockRead.mockResolvedValueOnce("---\ntitle: B\nstatus: done\n---\n");
    const result = await handleTool("list_properties", {});
    expect(result).toContain("title (2)");
    expect(result).toContain("status (1)");
  });
});

// ── list_tasks ───────────────────────────────────────────────────────────

describe("list_tasks", () => {
  it("returns tasks from daily note by default", async () => {
    mockRead.mockResolvedValueOnce("- [ ] Task A\n- [x] Task B");
    const result = await handleTool("list_tasks", {});
    expect(mockDailyPath).toHaveBeenCalled();
    expect(result).toContain("Task A");
    expect(result).toContain("Task B");
  });

  it("filters to open tasks only when todo=true", async () => {
    mockRead.mockResolvedValueOnce("- [ ] Open\n- [x] Done");
    const result = await handleTool("list_tasks", { todo: true });
    expect(result).toContain("Open");
    expect(result).not.toContain("Done");
  });

  it("filters to done tasks only when done=true", async () => {
    mockRead.mockResolvedValueOnce("- [ ] Open\n- [x] Done");
    const result = await handleTool("list_tasks", { done: true });
    expect(result).not.toContain("Open");
    expect(result).toContain("Done");
  });

  it("scans all vault files when all=true", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md"]);
    mockRead.mockResolvedValue("- [ ] Task");
    const result = await handleTool("list_tasks", { all: true });
    expect(mockListFiles).toHaveBeenCalled();
    expect(result).toContain("Task");
  });

  it("shows task file and line in verbose mode", async () => {
    mockRead.mockResolvedValueOnce("- [ ] Verbose task");
    const result = await handleTool("list_tasks", { verbose: true });
    expect(result).toContain("Daily Notes/2026-01-01.md:");
    expect(result).toContain("Verbose task");
  });
});

// ── toggle_task ──────────────────────────────────────────────────────────

describe("toggle_task", () => {
  it("toggles unchecked task to checked", async () => {
    mockFindFile.mockResolvedValueOnce("Notes/Tasks.md");
    mockRead.mockResolvedValueOnce("Line 1\n- [ ] Task A\nLine 3");
    const result = await handleTool("toggle_task", { file: "Tasks", line: 2 });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("- [x] Task A");
    expect(result).toContain("Toggled task at line 2");
  });

  it("toggles checked task to unchecked", async () => {
    mockFindFile.mockResolvedValueOnce("Notes/Tasks.md");
    mockRead.mockResolvedValueOnce("Line 1\n- [x] Task A\nLine 3");
    await handleTool("toggle_task", { file: "Tasks", line: 2 });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("- [ ] Task A");
  });

  it("throws when the line is not a task checkbox", async () => {
    mockFindFile.mockResolvedValueOnce("Notes/Tasks.md");
    mockRead.mockResolvedValueOnce("Just a plain line");
    await expect(
      handleTool("toggle_task", { file: "Tasks", line: 1 }),
    ).rejects.toThrow("not a task checkbox");
  });

  it("resolves file and line from ref parameter", async () => {
    mockFindFile.mockResolvedValueOnce("Notes/Tasks.md");
    mockRead.mockResolvedValueOnce("- [ ] Referenced task");
    await handleTool("toggle_task", { ref: "Tasks:1" });
    expect(mockFindFile).toHaveBeenCalledWith("Tasks");
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("- [x] Referenced task");
  });

  it("throws when line number is out of range", async () => {
    mockFindFile.mockResolvedValueOnce("Notes/T.md");
    mockRead.mockResolvedValueOnce("- [ ] Only line");
    await expect(
      handleTool("toggle_task", { file: "T", line: 99 }),
    ).rejects.toThrow("out of range");
  });
});

// ── list_templates ───────────────────────────────────────────────────────

describe("list_templates", () => {
  it("returns template names without .md extension", async () => {
    mockListFiles.mockResolvedValueOnce([
      "Templates/daily.md",
      "Templates/weekly.md",
    ]);
    const result = await handleTool("list_templates", {});
    expect(result).toBe("daily\nweekly");
  });

  it("returns count as string when total=true", async () => {
    mockListFiles.mockResolvedValueOnce([
      "Templates/a.md",
      "Templates/b.md",
      "Templates/c.md",
    ]);
    const result = await handleTool("list_templates", { total: true });
    expect(result).toBe("3");
  });

  it("requests files from the configured templates folder", async () => {
    mockListFiles.mockResolvedValueOnce([]);
    await handleTool("list_templates", {});
    expect(mockListFiles).toHaveBeenCalledWith({
      folder: "Templates",
      ext: "md",
    });
  });
});

// ── read_template ────────────────────────────────────────────────────────

describe("read_template", () => {
  it("returns raw template content without variable substitution", async () => {
    mockRead.mockResolvedValueOnce("{{date}} template content");
    const result = await handleTool("read_template", { name: "daily" });
    expect(mockRead).toHaveBeenCalledWith("Templates/daily.md");
    expect(result).toBe("{{date}} template content");
  });

  it("resolves template variables when resolve=true", async () => {
    mockRead.mockResolvedValueOnce("Date: {{date}}");
    const result = await handleTool("read_template", {
      name: "daily",
      resolve: true,
    });
    expect(result).not.toContain("{{date}}");
    expect(result).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
  });
});

// ── get_links ────────────────────────────────────────────────────────────

describe("get_links", () => {
  it("returns outgoing wiki links from the file", async () => {
    mockRead.mockResolvedValueOnce("See [[NoteA]] and [[NoteB]]");
    const result = await handleTool("get_links", { path: "Notes/Source.md" });
    expect(result).toContain("NoteA");
    expect(result).toContain("NoteB");
  });

  it("returns no-links message when file has none", async () => {
    mockRead.mockResolvedValueOnce("No wiki links here");
    const result = await handleTool("get_links", { path: "Notes/Test.md" });
    expect(result).toContain("No outgoing links");
  });
});

// ── get_tag_info ─────────────────────────────────────────────────────────

describe("get_tag_info", () => {
  it("returns tag info with matching file count", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md", "b.md"]);
    mockRead.mockResolvedValueOnce("#mytag content");
    mockRead.mockResolvedValueOnce("no tag here");
    const result = await handleTool("get_tag_info", { tag: "mytag" });
    expect(result).toContain("Tag: #mytag");
    expect(result).toContain("Files: 1");
  });

  it("strips leading # from the tag parameter", async () => {
    mockListFiles.mockResolvedValueOnce([]);
    const result = await handleTool("get_tag_info", { tag: "#mytag" });
    expect(result).toContain("#mytag");
  });

  it("lists matching files when verbose=true", async () => {
    mockListFiles.mockResolvedValueOnce(["a.md"]);
    mockRead.mockResolvedValueOnce("#mytag content");
    const result = await handleTool("get_tag_info", {
      tag: "mytag",
      verbose: true,
    });
    expect(result).toContain("a.md");
  });
});

// ── move_file ────────────────────────────────────────────────────────────

describe("move_file", () => {
  it("calls moveVaultFile and returns confirmation message", async () => {
    const result = await handleTool("move_file", {
      from: "Notes/Old.md",
      to: "Archive/Old.md",
    });
    expect(mockMove).toHaveBeenCalledWith("Notes/Old.md", "Archive/Old.md");
    expect(result).toBe("Moved Notes/Old.md to Archive/Old.md");
  });
});

// ── query_base ───────────────────────────────────────────────────────────

describe("query_base", () => {
  it("parses base file and returns matching notes as JSON", async () => {
    mockListFiles.mockResolvedValueOnce(["Tasks.base"]);
    mockRead.mockResolvedValueOnce(
      JSON.stringify({ source: { folder: "Notes" } }),
    );
    mockListFiles.mockResolvedValueOnce(["Notes/A.md"]);
    mockRead.mockResolvedValueOnce("---\ntitle: Note A\n---\nbody");
    const result = await handleTool("query_base", { base: "Tasks" });
    const parsed = JSON.parse(result) as Array<{ path: string; title: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe("Notes/A.md");
    expect(parsed[0].title).toBe("Note A");
  });

  it("returns paths format when format=paths", async () => {
    mockListFiles.mockResolvedValueOnce(["Tasks.base"]);
    mockRead.mockResolvedValueOnce(JSON.stringify({ source: {} }));
    mockListFiles.mockResolvedValueOnce(["Notes/A.md"]);
    mockRead.mockResolvedValueOnce("");
    const result = await handleTool("query_base", {
      base: "Tasks",
      format: "paths",
    });
    expect(result).toBe("Notes/A.md");
  });

  it("throws when base file is not found", async () => {
    mockListFiles.mockResolvedValueOnce([]);
    await expect(
      handleTool("query_base", { base: "nonexistent" }),
    ).rejects.toThrow("Base not found");
  });
});

// ── backlog_read ─────────────────────────────────────────────────────────

describe("backlog_read", () => {
  it("reads and returns the project backlog file", async () => {
    mockRead.mockResolvedValueOnce("- [ ] Task 1");
    const result = await handleTool("backlog_read", { project: "MyProject" });
    expect(mockRead).toHaveBeenCalledWith("Projects/MyProject/backlog.md");
    expect(result).toBe("- [ ] Task 1");
  });
});

// ── backlog_add ──────────────────────────────────────────────────────────

describe("backlog_add", () => {
  it("appends a new item to an existing backlog", async () => {
    mockRead.mockResolvedValueOnce("# Backlog\n\n- [ ] Existing\n");
    const result = await handleTool("backlog_add", {
      project: "P",
      item: "New task",
    });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("- [ ] New task");
    expect(result).toContain("Added to backlog");
  });

  it("creates backlog file when it does not exist", async () => {
    mockRead.mockRejectedValueOnce(new Error("ENOENT"));
    await handleTool("backlog_add", { project: "NewProject", item: "First" });
    const [path, written] = mockWrite.mock.calls[0] as [string, string];
    expect(path).toBe("Projects/NewProject/backlog.md");
    expect(written).toContain("- [ ] First");
  });

  it("appends priority tag when priority specified", async () => {
    mockRead.mockResolvedValueOnce("# Backlog\n");
    await handleTool("backlog_add", {
      project: "P",
      item: "Urgent thing",
      priority: "high",
    });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("@high");
  });

  it("skips duplicate items and does not write", async () => {
    mockRead.mockResolvedValueOnce("# Backlog\n\n- [ ] Existing task\n");
    const result = await handleTool("backlog_add", {
      project: "P",
      item: "Existing task",
    });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(result).toContain("Skipped");
  });
});

// ── backlog_done ─────────────────────────────────────────────────────────

describe("backlog_done", () => {
  it("marks the matching item done with a timestamp", async () => {
    mockRead.mockResolvedValueOnce("# Backlog\n\n- [ ] Fix the bug\n");
    const result = await handleTool("backlog_done", {
      project: "P",
      item: "Fix the bug",
    });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    expect(written).toContain("- [x] Fix the bug");
    expect(written).toMatch(/@done \(\d{2}-\d{2}-\d{2} \d{2}:\d{2}\)/);
    expect(result).toContain("Marked done");
  });

  it("throws when no unchecked item matches", async () => {
    mockRead.mockResolvedValueOnce("# Backlog\n\n- [ ] Other item\n");
    await expect(
      handleTool("backlog_done", { project: "P", item: "nonexistent" }),
    ).rejects.toThrow();
  });
});

// ── project_list ─────────────────────────────────────────────────────────

describe("project_list", () => {
  it("returns deduplicated project names from the Projects folder", async () => {
    mockListFiles.mockResolvedValueOnce([
      "Projects/Alpha/overview.md",
      "Projects/Alpha/session.md",
      "Projects/Beta/overview.md",
    ]);
    const result = await handleTool("project_list", {});
    const lines = result.split("\n");
    expect(lines).toContain("Alpha");
    expect(lines).toContain("Beta");
    expect(lines).toHaveLength(2);
  });
});

// ── project_overview ─────────────────────────────────────────────────────

describe("project_overview", () => {
  it("reads and returns overview.md for the project", async () => {
    mockRead.mockResolvedValueOnce("# MyProject\n\nDescription");
    const result = await handleTool("project_overview", {
      project: "MyProject",
    });
    expect(mockRead).toHaveBeenCalledWith("Projects/MyProject/overview.md");
    expect(result).toBe("# MyProject\n\nDescription");
  });
});

// ── project_create ───────────────────────────────────────────────────────

describe("project_create", () => {
  it("creates overview.md and backlog.md", async () => {
    const result = await handleTool("project_create", {
      project: "NewProject",
      description: "A brand new project",
    });
    expect(mockWrite).toHaveBeenCalledTimes(2);
    const paths = mockWrite.mock.calls.map((c) => c[0] as string);
    expect(paths).toContain("Projects/NewProject/overview.md");
    expect(paths).toContain("Projects/NewProject/backlog.md");
    expect(result).toContain("Created project: NewProject");
  });

  it("writes tech list as YAML array in the overview", async () => {
    await handleTool("project_create", {
      project: "Tech",
      description: "Heavy",
      tech: "TypeScript, Node.js",
    });
    const overviewCall = mockWrite.mock.calls.find((c) =>
      (c[0] as string).endsWith("overview.md"),
    );
    expect(overviewCall).toBeDefined();
    const written = overviewCall![1] as string;
    expect(written).toContain("- TypeScript");
    expect(written).toContain("- Node.js");
  });

  it("includes repo in overview frontmatter when provided", async () => {
    await handleTool("project_create", {
      project: "Repo",
      description: "Has a repo",
      repo: "github.com/user/repo",
    });
    const overviewCall = mockWrite.mock.calls.find((c) =>
      (c[0] as string).endsWith("overview.md"),
    );
    const written = overviewCall![1] as string;
    expect(written).toContain("repo: github.com/user/repo");
  });
});

// ── project_context ──────────────────────────────────────────────────────

describe("project_context", () => {
  it("returns overview, open backlog items, and recent sessions", async () => {
    mockRead.mockResolvedValueOnce("# Project overview");
    mockRead.mockResolvedValueOnce("- [ ] Task 1\n- [x] Done task");
    mockListFiles.mockResolvedValueOnce([
      "Projects/P/overview.md",
      "Projects/P/backlog.md",
      "Projects/P/2025-01-01 session.md",
    ]);
    mockRead.mockResolvedValueOnce("Session content here");
    const result = await handleTool("project_context", { project: "P" });
    expect(result).toContain("## Overview");
    expect(result).toContain("# Project overview");
    expect(result).toContain("## Open Backlog Items (1)");
    expect(result).toContain("Task 1");
    expect(result).toContain("## Recent Sessions");
    expect(result).toContain("Session content here");
  });

  it("reports no sessions when none exist", async () => {
    mockRead.mockResolvedValueOnce("# Overview");
    mockRead.mockResolvedValueOnce("");
    mockListFiles.mockResolvedValueOnce(["Projects/P/overview.md"]);
    const result = await handleTool("project_context", { project: "P" });
    expect(result).toContain("no session notes found");
  });
});

// ── backlog_prioritise ───────────────────────────────────────────────────

describe("backlog_prioritise", () => {
  it("moves item to the specified position", async () => {
    const content = "# Backlog\n- [ ] Task A\n- [ ] Task B\n- [ ] Task C\n";
    mockRead.mockResolvedValueOnce(content);
    mockRead.mockResolvedValueOnce(content);
    const result = await handleTool("backlog_prioritise", {
      project: "P",
      item: "Task C",
      position: 1,
    });
    expect(result).toContain("position 1");
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    const taskLines = written
      .split("\n")
      .filter((l) => l.startsWith("- [ ] "));
    expect(taskLines[0]).toContain("Task C");
  });

  it("throws when item is not found in backlog", async () => {
    mockRead.mockResolvedValueOnce("# Backlog\n- [ ] Only task\n");
    await expect(
      handleTool("backlog_prioritise", {
        project: "P",
        item: "nonexistent",
        position: 1,
      }),
    ).rejects.toThrow();
  });
});

// ── backlog_reorder ──────────────────────────────────────────────────────

describe("backlog_reorder", () => {
  it("reorders items to match the provided sequence", async () => {
    mockRead.mockResolvedValueOnce(
      "# Backlog\n- [ ] Alpha\n- [ ] Beta\n- [ ] Gamma\n",
    );
    const result = await handleTool("backlog_reorder", {
      project: "P",
      items: ["Gamma", "Alpha"],
    });
    const [, written] = mockWrite.mock.calls[0] as [string, string, unknown];
    const taskLines = written
      .split("\n")
      .filter((l) => l.startsWith("- [ ] "));
    expect(taskLines[0]).toContain("Gamma");
    expect(taskLines[1]).toContain("Alpha");
    expect(taskLines[2]).toContain("Beta");
    expect(result).toContain("Reordered 2 items");
  });

  it("reports items not found in the backlog", async () => {
    mockRead.mockResolvedValueOnce("# Backlog\n- [ ] Existing\n");
    const result = await handleTool("backlog_reorder", {
      project: "P",
      items: ["Missing"],
    });
    expect(result).toContain("not found");
  });
});

// ── project_summary ──────────────────────────────────────────────────────

describe("project_summary", () => {
  it("returns no-sessions message when none exist within the period", async () => {
    mockListFiles.mockResolvedValueOnce(["Projects/P/overview.md"]);
    const result = await handleTool("project_summary", {
      project: "P",
      days: 7,
    });
    expect(result).toContain("No session notes found");
  });

  it("returns summary with stats for sessions within the period", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockListFiles.mockResolvedValueOnce([
      `Projects/P/${today} notes.md`,
      "Projects/P/overview.md",
    ]);
    mockRead.mockResolvedValueOnce("Session body");
    mockRead.mockResolvedValueOnce("# Backlog\n- [ ] Open\n- [x] Done\n");
    const result = await handleTool("project_summary", {
      project: "P",
      days: 7,
    });
    expect(result).toContain("# Project Summary: P");
    expect(result).toContain("Sessions: 1");
    expect(result).toContain("Open backlog items: 1");
    expect(result).toContain("Completed backlog items: 1");
  });
});

// ── project_dashboard ────────────────────────────────────────────────────

describe("project_dashboard", () => {
  it("returns a markdown table with project info by default", async () => {
    mockListFiles.mockResolvedValueOnce([
      "Projects/Alpha/overview.md",
      "Projects/Alpha/2025-01-01 session.md",
    ]);
    mockRead.mockResolvedValueOnce("");
    mockRead.mockResolvedValueOnce("status: active");
    const result = await handleTool("project_dashboard", {});
    expect(result).toContain("# Project Dashboard");
    expect(result).toContain("Alpha");
    expect(result).toContain("active");
  });

  it("returns a JSON array when format=json", async () => {
    mockListFiles.mockResolvedValueOnce(["Projects/Z/overview.md"]);
    mockRead.mockResolvedValueOnce("");
    mockRead.mockResolvedValueOnce("status: active");
    const result = await handleTool("project_dashboard", { format: "json" });
    const parsed = JSON.parse(result) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe("Z");
  });
});

// ── unknown tool ─────────────────────────────────────────────────────────

describe("unknown tool", () => {
  it("throws for an unrecognised tool name", async () => {
    await expect(
      handleTool("not_a_real_tool" as never, {}),
    ).rejects.toThrow("Unknown tool");
  });
});
