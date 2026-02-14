/**
 * @module handlers
 *
 * Maps MCP tool names to Obsidian CLI commands.
 *
 * Each case in the {@link handleTool} switch builds the appropriate CLI
 * argument array via {@link buildArgs} and executes it with
 * {@link runObsidian}. This module is intentionally separated from the
 * server entry-point so it can be imported and tested in isolation.
 */

import { runObsidian, buildArgs } from "./cli.js";
import { validateInput } from "./validation.js";

/** Loosely-typed input object received from MCP tool calls. */
export type ToolInput = Record<string, string | number | boolean | undefined>;

/**
 * Route an MCP tool call to the appropriate Obsidian CLI command.
 * Validates input against the tool schema before execution.
 * Returns the CLI stdout as a string.
 */
export async function handleTool(name: string, input: ToolInput): Promise<string> {
  validateInput(name, input);

  switch (name) {
    // ── Core: Session Journaling ──────────────────────────────────────

    case "create_note":
      return runObsidian(
        buildArgs("create", {
          name: input.name as string,
          content: input.content as string | undefined,
          template: input.template as string | undefined,
          overwrite: input.overwrite as boolean | undefined,
          silent: true,
        }),
      );

    case "read_note":
      return runObsidian(
        buildArgs("read", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
        }),
      );

    case "append_to_note":
      return runObsidian(
        buildArgs("append", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
          content: input.content as string,
          silent: true,
        }),
      );

    case "prepend_to_note":
      return runObsidian(
        buildArgs("prepend", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
          content: input.content as string,
          silent: true,
        }),
      );

    case "search_vault":
      return runObsidian(
        buildArgs("search", {
          query: input.query as string,
          path: input.path as string | undefined,
          limit: input.limit as number | undefined,
          format: (input.format as string | undefined) ?? "json",
        }),
      );

    case "daily_note":
      return runObsidian(buildArgs("daily", { silent: true }));

    case "daily_append":
      return runObsidian(
        buildArgs("daily:append", {
          content: input.content as string,
          silent: true,
        }),
      );

    // ── Discovery & Context ───────────────────────────────────────────

    case "get_vault_info":
      return runObsidian(
        buildArgs("vault", {
          info: input.info as string | undefined,
        }),
      );

    case "list_files":
      return runObsidian(
        buildArgs("files", {
          folder: input.folder as string | undefined,
          ext: input.ext as string | undefined,
          total: input.total as boolean | undefined,
        }),
      );

    case "get_tags":
      // The CLI requires `all` and `counts` flags to return a useful listing;
      // these are always set rather than exposed as user-facing options.
      return runObsidian(
        buildArgs("tags", {
          sort: input.sort as string | undefined,
          all: true,
          counts: true,
        }),
      );

    case "get_backlinks":
      return runObsidian(
        buildArgs("backlinks", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
        }),
      );

    case "get_outline":
      return runObsidian(
        buildArgs("outline", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
          format: input.format as string | undefined,
        }),
      );

    // ── Properties / Metadata ─────────────────────────────────────────

    case "set_property":
      return runObsidian(
        buildArgs("property:set", {
          name: input.name as string,
          value: input.value as string,
          type: input.type as string | undefined,
          file: input.file as string | undefined,
          path: input.path as string | undefined,
        }),
      );

    case "read_property":
      return runObsidian(
        buildArgs("property:read", {
          name: input.name as string,
          file: input.file as string | undefined,
          path: input.path as string | undefined,
        }),
      );

    // ── Tasks ─────────────────────────────────────────────────────────

    case "list_tasks":
      return runObsidian(
        buildArgs("tasks", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
          all: input.all as boolean | undefined,
          daily: input.daily as boolean | undefined,
          done: input.done as boolean | undefined,
          todo: input.todo as boolean | undefined,
          verbose: input.verbose as boolean | undefined,
        }),
      );

    case "toggle_task":
      return runObsidian(
        buildArgs("task", {
          ref: input.ref as string | undefined,
          file: input.file as string | undefined,
          line: input.line as number | undefined,
          toggle: true,
        }),
      );

    // ── Daily Notes (extended) ────────────────────────────────────────

    case "daily_read":
      return runObsidian(buildArgs("daily:read", {}));

    case "daily_prepend":
      return runObsidian(
        buildArgs("daily:prepend", {
          content: input.content as string,
          silent: true,
        }),
      );

    // ── Templates ─────────────────────────────────────────────────────

    case "list_templates":
      return runObsidian(
        buildArgs("templates", {
          total: input.total as boolean | undefined,
        }),
      );

    case "read_template":
      return runObsidian(
        buildArgs("template:read", {
          name: input.name as string,
          resolve: input.resolve as boolean | undefined,
        }),
      );

    // ── Links ─────────────────────────────────────────────────────────

    case "get_links":
      return runObsidian(
        buildArgs("links", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
        }),
      );

    // ── Properties (extended) ─────────────────────────────────────────

    case "list_properties":
      return runObsidian(
        buildArgs("properties", {
          file: input.file as string | undefined,
          path: input.path as string | undefined,
          sort: input.sort as string | undefined,
          counts: true,
        }),
      );

    case "remove_property":
      return runObsidian(
        buildArgs("property:remove", {
          name: input.name as string,
          file: input.file as string | undefined,
          path: input.path as string | undefined,
        }),
      );

    // ── Tags (extended) ───────────────────────────────────────────────

    case "get_tag_info":
      return runObsidian(
        buildArgs("tag", {
          tag: input.tag as string,
          verbose: input.verbose as boolean | undefined,
        }),
      );

    // ── File Management ───────────────────────────────────────────────

    case "move_file":
      return runObsidian(
        buildArgs("move", {
          from: input.from as string,
          to: input.to as string,
          silent: true,
        }),
      );

    // ── Bases ─────────────────────────────────────────────────────────

    case "query_base":
      return runObsidian(
        buildArgs("base:query", {
          base: input.base as string,
          view: input.view as string | undefined,
          format: (input.format as string | undefined) ?? "json",
          limit: input.limit as number | undefined,
        }),
      );

    // ── Project Backlog ───────────────────────────────────────────────

    case "backlog_add": {
      const project = input.project as string;
      const item = input.item as string;
      const priority = input.priority as string | undefined;
      const line = priority ? `- [ ] ${item} @${priority}` : `- [ ] ${item}`;
      return runObsidian(
        buildArgs("append", {
          path: `Projects/${project}/backlog.md`,
          content: line,
          silent: true,
        }),
      );
    }

    case "backlog_read":
      return runObsidian(
        buildArgs("read", {
          path: `Projects/${input.project as string}/backlog.md`,
        }),
      );

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
