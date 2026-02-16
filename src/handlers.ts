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
export type ToolInput = Record<string, string | number | boolean | string[] | undefined>;

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

    // ── Project Management ─────────────────────────────────────────────

    case "backlog_add": {
      const project = input.project as string;
      const item = input.item as string;
      const priority = input.priority as string | undefined;
      const backlogPath = `Projects/${project}/backlog.md`;

      // Check if backlog exists and read current content
      let existingContent = "";
      try {
        existingContent = await runObsidian(buildArgs("read", { path: backlogPath }));
      } catch {
        // File doesn't exist, create it with a heading
        await runObsidian(
          buildArgs("create", {
            name: backlogPath.replace(/\.md$/, ""),
            content: `# Backlog\n\n`,
            silent: true,
          }),
        );
      }

      // Check for duplicates (case-insensitive, ignoring priority tags)
      const normalizedItem = item.toLowerCase().trim();
      const existingLines = existingContent.split("\n");
      for (const line of existingLines) {
        if (line.startsWith("- [ ] ")) {
          // Extract item text without priority tag for comparison
          const existingText = line
            .slice(6)
            .replace(/@(high|medium|low)\s*$/i, "")
            .trim()
            .toLowerCase();
          if (existingText === normalizedItem) {
            return `Skipped: duplicate item already exists in backlog`;
          }
        }
      }

      const taskLine = priority ? `- [ ] ${item} @${priority}` : `- [ ] ${item}`;
      await runObsidian(
        buildArgs("append", {
          path: backlogPath,
          content: taskLine,
          silent: true,
        }),
      );
      return `Added to backlog: ${item}`;
    }

    case "backlog_read":
      return runObsidian(
        buildArgs("read", {
          path: `Projects/${input.project as string}/backlog.md`,
        }),
      );

    case "backlog_done": {
      const project = input.project as string;
      const item = input.item as string;
      const backlogPath = `Projects/${project}/backlog.md`;

      // Read current backlog content
      const content = await runObsidian(buildArgs("read", { path: backlogPath }));

      // Find the first unchecked line containing the item substring
      const lines = content.split("\n");
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("- [ ] ") && lines[i].includes(item)) {
          const now = new Date();
          const yy = String(now.getFullYear()).slice(2);
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const dd = String(now.getDate()).padStart(2, "0");
          const hh = String(now.getHours()).padStart(2, "0");
          const min = String(now.getMinutes()).padStart(2, "0");
          const stamp = `${yy}-${mm}-${dd} ${hh}:${min}`;
          lines[i] = lines[i].replace("- [ ] ", "- [x] ") + ` @done (${stamp})`;
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error(
          `No unchecked backlog item matching "${item}" in ${backlogPath}`,
        );
      }

      // Write back using create with overwrite
      await runObsidian(
        buildArgs("create", {
          name: backlogPath.replace(/\.md$/, ""),
          content: lines.join("\n"),
          overwrite: true,
          silent: true,
        }),
      );
      return `Marked done: ${item}`;
    }

    case "project_list": {
      const listing = await runObsidian(
        buildArgs("files", { folder: "Projects", ext: "md" }),
      );
      // Extract unique project folder names from "Projects/<name>/..."
      const projects = [
        ...new Set(
          listing
            .split("\n")
            .map((line) => line.replace(/^Projects\//, "").split("/")[0])
            .filter(Boolean),
        ),
      ];
      return projects.join("\n");
    }

    case "project_overview":
      return runObsidian(
        buildArgs("read", {
          path: `Projects/${input.project as string}/overview.md`,
        }),
      );

    case "project_create": {
      const project = input.project as string;
      const description = input.description as string;
      const repo = input.repo as string | undefined;
      const tech = input.tech as string | undefined;

      // Build overview frontmatter
      const fmLines = [
        "---",
        `project: ${project}`,
        "status: active",
      ];
      if (repo) fmLines.push(`repo: ${repo}`);
      if (tech) {
        fmLines.push("tech:");
        for (const t of tech.split(",").map((s) => s.trim()).filter(Boolean)) {
          fmLines.push(`  - ${t}`);
        }
      }
      fmLines.push("tags:", "  - project-overview", "---");
      const overviewContent = `${fmLines.join("\n")}\n\n# ${project}\n\n${description}\n`;

      // Create overview and backlog
      await runObsidian(
        buildArgs("create", {
          name: `Projects/${project}/overview`,
          content: overviewContent,
          silent: true,
        }),
      );
      await runObsidian(
        buildArgs("create", {
          name: `Projects/${project}/backlog`,
          content: `# Backlog -- ${project}\n`,
          silent: true,
        }),
      );
      return `Created project: ${project}`;
    }

    // ── Project Context & Summaries ─────────────────────────────────────

    case "project_context": {
      const project = input.project as string;
      const sessionCount = (input.sessions as number | undefined) ?? 3;
      const sections: string[] = [];

      // 1. Project overview
      const overview = await runObsidian(
        buildArgs("read", { path: `Projects/${project}/overview.md` }),
      );
      sections.push("## Overview\n\n" + overview);

      // 2. Open backlog items
      const backlog = await runObsidian(
        buildArgs("read", { path: `Projects/${project}/backlog.md` }),
      );
      const openItems = backlog
        .split("\n")
        .filter((line) => line.startsWith("- [ ] "));
      sections.push(
        "## Open Backlog Items (" + openItems.length + ")\n\n" +
        (openItems.length > 0 ? openItems.join("\n") : "(none)"),
      );

      // 3. Recent session notes
      const listing = await runObsidian(
        buildArgs("files", { folder: `Projects/${project}`, ext: "md" }),
      );
      const sessionFiles = listing
        .split("\n")
        .filter((f) =>
          f.match(/Projects\/[^/]+\/\d{4}-\d{2}-\d{2}/) !== null,
        )
        .sort()
        .reverse()
        .slice(0, sessionCount);

      if (sessionFiles.length > 0) {
        const sessionSections: string[] = [];
        for (const file of sessionFiles) {
          const content = await runObsidian(
            buildArgs("read", { path: file }),
          );
          sessionSections.push("### " + file.split("/").pop() + "\n\n" + content);
        }
        sections.push(
          "## Recent Sessions (" + sessionFiles.length + ")\n\n" +
          sessionSections.join("\n\n---\n\n"),
        );
      } else {
        sections.push("## Recent Sessions\n\n(no session notes found)");
      }

      return sections.join("\n\n---\n\n");
    }

    case "project_summary": {
      const project = input.project as string;
      const days = (input.days as number | undefined) ?? 7;

      // Calculate the cutoff date
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

      // List session files for the project
      const listing = await runObsidian(
        buildArgs("files", { folder: `Projects/${project}`, ext: "md" }),
      );
      const sessionFiles = listing
        .split("\n")
        .filter((f) => {
          const match = f.match(/(\d{4}-\d{2}-\d{2})/);
          return match !== null && match[1] >= cutoffStr;
        })
        .sort();

      if (sessionFiles.length === 0) {
        return `No session notes found for ${project} in the last ${days} days.`;
      }

      // Read each session and collect content
      const sessions: string[] = [];
      for (const file of sessionFiles) {
        const content = await runObsidian(
          buildArgs("read", { path: file }),
        );
        const filename = file.split("/").pop() ?? file;
        sessions.push("### " + filename.replace(/\.md$/, "") + "\n\n" + content);
      }

      // Read open backlog for context
      const backlog = await runObsidian(
        buildArgs("read", { path: `Projects/${project}/backlog.md` }),
      );
      const openItems = backlog
        .split("\n")
        .filter((line) => line.startsWith("- [ ] "));
      const doneItems = backlog
        .split("\n")
        .filter((line) => line.startsWith("- [x] "));

      const summary = [
        `# Project Summary: ${project}`,
        `Period: ${cutoffStr} to ${new Date().toISOString().slice(0, 10)}`,
        `Sessions: ${sessionFiles.length}`,
        `Open backlog items: ${openItems.length}`,
        `Completed backlog items: ${doneItems.length}`,
        "",
        "## Session Activity",
        "",
        sessions.join("\n\n---\n\n"),
        "",
        "## Open Backlog",
        "",
        openItems.length > 0 ? openItems.join("\n") : "(none)",
      ];

      return summary.join("\n");
    }

    case "project_dashboard": {
      const format = (input.format as string | undefined) ?? "md";

      // List all projects
      const listing = await runObsidian(
        buildArgs("files", { folder: "Projects", ext: "md" }),
      );
      const allFiles = listing.split("\n").filter(Boolean);
      const projectNames = [
        ...new Set(
          allFiles
            .map((line) => line.replace(/^Projects\//, "").split("/")[0])
            .filter(Boolean),
        ),
      ];

      interface ProjectInfo {
        name: string;
        status: string;
        lastActivity: string;
        openBacklog: number;
        sessionCount: number;
      }

      const projects: ProjectInfo[] = [];

      for (const name of projectNames) {
        const projectFiles = allFiles.filter((f) =>
          f.startsWith(`Projects/${name}/`),
        );

        // Count sessions (files matching date pattern)
        const sessionFiles = projectFiles.filter(
          (f) => f.match(/\d{4}-\d{2}-\d{2}/) !== null,
        );

        // Find the most recent session date
        const dates = sessionFiles
          .map((f) => {
            const m = f.match(/(\d{4}-\d{2}-\d{2})/);
            return m ? m[1] : "";
          })
          .filter(Boolean)
          .sort()
          .reverse();
        const lastActivity = dates[0] ?? "none";

        // Count open backlog items
        let openBacklog = 0;
        let status = "unknown";
        try {
          const backlog = await runObsidian(
            buildArgs("read", {
              path: `Projects/${name}/backlog.md`,
            }),
          );
          openBacklog = backlog
            .split("\n")
            .filter((line) => line.startsWith("- [ ] ")).length;
        } catch {
          // backlog may not exist
        }

        // Read project status from overview
        try {
          const overviewRaw = await runObsidian(
            buildArgs("read", {
              path: `Projects/${name}/overview.md`,
            }),
          );
          const statusMatch = overviewRaw.match(/^status:\s*(.+)$/m);
          if (statusMatch) status = statusMatch[1].trim();
        } catch {
          // overview may not exist
        }

        projects.push({
          name,
          status,
          lastActivity,
          openBacklog,
          sessionCount: sessionFiles.length,
        });
      }

      // Sort by last activity (most recent first)
      projects.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

      if (format === "json") {
        return JSON.stringify(projects, null, 2);
      }

      // Markdown table
      const lines = [
        "# Project Dashboard",
        "",
        "| Project | Status | Last Activity | Open Backlog | Sessions |",
        "|---------|--------|---------------|--------------|----------|",
      ];
      for (const p of projects) {
        lines.push(
          `| ${p.name} | ${p.status} | ${p.lastActivity} | ${p.openBacklog} | ${p.sessionCount} |`,
        );
      }
      return lines.join("\n");
    }

    case "backlog_prioritise": {
      const project = input.project as string;
      const item = input.item as string;
      const position = input.position as number;
      const backlogPath = `Projects/${project}/backlog.md`;

      // Read current backlog to get unchecked items
      const content = await runObsidian(buildArgs("read", { path: backlogPath }));

      // Extract unchecked task content (without checkbox prefix)
      const unchecked: string[] = [];
      for (const line of content.split("\n")) {
        if (line.startsWith("- [ ] ")) {
          unchecked.push(line.slice(6));
        }
      }

      // Find the item matching the substring
      const matchIdx = unchecked.findIndex((task) => task.includes(item));
      if (matchIdx === -1) {
        throw new Error(
          `No unchecked backlog item matching "${item}" in ${backlogPath}`,
        );
      }

      // Remove the matched item temporarily
      const matched = unchecked.splice(matchIdx, 1)[0];

      // Calculate target position (1-based, clamped)
      const targetPos = Math.min(Math.max(1, position), unchecked.length + 1);

      // Build items array: items before target, matched item, items after target
      const items = [
        ...unchecked.slice(0, targetPos - 1),
        matched,
        ...unchecked.slice(targetPos - 1),
      ];

      // Delegate to backlog_reorder
      await handleTool("backlog_reorder", { project, items });
      return `Moved "${item}" to position ${targetPos}`;
    }

    case "backlog_reorder": {
      const project = input.project as string;
      const items = input.items as unknown as string[];
      const backlogPath = `Projects/${project}/backlog.md`;

      // Read current backlog
      const content = await runObsidian(buildArgs("read", { path: backlogPath }));
      const lines = content.split("\n");

      // Separate heading/non-task lines from task lines
      const headingLines: string[] = [];
      const taskLines: string[] = [];
      let pastHeading = false;
      for (const line of lines) {
        if (line.startsWith("- [")) {
          pastHeading = true;
          taskLines.push(line);
        } else if (!pastHeading) {
          headingLines.push(line);
        } else {
          taskLines.push(line);
        }
      }

      // Separate unchecked and checked tasks
      const unchecked = taskLines.filter((l) => l.startsWith("- [ ] "));
      const checked = taskLines.filter((l) => l.startsWith("- [x] ") || l.startsWith("- [X] "));

      // Match each item substring to an unchecked task
      const matched: string[] = [];
      const remaining = [...unchecked];
      const notFound: string[] = [];

      for (const substr of items) {
        const idx = remaining.findIndex((t) => t.includes(substr));
        if (idx !== -1) {
          matched.push(remaining.splice(idx, 1)[0]);
        } else {
          notFound.push(substr);
        }
      }

      // Reorder: matched items first, then remaining unchecked, then checked
      const reordered = [...matched, ...remaining, ...checked];
      const newContent = [...headingLines, ...reordered].join("\n");

      await runObsidian(
        buildArgs("create", {
          name: backlogPath.replace(/\.md$/, ""),
          content: newContent,
          overwrite: true,
          silent: true,
        }),
      );

      const movedCount = matched.length;
      let result = `Reordered ${movedCount} item${movedCount !== 1 ? "s" : ""} to top of backlog`;
      if (notFound.length > 0) {
        result += ` (not found: ${notFound.join(", ")})`;
      }
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
