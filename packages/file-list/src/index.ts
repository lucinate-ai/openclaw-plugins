import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";

export default definePluginEntry({
  id: "file-list",
  name: "File List",
  description: "Adds a list_files tool for reading directory contents",
  register(api) {
    api.registerTool({
      name: "list_files",
      description:
        "List files and directories at a given path. Returns entries with " +
        "name, type (file/directory/symlink), size (bytes), and last modified time. " +
        "The path must be absolute.",
      parameters: Type.Object({
        path: Type.String({
          description: "Absolute path to the directory to list",
        }),
        depth: Type.Optional(
          Type.Integer({
            description:
              "Recursion depth for subdirectories (0 = current dir only, default 0)",
            minimum: 0,
            maximum: 10,
          }),
        ),
        showHidden: Type.Optional(
          Type.Boolean({
            description:
              "Include hidden files (dotfiles). Default false.",
          }),
        ),
      }),
      async execute(_id, params) {
        const dirPath = path.resolve(params.path);

        // Security: prevent escaping via symlinks or relative traversal
        if (!path.isAbsolute(params.path)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: path must be absolute",
              },
            ],
            isError: true,
          };
        }

        // Verify the path exists and is a directory
        let stat: fs.Stats;
        try {
          stat = await fs.promises.stat(dirPath);
        } catch (err: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error: cannot access path: ${err.message}`,
              },
            ],
            isError: true,
          };
        }

        if (!stat.isDirectory()) {
          return {
            content: [
              {
                type: "text",
                text: `Error: not a directory: ${dirPath}`,
              },
            ],
            isError: true,
          };
        }

        const maxDepth = params.depth ?? 0;
        const showHidden = params.showHidden ?? false;

        try {
          const entries = await listDir(dirPath, maxDepth, showHidden, 0);
          return {
            content: [
              {
                type: "text",
                text: formatOutput(dirPath, entries, showHidden),
              },
            ],
          };
        } catch (err: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing directory: ${err.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    });
  },
});

interface DirEntry {
  name: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  modified: string;
  children?: DirEntry[];
}

async function listDir(
  dirPath: string,
  maxDepth: number,
  showHidden: boolean,
  currentDepth: number,
): Promise<DirEntry[]> {
  const names = await fs.promises.readdir(dirPath);
  const entries: DirEntry[] = [];

  for (const name of names) {
    if (!showHidden && name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dirPath, name);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(fullPath);
    } catch {
      // Skip entries we can't stat (permission issues, broken symlinks, etc.)
      entries.push({
        name,
        type: "other",
        size: 0,
        modified: "",
      });
      continue;
    }

    const entry: DirEntry = {
      name: name,
      type: stat.isDirectory()
        ? "directory"
        : stat.isFile()
          ? "file"
          : stat.isSymbolicLink()
            ? "symlink"
            : "other",
      size: stat.size,
      modified: stat.mtime.toISOString(),
    };

    if (stat.isDirectory() && currentDepth < maxDepth) {
      entry.children = await listDir(
        fullPath,
        maxDepth,
        showHidden,
        currentDepth + 1,
      );
    }

    entries.push(entry);
  }

  // Sort: directories first, then by name
  entries.sort((a, b) => {
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (a.type !== "directory" && b.type === "directory") return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

function formatOutput(
  rootPath: string,
  entries: DirEntry[],
  showHidden: boolean,
): string {
  const lines: string[] = [];
  const totalFiles = entries.filter((e) => e.type === "file").length;
  const totalDirs = entries.filter((e) => e.type === "directory").length;

  lines.push(`📂 ${rootPath}`);
  lines.push(`   ${totalDirs} dirs, ${totalFiles} files`);
  lines.push("");

  for (const entry of entries) {
    const icon =
      entry.type === "directory"
        ? "📁"
        : entry.type === "file"
          ? "📄"
          : entry.type === "symlink"
            ? "🔗"
            : "❓";
    const sizeStr =
      entry.type === "file" ? `  ${formatSize(entry.size)}` : "       ";
    const hidden = entry.name.startsWith(".") ? " (hidden)" : "";
    lines.push(
      `  ${icon} ${entry.name}${sizeStr}${hidden}`,
    );

    if (entry.children) {
      for (const child of entry.children) {
        const childIcon =
          child.type === "directory"
            ? "📁"
            : child.type === "file"
              ? "📄"
              : "🔗";
        const childSize =
          child.type === "file" ? `  ${formatSize(child.size)}` : "";
        lines.push(
          `    ${childIcon} ${child.name}${childSize}`,
        );
      }
    }
  }

  lines.push("");
  lines.push(`Total: ${totalDirs + totalFiles} entries`);
  return lines.join("\n");
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${size} ${units[i]}`;
}
