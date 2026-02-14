import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTool } from "../src/handlers.js";

// Mock the cli module so we never call the real Obsidian binary
vi.mock("../src/cli.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/cli.js")>();
  return {
    ...actual,
    runObsidian: vi.fn().mockResolvedValue("mock output"),
  };
});

import { runObsidian } from "../src/cli.js";

const mockRun = vi.mocked(runObsidian);

beforeEach(() => {
  mockRun.mockClear();
  mockRun.mockResolvedValue("mock output");
});

// ── Helpers ─────────────────────────────────────────────────────────────

/** Return the args that runObsidian was last called with */
function calledWith(): string[] {
  expect(mockRun).toHaveBeenCalledOnce();
  return mockRun.mock.calls[0][0] as string[];
}

// ── Core: Session Journaling ────────────────────────────────────────────

describe("create_note", () => {
  it("passes name and adds silent flag", async () => {
    await handleTool("create_note", { name: "Session 1" });
    const args = calledWith();
    expect(args[0]).toBe("create");
    expect(args).toContain("name=Session 1");
    expect(args).toContain("silent");
  });

  it("includes optional content and template", async () => {
    await handleTool("create_note", {
      name: "Test",
      content: "Hello world",
      template: "daily",
    });
    const args = calledWith();
    expect(args).toContain("content=Hello world");
    expect(args).toContain("template=daily");
  });

  it("includes overwrite flag when true", async () => {
    await handleTool("create_note", { name: "Test", overwrite: true });
    const args = calledWith();
    expect(args).toContain("overwrite");
  });

  it("omits overwrite when not provided", async () => {
    await handleTool("create_note", { name: "Test" });
    const args = calledWith();
    expect(args).not.toContain("overwrite");
  });
});

describe("read_note", () => {
  it("passes file param", async () => {
    await handleTool("read_note", { file: "MyNote" });
    const args = calledWith();
    expect(args).toEqual(["read", "file=MyNote"]);
  });

  it("passes path param", async () => {
    await handleTool("read_note", { path: "folder/note.md" });
    const args = calledWith();
    expect(args).toEqual(["read", "path=folder/note.md"]);
  });

  it("works with no params", async () => {
    await handleTool("read_note", {});
    const args = calledWith();
    expect(args).toEqual(["read"]);
  });
});

describe("append_to_note", () => {
  it("passes content with silent flag", async () => {
    await handleTool("append_to_note", {
      file: "Log",
      content: "New entry",
    });
    const args = calledWith();
    expect(args[0]).toBe("append");
    expect(args).toContain("file=Log");
    expect(args).toContain("content=New entry");
    expect(args).toContain("silent");
  });

  it("supports path instead of file", async () => {
    await handleTool("append_to_note", {
      path: "logs/today.md",
      content: "Entry",
    });
    const args = calledWith();
    expect(args).toContain("path=logs/today.md");
  });
});

describe("prepend_to_note", () => {
  it("passes content with silent flag", async () => {
    await handleTool("prepend_to_note", {
      file: "Status",
      content: "Updated",
    });
    const args = calledWith();
    expect(args[0]).toBe("prepend");
    expect(args).toContain("file=Status");
    expect(args).toContain("content=Updated");
    expect(args).toContain("silent");
  });
});

describe("search_vault", () => {
  it("passes query with default json format", async () => {
    await handleTool("search_vault", { query: "TODO" });
    const args = calledWith();
    expect(args[0]).toBe("search");
    expect(args).toContain("query=TODO");
    expect(args).toContain("format=json");
  });

  it("allows overriding format", async () => {
    await handleTool("search_vault", { query: "TODO", format: "text" });
    const args = calledWith();
    expect(args).toContain("format=text");
  });

  it("passes optional path and limit", async () => {
    await handleTool("search_vault", {
      query: "fix",
      path: "projects/",
      limit: 20,
    });
    const args = calledWith();
    expect(args).toContain("path=projects/");
    expect(args).toContain("limit=20");
  });
});

