import { describe, it, expect } from "vitest";
import { ObsidianCliError } from "../src/cli.js";

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
