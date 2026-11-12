export const AUTHORING_GUIDE = `# SDUI templates

A template is server-driven UI for a chat app. The backend asks an LLM to pick a template id and
extract its props from the conversation, then sends the bound view to Android, iOS and Web clients.

Each template has:
- prompt: when the LLM should pick it (shared by every variant)
- schema: JSON Schema for its props; each field's "description" is the prompt for extracting it
- samples: example props used to preview and validate
- variants: JSX files, each targeted at clients (platform + app version range + experiment arm).
  Variants are checked in order; the first with a matching target is served, else the fallback.

## Workflow
0. When the user refers to what they see ("this pill", "the selected card"), call playground_context first.
1. list_templates / get_template to see what exists. Read authoring rules here and node_reference for elements.
2. Write JSX with write_variant. It compiles first and refuses invalid JSX, then reports diagnostics per sample.
3. Keep the schema in step with the JSX: every props.* path the JSX reads must be declared, with a description.
   Add samples that exercise optional branches (e.g. one with every field, one minimal).
4. Attach the design with set_reference (Figma link or screenshot path), then render_template:
   it returns your render and the reference together. Compare and iterate.
   Then show_in_playground so the user sees the result.
5. Don't invent tokens: use names from design_tokens and looks from node_reference.

## JSX subset (.sdui.jsx)
\`\`\`jsx
export default (props) => (
  <Card look="glass" gap="md">
    <Text style="heading" tone="title">{props.name}</Text>
    {props.area && <Text style="caption" tone="secondary">{props.area}</Text>}
    {props.luxury ? <Pill look="success">LUXURY</Pill> : <Pill look="chip">Value</Pill>}
    <Stack gap="sm" dividers>
      {props.rooms.map((room) => (
        <Stack direction="horizontal" justify="between">
          <Text style="bodyStrong">{room.name}</Text>
          <Text style="body">{room.price} / night</Text>
        </Stack>
      ))}
    </Stack>
    <Button look="primary" fullWidth action={{ kind: "message", text: \`Show rooms at \${props.name}\` }}>
      View rooms
    </Button>
  </Card>
);
\`\`\`
Rules:
- One module: \`export default (props) => (<Root …/>)\`. Optional \`// @key value\` comments at the top.
  Samples live in the template (update_template), not in the file.
- Tags are node types in PascalCase: Stack, Text, Card, ScrollRow, TextInput… Slots use dotted tags:
  <Overlay.Base>/<Overlay.Layer>, <Disclosure.Summary>/<Disclosure.Detail>, <Table.Row>, <Tabs.Pane label="…">.
- Attributes: "strings", {numbers}, {true}/bare flag, {{ objects }}, {[arrays]}. No spreads.
- Data: \`props.a.b\` paths only, or the loop variable inside .map. Template strings may insert paths.
  No function calls, arithmetic, indexing, ||, ??, or other expressions.
- Conditions: \`path\`, \`!path\`, \`path === "literal"\`, \`path !== otherPath\`.
  Use \`{cond && <El/>}\` or \`{cond ? <A/> : <B/>}\` for children; a ternary also works inside an attribute.
  A branch must be one element (use a fragment only around a nested conditional or loop).
- Loops: \`{props.list.map((item) => (<El/>))}\` returns one element. No index, no key.
- Text: Text/Markdown/Button/Pill take their text as children. Mix text and {paths} freely; styled runs use
  <Span tone="…" weight="…">…</Span> inside <Text>. Text can't sit directly inside layout elements.
- Inputs (Choice, Stepper, TextInput) must be inside <Form>.
- Action payloads are provisional; use { kind: "message", text } unless told otherwise.
`;