describe("daily_note", () => {
  it("calls daily with silent flag", async () => {
    await handleTool("daily_note", {});
    const args = calledWith();
    expect(args).toEqual(["daily", "silent"]);
  });
});

describe("daily_append", () => {
  it("passes content with silent flag", async () => {
    await handleTool("daily_append", { content: "Session log" });
    const args = calledWith();
    expect(args[0]).toBe("daily:append");
    expect(args).toContain("content=Session log");
    expect(args).toContain("silent");
  });
});

// ── Discovery & Context ─────────────────────────────────────────────────

describe("get_vault_info", () => {
  it("calls vault with no extra params when info not given", async () => {
    await handleTool("get_vault_info", {});
    const args = calledWith();
    expect(args).toEqual(["vault"]);
  });

  it("passes info param when specified", async () => {
    await handleTool("get_vault_info", { info: "name" });
    const args = calledWith();
    expect(args).toEqual(["vault", "info=name"]);
  });
});

describe("list_files", () => {
  it("calls files with no filters", async () => {
    await handleTool("list_files", {});
    const args = calledWith();
    expect(args).toEqual(["files"]);
  });

  it("passes folder, ext, and total", async () => {
    await handleTool("list_files", {
      folder: "attachments",
      ext: "png",
      total: true,
    });
    const args = calledWith();
    expect(args).toContain("folder=attachments");
    expect(args).toContain("ext=png");
    expect(args).toContain("total");
  });
});

describe("get_tags", () => {
  it("always includes all and counts flags", async () => {
    await handleTool("get_tags", {});
    const args = calledWith();
    expect(args[0]).toBe("tags");
    expect(args).toContain("all");
    expect(args).toContain("counts");
  });

  it("passes sort param", async () => {
    await handleTool("get_tags", { sort: "count" });
    const args = calledWith();
    expect(args).toContain("sort=count");
  });
});

describe("get_backlinks", () => {
  it("passes file param", async () => {
    await handleTool("get_backlinks", { file: "Index" });
    const args = calledWith();
    expect(args).toEqual(["backlinks", "file=Index"]);
  });

  it("passes path param", async () => {
    await handleTool("get_backlinks", { path: "notes/Index.md" });
    const args = calledWith();
    expect(args).toEqual(["backlinks", "path=notes/Index.md"]);
  });
});

describe("get_outline", () => {
  it("passes file param", async () => {
    await handleTool("get_outline", { file: "README" });
    const args = calledWith();
    expect(args).toEqual(["outline", "file=README"]);
  });

  it("passes format param", async () => {
    await handleTool("get_outline", { file: "README", format: "md" });
    const args = calledWith();
    expect(args).toContain("format=md");
  });
});

// ── Properties / Metadata ───────────────────────────────────────────────

describe("set_property", () => {
  it("passes name and value", async () => {
    await handleTool("set_property", {
      name: "status",
      value: "done",
      file: "Task1",
    });
    const args = calledWith();
    expect(args[0]).toBe("property:set");
    expect(args).toContain("name=status");
    expect(args).toContain("value=done");
    expect(args).toContain("file=Task1");
  });

  it("passes optional type", async () => {
    await handleTool("set_property", {
      name: "priority",
      value: "5",
      type: "number",
    });
    const args = calledWith();
    expect(args).toContain("type=number");
  });
});

describe("read_property", () => {
  it("passes name and file", async () => {
    await handleTool("read_property", { name: "status", file: "Task1" });
    const args = calledWith();
    expect(args[0]).toBe("property:read");
    expect(args).toContain("name=status");
    expect(args).toContain("file=Task1");
  });

  it("passes path instead of file", async () => {
    await handleTool("read_property", {
      name: "tags",
      path: "notes/task.md",
    });
    const args = calledWith();
    expect(args).toContain("path=notes/task.md");
  });
});

// ── Tasks ───────────────────────────────────────────────────────────────

