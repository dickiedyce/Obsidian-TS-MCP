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
 * There are 26 tools organised into nine groups:
 *
 *  1. Core -- note creation, reading, appending, prepending, searching,
 *     and daily-note management.
 *  2. Discovery -- vault info, file listing, tags, backlinks, outlines.
 *  3. Properties -- reading, setting, and removing frontmatter metadata.
 *  4. Tasks -- listing and toggling task checkboxes.
 *  5. Daily Notes (extended) -- reading and prepending to the daily note.
 *  6. Templates -- listing and reading vault templates.
 *  7. Links -- outgoing link discovery.
 *  8. Tags (extended) -- detailed tag information.
 *  9. File Management, Bases -- moving files and querying structured views.
 * 10. Project Management -- per-project backlog, overview, and listing.
 */
/**
 * Complete list of MCP tools exposed by this server (32 tools).
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

  // ── Daily Notes (extended) ──────────────────────────────────────────

  {
    name: "daily_read",
    description:
      "Read the contents of today's daily note. Returns the full markdown content " +
      "including frontmatter. Creates the daily note if it doesn't exist.",
    inputSchema: objectSchema({}),
  },

  {
    name: "daily_prepend",
    description:
      "Prepend content after the frontmatter of today's daily note. Useful for " +
      "adding standup summaries or status updates at the top of the daily note.",
    inputSchema: objectSchema(
      {
        content: {
          type: "string",
          description: "Content to prepend. Use \\n for newlines.",
        },
      },
      ["content"],
    ),
  },

  // ── Templates ─────────────────────────────────────────────────────────

  {
    name: "list_templates",
    description:
      "List all available templates in the vault. Returns template names that can " +
      "be used with create_note's template parameter.",
    inputSchema: objectSchema({
      total: {
        type: "boolean",
        description: "Return only the template count instead of the list",
      },
    }),
  },

  {
    name: "read_template",
    description:
      "Read the contents of a template. Optionally resolves template variables " +
      "like {{date}}, {{time}}, and {{title}}.",
    inputSchema: objectSchema(
      {
        name: {
          type: "string",
          description: "Template name (without path or extension)",
        },
        resolve: {
          type: "boolean",
          description: "Resolve template variables ({{date}}, {{time}}, {{title}})",
        },
      },
      ["name"],
    ),
  },

  // ── Links ─────────────────────────────────────────────────────────────

  {
    name: "get_links",
    description:
      "List all outgoing links from a note. Returns the files that the given note " +
      "links to. The complement of get_backlinks.",
    inputSchema: objectSchema({
      file: {
        type: "string",
        description: "Note name to find outgoing links for",
      },
      path: {
        type: "string",
        description: "Exact path from vault root",
      },
    }),
  },

  // ── Properties (extended) ─────────────────────────────────────────────

  {
    name: "list_properties",
    description:
      "List all frontmatter properties used across the vault, or on a specific note. " +
      "Returns property names with occurrence counts.",
    inputSchema: objectSchema({
      file: {
        type: "string",
        description: "Note name to list properties for (omit for vault-wide)",
      },
      path: {
        type: "string",
        description: "Exact path from vault root",
      },
      sort: {
        type: "string",
        enum: ["name", "count"],
        description: "Sort order (default: name)",
      },
    }),
  },

  {
    name: "remove_property",
    description: "Remove a frontmatter property from a note.",
    inputSchema: objectSchema(
      {
        name: {
          type: "string",
          description: "Property name to remove",
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

  // ── Tags (extended) ───────────────────────────────────────────────────

  {
    name: "get_tag_info",
    description:
      "Get detailed information about a specific tag, including occurrence count " +
      "and the list of files that use it.",
    inputSchema: objectSchema(
      {
        tag: {
          type: "string",
          description: "Tag name (with or without # prefix)",
        },
        verbose: {
          type: "boolean",
          description: "Include the list of files using this tag",
        },
      },
      ["tag"],
    ),
  },

  // ── File Management ───────────────────────────────────────────────────

  {
    name: "move_file",
    description:
      "Move or rename a file in the vault. Obsidian will automatically update " +
      "all internal links to the moved file.",
    inputSchema: objectSchema(
      {
        from: {
          type: "string",
          description: "Current file path from vault root",
        },
        to: {
          type: "string",
          description: "New file path from vault root",
        },
      },
      ["from", "to"],
    ),
  },

  // ── Bases ─────────────────────────────────────────────────────────────

  {
    name: "query_base",
    description:
      "Query an Obsidian Base and return structured results. Bases provide " +
      "database-like views of notes filtered by tags, properties, and folders.",
    inputSchema: objectSchema(
      {
        base: {
          type: "string",
          description: "Base file name or path (e.g. 'ADRs' or 'Bases/ADRs.base')",
        },
        view: {
          type: "string",
          description: "View name within the base (uses first view if omitted)",
        },
        format: {
          type: "string",
          enum: ["json", "csv", "tsv", "md", "paths"],
          description: "Output format (default: json)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
        },
      },
      ["base"],
    ),
  },

  // ── Project Management ────────────────────────────────────────────────

  {
    name: "backlog_add",
    description:
      "Add an item to a project's backlog. The backlog is stored at " +
      "'Projects/<project>/backlog.md'. Creates the file if it does not exist. " +
      "Items are appended as task checkboxes. Use the priority parameter to tag " +
      "an item with @high, @medium, or @low.",
    inputSchema: objectSchema(
      {
        project: {
          type: "string",
          description: "Project name (used as folder name under Projects/)",
        },
        item: {
          type: "string",
          description: "Backlog item description",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Priority tag appended as @high, @medium, or @low",
        },
      },
      ["project", "item"],
    ),
  },

  {
    name: "backlog_read",
    description:
      "Read a project's backlog. Returns the contents of " +
      "'Projects/<project>/backlog.md'.",
    inputSchema: objectSchema(
      {
        project: {
          type: "string",
          description: "Project name (used as folder name under Projects/)",
        },
      },
      ["project"],
    ),
  },

  {
    name: "backlog_done",
    description:
      "Mark a backlog item as done. Finds the first unchecked item whose text " +
      "contains the given substring and checks it off with a @done timestamp. " +
      "The item is changed from '- [ ] item' to '- [x] item @done (YY-MM-DD HH:mm)'.",
    inputSchema: objectSchema(
      {
        project: {
          type: "string",
          description: "Project name (used as folder name under Projects/)",
        },
        item: {
          type: "string",
          description:
            "Substring to match against unchecked backlog items. " +
            "The first matching '- [ ]' line is marked as done.",
        },
      },
      ["project", "item"],
    ),
  },

  {
    name: "project_list",
    description:
      "List all projects in the vault. Returns the folder names under Projects/.",
    inputSchema: objectSchema({}),
  },

  {
    name: "project_overview",
    description:
      "Read a project's overview. Returns the contents of " +
      "'Projects/<project>/overview.md', which contains project metadata " +
      "such as description, repo URL, status, and tech stack.",
    inputSchema: objectSchema(
      {
        project: {
          type: "string",
          description: "Project name (used as folder name under Projects/)",
        },
      },
      ["project"],
    ),
  },

  {
    name: "project_create",
    description:
      "Create a new project. Sets up 'Projects/<project>/overview.md' with " +
      "metadata frontmatter and 'Projects/<project>/backlog.md' with a heading. " +
      "Use this when starting work on a project for the first time.",
    inputSchema: objectSchema(
      {
        project: {
          type: "string",
          description: "Project name (becomes the folder name under Projects/)",
        },
        description: {
          type: "string",
          description: "One-line project description",
        },
        repo: {
          type: "string",
          description: "Repository URL (e.g. https://github.com/user/repo)",
        },
        tech: {
          type: "string",
          description: "Comma-separated tech stack (e.g. 'TypeScript, React, Vitest')",
        },
      },
      ["project", "description"],
    ),
  },
];
