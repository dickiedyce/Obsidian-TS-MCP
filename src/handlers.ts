/**
 * @module handlers
 *
 * Maps MCP tool names to direct filesystem operations on the Obsidian vault.
 *
 * All tool calls are dispatched through {@link handleTool}. This module is
 * intentionally separated from the server entry-point so it can be imported
 * and tested in isolation.
 */

import { basename } from "node:path";
import { stat } from "node:fs/promises";
import { validateInput } from "./validation.js";
import {
  writeVaultFile,
  readVaultFile,
  vaultFileExists,
  getVaultPath,
  moveVaultFile,
  listVaultFiles,
  findFileByName,
  getDailyNotePath,
  getDailyNoteConfig,
  getTemplatesFolder,
  formatMomentDate,
  parseFrontmatter,
  stringifyFrontmatter,
  coercePropertyValue,
  extractTags,
  extractWikiLinks,
  extractHeadings,
  extractTasks,
} from "./fs-ops.js";

/** Loosely-typed input object received from MCP tool calls. */
export type ToolInput = Record<string, string | number | boolean | string[] | undefined>;

// ── Private helpers ───────────────────────────────────────────────────────

/**
 * Resolve a `file` / `path` pair from tool input to a vault-relative path.
 * - `path` is used verbatim (`.md` appended if missing).
 * - `file` with directory separators is treated as a path.
 * - A bare `file` name is resolved via fuzzy vault search.
 */
async function resolveNotePath(input: ToolInput): Promise<string> {
  const path = input.path as string | undefined;
  const file = input.file as string | undefined;

  if (path) {
    return path.endsWith(".md") ? path : `${path}.md`;
  }

  if (file) {
    if (file.includes("/")) {
      return file.endsWith(".md") ? file : `${file}.md`;
    }
    const found = await findFileByName(file);
    return found ?? (file.endsWith(".md") ? file : `${file}.md`);
  }

  throw new Error("No file or path provided");
}

/**
 * Read a template file from the configured templates folder.
 * When `resolve` is true, replaces `{{date}}`, `{{time}}`, and `{{title}}`
 * template variables.
 */
async function readTemplate(name: string, resolve: boolean): Promise<string> {
  const folder = await getTemplatesFolder();
  let templatePath: string;
  if (name.includes("/")) {
    templatePath = name.endsWith(".md") ? name : `${name}.md`;
  } else {
    templatePath = `${folder}/${name}.md`;
  }

  const content = await readVaultFile(templatePath);
  if (!resolve) return content;

  const now = new Date();
  const config = await getDailyNoteConfig();
  const dateStr = formatMomentDate(config.format, now);
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  return content
    .replace(/\{\{date\}\}/gi, dateStr)
    .replace(/\{\{time\}\}/gi, `${hh}:${min}`)
    .replace(/\{\{title\}\}/gi, name);
}

// ── Main dispatcher ───────────────────────────────────────────────────────

/**
 * Route an MCP tool call to the appropriate filesystem operation.
 * Validates input against the tool schema before execution.
 */