describe("list_tasks", () => {
  it("calls tasks with no filters", async () => {
    await handleTool("list_tasks", {});
    const args = calledWith();
    expect(args).toEqual(["tasks"]);
  });

  it("passes all boolean filters", async () => {
    await handleTool("list_tasks", {
      all: true,
      done: true,
      verbose: true,
    });
    const args = calledWith();
    expect(args).toContain("all");
    expect(args).toContain("done");
    expect(args).toContain("verbose");
  });

  it("passes file filter", async () => {
    await handleTool("list_tasks", { file: "Sprint" });
    const args = calledWith();
    expect(args).toContain("file=Sprint");
  });

  it("passes daily filter", async () => {
    await handleTool("list_tasks", { daily: true });
    const args = calledWith();
    expect(args).toContain("daily");
  });

  it("passes todo filter", async () => {
    await handleTool("list_tasks", { todo: true });
    const args = calledWith();
    expect(args).toContain("todo");
  });
});

describe("toggle_task", () => {
  it("passes ref with toggle flag", async () => {
    await handleTool("toggle_task", { ref: "Recipe.md:8" });
    const args = calledWith();
    expect(args[0]).toBe("task");
    expect(args).toContain("ref=Recipe.md:8");
    expect(args).toContain("toggle");
  });

  it("passes file and line with toggle flag", async () => {
    await handleTool("toggle_task", { file: "Sprint", line: 12 });
    const args = calledWith();
    expect(args).toContain("file=Sprint");
    expect(args).toContain("line=12");
    expect(args).toContain("toggle");
  });
});

// ── Error handling ──────────────────────────────────────────────────────

// ── Daily Notes (extended) ──────────────────────────────────────────────

describe("daily_read", () => {
  it("calls daily:read with no extra params", async () => {
    await handleTool("daily_read", {});
    const args = calledWith();
    expect(args).toEqual(["daily:read"]);
  });
});

describe("daily_prepend", () => {
  it("passes content with silent flag", async () => {
    await handleTool("daily_prepend", { content: "Standup summary" });
    const args = calledWith();
    expect(args[0]).toBe("daily:prepend");
    expect(args).toContain("content=Standup summary");
    expect(args).toContain("silent");
  });
});

// ── Templates ───────────────────────────────────────────────────────────

describe("list_templates", () => {
  it("calls templates with no extra params", async () => {
    await handleTool("list_templates", {});
    const args = calledWith();
    expect(args).toEqual(["templates"]);
  });

  it("passes total flag", async () => {
    await handleTool("list_templates", { total: true });
    const args = calledWith();
    expect(args).toContain("total");
  });
});

describe("read_template", () => {
  it("passes name param", async () => {
    await handleTool("read_template", { name: "Session Note" });
    const args = calledWith();
    expect(args[0]).toBe("template:read");
    expect(args).toContain("name=Session Note");
  });

  it("passes resolve flag", async () => {
    await handleTool("read_template", { name: "ADR", resolve: true });
    const args = calledWith();
    expect(args).toContain("resolve");
  });
});

// ── Links ───────────────────────────────────────────────────────────────

describe("get_links", () => {
  it("passes file param", async () => {
    await handleTool("get_links", { file: "Index" });
    const args = calledWith();
    expect(args).toEqual(["links", "file=Index"]);
  });

  it("passes path param", async () => {
    await handleTool("get_links", { path: "notes/Index.md" });
    const args = calledWith();
    expect(args).toEqual(["links", "path=notes/Index.md"]);
  });
});

// ── Properties (extended) ───────────────────────────────────────────────

describe("list_properties", () => {
  it("calls properties with counts flag always set", async () => {
    await handleTool("list_properties", {});
    const args = calledWith();
    expect(args[0]).toBe("properties");
    expect(args).toContain("counts");
  });

  it("passes file and sort params", async () => {
    await handleTool("list_properties", { file: "ADR-001", sort: "count" });
    const args = calledWith();
    expect(args).toContain("file=ADR-001");
    expect(args).toContain("sort=count");
  });
});

