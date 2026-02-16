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
    // First call reads existing backlog, second appends
    mockRun
      .mockResolvedValueOnce("# Backlog\n")
      .mockResolvedValueOnce("ok");

    const result = await handleTool("backlog_add", { project: "Acme", item: "Fix login bug" });

    expect(mockRun).toHaveBeenCalledTimes(2);
    const appendArgs = mockRun.mock.calls[1][0] as string[];
    expect(appendArgs[0]).toBe("append");
    expect(appendArgs).toContain("path=Projects/Acme/backlog.md");
    expect(appendArgs).toContain("content=- [ ] Fix login bug");
    expect(appendArgs).toContain("silent");
    expect(result).toContain("Added to backlog");
  });

  it("includes @priority tag when priority is set", async () => {
    mockRun
      .mockResolvedValueOnce("# Backlog\n")
      .mockResolvedValueOnce("ok");

    await handleTool("backlog_add", {
      project: "Acme",
      item: "Upgrade deps",
      priority: "high",
    });

    const appendArgs = mockRun.mock.calls[1][0] as string[];
    expect(appendArgs).toContain("content=- [ ] Upgrade deps @high");
  });

  it("omits priority tag when not provided", async () => {
    mockRun
      .mockResolvedValueOnce("# Backlog\n")
      .mockResolvedValueOnce("ok");

    await handleTool("backlog_add", { project: "Acme", item: "Write docs" });

    const appendArgs = mockRun.mock.calls[1][0] as string[];
    expect(appendArgs).toContain("content=- [ ] Write docs");
  });

  it("creates backlog file with heading if it does not exist", async () => {
    // First read throws (file not found), then create, then append
    mockRun
      .mockRejectedValueOnce(new Error("File not found"))
      .mockResolvedValueOnce("ok") // create
      .mockResolvedValueOnce("ok"); // append

    await handleTool("backlog_add", { project: "NewProj", item: "First task" });

    expect(mockRun).toHaveBeenCalledTimes(3);
    const createArgs = mockRun.mock.calls[1][0] as string[];
    expect(createArgs[0]).toBe("create");
    expect(createArgs).toContain("name=Projects/NewProj/backlog");
    expect(createArgs.find((a) => a.startsWith("content="))).toContain("# Backlog");
  });

  it("skips duplicate items", async () => {
    mockRun.mockResolvedValueOnce("# Backlog\n- [ ] Fix login bug\n");

    const result = await handleTool("backlog_add", { project: "Acme", item: "Fix login bug" });

    expect(mockRun).toHaveBeenCalledTimes(1); // Only read, no append
    expect(result).toContain("Skipped: duplicate");
  });

  it("skips duplicates ignoring case and priority tags", async () => {
    mockRun.mockResolvedValueOnce("# Backlog\n- [ ] Fix Login Bug @high\n");

    const result = await handleTool("backlog_add", { project: "Acme", item: "fix login bug" });

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(result).toContain("Skipped: duplicate");
  });

  it("allows similar but different items", async () => {
    mockRun
      .mockResolvedValueOnce("# Backlog\n- [ ] Fix login bug\n")
      .mockResolvedValueOnce("ok");

    const result = await handleTool("backlog_add", { project: "Acme", item: "Fix logout bug" });

    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(result).toContain("Added to backlog");
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

describe("backlog_done", () => {
  it("marks the first matching unchecked item as done", async () => {
    const backlogContent =
      "# Backlog -- Acme\n- [ ] Fix login bug\n- [ ] Write docs\n";
    // First call reads the backlog, second call writes it back
    mockRun
      .mockResolvedValueOnce(backlogContent)
      .mockResolvedValueOnce("ok");

    const result = await handleTool("backlog_done", {
      project: "Acme",
      item: "Fix login bug",
    });

    expect(mockRun).toHaveBeenCalledTimes(2);

    // First call: read the backlog
    const readArgs = mockRun.mock.calls[0][0] as string[];
    expect(readArgs[0]).toBe("read");
    expect(readArgs).toContain("path=Projects/Acme/backlog.md");

    // Second call: overwrite with updated content
    const writeArgs = mockRun.mock.calls[1][0] as string[];
    expect(writeArgs[0]).toBe("create");
    expect(writeArgs).toContain("name=Projects/Acme/backlog");
    expect(writeArgs).toContain("overwrite");
    expect(writeArgs).toContain("silent");

    const content = writeArgs.find((a) => a.startsWith("content="));
    expect(content).toBeDefined();
    expect(content).toMatch(/- \[x\] Fix login bug @done \(\d{2}-\d{2}-\d{2} \d{2}:\d{2}\)/);
    // The other item should remain unchecked
    expect(content).toContain("- [ ] Write docs");

    expect(result).toBe("Marked done: Fix login bug");
  });

  it("throws when no matching unchecked item is found", async () => {
    mockRun.mockResolvedValueOnce("# Backlog -- Acme\n- [x] Fix login bug\n");
    await expect(
      handleTool("backlog_done", { project: "Acme", item: "Fix login bug" }),
    ).rejects.toThrow(/No unchecked backlog item matching/);
  });

  it("matches by substring", async () => {
    const backlogContent = "# Backlog\n- [ ] Upgrade dependencies @high\n";
    mockRun
      .mockResolvedValueOnce(backlogContent)
      .mockResolvedValueOnce("ok");

    await handleTool("backlog_done", { project: "Acme", item: "Upgrade" });

    const writeArgs = mockRun.mock.calls[1][0] as string[];
    const content = writeArgs.find((a) => a.startsWith("content="));
    expect(content).toMatch(/- \[x\] Upgrade dependencies @high @done/);
  });
});

describe("project_list", () => {
  it("lists files in Projects folder and extracts unique project names", async () => {
    mockRun.mockResolvedValue(
      "Projects/Acme/backlog.md\nProjects/Acme/overview.md\nProjects/Beta/backlog.md",
    );
    const result = await handleTool("project_list", {});
    expect(mockRun).toHaveBeenCalledOnce();
    const args = mockRun.mock.calls[0][0] as string[];
    expect(args[0]).toBe("files");
    expect(args).toContain("folder=Projects");
    expect(args).toContain("ext=md");
    expect(result).toBe("Acme\nBeta");
  });
});

describe("project_overview", () => {
  it("reads the project overview file", async () => {
    await handleTool("project_overview", { project: "Acme" });
    const args = calledWith();
    expect(args[0]).toBe("read");
    expect(args).toContain("path=Projects/Acme/overview.md");
  });
});

describe("project_create", () => {
  it("creates overview and backlog files", async () => {
    const result = await handleTool("project_create", {
      project: "NewApp",
      description: "A shiny new app",
    });
    expect(mockRun).toHaveBeenCalledTimes(2);
    const overviewArgs = mockRun.mock.calls[0][0] as string[];
    expect(overviewArgs[0]).toBe("create");
    expect(overviewArgs).toContain("name=Projects/NewApp/overview");
    expect(overviewArgs).toContain("silent");
    const backlogArgs = mockRun.mock.calls[1][0] as string[];
    expect(backlogArgs[0]).toBe("create");
    expect(backlogArgs).toContain("name=Projects/NewApp/backlog");
    expect(backlogArgs).toContain("silent");
    expect(result).toBe("Created project: NewApp");
  });

  it("includes repo and tech in overview content", async () => {
    await handleTool("project_create", {
      project: "WebApp",
      description: "A web application",
      repo: "https://github.com/dd/WebApp",
      tech: "TypeScript, React",
    });
    const overviewArgs = mockRun.mock.calls[0][0] as string[];
    const content = overviewArgs.find((a) => a.startsWith("content="));
    expect(content).toBeDefined();
    expect(content).toContain("repo: https://github.com/dd/WebApp");
    expect(content).toContain("- TypeScript");
    expect(content).toContain("- React");
  });
});

// ── Project Context & Summaries ─────────────────────────────────────────

describe("project_context", () => {
  it("returns overview, backlog, and recent sessions", async () => {
    mockRun
      .mockResolvedValueOnce("# Overview\nProject info here") // overview read
      .mockResolvedValueOnce("# Backlog\n- [ ] Task 1\n- [x] Task 2\n") // backlog read
      .mockResolvedValueOnce( // list files
        "Projects/Acme/overview.md\nProjects/Acme/backlog.md\n" +
        "Projects/Acme/2026-02-10 Session A.md\nProjects/Acme/2026-02-12 Session B.md",
      )
      .mockResolvedValueOnce("Session B content") // read most recent
      .mockResolvedValueOnce("Session A content"); // read second recent

    const result = await handleTool("project_context", { project: "Acme" });

    expect(result).toContain("## Overview");
    expect(result).toContain("Project info here");
    expect(result).toContain("## Open Backlog Items (1)");
    expect(result).toContain("- [ ] Task 1");
    expect(result).toContain("## Recent Sessions (2)");
    expect(result).toContain("Session B content");
    expect(result).toContain("Session A content");
  });

  it("limits session count via sessions parameter", async () => {
    mockRun
      .mockResolvedValueOnce("overview") // overview
      .mockResolvedValueOnce("# Backlog\n") // backlog
      .mockResolvedValueOnce( // list files
        "Projects/Acme/2026-02-10 A.md\nProjects/Acme/2026-02-11 B.md\nProjects/Acme/2026-02-12 C.md",
      )
      .mockResolvedValueOnce("C content"); // only 1 session

    await handleTool("project_context", { project: "Acme", sessions: 1 });

    // 4 calls: overview, backlog, list, 1 session read
    expect(mockRun).toHaveBeenCalledTimes(4);
  });
});

describe("project_summary", () => {
  it("returns summary with session activity", async () => {
    mockRun
      .mockResolvedValueOnce( // list files
        "Projects/Acme/2026-02-10 Fix.md\nProjects/Acme/2026-02-12 Feature.md",
      )
      .mockResolvedValueOnce("Fix session content") // read first
      .mockResolvedValueOnce("Feature session content") // read second
      .mockResolvedValueOnce("# Backlog\n- [ ] Open item\n- [x] Done item\n"); // backlog

    const result = await handleTool("project_summary", { project: "Acme" });

    expect(result).toContain("# Project Summary: Acme");
    expect(result).toContain("Sessions: 2");
    expect(result).toContain("Open backlog items: 1");
    expect(result).toContain("Completed backlog items: 1");
    expect(result).toContain("Fix session content");
    expect(result).toContain("Feature session content");
  });

  it("returns message when no sessions found", async () => {
    mockRun.mockResolvedValueOnce("Projects/Acme/overview.md\n"); // no dated files

    const result = await handleTool("project_summary", { project: "Acme" });
    expect(result).toContain("No session notes found");
  });
});

describe("project_dashboard", () => {
  it("returns markdown table by default", async () => {
    mockRun
      .mockResolvedValueOnce( // list all project files
        "Projects/Acme/overview.md\nProjects/Acme/backlog.md\n" +
        "Projects/Acme/2026-02-10 Session.md\n" +
        "Projects/Beta/overview.md\nProjects/Beta/backlog.md\n",
      )
      .mockResolvedValueOnce("# Backlog\n- [ ] Task 1\n- [ ] Task 2\n") // Acme backlog
      .mockResolvedValueOnce("---\nstatus: active\n---\n# Acme") // Acme overview
      .mockResolvedValueOnce("# Backlog\n") // Beta backlog
      .mockResolvedValueOnce("---\nstatus: paused\n---\n# Beta"); // Beta overview

    const result = await handleTool("project_dashboard", {});

    expect(result).toContain("# Project Dashboard");
    expect(result).toContain("| Acme | active | 2026-02-10 | 2 | 1 |");
    expect(result).toContain("| Beta | paused | none | 0 | 0 |");
  });

  it("returns JSON when format is json", async () => {
    mockRun
      .mockResolvedValueOnce("Projects/Acme/overview.md\nProjects/Acme/backlog.md\n")
      .mockResolvedValueOnce("# Backlog\n")
      .mockResolvedValueOnce("---\nstatus: active\n---\n");

    const result = await handleTool("project_dashboard", { format: "json" });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("Acme");
  });
});

describe("backlog_prioritise", () => {
  it("moves an item to the specified position", async () => {
    const backlog =
      "# Backlog -- Acme\n- [ ] Task A\n- [ ] Task B @high\n- [ ] Task C\n";
    mockRun
      .mockResolvedValueOnce(backlog) // prioritise read
      .mockResolvedValueOnce(backlog) // reorder read
      .mockResolvedValueOnce("ok"); // reorder write

    const result = await handleTool("backlog_prioritise", {
      project: "Acme",
      item: "Task C",
      position: 1,
    });

    expect(result).toContain("Task C");
    expect(result).toContain("position 1");

    // Verify the written content has Task C first (call index 2 = reorder write)
    const writeArgs = mockRun.mock.calls[2][0] as string[];
    const content = writeArgs.find((a) => a.startsWith("content="));
    expect(content).toBeDefined();
    const contentStr = content!.replace("content=", "");
    const taskLines = contentStr.split("\n").filter((l) => l.startsWith("- [ ]"));
    expect(taskLines[0]).toContain("Task C");
    expect(taskLines[1]).toContain("Task A");
    expect(taskLines[2]).toContain("Task B");
  });

  it("throws when no matching item is found", async () => {
    mockRun.mockResolvedValueOnce("# Backlog\n- [x] Done item\n");
    await expect(
      handleTool("backlog_prioritise", {
        project: "Acme",
        item: "Nonexistent",
        position: 1,
      }),
    ).rejects.toThrow(/No unchecked backlog item matching/);
  });

  it("moves the last item to position 2 (middle)", async () => {
    const backlog =
      "# Backlog -- Acme\n\n- [ ] Task A\n- [ ] Task B\n- [ ] Task C\n";
    mockRun
      .mockResolvedValueOnce(backlog) // prioritise read
      .mockResolvedValueOnce(backlog) // reorder read
      .mockResolvedValueOnce("ok"); // reorder write

    const result = await handleTool("backlog_prioritise", {
      project: "Acme",
      item: "Task C",
      position: 2,
    });

    expect(result).toContain("position 2");
    const writeArgs = mockRun.mock.calls[2][0] as string[];
    const content = writeArgs.find((a) => a.startsWith("content="));
    const contentStr = content!.replace("content=", "");
    const taskLines = contentStr.split("\n").filter((l) => l.startsWith("- [ ]"));
    expect(taskLines[0]).toContain("Task A");
    expect(taskLines[1]).toContain("Task C");
    expect(taskLines[2]).toContain("Task B");
  });

  it("written content has no diagnostic noise lines", async () => {
    // Simulate what happens if CLI noise leaks into content
    const backlog =
      "# Backlog -- Acme\n- [ ] Task A\n- [ ] Task B\n- [ ] Task C\n";
    mockRun
      .mockResolvedValueOnce(backlog) // prioritise read
      .mockResolvedValueOnce(backlog) // reorder read
      .mockResolvedValueOnce("ok"); // reorder write

    await handleTool("backlog_prioritise", {
      project: "Acme",
      item: "Task C",
      position: 1,
    });

    const writeArgs = mockRun.mock.calls[2][0] as string[];
    const content = writeArgs.find((a) => a.startsWith("content="))!;
    const contentStr = content.replace("content=", "");
    expect(contentStr).not.toContain("Loading");
    expect(contentStr.startsWith("# Backlog")).toBe(true);
  });
});

describe("backlog_reorder", () => {
  it("reorders multiple items in one call", async () => {
    const backlog =
      "# Backlog -- Acme\n- [ ] Task A\n- [ ] Task B\n- [ ] Task C\n- [ ] Task D\n";
    mockRun
      .mockResolvedValueOnce(backlog)
      .mockResolvedValueOnce("ok");

    const result = await handleTool("backlog_reorder", {
      project: "Acme",
      items: ["Task D", "Task B"],
    });

    expect(result).toContain("Reordered 2 items");
    const writeArgs = mockRun.mock.calls[1][0] as string[];
    const content = writeArgs.find((a) => a.startsWith("content="));
    const contentStr = content!.replace("content=", "");
    const taskLines = contentStr.split("\n").filter((l) => l.startsWith("- [ ]"));
    expect(taskLines[0]).toContain("Task D");
    expect(taskLines[1]).toContain("Task B");
    expect(taskLines[2]).toContain("Task A");
    expect(taskLines[3]).toContain("Task C");
  });

  it("reports not-found items", async () => {
    const backlog = "# Backlog\n- [ ] Task A\n- [ ] Task B\n";
    mockRun
      .mockResolvedValueOnce(backlog)
      .mockResolvedValueOnce("ok");

    const result = await handleTool("backlog_reorder", {
      project: "Acme",
      items: ["Task B", "Nonexistent"],
    });

    expect(result).toContain("Reordered 1 item");
    expect(result).toContain("not found: Nonexistent");
  });

  it("preserves checked items at the end", async () => {
    const backlog =
      "# Backlog\n- [x] Done item\n- [ ] Task A\n- [ ] Task B\n";
    mockRun
      .mockResolvedValueOnce(backlog)
      .mockResolvedValueOnce("ok");

    await handleTool("backlog_reorder", {
      project: "Acme",
      items: ["Task B"],
    });

    const writeArgs = mockRun.mock.calls[1][0] as string[];
    const content = writeArgs.find((a) => a.startsWith("content="))!;
    const contentStr = content.replace("content=", "");
    const lines = contentStr.split("\n").filter((l) => l.startsWith("- ["));
    expect(lines[0]).toContain("Task B");
    expect(lines[1]).toContain("Task A");
    expect(lines[2]).toContain("Done item");
  });
});
