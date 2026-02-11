import { describe, it, expect, vi, beforeEach } from "vitest";
import { runObsidian, ObsidianCliError } from "../src/cli.js";

// Mock child_process.execFile to avoid invoking the real Obsidian binary
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);

/**
 * Helper to configure the execFile mock to simulate a CLI call.
 * Uses the same callback signature that Node.js execFile provides.
 */
function mockCliCall(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  killed?: boolean;
}): void {
  mockExecFile.mockImplementation(
    (_bin: unknown, _args: unknown, _options: unknown, cb: unknown) => {
      const callback = cb as (
        error: Error | null,
        stdout: string,
        stderr: string,
      ) => void;

      const stdout = opts.stdout ?? "";
      const stderr = opts.stderr ?? "";

      if (opts.killed) {
        const err = Object.assign(new Error("killed"), { killed: true });
        callback(err, stdout, stderr);
        return undefined as never;
      }

      if (opts.exitCode && opts.exitCode !== 0) {
        const err = Object.assign(new Error("non-zero exit"), {
          code: opts.exitCode,
        });
        callback(err, stdout, stderr);
        return undefined as never;
      }

      callback(null, stdout, stderr);
      return undefined as never;
    },
  );
}

beforeEach(() => {
  mockExecFile.mockReset();
});

describe("runObsidian", () => {
  // ── Successful invocations ──────────────────────────────────────────

  it("returns trimmed stdout on success", async () => {
    mockCliCall({ stdout: "  vault info  \n" });
    const result = await runObsidian(["vault"]);
    expect(result).toBe("vault info");
  });

  it("passes args to execFile", async () => {
    mockCliCall({ stdout: "ok" });
    await runObsidian(["read", "file=MyNote"]);
    expect(mockExecFile).toHaveBeenCalledOnce();
    const callArgs = mockExecFile.mock.calls[0];
    expect(callArgs[0]).toBe("obsidian");
    expect(callArgs[1]).toEqual(["read", "file=MyNote"]);
  });

  // ── Vault targeting via options ─────────────────────────────────────

  it("appends vault= when vault is passed via options", async () => {
    mockCliCall({ stdout: "ok" });
    await runObsidian(["vault"], { vault: "My Vault" });
    const callArgs = mockExecFile.mock.calls[0];
    expect(callArgs[1]).toEqual(["vault", "vault=My Vault"]);
  });

  // ── Vault targeting via env ─────────────────────────────────────────

  it("appends vault= from OBSIDIAN_VAULT env var", async () => {
    const original = process.env.OBSIDIAN_VAULT;
    process.env.OBSIDIAN_VAULT = "Test Vault";
    try {
      mockCliCall({ stdout: "ok" });
      await runObsidian(["vault"]);
      const callArgs = mockExecFile.mock.calls[0];
      expect(callArgs[1]).toEqual(["vault", "vault=Test Vault"]);
    } finally {
      if (original === undefined) {
        delete process.env.OBSIDIAN_VAULT;
      } else {
        process.env.OBSIDIAN_VAULT = original;
      }
    }
  });

  it("options.vault takes precedence over env var", async () => {
    const original = process.env.OBSIDIAN_VAULT;
    process.env.OBSIDIAN_VAULT = "Env Vault";
    try {
      mockCliCall({ stdout: "ok" });
      await runObsidian(["vault"], { vault: "Option Vault" });
      const callArgs = mockExecFile.mock.calls[0];
      expect(callArgs[1]).toEqual(["vault", "vault=Option Vault"]);
    } finally {
      if (original === undefined) {
        delete process.env.OBSIDIAN_VAULT;
      } else {
        process.env.OBSIDIAN_VAULT = original;
      }
    }
  });

  it("does not append vault= when no vault env or option set", async () => {
    const original = process.env.OBSIDIAN_VAULT;
    delete process.env.OBSIDIAN_VAULT;
    try {
      mockCliCall({ stdout: "ok" });
      await runObsidian(["vault"]);
      const callArgs = mockExecFile.mock.calls[0];
      expect(callArgs[1]).toEqual(["vault"]);
    } finally {
      if (original !== undefined) {
        process.env.OBSIDIAN_VAULT = original;
      }
    }
  });

  // ── Timeout option ──────────────────────────────────────────────────

  it("passes custom timeout to execFile options", async () => {
    mockCliCall({ stdout: "ok" });
    await runObsidian(["vault"], { timeoutMs: 5000 });
    const execOptions = mockExecFile.mock.calls[0][2] as { timeout: number };
    expect(execOptions.timeout).toBe(5000);
  });

  it("uses default timeout when not specified", async () => {
    mockCliCall({ stdout: "ok" });
    await runObsidian(["vault"]);
    const execOptions = mockExecFile.mock.calls[0][2] as { timeout: number };
    expect(execOptions.timeout).toBe(15_000);
  });

  // ── Non-zero exit codes ─────────────────────────────────────────────

  it("throws ObsidianCliError on non-zero exit code", async () => {
    mockCliCall({ exitCode: 1, stderr: "vault not found" });
    await expect(runObsidian(["vault"])).rejects.toThrow(ObsidianCliError);
  });

  it("includes stderr in error message when available", async () => {
    mockCliCall({ exitCode: 1, stderr: "vault not found" });
    try {
      await runObsidian(["vault"]);
    } catch (err) {
      expect(err).toBeInstanceOf(ObsidianCliError);
      expect((err as ObsidianCliError).message).toBe("vault not found");
      expect((err as ObsidianCliError).exitCode).toBe(1);
      expect((err as ObsidianCliError).stderr).toBe("vault not found");
    }
  });

  it("falls back to stdout when stderr is empty", async () => {
    mockCliCall({ exitCode: 2, stderr: "", stdout: "error in stdout\n" });
    try {
      await runObsidian(["vault"]);
    } catch (err) {
      expect((err as ObsidianCliError).message).toBe("error in stdout");
    }
  });

  it("uses 'Command failed' when both stdout and stderr are empty", async () => {
    mockCliCall({ exitCode: 1, stderr: "", stdout: "" });
    try {
      await runObsidian(["vault"]);
    } catch (err) {
      expect((err as ObsidianCliError).message).toBe("Command failed");
    }
  });

  // ── Timeout / killed process ────────────────────────────────────────

  it("rejects with ObsidianCliError when process is killed (timeout)", async () => {
    mockCliCall({ killed: true, stderr: "" });
    await expect(runObsidian(["vault"])).rejects.toThrow(ObsidianCliError);
    await expect(runObsidian(["vault"])).rejects.toThrow(/timed out/);
  });

  it("includes command in timeout error message", async () => {
    mockCliCall({ killed: true, stderr: "" });
    try {
      await runObsidian(["search", "query=test"]);
    } catch (err) {
      expect((err as ObsidianCliError).message).toContain("obsidian search query=test");
    }
  });
});