describe("remove_property", () => {
  it("passes name and file", async () => {
    await handleTool("remove_property", { name: "deprecated", file: "ADR-001" });
    const args = calledWith();
    expect(args[0]).toBe("property:remove");
    expect(args).toContain("name=deprecated");
    expect(args).toContain("file=ADR-001");
  });

  it("passes path instead of file", async () => {
    await handleTool("remove_property", { name: "old", path: "notes/task.md" });
    const args = calledWith();
    expect(args).toContain("path=notes/task.md");
  });
});

// ── Tags (extended) ─────────────────────────────────────────────────────

describe("get_tag_info", () => {
  it("passes tag param", async () => {
    await handleTool("get_tag_info", { tag: "debug" });
    const args = calledWith();
    expect(args[0]).toBe("tag");
    expect(args).toContain("tag=debug");
  });

  it("passes verbose flag", async () => {
    await handleTool("get_tag_info", { tag: "adr", verbose: true });
    const args = calledWith();
    expect(args).toContain("verbose");
  });
});

// ── File Management ─────────────────────────────────────────────────────

describe("move_file", () => {
  it("passes from and to with silent flag", async () => {
    await handleTool("move_file", { from: "ADR-001.md", to: "archive/ADR-001.md" });
    const args = calledWith();
    expect(args[0]).toBe("move");
    expect(args).toContain("from=ADR-001.md");
    expect(args).toContain("to=archive/ADR-001.md");
    expect(args).toContain("silent");
  });
});

// ── Bases ───────────────────────────────────────────────────────────────

describe("query_base", () => {
  it("passes base with default json format", async () => {
    await handleTool("query_base", { base: "ADRs" });
    const args = calledWith();
    expect(args[0]).toBe("base:query");
    expect(args).toContain("base=ADRs");
    expect(args).toContain("format=json");
  });

  it("allows overriding format", async () => {
    await handleTool("query_base", { base: "ADRs", format: "md" });
    const args = calledWith();
    expect(args).toContain("format=md");
  });

  it("passes view and limit", async () => {
    await handleTool("query_base", { base: "Reviews", view: "Open", limit: 10 });
    const args = calledWith();
    expect(args).toContain("view=Open");
    expect(args).toContain("limit=10");
  });
});

// ── Error handling ──────────────────────────────────────────────────────

describe("unknown tool", () => {
  it("throws for an unknown tool name", async () => {
    await expect(handleTool("nonexistent_tool", {})).rejects.toThrow(
      /Unknown tool "nonexistent_tool"/,
    );
  });
});

describe("return value", () => {
  it("returns the CLI output string", async () => {
    mockRun.mockResolvedValue("vault info here");
    const result = await handleTool("get_vault_info", {});
    expect(result).toBe("vault info here");
  });
});

// ── Project Backlog ─────────────────────────────────────────────────────

describe("backlog_add", () => {
  it("appends a task item to the project backlog", async () => {
    await handleTool("backlog_add", { project: "Acme", item: "Fix login bug" });
    const args = calledWith();
    expect(args[0]).toBe("append");
    expect(args).toContain("path=Projects/Acme/backlog.md");
    expect(args).toContain("content=- [ ] Fix login bug");
    expect(args).toContain("silent");
  });

  it("includes @priority tag when priority is set", async () => {
    await handleTool("backlog_add", {
      project: "Acme",
      item: "Upgrade deps",
      priority: "high",
    });
    const args = calledWith();
    expect(args).toContain("content=- [ ] Upgrade deps @high");
  });

  it("omits priority tag when not provided", async () => {
    await handleTool("backlog_add", { project: "Acme", item: "Write docs" });
    const args = calledWith();
    expect(args).toContain("content=- [ ] Write docs");
  });
});

describe("backlog_read", () => {
  it("reads the project backlog file", async () => {
    await handleTool("backlog_read", { project: "Acme" });
    const args = calledWith();
    expect(args[0]).toBe("read");
    expect(args).toContain("path=Projects/Acme/backlog.md");
  });
});
