import { describe, it, expect } from "vitest";
import { validateInput, ValidationError } from "../src/validation.js";

describe("validateInput", () => {
  // ── Unknown tool ────────────────────────────────────────────────────

  it("throws for an unknown tool name", () => {
    expect(() => validateInput("nonexistent", {})).toThrow(ValidationError);
    expect(() => validateInput("nonexistent", {})).toThrow(/Unknown tool "nonexistent"/);
  });

  // ── Required fields ─────────────────────────────────────────────────

  it("throws when a required field is missing", () => {
    expect(() => validateInput("create_note", {})).toThrow(
      /Missing required parameter "name"/,
    );
  });

  it("throws when a required string field is empty", () => {
    expect(() => validateInput("create_note", { name: "  " })).toThrow(
      /must not be empty/,
    );
  });

  it("passes when required fields are present", () => {
    expect(() => validateInput("create_note", { name: "My Note" })).not.toThrow();
  });

  it("passes for tools with no required fields", () => {
    expect(() => validateInput("daily_note", {})).not.toThrow();
    expect(() => validateInput("list_files", {})).not.toThrow();
    expect(() => validateInput("list_tasks", {})).not.toThrow();
  });

  it("validates multiple required fields", () => {
    expect(() => validateInput("set_property", {})).toThrow(
      /Missing required parameter "name"/,
    );
    expect(() => validateInput("set_property", { name: "status" })).toThrow(
      /Missing required parameter "value"/,
    );
    expect(() =>
      validateInput("set_property", { name: "status", value: "done" }),
    ).not.toThrow();
  });

  // ── Type checking ───────────────────────────────────────────────────

  it("rejects wrong type for string param", () => {
    expect(() => validateInput("create_note", { name: 42 })).toThrow(/must be a string/);
  });

  it("rejects wrong type for number param", () => {
    expect(() =>
      validateInput("search_vault", { query: "test", limit: "not-a-number" }),
    ).toThrow(/must be a number/);
  });

  it("rejects wrong type for boolean param", () => {
    expect(() =>
      validateInput("create_note", { name: "Test", overwrite: "yes" }),
    ).toThrow(/must be a boolean/);
  });

  it("accepts correct types", () => {
    expect(() =>
      validateInput("search_vault", {
        query: "todo",
        limit: 10,
        format: "json",
      }),
    ).not.toThrow();
  });

  // ── Enum checking ───────────────────────────────────────────────────

  it("rejects invalid enum value", () => {
    expect(() => validateInput("search_vault", { query: "test", format: "xml" })).toThrow(
      /must be one of \[text, json\]/,
    );
  });

  it("accepts valid enum value", () => {
    expect(() =>
      validateInput("search_vault", { query: "test", format: "text" }),
    ).not.toThrow();
  });

  it("validates get_vault_info enum", () => {
    expect(() => validateInput("get_vault_info", { info: "invalid" })).toThrow(
      /must be one of/,
    );
    expect(() => validateInput("get_vault_info", { info: "name" })).not.toThrow();
  });

  it("validates set_property type enum", () => {
    expect(() =>
      validateInput("set_property", {
        name: "priority",
        value: "5",
        type: "integer",
      }),
    ).toThrow(/must be one of/);
    expect(() =>
      validateInput("set_property", {
        name: "priority",
        value: "5",
        type: "number",
      }),
    ).not.toThrow();
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it("allows extra/unknown parameters", () => {
    expect(() =>
      validateInput("create_note", { name: "Test", extraField: "hello" }),
    ).not.toThrow();
  });

  it("allows undefined optional params", () => {
    expect(() =>
      validateInput("create_note", {
        name: "Test",
        content: undefined,
        template: undefined,
      }),
    ).not.toThrow();
  });

  it("ValidationError has correct properties", () => {
    try {
      validateInput("create_note", {});
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).toolName).toBe("create_note");
      expect((err as ValidationError).name).toBe("ValidationError");
    }
  });
});
