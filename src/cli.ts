/**
 * @module cli
 *
 * Low-level wrapper around the official Obsidian CLI binary.
 *
 * Provides {@link runObsidian} to execute CLI commands and return stdout,
 * {@link buildArgs} to convert a command name and parameter object into a
 * CLI argument array, and {@link ObsidianCliError} for structured error
 * reporting.
 *
 * The Obsidian CLI requires the Obsidian desktop app (v1.12+) to be running
 * and a valid Catalyst licence.
 */

import { execFile } from "node:child_process";

/** Default timeout for CLI commands in milliseconds. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Name of the Obsidian CLI binary expected on PATH. */
const OBSIDIAN_BIN = "obsidian";

/** Raw result from an Obsidian CLI invocation. */
export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Error thrown when the Obsidian CLI exits with a non-zero status code.
 * Carries the exit code and raw stderr for diagnostic purposes.
 */
export class ObsidianCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "ObsidianCliError";
  }
}

/**
 * Run an Obsidian CLI command and return stdout.
 *
 * If OBSIDIAN_VAULT is set, prepends `vault=<name>` to target a specific vault.
 * The official Obsidian CLI requires the Obsidian app to be running.
 */
export async function runObsidian(
  args: string[],
  options?: { timeoutMs?: number; vault?: string },
): Promise<string> {
  const vault = options?.vault ?? process.env.OBSIDIAN_VAULT;
  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Append vault targeting after the command (Obsidian CLI expects vault= after command)
  const fullArgs = vault ? [...args, `vault=${vault}`] : args;

  const result = await execObsidian(fullArgs, timeout);

  if (result.exitCode !== 0) {
    const msg = result.stderr.trim() || result.stdout.trim() || "Command failed";
    throw new ObsidianCliError(msg, result.exitCode, result.stderr);
  }

  return result.stdout.trim();
}

/**
 * Build a CLI argument string from a command and parameter object.
 * Converts { name: "foo", content: "bar", silent: true } to
 * ["create", 'name=foo', 'content=bar', "silent"]
 */
export function buildArgs(
  command: string,
  params?: Record<string, string | number | boolean | undefined>,
): string[] {
  const args = [command];

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (typeof value === "boolean") {
        if (value) args.push(key); // flags: only include when true
      } else {
        args.push(`${key}=${String(value)}`);
      }
    }
  }

  return args;
}

/**
 * Execute the Obsidian CLI binary and collect its output.
 * Rejects with {@link ObsidianCliError} only on timeout; non-zero exit codes
 * are returned as part of the {@link CliResult} for the caller to handle.
 */
function execObsidian(args: string[], timeoutMs: number): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      OBSIDIAN_BIN,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      },
      (error, stdout, stderr) => {
        if (error && "killed" in error && error.killed) {
          reject(
            new ObsidianCliError(
              `Command timed out after ${timeoutMs}ms: obsidian ${args.join(" ")}`,
              1,
              stderr,
            ),
          );
          return;
        }

        // execFile sets error for non-zero exit codes, but we handle that upstream
        const exitCode =
          error && "code" in error && typeof error.code === "number"
            ? error.code
            : error
              ? 1
              : 0;

        resolve({ stdout, stderr, exitCode });
      },
    );
  });
}