export async function handleTool(name: string, input: ToolInput): Promise<string> {
  validateInput(name, input);

  switch (name) {
    // ── Core: Note Management ─────────────────────────────────────────

    case "create_note": {
      const noteName = input.name as string;
      const notePath = input.path as string | undefined;
      const content = input.content as string | undefined;
      const template = input.template as string | undefined;
      const overwrite = input.overwrite as boolean | undefined;

      const targetPath = notePath
        ? (notePath.endsWith(".md") ? notePath : `${notePath}.md`)
        : noteName.includes("/")
          ? `${noteName}.md`
          : undefined;

      let noteContent = content ?? "";
      if (template) {
        const tplContent = await readTemplate(template, false);
        noteContent = content ? `${tplContent}\n${content}` : tplContent;
      }

      if (targetPath) {
        await writeVaultFile(targetPath, noteContent, { overwrite });
        return `Created: ${targetPath}`;
      }

      const rootPath = `${noteName}.md`;
      await writeVaultFile(rootPath, noteContent, { overwrite });
      return `Created: ${rootPath}`;
    }

    case "read_note": {
      const filePath = await resolveNotePath(input);
      return readVaultFile(filePath);
    }

    case "append_to_note": {
      const filePath = await resolveNotePath(input);
      const content = input.content as string;
      const existing = await readVaultFile(filePath);
      const sep = existing.endsWith("\n") ? "" : "\n";
      await writeVaultFile(filePath, existing + sep + content, { overwrite: true });
      return `Appended to: ${filePath}`;
    }

    case "prepend_to_note": {
      const filePath = await resolveNotePath(input);
      const content = input.content as string;
      const existing = await readVaultFile(filePath);
      const { data, body, hasFrontmatter } = parseFrontmatter(existing);

      let newContent: string;
      if (hasFrontmatter) {
        const fmStr = stringifyFrontmatter(data, "");
        // fmStr ends with "---\n", body is the rest
        newContent = fmStr + content + "\n" + body;
      } else {
        newContent = content + "\n" + existing;
      }

      await writeVaultFile(filePath, newContent, { overwrite: true });
      return `Prepended to: ${filePath}`;
    }

    case "search_vault": {
      const query = input.query as string;
      const pathFilter = input.path as string | undefined;
      const limit = input.limit as number | undefined;
      const format = (input.format as string | undefined) ?? "json";

      const isTagQuery = query.startsWith("#");
      const searchTerm = isTagQuery
        ? query.slice(1).toLowerCase()
        : query.toLowerCase();

      const files = await listVaultFiles({ folder: pathFilter, ext: "md" });

      interface SearchResult {
        path: string;
        matches: Array<{ line: number; text: string }>;
      }
      const results: SearchResult[] = [];

      for (const fp of files) {
        let content: string;
        try {
          content = await readVaultFile(fp);
        } catch {
          continue;
        }

        let matches: Array<{ line: number; text: string }> = [];

        if (isTagQuery) {
          const { data, body } = parseFrontmatter(content);
          const tags = extractTags(body, data);
          if (tags.some((t) => t.includes(searchTerm))) {
            matches = [{ line: 0, text: fp }];
          }
        } else {
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(searchTerm)) {
              matches.push({ line: i + 1, text: lines[i].trim() });
            }
          }
        }

        if (matches.length > 0) {
          results.push({ path: fp, matches });
          if (limit && results.length >= limit) break;
        }
      }

      if (format === "json") return JSON.stringify(results, null, 2);
      return results
        .map(
          (r) =>
            `${r.path}:\n${r.matches
              .map((m) => `  ${m.line ? `${m.line}: ` : ""}${m.text}`)
              .join("\n")}`,
        )
        .join("\n\n");
    }

    case "daily_note": {
      const notePath = await getDailyNotePath();
      if (!(await vaultFileExists(notePath))) {
        const config = await getDailyNoteConfig();
        let initContent = "";
        if (config.template) {
          try {
            initContent = await readTemplate(config.template, true);
          } catch {
            // template not found -- create empty note
          }
        }
        await writeVaultFile(notePath, initContent);
      }
      return notePath;
    }

    case "daily_append": {
      const notePath = await getDailyNotePath();
      const content = input.content as string;
      let existing = "";
      try {
        existing = await readVaultFile(notePath);
      } catch {
        /* new file */
      }
      const sep = existing.endsWith("\n") ? "" : existing ? "\n" : "";
      if (existing) {
        await writeVaultFile(notePath, existing + sep + content, {
          overwrite: true,
        });
      } else {
        await writeVaultFile(notePath, content);
      }
      return `Appended to daily note: ${notePath}`;
    }

    // ── Discovery & Context ───────────────────────────────────────────

    case "get_vault_info": {
      const info = input.info as string | undefined;
      const vaultRoot = await getVaultPath();

      if (info === "path") return vaultRoot;
      if (info === "name") return basename(vaultRoot);

      const allFiles = await listVaultFiles();

      if (info === "files") return String(allFiles.length);

      if (info === "folders") {
        const folders = new Set(
          allFiles
            .filter((f) => f.includes("/"))
            .map((f) => f.split("/").slice(0, -1).join("/")),
        );
        return String(folders.size);
      }

      if (info === "size") {
        let totalBytes = 0;
        for (const f of allFiles) {
          try {
            const fullPath = `${vaultRoot}/${f}`;
            const st = await stat(fullPath);
            totalBytes += st.size;
          } catch {
            /* skip unreadable */
          }
        }
        return `${(totalBytes / 1024).toFixed(1)} KB`;
      }

      const folders = new Set(
        allFiles
          .filter((f) => f.includes("/"))
          .map((f) => f.split("/").slice(0, -1).join("/")),
      );
      return [
        `name: ${basename(vaultRoot)}`,
        `path: ${vaultRoot}`,
        `files: ${allFiles.length}`,
        `folders: ${folders.size}`,
      ].join("\n");
    }

    case "list_files": {
      const folder = input.folder as string | undefined;
      const ext = input.ext as string | undefined;
      const total = input.total as boolean | undefined;
      const files = await listVaultFiles({ folder, ext });
      if (total) return String(files.length);
      return files.join("\n");
    }

    case "get_tags": {
      const sort = input.sort as string | undefined;
      const files = await listVaultFiles({ ext: "md" });
      const counts = new Map<string, number>();

      for (const fp of files) {
        let content: string;
        try {
          content = await readVaultFile(fp);
        } catch {
          continue;
        }
        const { data, body } = parseFrontmatter(content);
        for (const tag of extractTags(body, data)) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }

      let entries = [...counts.entries()];
      if (sort === "count") {
        entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      } else {
        entries.sort((a, b) => a[0].localeCompare(b[0]));
      }
      return entries.map(([tag, count]) => `#${tag} (${count})`).join("\n");
    }

    case "get_backlinks": {
      const filePath = await resolveNotePath(input);
      const targetName = basename(filePath, ".md").toLowerCase();
      const targetLower = filePath.toLowerCase();

      const files = await listVaultFiles({ ext: "md" });
      const backlinks: string[] = [];

      for (const fp of files) {
        if (fp.toLowerCase() === targetLower) continue;
        let content: string;
        try {
          content = await readVaultFile(fp);
        } catch {
          continue;
        }
        const { body } = parseFrontmatter(content);
        const linked = extractWikiLinks(body).some((l) => {
          const lLower = l.replace(/\.md$/i, "").toLowerCase();
          return (
            lLower === targetLower.replace(/\.md$/i, "") ||
            lLower.split("/").pop() === targetName
          );
        });
        if (linked) backlinks.push(fp);
      }

      if (backlinks.length === 0) return `No backlinks found for ${filePath}`;
      return `Backlinks to ${filePath}:\n${backlinks.map((b) => `- ${b}`).join("\n")}`;
    }

    case "get_outline": {
      const filePath = await resolveNotePath(input);
      const format = (input.format as string | undefined) ?? "tree";
      const content = await readVaultFile(filePath);
      const { body } = parseFrontmatter(content);
      const headings = extractHeadings(body);

      if (headings.length === 0) return "No headings found";

      if (format === "md") {
        return headings.map((h) => `${"#".repeat(h.level)} ${h.text}`).join("\n");
      }
      return headings
        .map((h) => `${"  ".repeat(h.level - 1)}- ${h.text}`)
        .join("\n");
    }

    // ── Properties / Metadata ─────────────────────────────────────────

    case "set_property": {
      const propName = input.name as string;
      const propValue = input.value as string;
      const propType = input.type as string | undefined;
      const filePath = await resolveNotePath(input);
      const rawContent = await readVaultFile(filePath);
      const { data, body } = parseFrontmatter(rawContent);
      data[propName] = coercePropertyValue(propValue, propType);
      await writeVaultFile(filePath, stringifyFrontmatter(data, body), {
        overwrite: true,
      });
      return `Set ${propName} in ${filePath}`;
    }

    case "read_property": {
      const propName = input.name as string;
      const filePath = await resolveNotePath(input);
      const rawContent = await readVaultFile(filePath);
      const { data } = parseFrontmatter(rawContent);
      const value = data[propName];
      if (value === undefined) {
        return `Property "${propName}" not found in ${filePath}`;
      }
      if (Array.isArray(value)) return value.join(", ");
      return String(value);
    }

    // ── Tasks ─────────────────────────────────────────────────────────

    case "list_tasks": {
      const file = input.file as string | undefined;
      const pathParam = input.path as string | undefined;
      const all = input.all as boolean | undefined;
      const daily = input.daily as boolean | undefined;
      const done = input.done as boolean | undefined;
      const todo = input.todo as boolean | undefined;
      const verbose = input.verbose as boolean | undefined;

      let filePaths: string[];
      if (daily) {
        filePaths = [await getDailyNotePath()];
      } else if (file) {
        const resolved = file.includes("/")
          ? (file.endsWith(".md") ? file : `${file}.md`)
          : ((await findFileByName(file)) ?? `${file}.md`);
        filePaths = [resolved];
      } else if (pathParam) {
        filePaths = [pathParam.endsWith(".md") ? pathParam : `${pathParam}.md`];
      } else {
        filePaths = await listVaultFiles({ ext: "md" });
        if (!all) {
          // Default: only show tasks from the current day's note
          filePaths = [await getDailyNotePath()];
        }
      }

      interface TaskRow {
        file: string;
        line: number;
        checked: boolean;
        text: string;
      }
      const rows: TaskRow[] = [];

      for (const fp of filePaths) {
        let content: string;
        try {
          content = await readVaultFile(fp);
        } catch {
          continue;
        }
        for (const t of extractTasks(content)) {
          if (done === true && !t.checked) continue;
          if (todo === true && t.checked) continue;
          rows.push({ file: fp, ...t });
        }
      }

      if (verbose) {
        const byFile = new Map<string, TaskRow[]>();
        for (const r of rows) {
          const arr = byFile.get(r.file) ?? [];
          arr.push(r);
          byFile.set(r.file, arr);
        }
        const lines: string[] = [];
        for (const [fp, tasks] of byFile) {
          lines.push(`${fp}:`);
          for (const t of tasks) {
            lines.push(`  ${t.line}: [${t.checked ? "x" : " "}] ${t.text}`);
          }
        }
        return lines.join("\n");
      }

      return rows
        .map(
          (r) =>
            `- [${r.checked ? "x" : " "}] ${r.text} (${r.file}:${r.line})`,
        )
        .join("\n");
    }

    case "toggle_task": {
      let filePath: string;
      let lineNum: number;

      if (input.ref) {
        const ref = input.ref as string;
        const colon = ref.lastIndexOf(":");
        const refFile = ref.slice(0, colon);
        lineNum = Number(ref.slice(colon + 1));
        filePath = refFile.includes("/")
          ? (refFile.endsWith(".md") ? refFile : `${refFile}.md`)
          : ((await findFileByName(refFile)) ??
            (refFile.endsWith(".md") ? refFile : `${refFile}.md`));
      } else {
        const file = input.file as string;
        lineNum = input.line as number;
        filePath = file.includes("/")
          ? (file.endsWith(".md") ? file : `${file}.md`)
          : ((await findFileByName(file)) ??
            (file.endsWith(".md") ? file : `${file}.md`));
      }

      const content = await readVaultFile(filePath);
      const lines = content.split("\n");
      const idx = lineNum - 1;

      if (idx < 0 || idx >= lines.length) {
        throw new Error(`Line ${lineNum} is out of range in ${filePath}`);
      }

      if (/^\s*-\s+\[ \]/.test(lines[idx])) {
        lines[idx] = lines[idx].replace(/^(\s*-\s+)\[ \]/, "$1[x]");
      } else if (/^\s*-\s+\[x\]/i.test(lines[idx])) {
        lines[idx] = lines[idx].replace(/^(\s*-\s+)\[x\]/i, "$1[ ]");
      } else {
        throw new Error(
          `Line ${lineNum} in ${filePath} is not a task checkbox`,
        );
      }

      await writeVaultFile(filePath, lines.join("\n"), { overwrite: true });
      return `Toggled task at line ${lineNum} in ${filePath}`;
    }

    // ── Daily Notes (extended) ────────────────────────────────────────

    case "daily_read": {
      const notePath = await getDailyNotePath();
      if (!(await vaultFileExists(notePath))) {
        await writeVaultFile(notePath, "");
      }
      return readVaultFile(notePath);
    }

    case "daily_prepend": {
      const notePath = await getDailyNotePath();
      const content = input.content as string;
      let existing = "";
      try {
        existing = await readVaultFile(notePath);
      } catch {
        /* new file */
      }
      const { data, body, hasFrontmatter } = parseFrontmatter(existing);
      let newContent: string;
      if (hasFrontmatter) {
        const fmStr = stringifyFrontmatter(data, "");
        newContent = fmStr + content + "\n" + body;
      } else {
        newContent = content + "\n" + existing;
      }
      if (existing) {
        await writeVaultFile(notePath, newContent, { overwrite: true });
      } else {
        await writeVaultFile(notePath, newContent);
      }
      return `Prepended to daily note: ${notePath}`;
    }

    // ── Templates ─────────────────────────────────────────────────────

    case "list_templates": {
      const total = input.total as boolean | undefined;
      const folder = await getTemplatesFolder();
      const files = await listVaultFiles({ folder, ext: "md" });
      if (total) return String(files.length);
      return files.map((f) => basename(f, ".md")).join("\n");
    }

    case "read_template": {
      const tplName = input.name as string;
      const resolve = input.resolve as boolean | undefined;
      return readTemplate(tplName, resolve === true);
    }

    // ── Links ─────────────────────────────────────────────────────────

    case "get_links": {
      const filePath = await resolveNotePath(input);
      const content = await readVaultFile(filePath);
      const { body } = parseFrontmatter(content);
      const links = extractWikiLinks(body);
      if (links.length === 0) return `No outgoing links found in ${filePath}`;
      return `Links from ${filePath}:\n${links.map((l) => `- ${l}`).join("\n")}`;
    }

    // ── Properties (extended) ─────────────────────────────────────────

    case "list_properties": {
      const file = input.file as string | undefined;
      const pathParam = input.path as string | undefined;
      const sort = input.sort as string | undefined;

      if (file || pathParam) {
        const filePath = await resolveNotePath(input);
        const content = await readVaultFile(filePath);
        const { data } = parseFrontmatter(content);
        let entries = Object.entries(data).map(([k, v]) => ({
          name: k,
          value: Array.isArray(v) ? v.join(", ") : String(v ?? ""),
        }));
        if (sort === "name") entries.sort((a, b) => a.name.localeCompare(b.name));
        return entries.map((e) => `${e.name}: ${e.value}`).join("\n");
      }

      const files = await listVaultFiles({ ext: "md" });
      const counts = new Map<string, number>();
      for (const fp of files) {
        let content: string;
        try {
          content = await readVaultFile(fp);
        } catch {
          continue;
        }
        const { data } = parseFrontmatter(content);
        for (const key of Object.keys(data)) {
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      let entries = [...counts.entries()];
      if (sort === "count") {
        entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      } else {
        entries.sort((a, b) => a[0].localeCompare(b[0]));
      }
      return entries.map(([k, c]) => `${k} (${c})`).join("\n");
    }

    case "remove_property": {
      const propName = input.name as string;
      const filePath = await resolveNotePath(input);
      const rawContent = await readVaultFile(filePath);
      const { data, body } = parseFrontmatter(rawContent);
      if (!(propName in data)) {
        return `Property "${propName}" not found in ${filePath}`;
      }
      delete data[propName];
      await writeVaultFile(filePath, stringifyFrontmatter(data, body), {
        overwrite: true,
      });
      return `Removed property "${propName}" from ${filePath}`;
    }

    // ── Tags (extended) ───────────────────────────────────────────────

    case "get_tag_info": {
      const tag = (input.tag as string).replace(/^#/, "").toLowerCase();
      const verbose = input.verbose as boolean | undefined;
      const files = await listVaultFiles({ ext: "md" });
      const matching: string[] = [];

      for (const fp of files) {
        let content: string;
        try {
          content = await readVaultFile(fp);
        } catch {
          continue;
        }
        const { data, body } = parseFrontmatter(content);
        if (extractTags(body, data).includes(tag)) matching.push(fp);
      }

      const lines = [`Tag: #${tag}`, `Files: ${matching.length}`];
      if (verbose && matching.length > 0) {
        lines.push("", "Files using this tag:");
        lines.push(...matching.map((f) => `- ${f}`));
      }
      return lines.join("\n");
    }

    // ── File Management ───────────────────────────────────────────────

    case "move_file": {
      const from = input.from as string;
      const to = input.to as string;
      await moveVaultFile(from, to);
      return `Moved ${from} to ${to}`;
    }

    // ── Bases ─────────────────────────────────────────────────────────

    case "query_base": {
      const baseName = input.base as string;
      const format = (input.format as string | undefined) ?? "json";
      const limit = input.limit as number | undefined;

      // Find the base file
      let basePath: string;
      if (baseName.endsWith(".base")) {
        basePath = baseName;
      } else if (baseName.includes("/")) {
        basePath = `${baseName}.base`;
      } else {
        const found = (await listVaultFiles({ ext: "base" })).find(
          (f) => basename(f, ".base").toLowerCase() === baseName.toLowerCase(),
        );
        if (!found) throw new Error(`Base not found: ${baseName}`);
        basePath = found;
      }

      const rawBase = await readVaultFile(basePath);

      let folder = "";
      try {
        const cfg = JSON.parse(rawBase) as Record<string, unknown>;
        const src = cfg.source as Record<string, unknown> | undefined;
        folder = ((src?.folder ?? src?.path ?? "") as string) || "";
      } catch {
        // Not JSON -- return raw content
        return rawBase;
      }

      const mdFiles = await listVaultFiles({ folder: folder || undefined, ext: "md" });
      const slice = limit ? mdFiles.slice(0, limit) : mdFiles;

      const results: Array<Record<string, unknown>> = [];
      for (const fp of slice) {
        try {
          const content = await readVaultFile(fp);
          const { data } = parseFrontmatter(content);
          results.push({ path: fp, ...data });
        } catch {
          /* skip */
        }
      }

      if (format === "json") return JSON.stringify(results, null, 2);
      if (format === "csv") {
        if (results.length === 0) return "";
        const keys = [...new Set(results.flatMap((r) => Object.keys(r)))];
        const rows = results.map((r) =>
          keys.map((k) => JSON.stringify(r[k] ?? "")).join(","),
        );
        return [keys.join(","), ...rows].join("\n");
      }
      if (format === "paths") return results.map((r) => r.path as string).join("\n");
      return results
        .map((r) => `- [[${(r.path as string).replace(/\.md$/, "")}]]`)
        .join("\n");
    }

    // ── Project Management ─────────────────────────────────────────────

    case "backlog_add": {
      const project = input.project as string;
      const item = input.item as string;
      const priority = input.priority as string | undefined;
      const backlogPath = `Projects/${project}/backlog.md`;

      let existingContent = "";
      let fileExisted = true;
      try {
        existingContent = await readVaultFile(backlogPath);
      } catch {
        fileExisted = false;
      }

      const normalizedItem = item.toLowerCase().trim();
      for (const line of existingContent.split("\n")) {
        if (line.startsWith("- [ ] ")) {
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

      if (!fileExisted) {
        await writeVaultFile(backlogPath, `# Backlog\n\n${taskLine}\n`);
      } else {
        const sep = existingContent.endsWith("\n") ? "" : "\n";
        await writeVaultFile(backlogPath, existingContent + sep + taskLine + "\n", {
          overwrite: true,
        });
      }
      return `Added to backlog: ${item}`;
    }

    case "backlog_read":
      return readVaultFile(`Projects/${input.project as string}/backlog.md`);

    case "backlog_done": {
      const project = input.project as string;
      const item = input.item as string;
      const backlogPath = `Projects/${project}/backlog.md`;

      const content = await readVaultFile(backlogPath);
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

      await writeVaultFile(backlogPath, lines.join("\n"), { overwrite: true });
      return `Marked done: ${item}`;
    }

    case "project_list": {
      const listing = await listVaultFiles({ folder: "Projects", ext: "md" });
      const projects = [
        ...new Set(
          listing
            .map((line) => line.replace(/^Projects\//, "").split("/")[0])
            .filter(Boolean),
        ),
      ];
      return projects.join("\n");
    }

    case "project_overview":
      return readVaultFile(
        `Projects/${input.project as string}/overview.md`,
      );

    case "project_create": {
      const project = input.project as string;
      const description = input.description as string;
      const repo = input.repo as string | undefined;
      const tech = input.tech as string | undefined;

      const fmLines = ["---", `project: ${project}`, "status: active"];
      if (repo) fmLines.push(`repo: ${repo}`);
      if (tech) {
        fmLines.push("tech:");
        for (const t of tech
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)) {
          fmLines.push(`  - ${t}`);
        }
      }
      fmLines.push("tags:", "  - project-overview", "---");
      const overviewContent = `${fmLines.join("\n")}\n\n# ${project}\n\n${description}\n`;

      await writeVaultFile(`Projects/${project}/overview.md`, overviewContent);
      await writeVaultFile(
        `Projects/${project}/backlog.md`,
        `# Backlog -- ${project}\n`,
      );
      return `Created project: ${project}`;
    }

    // ── Project Context & Summaries ─────────────────────────────────────

    case "project_context": {
      const project = input.project as string;
      const sessionCount = (input.sessions as number | undefined) ?? 3;
      const sections: string[] = [];

      const overview = await readVaultFile(
        `Projects/${project}/overview.md`,
      );
      sections.push("## Overview\n\n" + overview);

      const backlog = await readVaultFile(
        `Projects/${project}/backlog.md`,
      );
      const openItems = backlog
        .split("\n")
        .filter((l) => l.startsWith("- [ ] "));
      sections.push(
        `## Open Backlog Items (${openItems.length})\n\n` +
          (openItems.length > 0 ? openItems.join("\n") : "(none)"),
      );

      const listing = await listVaultFiles({
        folder: `Projects/${project}`,
        ext: "md",
      });
      const sessionFiles = listing
        .filter((f) => /Projects\/[^/]+\/\d{4}-\d{2}-\d{2}/.test(f))
        .sort()
        .reverse()
        .slice(0, sessionCount);

      if (sessionFiles.length > 0) {
        const sessSections: string[] = [];
        for (const file of sessionFiles) {
          const content = await readVaultFile(file);
          sessSections.push(
            `### ${file.split("/").pop()}\n\n${content}`,
          );
        }
        sections.push(
          `## Recent Sessions (${sessionFiles.length})\n\n` +
            sessSections.join("\n\n---\n\n"),
        );
      } else {
        sections.push("## Recent Sessions\n\n(no session notes found)");
      }

      return sections.join("\n\n---\n\n");
    }

    case "project_summary": {
      const project = input.project as string;
      const days = (input.days as number | undefined) ?? 7;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const listing = await listVaultFiles({
        folder: `Projects/${project}`,
        ext: "md",
      });
      const sessionFiles = listing
        .filter((f) => {
          const m = f.match(/(\d{4}-\d{2}-\d{2})/);
          return m !== null && m[1] >= cutoffStr;
        })
        .sort();

      if (sessionFiles.length === 0) {
        return `No session notes found for ${project} in the last ${days} days.`;
      }

      const sessions: string[] = [];
      for (const file of sessionFiles) {
        const content = await readVaultFile(file);
        const name = (file.split("/").pop() ?? file).replace(/\.md$/, "");
        sessions.push(`### ${name}\n\n${content}`);
      }

      const backlog = await readVaultFile(
        `Projects/${project}/backlog.md`,
      );
      const openItems = backlog
        .split("\n")
        .filter((l) => l.startsWith("- [ ] "));
      const doneItems = backlog
        .split("\n")
        .filter((l) => l.startsWith("- [x] "));

      return [
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
      ].join("\n");
    }

    case "project_dashboard": {
      const format = (input.format as string | undefined) ?? "md";
      const allFiles = await listVaultFiles({ folder: "Projects", ext: "md" });

      const projectNames = [
        ...new Set(
          allFiles
            .map((f) => f.replace(/^Projects\//, "").split("/")[0])
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

      for (const pName of projectNames) {
        const projectFiles = allFiles.filter((f) =>
          f.startsWith(`Projects/${pName}/`),
        );
        const sessionFiles = projectFiles.filter((f) =>
          /\d{4}-\d{2}-\d{2}/.test(f),
        );
        const dates = sessionFiles
          .map((f) => {
            const m = f.match(/(\d{4}-\d{2}-\d{2})/);
            return m ? m[1] : "";
          })
          .filter(Boolean)
          .sort()
          .reverse();
        const lastActivity = dates[0] ?? "none";

        let openBacklog = 0;
        let status = "unknown";
        try {
          const backlog = await readVaultFile(
            `Projects/${pName}/backlog.md`,
          );
          openBacklog = backlog
            .split("\n")
            .filter((l) => l.startsWith("- [ ] ")).length;
        } catch {
          /* no backlog */
        }
        try {
          const overview = await readVaultFile(
            `Projects/${pName}/overview.md`,
          );
          const m = overview.match(/^status:\s*(.+)$/m);
          if (m) status = m[1].trim();
        } catch {
          /* no overview */
        }

        projects.push({
          name: pName,
          status,
          lastActivity,
          openBacklog,
          sessionCount: sessionFiles.length,
        });
      }

      projects.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

      if (format === "json") return JSON.stringify(projects, null, 2);

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

      const content = await readVaultFile(backlogPath);
      const unchecked: string[] = [];
      for (const line of content.split("\n")) {
        if (line.startsWith("- [ ] ")) unchecked.push(line.slice(6));
      }

      const matchIdx = unchecked.findIndex((t) => t.includes(item));
      if (matchIdx === -1) {
        throw new Error(
          `No unchecked backlog item matching "${item}" in ${backlogPath}`,
        );
      }

      const matched = unchecked.splice(matchIdx, 1)[0];
      const targetPos = Math.min(Math.max(1, position), unchecked.length + 1);
      const items = [
        ...unchecked.slice(0, targetPos - 1),
        matched,
        ...unchecked.slice(targetPos - 1),
      ];

      await handleTool("backlog_reorder", { project, items });
      return `Moved "${item}" to position ${targetPos}`;
    }

    case "backlog_reorder": {
      const project = input.project as string;
      const items = input.items as unknown as string[];
      const backlogPath = `Projects/${project}/backlog.md`;

      const content = await readVaultFile(backlogPath);
      const lines = content.split("\n");

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

      const unchecked = taskLines.filter((l) => l.startsWith("- [ ] "));
      const checked = taskLines.filter(
        (l) => l.startsWith("- [x] ") || l.startsWith("- [X] "),
      );

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

      const reordered = [...matched, ...remaining, ...checked];
      await writeVaultFile(
        backlogPath,
        [...headingLines, ...reordered].join("\n"),
        { overwrite: true },
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
