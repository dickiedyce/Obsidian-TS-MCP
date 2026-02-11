/**
 * @module tools
 *
 * MCP tool definitions for the Obsidian MCP server.
 *
 * Each entry describes one tool that an MCP client can invoke: its name,
 * human-readable description, and a JSON Schema for the expected input.
 * The handler logic that actually executes these tools lives in
 * {@link ./handlers.ts}.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Helper to build a JSON Schema object with 'type' narrowed to the literal
 * "object" that the MCP SDK expects, avoiding `as const` at every call site.
 */
function objectSchema(
  properties: Record<string, Record<string, unknown>>,
  required?: string[],
): Tool["inputSchema"] {
  const schema: Tool["inputSchema"] = {
    type: "object",
    properties,
  };
  if (required && required.length > 0) {
    (schema as Record<string, unknown>).required = required;
  }
  return schema;
}

/**
 * Complete list of MCP tools exposed by this server.
 * There are 16 tools organised into four groups:
 *
 *  1. Core -- note creation, reading, appending, prepending, searching,
 *     and daily-note management.
 *  2. Discovery -- vault info, file listing, tags, backlinks, outlines.
 *  3. Properties -- reading and setting frontmatter metadata.
 *  4. Tasks -- listing and toggling task checkboxes.
 */
export const tools: Tool[] = [
  // ── Core: Note Management ─────────────────────────────────────────────

  {
    name: "create_note",
    description:
      "Create a new note in the Obsidian vault. Supports optional content and templates. " +
      "Use this when you need to record a new session, decision, or piece of documentation.",
    inputSchema: objectSchema(
      {
        name: {
          type: "string",
          description: "Note name (without .md extension)",
        },
        content: {
          type: "string",
          description:
            "Initial content for the note. Supports markdown. Use \\n for newlines.",
        },
        template: {
          type: "string",
          description: "Template name to use for the note",
        },
        overwrite: {
          type: "boolean",
          description: "Overwrite if a note with this name already exists",
        },
      },
      ["name"],
    ),
  },

  {
    name: "read_note",
    description:
      "Read the full contents of a note. Returns the markdown content including frontmatter. " +
      "Provide at least one of 'file' or 'path' to identify the note.",
    inputSchema: objectSchema({
      file: {
        type: "string",
        description:
          "Note name (resolved like internal links — no path or extension needed)",
      },
      path: {
        type: "string",
        description: "Exact path from vault root (e.g. 'folder/note.md')",
      },
    }),
  },

  {
    name: "append_to_note",
    description:
      "Append content to the end of an existing note. Useful for adding session logs, " +
      "tasks, or follow-up notes to an existing document.",
    inputSchema: objectSchema(
      {
        file: {
          type: "string",
          description: "Note name to append to",
        },
        path: {
          type: "string",
          description: "Exact path from vault root",
        },
        content: {
          type: "string",
          description: "Content to append. Use \\n for newlines.",
        },
      },
      ["content"],
    ),
  },

  {
    name: "prepend_to_note",
    description:
      "Prepend content after the frontmatter of a note. Useful for adding a summary or " +
      "status update at the top of an existing document.",
    inputSchema: objectSchema(
      {
        file: {
          type: "string",
          description: "Note name to prepend to",
        },
        path: {
          type: "string",
          description: "Exact path from vault root",
        },
        content: {
          type: "string",
          description: "Content to prepend. Use \\n for newlines.",
        },
      },
      ["content"],
    ),
  },

  {
    name: "search_vault",
    description:
      "Search the vault for text. Returns matching files and context. " +
      "Use Obsidian's full search syntax (supports operators, tags, paths).",
    inputSchema: objectSchema(
      {
        query: {
          type: "string",
          description: "Search query (supports Obsidian search syntax)",
        },
        path: {
          type: "string",
          description: "Limit search to a folder path",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
        },
        format: {
          type: "string",
          enum: ["text", "json"],
          description: "Output format (default: json)",
        },
      },
      ["query"],
    ),
  },

  {
    name: "daily_note",
    description:
      "Get today's daily note path, creating it if it doesn't exist. " +
      "Returns the file path of the daily note.",
    inputSchema: objectSchema({}),
  },

  {
    name: "daily_append",
    description:
      "Append content to today's daily note. Creates the daily note if it doesn't exist. " +
      "Useful for logging tasks, session summaries, or quick entries.",
    inputSchema: objectSchema(
      {
        content: {
          type: "string",
          description: "Content to append to the daily note. Use \\n for newlines.",
        },
      },
      ["content"],
    ),
  },

  // ── Discovery & Context ───────────────────────────────────────────────

  {
    name: "get_vault_info",
    description:
      "Get information about the Obsidian vault: name, path, file count, folder count, and size.",
    inputSchema: objectSchema({
      info: {
        type: "string",
        enum: ["name", "path", "files", "folders", "size"],
        description: "Return only a specific piece of info",
      },
    }),
  },

  {
    name: "list_files",
    description: "List files in the vault. Can filter by folder and/or file extension.",
    inputSchema: objectSchema({
      folder: {
        type: "string",
        description: "Filter to files in this folder",
      },
      ext: {
        type: "string",
        description: "Filter by file extension (e.g. 'md', 'png')",
      },
      total: {
        type: "boolean",
        description: "Return only the file count instead of the list",
      },
    }),
  },

  {
    name: "get_tags",
    description:
      "List all tags in the vault with their occurrence counts. " +
      "Always returns all tags with counts included.",
    inputSchema: objectSchema({
      sort: {
        type: "string",
        enum: ["name", "count"],
        description: "Sort order (default: name)",
      },
    }),
  },

  {
    name: "get_backlinks",
    description:
      "List all notes that link to a given note (backlinks/incoming links). " +
      "Provide at least one of 'file' or 'path' to identify the note.",
    inputSchema: objectSchema({
      file: {
        type: "string",
        description: "Note name to find backlinks for",
      },
      path: {
        type: "string",
        description: "Exact path from vault root",
      },
    }),
  },

  {
    name: "get_outline",
    description: "Get the heading structure/outline of a note.",
    inputSchema: objectSchema({
      file: {
        type: "string",
        description: "Note name",
      },
      path: {
        type: "string",
        description: "Exact path from vault root",
      },
      format: {
        type: "string",
        enum: ["tree", "md"],
        description: "Output format (default: tree)",
      },
    }),
  },

  // ── Properties / Metadata ─────────────────────────────────────────────

  {
    name: "set_property",
    description:
      "Set a frontmatter property on a note. Supports text, list, number, checkbox, date, datetime types.",
    inputSchema: objectSchema(
      {
        name: {
          type: "string",
          description: "Property name",
        },
        value: {
          type: "string",
          description: "Property value",
        },
        type: {
          type: "string",
          enum: ["text", "list", "number", "checkbox", "date", "datetime"],
          description: "Property type",
        },
        file: {
          type: "string",
          description: "Note name",
        },
        path: {
          type: "string",
          description: "Exact path from vault root",
        },
      },
      ["name", "value"],
    ),
  },

  {
    name: "read_property",
    description: "Read a frontmatter property value from a note.",
    inputSchema: objectSchema(
      {
        name: {
          type: "string",
          description: "Property name to read",
        },
        file: {
          type: "string",
          description: "Note name",
        },
        path: {
          type: "string",
          description: "Exact path from vault root",
        },
      },
      ["name"],
    ),
  },

  // ── Tasks ─────────────────────────────────────────────────────────────

  {
    name: "list_tasks",
    description:
      "List tasks from notes. Can filter by file, completion status, or show tasks from the daily note.",
    inputSchema: objectSchema({
      file: {
        type: "string",
        description: "Filter tasks to a specific note",
      },
      path: {
        type: "string",
        description: "Filter tasks by file path",
      },
      all: {
        type: "boolean",
        description: "List all tasks in the vault",
      },
      daily: {
        type: "boolean",
        description: "Show tasks from today's daily note",
      },
      done: {
        type: "boolean",
        description: "Show only completed tasks",
      },
      todo: {
        type: "boolean",
        description: "Show only incomplete tasks",
      },
      verbose: {
        type: "boolean",
        description: "Group by file with line numbers",
      },
    }),
  },

  {
    name: "toggle_task",
    description:
      "Toggle a task's completion status. " +
      "Identify the task by 'ref' (path:line) or by 'file' and 'line' together.",
    inputSchema: objectSchema({
      ref: {
        type: "string",
        description: "Task reference in path:line format (e.g. 'Recipe.md:8')",
      },
      file: {
        type: "string",
        description: "Note name containing the task",
      },
      line: {
        type: "number",
        description: "Line number of the task",
      },
    }),
  },
];
