import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock CLI module so we never call the real Obsidian binary
vi.mock("../src/cli.js", () => ({
  runObsidian: vi.fn(),
  buildArgs: vi.fn((...args: unknown[]) => args),
}));

import {
  getVaultPath,
  resetVaultPathCache,
  writeVaultFile,
  readVaultFile,
  vaultFileExists,
} from "../src/fs-ops.js";

describe("fs-ops", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "vault-test-"));
    process.env.OBSIDIAN_VAULT_PATH = tmpDir;
    resetVaultPathCache();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
    delete process.env.OBSIDIAN_VAULT_PATH;
    resetVaultPathCache();
  });

  describe("getVaultPath", () => {
    it("uses OBSIDIAN_VAULT_PATH env var", async () => {
      const path = await getVaultPath();
      expect(path).toBe(tmpDir);
    });

    it("caches the vault path across calls", async () => {
      const first = await getVaultPath();
      delete process.env.OBSIDIAN_VAULT_PATH;
      const second = await getVaultPath();
      expect(second).toBe(first);
    });
  });

  describe("writeVaultFile", () => {
    it("creates a file with parent directories", async () => {
      await writeVaultFile("Projects/Test/note.md", "# Hello");
      const content = await readFile(join(tmpDir, "Projects/Test/note.md"), "utf-8");
      expect(content).toBe("# Hello");
    });

    it("creates deeply nested directories", async () => {
      await writeVaultFile("a/b/c/d/note.md", "deep");
      const content = await readFile(join(tmpDir, "a/b/c/d/note.md"), "utf-8");
      expect(content).toBe("deep");
    });

    it("throws when file exists and overwrite is false", async () => {
      await writeVaultFile("test.md", "first");
      await expect(writeVaultFile("test.md", "second")).rejects.toThrow(
        /already exists/,
      );
    });

    it("overwrites when overwrite is true", async () => {
      await writeVaultFile("test.md", "first");
      await writeVaultFile("test.md", "second", { overwrite: true });
      const content = await readFile(join(tmpDir, "test.md"), "utf-8");
      expect(content).toBe("second");
    });

    it("defaults to no overwrite", async () => {
      await writeVaultFile("test.md", "first");
      await expect(writeVaultFile("test.md", "second")).rejects.toThrow();
    });
  });

  describe("readVaultFile", () => {
    it("reads file content by exact path", async () => {
      await writeVaultFile("Projects/Test/note.md", "content here");
      const result = await readVaultFile("Projects/Test/note.md");
      expect(result).toBe("content here");
    });

    it("throws when file does not exist", async () => {
      await expect(readVaultFile("nonexistent.md")).rejects.toThrow();
    });
  });

  describe("vaultFileExists", () => {
    it("returns true for existing files", async () => {
      await writeVaultFile("test.md", "content");
      expect(await vaultFileExists("test.md")).toBe(true);
    });

    it("returns false for non-existing files", async () => {
      expect(await vaultFileExists("nonexistent.md")).toBe(false);
    });

    it("returns false for non-existing directories", async () => {
      expect(await vaultFileExists("no/such/dir/file.md")).toBe(false);
    });
  });
});
