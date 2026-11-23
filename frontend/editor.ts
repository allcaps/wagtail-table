import { Editor, type JSONContent } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import { UndoRedo } from '@tiptap/extensions';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { VerticalAlignment } from './alignment';
import { clipboardProps, type ClipboardNotice } from './clipboard';
import { blockCellExtension, type BlockOptions, type CellEditors } from './hybrid';

export interface TableValue {
  version: 1 | 2;
  table: JSONContent;
  caption: string;
  description: string;
}

export function createEditor(
  element: HTMLElement, value: TableValue | null,
  notify: (messages: ClipboardNotice[]) => void = () => {},
  hybrid?: { block: BlockOptions; editors: CellEditors },
) {
  return new Editor({
    element,
    extensions: [
      Document.extend({ content: 'table?' }), Paragraph, Text, HardBreak,
      TableKit.configure({ tableCell: false, tableHeader: false }),
      TableCell.extend({ content: hybrid ? '(paragraph+ | wagtailBlock)' : 'paragraph+' }),
      TableHeader.extend({ content: hybrid ? '(paragraph+ | wagtailBlock)' : 'paragraph+' }),
      ...(hybrid ? [blockCellExtension(hybrid.block, hybrid.editors)] : []),
      UndoRedo, VerticalAlignment,
    ],
    content: value ? { type: 'doc', content: [value.table] } : undefined,
    enableContentCheck: true,
    editorProps: clipboardProps(notify),
  });
}

// Only a genuinely empty document may become an empty draft. Never discard
// outside nodes, even empty paragraphs, to extract an apparently valid table.
export function tableValue(doc: JSONContent, previous: Pick<TableValue, 'caption' | 'description'> | null): TableValue | null {
  if (doc.type !== 'doc') throw new Error('Expected a table document.');
  const content = doc.content ?? [];
  if (!content.length) return null;
  if (content.length !== 1 || content[0].type !== 'table') {
    throw new Error('Only one table can be saved.');
  }
  return {
    version: content[0].content?.some(row => row.content?.some(cell =>
      cell.content?.some(node => node.type === 'wagtailBlock'))) ? 2 : 1,
    table: content[0],
    caption: previous?.caption ?? '',
    description: previous?.description ?? '',
  };
}

export type HeaderConfiguration = 'none' | 'row' | 'column' | 'both' | 'custom';

export function selectedCellAlignment(state: EditorState) {
  const cells: ProseMirrorNode[] = [];
  const selection = state.selection;
  if (selection instanceof CellSelection) {
    selection.forEachCell(cell => cells.push(cell));
  } else {
    for (let depth = selection.$from.depth; depth > 0; depth--) {
      const node = selection.$from.node(depth);
      if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
        cells.push(node);
        break;
      }
    }
  }
  const alignment: { align: string | null | undefined; verticalAlign: string | null | undefined } = {
    align: undefined, verticalAlign: undefined,
  };
  for (const key of ['align', 'verticalAlign'] as const) {
    const first = cells[0]?.attrs[key] ?? null;
    if (cells.length && cells.every(cell => (cell.attrs[key] ?? null) === first)) alignment[key] = first;
  }
  return alignment;
}

// Match the edge cells inspected by ProseMirror's native header toggles.
// Interior headers do not change whether the first row or column is enabled.
export function headerEdges(table: ProseMirrorNode) {
  const map = TableMap.get(table);
  const isHeader = (position: number) => table.nodeAt(position)?.type.name === 'tableHeader';
  return {
    row: map.cellsInRect({ left: 0, top: 0, right: map.width, bottom: 1 }).every(isHeader),
    column: map.cellsInRect({ left: 0, top: 0, right: 1, bottom: map.height }).every(isHeader),
  };
}

// Read ProseMirror's logical grid so merged cells and structural edits are
// reflected in the UI. There is no separately stored header-mode flag.
export function headerConfiguration(table: ProseMirrorNode): HeaderConfiguration {
  const map = TableMap.get(table);
  for (const mode of ['none', 'row', 'column', 'both'] as const) {
    const matches = map.map.every((position, index) => {
      const row = Math.floor(index / map.width);
      const column = index % map.width;
      const expected = ((mode === 'row' || mode === 'both') && row === 0)
        || ((mode === 'column' || mode === 'both') && column === 0);
      return (table.nodeAt(position)?.type.name === 'tableHeader') === expected;
    });
    if (matches) return mode;
  }
  return 'custom';
}
