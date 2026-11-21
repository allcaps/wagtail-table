import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { CellSelection, TableMap, tableEditingKey } from '@tiptap/pm/tables';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';

export const selectionLabels = {
  selectCell: 'Select cell, row %(row)s, column %(column)s',
  selectCellHelp: 'Click to select this cell. Shift-click to extend the selection, or drag to select cells.',
};

function cellPosition(view: EditorView, target: EventTarget | null): number | null {
  const handle = target instanceof Element ? target.closest('[data-table-select-cell]') : null;
  const cell = handle?.closest('td, th');
  return cell && view.dom.contains(cell) ? view.posAtDOM(cell, 0) - 1 : null;
}

function selectCell(view: EditorView, pos: number, extend: boolean) {
  const { selection, doc } = view.state;
  const anchor = extend && selection instanceof CellSelection ? selection.$anchorCell.pos : pos;
  view.dispatch(view.state.tr.setSelection(CellSelection.create(doc, anchor, pos)));
}

export function cellHandles(state: EditorState, labels: typeof selectionLabels): DecorationSet {
  const decorations: Decoration[] = [];
  const selected = new Set<number>();
  if (state.selection instanceof CellSelection) state.selection.forEachCell((_node, pos) => selected.add(pos));
  state.doc.descendants((table, tablePos) => {
    if (table.type.spec.tableRole !== 'table') return true;
    const map = TableMap.get(table);
    table.forEach((row, rowOffset) => row.forEach((cell, cellOffset) => {
      if (cell.firstChild?.type.name !== 'wagtailBlock') return;
      const relative = rowOffset + cellOffset + 1;
      const pos = tablePos + 1 + relative;
      const { top, left } = map.findCell(relative);
      const label = labels.selectCell.replace('%(row)s', String(top + 1)).replace('%(column)s', String(left + 1));
      const pressed = String(selected.has(pos));
      decorations.push(Decoration.widget(pos + 1, () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wagtail-table-cell-handle';
        button.dataset.tableSelectCell = '';
        button.contentEditable = 'false';
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', pressed);
        button.title = `${label}. ${labels.selectCellHelp}`;
        return button;
      }, { side: -1, ignoreSelection: true, key: `cell-handle-${pos}-${label}` }));
    }));
    return false;
  });
  return DecorationSet.create(state.doc, decorations);
}

export const CellHandles = Extension.create({
  name: 'cellHandles',
  // Handle buttons before the table plugin's general mouse handling.
  priority: 1100,
  addOptions() { return selectionLabels; },
  addProseMirrorPlugins() {
    const labels = this.options;
    return [new Plugin<DecorationSet>({
      view() {
        return {
          update(view) {
            // Keep the same button DOM during selection changes, including
            // while ProseMirror tracks the original mousedown target.
            for (const handle of view.dom.querySelectorAll('[data-table-select-cell]')) {
              handle.setAttribute('aria-pressed', String(handle.closest('td, th')!.classList.contains('selectedCell')));
            }
          },
        };
      },
      state: {
        init: (_config, state) => cellHandles(state, labels),
        apply: (transaction, handles, _old, state) => transaction.docChanged || transaction.selectionSet
          ? cellHandles(state, labels) : handles,
      },
      props: {
        decorations(state) { return this.getState(state); },
        handleDOMEvents: {
          mousedown(view, event) {
            const pos = cellPosition(view, event.target);
            if (pos === null || event.button !== 0 || event.ctrlKey || event.metaKey) return false;
            selectCell(view, pos, event.shiftKey);
            // Reuse the installed table plugin's drag handling and cleanup.
            // Prevent the button's default focus only after it sees the event.
            const tables = tableEditingKey.get(view.state);
            tables?.props.handleDOMEvents?.mousedown?.call(tables, view, event);
            event.preventDefault();
            view.focus();
            return true;
          },
          click(view, event) {
            const pos = cellPosition(view, event.target);
            if (pos === null) return false;
            // Keyboard and assistive-technology button activation has no
            // mousedown. Mouse clicks must retain the completed drag range.
            if (event.detail === 0) {
              selectCell(view, pos, event.shiftKey);
              view.focus();
            }
            event.preventDefault();
            return true;
          },
          keydown(view, event) {
            const pos = cellPosition(view, event.target);
            if (pos === null || !['Enter', ' '].includes(event.key)) return false;
            event.preventDefault();
            selectCell(view, pos, event.shiftKey);
            view.focus();
            return true;
          },
        },
      },
    })];
  },
});
