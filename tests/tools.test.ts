import { describe, it, expect } from "vitest";
import { tools } from "../src/tools.js";

const EXPECTED_TOOL_NAMES = [
  "create_note",
  "read_note",
  "append_to_note",
  "prepend_to_note",
  "search_vault",
  "daily_note",
  "daily_append",
  "get_vault_info",
  "list_files",
  "get_tags",
  "get_backlinks",
  "get_outline",
  "set_property",
  "read_property",
  "list_tasks",
  "toggle_task",
];

describe("tool definitions", () => {
  it("exports exactly 16 tools", () => {
    expect(tools).toHaveLength(16);
  });

  it("has all expected tool names", () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
  });

  it("has no duplicate tool names", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const tool of tools) {
    describe(tool.name, () => {
      it("has a non-empty description", () => {
        expect(tool.description).toBeTruthy();
        expect(tool.description?.length).toBeGreaterThan(10);
      });

      it("has a valid inputSchema with type object", () => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
      });

      it("has descriptions for every property", () => {
        const props = tool.inputSchema.properties as Record<
          string,
          { description?: string }
        >;
        for (const [key, value] of Object.entries(props)) {
          expect(
            value.description,
            `${tool.name}.${key} missing description`,
          ).toBeTruthy();
        }
      });

      it("required fields are listed in properties", () => {
        const required = (tool.inputSchema as { required?: string[] }).required;
        if (required) {
          const propKeys = Object.keys(
            tool.inputSchema.properties as Record<string, unknown>,
          );
          for (const req of required) {
            expect(
              propKeys,
              `${tool.name}: required field "${req}" not in properties`,
            ).toContain(req);
          }
        }
      });
    });
  }
});

// ── Specific tool schema checks ─────────────────────────────────────────

describe("specific schemas", () => {
  const byName = (name: string): (typeof tools)[number] => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool "${name}" not found`);
    return tool;
  };

  it("create_note requires 'name'", () => {
    const schema = byName("create_note").inputSchema as { required?: string[] };
    expect(schema.required).toContain("name");
  });

  it("append_to_note requires 'content'", () => {
    const schema = byName("append_to_note").inputSchema as {
      required?: string[];
    };
    expect(schema.required).toContain("content");
  });

  it("prepend_to_note requires 'content'", () => {
    const schema = byName("prepend_to_note").inputSchema as {
      required?: string[];
    };
    expect(schema.required).toContain("content");
  });

  it("search_vault requires 'query'", () => {
    const schema = byName("search_vault").inputSchema as {
      required?: string[];
    };
    expect(schema.required).toContain("query");
  });

  it("daily_append requires 'content'", () => {
    const schema = byName("daily_append").inputSchema as {
      required?: string[];
    };
    expect(schema.required).toContain("content");
  });

  it("set_property requires 'name' and 'value'", () => {
    const schema = byName("set_property").inputSchema as {
      required?: string[];
    };
    expect(schema.required).toContain("name");
    expect(schema.required).toContain("value");
  });

  it("read_property requires 'name'", () => {
    const schema = byName("read_property").inputSchema as {
      required?: string[];
    };
    expect(schema.required).toContain("name");
  });

  it("daily_note has no required fields", () => {
    const schema = byName("daily_note").inputSchema as {
      required?: string[];
    };
    expect(schema.required).toBeUndefined();
  });

  it("get_vault_info info enum has correct values", () => {
    const props = byName("get_vault_info").inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >;
    expect(props.info.enum).toEqual(["name", "path", "files", "folders", "size"]);
  });

  it("search_vault format enum has text and json", () => {
    const props = byName("search_vault").inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >;
    expect(props.format.enum).toEqual(["text", "json"]);
  });

  it("get_outline format enum has tree and md", () => {
    const props = byName("get_outline").inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >;
    expect(props.format.enum).toEqual(["tree", "md"]);
  });

  it("set_property type enum has all supported types", () => {
    const props = byName("set_property").inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >;
    expect(props.type.enum).toEqual([
      "text",
      "list",
      "number",
      "checkbox",
      "date",
      "datetime",
    ]);
  });

  it("get_tags sort enum has name and count", () => {
    const props = byName("get_tags").inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >;
    expect(props.sort.enum).toEqual(["name", "count"]);
  });
});
