import { describe, it, expect } from "vitest";
import {
  SERVER_NAME,
  SERVER_VERSION,
  formatToolError,
  createServer,
} from "../src/server.js";
import { ObsidianCliError } from "../src/cli.js";
import { ValidationError } from "../src/validation.js";

// ── Constants ───────────────────────────────────────────────────────────

describe("server constants", () => {
  it("has expected server name", () => {
    expect(SERVER_NAME).toBe("obsidian-ts-mcp");
  });

  it("reads version from package.json", () => {
    expect(SERVER_VERSION).toBe("0.1.0");
    expect(typeof SERVER_VERSION).toBe("string");
    // Verify it looks like a semver string
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ── formatToolError ─────────────────────────────────────────────────────

describe("formatToolError", () => {
  it("formats ValidationError with its message", () => {
    const err = new ValidationError("create_note", 'Missing required parameter "name"');
    const msg = formatToolError(err);
    expect(msg).toContain("create_note");
    expect(msg).toContain("Missing required parameter");
  });

  it("formats ObsidianCliError with exit code and message", () => {
    const err = new ObsidianCliError("vault not found", 1, "stderr text");
    const msg = formatToolError(err);
    expect(msg).toBe("Obsidian CLI error (exit 1): vault not found");
  });

  it("formats generic Error with its message", () => {
    const err = new Error("something broke");
    const msg = formatToolError(err);
    expect(msg).toBe("something broke");
  });

  it("formats non-Error values with String()", () => {
    expect(formatToolError("raw string")).toBe("raw string");
    expect(formatToolError(42)).toBe("42");
    expect(formatToolError(null)).toBe("null");
  });

  it("prefers ValidationError over ObsidianCliError format", () => {
    // ValidationError is checked first, so this should use its branch
    const err = new ValidationError("test_tool", "bad input");
    const msg = formatToolError(err);
    expect(msg).not.toContain("Obsidian CLI error");
    expect(msg).toContain("bad input");
  });
});

// ── createServer ────────────────────────────────────────────────────────

describe("createServer", () => {
  it("returns a Server instance", () => {
    const server = createServer();
    expect(server).toBeDefined();
    // The Server from MCP SDK should have a connect method
    expect(typeof server.connect).toBe("function");
  });

  it("can be called multiple times to create independent servers", () => {
    const server1 = createServer();
    const server2 = createServer();
    expect(server1).not.toBe(server2);
  });
});
