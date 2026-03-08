/**
 * @module cli
 *
 * Legacy module retained for backward compatibility.
 *
 * All Obsidian CLI invocation code has been replaced by direct filesystem
 * operations in {@link ./fs-ops.ts} and {@link ./handlers.ts}.
 * {@link ObsidianCliError} is kept so that {@link ./server.ts} can still
 * reference it in its error-formatting logic.
 */

/**
 * Error class retained for backward compatibility with {@link ./server.ts}.
 * It is no longer thrown by the server in normal operation.
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
