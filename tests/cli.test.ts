import { describe, it, expect } from "vitest";
import { buildArgs, ObsidianCliError } from "../src/cli.js";

// ── buildArgs ───────────────────────────────────────────────────────────

describe("buildArgs", () => {
  it("returns just the command when no params given", () => {
    expect(buildArgs("vault")).toEqual(["vault"]);
  });

  it("returns just the command when params is empty", () => {
    expect(buildArgs("read", {})).toEqual(["read"]);
  });

  it("converts string params to key=value", () => {
    expect(buildArgs("read", { file: "MyNote" })).toEqual(["read", "file=MyNote"]);
  });

  it("converts number params to key=value", () => {
    expect(buildArgs("search", { limit: 10 })).toEqual(["search", "limit=10"]);
  });

  it("includes boolean true as a bare flag", () => {
    expect(buildArgs("create", { silent: true })).toEqual(["create", "silent"]);
  });

  it("omits boolean false params", () => {
    expect(buildArgs("create", { silent: false })).toEqual(["create"]);
  });

  it("omits undefined params", () => {
    expect(buildArgs("create", { name: "Test", content: undefined })).toEqual([
      "create",
      "name=Test",
    ]);
  });

  it("handles mixed param types", () => {
    const args = buildArgs("search", {
      query: "todo",
      limit: 5,
      format: "json",
    });
    expect(args).toEqual(["search", "query=todo", "limit=5", "format=json"]);
  });

  it("handles params with special characters", () => {
    const args = buildArgs("create", { name: "My Note (draft)" });
    expect(args).toEqual(["create", "name=My Note (draft)"]);
  });

  it("handles params with newlines", () => {
    const args = buildArgs("append", { content: "line1\\nline2" });
    expect(args).toEqual(["append", "content=line1\\nline2"]);
  });

  it("preserves param order from object", () => {
    const args = buildArgs("create", {
      name: "Test",
      content: "Hello",
      silent: true,
      overwrite: true,
    });
    expect(args[0]).toBe("create");
    expect(args).toContain("name=Test");
    expect(args).toContain("content=Hello");
    expect(args).toContain("silent");
    expect(args).toContain("overwrite");
  });
});

// ── ObsidianCliError ────────────────────────────────────────────────────

describe("ObsidianCliError", () => {
  it("stores exitCode and stderr", () => {
    const err = new ObsidianCliError("fail", 2, "some stderr");
    expect(err.message).toBe("fail");
    expect(err.exitCode).toBe(2);
    expect(err.stderr).toBe("some stderr");
    expect(err.name).toBe("ObsidianCliError");
  });

  it("is an instance of Error", () => {
    const err = new ObsidianCliError("fail", 1, "");
    expect(err).toBeInstanceOf(Error);
  });
});
