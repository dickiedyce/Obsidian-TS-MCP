/**
 * @module fs-ops
 *
 * Direct filesystem operations for vault file management.
 *
 * Bypasses the Obsidian CLI when exact path control is needed -- for
 * example, creating notes inside subdirectories (the CLI ignores
 * directory components in the `name` parameter) or writing to a known
 * path without fuzzy matching.
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { runObsidian, buildArgs } from "./cli.js";

/** Cached vault root directory path (resolved once per process). */
let cachedVaultPath: string | undefined;

/**
 * Resolve the vault root directory path.
 *
 * Checks `OBSIDIAN_VAULT_PATH` environment variable first, then falls
 * back to querying the CLI with `vault info=path`.
 */
export async function getVaultPath(): Promise<string> {
  if (cachedVaultPath) return cachedVaultPath;

  const envPath = process.env.OBSIDIAN_VAULT_PATH;
  if (envPath) {
    cachedVaultPath = envPath;
    return envPath;
  }

  const result = await runObsidian(buildArgs("vault", { info: "path" }));
  cachedVaultPath = result.trim();
  return cachedVaultPath;
}

/**
 * Clear the cached vault path.  Intended for tests.
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

/**
 * Write a file in the vault, creating parent directories as needed.
 *
 * By default refuses to overwrite an existing file.  Pass
 * `{ overwrite: true }` to replace it.
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
 * Read a file from the vault by exact relative path.
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
