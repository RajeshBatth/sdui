import { javascript } from '@codemirror/lang-javascript';
import { setDiagnostics } from '@codemirror/lint';
import { Annotation, EditorSelection, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { basicSetup, EditorView } from 'codemirror';
import { useEffect, useRef } from 'react';

export interface CodeError {
  line: number;
  column: number;
  message: string;
}

const external = Annotation.define<boolean>();
const setMark = StateEffect.define<{ from: number; to: number } | null>();
const markField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMark)) continue;
      if (!e.value) {
        deco = Decoration.none;
        continue;
      }
      // Whole-line highlight with a bar in the margin: quiet even when the selection spans many lines.
      const doc = tr.state.doc;
      const first = doc.lineAt(e.value.from).number;
      const last = doc.lineAt(Math.min(e.value.to, doc.length)).number;
      const ranges = [];
      for (let n = first; n <= last; n++) {
        const cls = ['cm-sduiSelLine', n === first ? 'first' : '', n === last ? 'last' : ''].filter(Boolean).join(' ');
        ranges.push(Decoration.line({ class: cls }).range(doc.line(n).from));
      }
      deco = Decoration.set(ranges);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: '#fbfbfc' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.6' },
  '.cm-gutters': { backgroundColor: '#f4f5f7', border: 'none', color: '#9aa0a6' },
  '.cm-activeLine': { backgroundColor: '#eef2ff66' },
  '.cm-activeLineGutter': { backgroundColor: '#eef2ff' },
  '.cm-sduiSelLine': { backgroundColor: '#355ff212', boxShadow: 'inset 3px 0 0 #355ff2' },
  '.cm-sduiSelLine.first': { borderTopLeftRadius: '2px' },
  '.cm-sduiSelLine.last': { borderBottomLeftRadius: '2px' },
});

export function CodeEditor({
  value,
  onChange,
  error,
  mark,
  onCursor,
}: {
  value: string;
  onChange: (v: string) => void;
  error: CodeError | null;
  mark: { from: number; to: number } | null;
  onCursor?: (pos: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onCursor });
  cb.current = { onChange, onCursor };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      doc: value,
      extensions: [
        basicSetup,
        EditorView.lineWrapping,
        javascript({ jsx: true }),
        markField,
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !u.transactions.some((t) => t.annotation(external))) cb.current.onChange(u.state.doc.toString());
          if (u.selectionSet && u.transactions.some((t) => t.isUserEvent('select'))) cb.current.onCursor?.(u.state.selection.main.head);
        }),
      ],
    });
    view.current = v;
    return () => v.destroy();
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, annotations: external.of(true) });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const diags = [];
    if (error) {
      const line = v.state.doc.line(Math.min(Math.max(1, error.line), v.state.doc.lines));
      const from = Math.min(line.from + error.column, line.to);
      diags.push({ from, to: Math.max(from + 1, Math.min(line.to, from + 1)), severity: 'error' as const, message: error.message });
    }
    v.dispatch(setDiagnostics(v.state, diags));
  }, [error, value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const inRange = mark && mark.to <= v.state.doc.length;
    v.dispatch({
      effects: [setMark.of(inRange ? mark : null), ...(inRange ? [EditorView.scrollIntoView(EditorSelection.range(mark.from, mark.to), { y: 'nearest' })] : [])],
    });
  }, [mark?.from, mark?.to]);

  return <div className="codeHost" ref={host} />;
}
