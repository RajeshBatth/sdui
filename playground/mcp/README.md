# SDUI MCP server

Lets coding agents read and write the playground's templates (`playground/private/templates/`).
Writes go straight to disk, so an open playground updates live and its activity feed names the agent.
The playground also reports what you're looking at, so you can say "make the selected pill bigger" in Cursor.

## Connect

**Cursor**: already configured in `.cursor/mcp.json`. Enable "sdui" under Settings → MCP.

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.sdui]
command = "node"
args = ["/absolute/path/to/sdui/playground/mcp/sdui-mcp.mjs"]
```

**Claude Code**: `claude mcp add sdui -- node /absolute/path/to/sdui/playground/mcp/sdui-mcp.mjs`

`render_template` also needs the playground running (`npm run viewer`) and Chrome installed.
Override with `SDUI_PLAYGROUND_URL` and `CHROME_PATH`.

Fetching Figma frames needs a Figma personal access token: put `FIGMA_TOKEN=…` in `.env` (or `.env.local`) at the project root (git-ignored; read on each fetch, no restart). A `FIGMA_TOKEN` environment variable also works. Screenshots work without it.

## Tools

| Tool | What it does |
| --- | --- |
| `authoring_guide` | How templates work and the JSX subset (also sent as the server's instructions) |
| `node_reference` | Every element, or one element's props, token options and looks |
| `design_tokens` | Token names and values per scale (color, text, space, icon, look, …) |
| `list_templates` / `get_template` | Templates with prompt, schema, samples, variants and JSX |
| `create_template` | New template with a fallback `v1` |
| `write_variant` | Write a variant's JSX, label, targets, fallback; refuses JSX that doesn't compile |
| `update_template` | Name, selection prompt, props schema, samples, variant order |
| `remove_variant` | Drop a variant |
| `validate_template` | Compile + check every variant against every sample |
| `resolve_variant` | Which variant a platform / app version / experiment gets |
| `render_template` | PNG of a variant with a sample, cropped to the content |
| `set_reference` / `remove_reference` | Attach a Figma frame (needs `FIGMA_TOKEN`) or screenshot; `render_template` then returns it beside the render |
| `playground_context` | What the user is looking at: template, variant, sample, simulated client, selected node and its JSX lines |
| `show_in_playground` | Open a template / variant / sample in the playground and select the node on a JSX line |
| `selection_prompt` | The collated LLM system prompt and response schema across templates |
