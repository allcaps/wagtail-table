import { Editor, type JSONContent } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TableKit } from '@tiptap/extension-table';
import { UndoRedo } from '@tiptap/extensions';

export interface TableValue {
  version: 1;
  table: JSONContent;
  caption: string;
  description: string;
}

export function createEditor(element: HTMLElement, value: TableValue | null) {
  return new Editor({
    element,
    extensions: [Document, Paragraph, Text, TableKit, UndoRedo],
    content: value ? { type: 'doc', content: [value.table] } : undefined,
    enableContentCheck: true,
  });
}

// An empty paragraph may be created by native insertion/navigation. It carries
// no saved content. Anything else outside the single table must remain visible
// and produce a validation error instead of being silently discarded.
export function tableValue(doc: JSONContent, previous: TableValue | null): TableValue | null {
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
