/**
 * @module validation
 *
 * Input validation for MCP tool calls.
 *
 * Validates that required parameters are present and that parameter values
 * match the expected types declared in the tool schemas from
 * {@link ./tools.ts}. Throws {@link ValidationError} on invalid input.
 */

import { tools } from "./tools.js";

/** Schema property definition extracted from tool inputSchema. */
interface SchemaProp {
  type?: string;
  enum?: string[];
  description?: string;
}

/** Parsed schema info cached per tool name. */
interface ToolSchema {
  required: Set<string>;
  properties: Record<string, SchemaProp>;
}

/**
 * Error thrown when tool input fails validation.
 */
export class ValidationError extends Error {
  constructor(
    public readonly toolName: string,
    message: string,
  ) {
    super(`Validation error for "${toolName}": ${message}`);
    this.name = "ValidationError";
  }
}

/** Lazily-built cache of parsed tool schemas, keyed by tool name. */
const schemaCache = new Map<string, ToolSchema>();

/** Parse and cache the schema for a given tool name. */
function getSchema(toolName: string): ToolSchema | undefined {
  const cached = schemaCache.get(toolName);
  if (cached) return cached;

  const tool = tools.find((t) => t.name === toolName);
  if (!tool) return undefined;

  const schema = tool.inputSchema as {
    required?: string[];
    properties?: Record<string, SchemaProp>;
  };

  const parsed: ToolSchema = {
    required: new Set(schema.required),
    properties: (schema.properties ?? {}) as Record<string, SchemaProp>,
  };

  schemaCache.set(toolName, parsed);
  return parsed;
}

/**
 * Validate tool input against its declared schema.
 *
 * Checks:
 *  1. The tool name is known.
 *  2. All required parameters are present and non-empty (for strings).
 *  3. Parameter types match the schema declaration.
 *  4. Enum values are within the allowed set.
 *
 * @throws {ValidationError} if validation fails.
 */
export function validateInput(toolName: string, input: Record<string, unknown>): void {
  const schema = getSchema(toolName);
  if (!schema) {
    throw new ValidationError(toolName, `Unknown tool "${toolName}"`);
  }

  // Check required fields
  for (const field of schema.required) {
    const value = input[field];
    if (value === undefined || value === null) {
      throw new ValidationError(toolName, `Missing required parameter "${field}"`);
    }
    if (typeof value === "string" && value.trim() === "") {
      throw new ValidationError(
        toolName,
        `Required parameter "${field}" must not be empty`,
      );
    }
  }

  // Check types and enum constraints for provided fields
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    const propSchema = schema.properties[key] as SchemaProp | undefined;
    if (!propSchema) continue; // allow extra params -- don't reject unknown keys

    // Type check
    if (propSchema.type) {
      const expectedType = propSchema.type;
      const actualType = typeof value;

      if (expectedType === "string" && actualType !== "string") {
        throw new ValidationError(
          toolName,
          `Parameter "${key}" must be a string, got ${actualType}`,
        );
      }
      if (expectedType === "number" && actualType !== "number") {
        throw new ValidationError(
          toolName,
          `Parameter "${key}" must be a number, got ${actualType}`,
        );
      }
      if (expectedType === "boolean" && actualType !== "boolean") {
        throw new ValidationError(
          toolName,
          `Parameter "${key}" must be a boolean, got ${actualType}`,
        );
      }
    }

    // Enum check
    if (propSchema.enum && typeof value === "string") {
      if (!propSchema.enum.includes(value)) {
        throw new ValidationError(
          toolName,
          `Parameter "${key}" must be one of [${propSchema.enum.join(", ")}], got "${value}"`,
        );
      }
    }
  }
}
