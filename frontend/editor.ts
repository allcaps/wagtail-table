import { Editor, type JSONContent } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import { UndoRedo } from '@tiptap/extensions';
import { TableMap } from '@tiptap/pm/tables';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { VerticalAlignment } from './alignment';
import { clipboardProps, type ClipboardNotice } from './clipboard';

export interface TableValue {
  version: 1;
  table: JSONContent;
  caption: string;
  description: string;
}

export function createEditor(
  element: HTMLElement, value: TableValue | null,
  notify: (messages: ClipboardNotice[]) => void = () => {},
) {
  return new Editor({
    element,
    extensions: [
      Document.extend({ content: 'table?' }), Paragraph, Text, HardBreak,
      TableKit.configure({ tableCell: false, tableHeader: false }),
      TableCell.extend({ content: 'paragraph+' }),
      TableHeader.extend({ content: 'paragraph+' }),
      UndoRedo, VerticalAlignment,
    ],
    content: value ? { type: 'doc', content: [value.table] } : undefined,
    enableContentCheck: true,
    editorProps: clipboardProps(notify),
  });
}

// An empty paragraph may be created by native insertion/navigation. It carries
// no saved content. Anything else outside the single table must remain visible
// and produce a validation error instead of being silently discarded.
export function tableValue(doc: JSONContent, previous: Pick<TableValue, 'caption' | 'description'> | null): TableValue | null {
  const content = (doc.content ?? []).filter(
    node => !(node.type === 'paragraph' && !node.content?.length),
  );
  if (!content.length) return null;
  if (content.length !== 1 || content[0].type !== 'table') {
    throw new Error('Only one table can be saved.');
  }
  return {
    version: 1,
    table: content[0],
    caption: previous?.caption ?? '',
    description: previous?.description ?? '',
  };
}

export type HeaderConfiguration = 'none' | 'row' | 'column' | 'both' | 'custom';

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
