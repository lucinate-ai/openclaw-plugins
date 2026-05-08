# @lucinate-ai/openclaw-file-list

An OpenClaw plugin that registers a `list_files` tool for reading directory contents - perfect for use through the [`/tools/invoke` HTTP API](https://docs.openclaw.ai/gateway/tools-invoke-http-api).

## Why?

OpenClaw's `/tools/invoke` HTTP API blocks `exec` (shell commands) by default for security, and there's no built-in tool for listing directory contents. This plugin fills that gap with a read-only, sandboxed directory listing tool.

## Tool: `list_files`

List files and directories at a given absolute path.

### Parameters

| Parameter    | Type    | Required | Default | Description |
|-------------|---------|----------|---------|-------------|
| `path`      | string  | Yes      | —       | Absolute path to the directory to list |
| `depth`     | integer | No       | `0`     | Recursion depth for subdirectories (0-10) |
| `showHidden`| boolean | No       | `false` | Include hidden files (dotfiles) |

### Example

```bash
curl -s http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer ***' \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "list_files",
    "args": { "path": "/home/pete/.openclaw/workspaces/test" }
  }'
```

### Response format

```
📂 /home/pete/.openclaw/workspaces/test
   2 dirs, 5 files

  📁 memory
  📁 subagents
  📄 AGENTS.md        2.3 KB
  📄 HEARTBEAT.md     126 B
  📄 IDENTITY.md      83 B
  📄 SOUL.md          3.1 KB
  📄 USER.md          891 B

Total: 7 entries
```

## Installation

```bash
# From local checkout
openclaw plugins install ./packages/file-list

# From GitHub (once released)
openclaw plugins install git:github.com/lucinate-ai/openclaw-plugins@v1.0.0
```

## Configuration (optional)

```json
{
  "plugins": {
    "entries": {
      "file-list": {
        "enabled": true,
        "config": {
          "allowedPaths": ["/home/pete/.openclaw"],
          "maxDepth": 3
        }
      }
    }
  }
}
```

- `allowedPaths`: restrict listing to these path prefixes (empty = unrestricted)
- `maxDepth`: default recursion limit (default: 1)

## Security

The tool:
- Requires **absolute paths** (relative paths are rejected)
- Does not execute shell commands
- Is read-only (no file creation, modification, or deletion)
- Respects filesystem permissions on the host
