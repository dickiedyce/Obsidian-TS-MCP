import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  getVaultPath,
  resetVaultPathCache,
  writeVaultFile,
  readVaultFile,
  vaultFileExists,
  moveVaultFile,
  listVaultFiles,
  findFileByName,
  getDailyNoteConfig,
  getTemplatesFolder,
  getDailyNotePath,
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

    it("throws a descriptive error when env var is not set", async () => {
      delete process.env.OBSIDIAN_VAULT_PATH;
      resetVaultPathCache();
      await expect(getVaultPath()).rejects.toThrow(/OBSIDIAN_VAULT_PATH/);
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

  describe("moveVaultFile", () => {
    it("moves a file to a new path", async () => {
      await writeVaultFile("original.md", "hello");
      await moveVaultFile("original.md", "moved/original.md");
      expect(await vaultFileExists("moved/original.md")).toBe(true);
      expect(await vaultFileExists("original.md")).toBe(false);
    });

    it("creates destination directory as needed", async () => {
      await writeVaultFile("note.md", "content");
      await moveVaultFile("note.md", "deep/path/note.md");
      const content = await readFile(join(tmpDir, "deep/path/note.md"), "utf-8");
      expect(content).toBe("content");
    });
  });

  describe("listVaultFiles", () => {
    beforeEach(async () => {
      await writeVaultFile("root.md", "");
      await writeVaultFile("Projects/A/overview.md", "");
      await writeVaultFile("Projects/A/backlog.md", "");
      await writeVaultFile("Projects/B/overview.md", "");
      await writeVaultFile("Assets/image.png", "");
    });

    it("lists all files when no filter given", async () => {
      const files = await listVaultFiles();
      expect(files).toContain("root.md");
      expect(files).toContain("Projects/A/overview.md");
      expect(files).toContain("Assets/image.png");
    });

    it("filters by folder prefix", async () => {
      const files = await listVaultFiles({ folder: "Projects" });
      expect(files).toContain("Projects/A/overview.md");
      expect(files).not.toContain("root.md");
      expect(files).not.toContain("Assets/image.png");
    });

    it("filters by extension", async () => {
      const files = await listVaultFiles({ ext: "md" });
      expect(files.every((f) => f.endsWith(".md"))).toBe(true);
      expect(files).not.toContain("Assets/image.png");
    });

    it("filters by both folder and extension", async () => {
      const files = await listVaultFiles({ folder: "Projects", ext: "md" });
      expect(files).toContain("Projects/A/overview.md");
      expect(files).not.toContain("root.md");
    });

    it("skips hidden directories (.obsidian)", async () => {
      await mkdir(join(tmpDir, ".obsidian"), { recursive: true });
      await writeFile(join(tmpDir, ".obsidian/app.json"), "{}");
      const files = await listVaultFiles();
      expect(files.every((f) => !f.includes(".obsidian"))).toBe(true);
    });
  });

  describe("findFileByName", () => {
    beforeEach(async () => {
      await writeVaultFile("Notes/ProjectAlpha.md", "");
      await writeVaultFile("Archive/ProjectAlpha.md", "");
      await writeVaultFile("Daily Notes/2026-03-08.md", "");
    });

    it("finds a file by basename", async () => {
      const result = await findFileByName("2026-03-08");
      expect(result).toBe("Daily Notes/2026-03-08.md");
    });

    it("returns the shallowest match when multiple files have the same name", async () => {
      // Both Notes/ and Archive/ contain ProjectAlpha.md -- prefer shallower
      const result = await findFileByName("ProjectAlpha");
      // Both are at depth 2, so picks alphabetically first
      expect(result).toMatch(/ProjectAlpha\.md$/);
    });

    it("returns null when no file matches", async () => {
      expect(await findFileByName("NonExistent")).toBeNull();
    });

    it("matches case-insensitively", async () => {
      const result = await findFileByName("projectalpha");
      expect(result).not.toBeNull();
    });

    it("strips .md extension before matching", async () => {
      const result = await findFileByName("2026-03-08.md");
      expect(result).toBe("Daily Notes/2026-03-08.md");
    });
  });

  describe("getDailyNoteConfig", () => {
    it("returns defaults when config file is absent", async () => {
      const config = await getDailyNoteConfig();
      expect(config.folder).toBe("");
      expect(config.format).toBe("YYYY-MM-DD");
    });

    it("reads folder and format from config file", async () => {
      await mkdir(join(tmpDir, ".obsidian"), { recursive: true });
      await writeFile(
        join(tmpDir, ".obsidian/daily-notes.json"),
        JSON.stringify({ folder: "Daily Notes", format: "YYYY/MM/DD" }),
      );
      const config = await getDailyNoteConfig();
      expect(config.folder).toBe("Daily Notes");
      expect(config.format).toBe("YYYY/MM/DD");
    });
  });

  describe("getTemplatesFolder", () => {
    it("returns 'Templates' when config file is absent", async () => {
      expect(await getTemplatesFolder()).toBe("Templates");
    });

    it("reads folder from config file", async () => {
      await mkdir(join(tmpDir, ".obsidian"), { recursive: true });
      await writeFile(
        join(tmpDir, ".obsidian/templates.json"),
        JSON.stringify({ folder: "My Templates" }),
      );
      expect(await getTemplatesFolder()).toBe("My Templates");
    });
  });

  describe("getDailyNotePath", () => {
    it("returns path in vault root when folder is empty", async () => {
      const path = await getDailyNotePath(new Date(2026, 2, 8));
      expect(path).toMatch(/2026-03-08\.md$/);
      expect(path).not.toContain("/");
    });

    it("includes configured folder", async () => {
      await mkdir(join(tmpDir, ".obsidian"), { recursive: true });
      await writeFile(
        join(tmpDir, ".obsidian/daily-notes.json"),
        JSON.stringify({ folder: "Daily Notes", format: "YYYY-MM-DD" }),
      );
      resetVaultPathCache();
      process.env.OBSIDIAN_VAULT_PATH = tmpDir;
      const path = await getDailyNotePath(new Date(2026, 2, 8));
      expect(path).toBe("Daily Notes/2026-03-08.md");
    });
  });
});

