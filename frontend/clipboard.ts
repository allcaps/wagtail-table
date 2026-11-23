import type { EditorProps, EditorView } from '@tiptap/pm/view';
import { Fragment, Slice, type Node as ProseMirrorNode, type Schema } from '@tiptap/pm/model';
import { CellSelection, isInTable, selectedRect, TableMap } from '@tiptap/pm/tables';
import { containsBlock } from './hybrid';

const MAX_TEXT = 2_000_000;
const MAX_ROWS = 1000;
const MAX_COLUMNS = 100;
const MAX_CELLS = 10_000;

export const clipboardMessages = {
  pasteBlocks: 'Table paste, copy, and cut are unavailable for block cells. You can still paste ordinary text into individual text cells.',
  pasteUnsupported: 'This paste contains multiple or nested tables, surrounding text, or an unsupported table structure. The table was not changed.',
  pasteLimit: 'This paste would exceed the table size limit. The table was not changed.',
  pasteFirst: 'Insert a table before pasting ordinary text, or paste a complete HTML table or tab-separated range.',
  pasteFit: 'The pasted cells were fitted to the selected range: larger ranges are clipped and smaller ranges repeat. Undo restores the previous cells.',
  pasteMerged: 'Native table paste may split intersecting merged cells and replace their contents. Undo restores the previous cells.',
};
export type ClipboardNotice = keyof typeof clipboardMessages;
type Notify = (messages: ClipboardNotice[]) => void;

// TSV is the only new parser. HTML parsing and all table insertion, growth,
// clipping, repetition, and span adjustment remain ProseMirror's responsibility.
export function parseTSV(text: string): string[][] | null {
  if (text.length > MAX_TEXT) throw new RangeError('Paste too large');
  if (!text.includes('\t')) return null;
  text = text.replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (character === '"') { quoted = false; closed = true; }
      else field += character;
    } else if (character === '\t' || character === '\n') {
      row.push(field); field = ''; closed = false;
      if (row.length > MAX_COLUMNS) throw new RangeError('Too many columns');
      if (character === '\n') { rows.push(row); row = []; }
      if (rows.length > MAX_ROWS) throw new RangeError('Too many rows');
    } else if (character === '"' && !field && !closed) {
      quoted = true;
    } else {
      if (closed) throw new Error('Invalid quoted field');
      field += character;
    }
  }
  if (quoted) throw new Error('Unclosed quoted field');
  row.push(field);
  rows.push(row);
  if (text.endsWith('\n') && row.length === 1 && !row[0]) rows.pop();
  const width = Math.max(...rows.map(cells => cells.length));
  if (width > MAX_COLUMNS || rows.length > MAX_ROWS || width * rows.length > MAX_CELLS) {
    throw new RangeError('Table too large');
  }
  for (const cells of rows) while (cells.length < width) cells.push('');
  return rows;
}

function tsvSlice(rows: string[][], schema: Schema): Slice {
  const content = rows.map(row => schema.nodes.tableRow.create(null, row.map(field => {
    const paragraphs = field.split('\n').map(line => schema.nodes.paragraph.create(
      null, line ? schema.text(line) : undefined,
    ));
    return schema.nodes.tableCell.create(null, paragraphs);
  })));
  return new Slice(Fragment.from(schema.nodes.table.create(null, content)), 0, 0);
}

function prepareHTML(html: string): string {
  if (html.length > MAX_TEXT) throw new RangeError('Paste too large');
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, style, meta, link, title').forEach(node => node.remove());
  const tables = template.content.querySelectorAll('table');
  if (tables.length > 1) throw new Error('Multiple or nested tables');
  if (!tables.length) return template.innerHTML;
  const remainder = template.content.cloneNode(true) as DocumentFragment;
  remainder.querySelector('table')!.remove();
  if (remainder.textContent?.trim()) throw new Error('Text outside table');
  const rows = [...tables[0].rows];
  if (rows.length > MAX_ROWS) throw new RangeError('Too many rows');
  let area = 0;
  rows.forEach((row, r) => {
    let width = 0;
    for (const cell of row.cells) {
      const colspan = Number(cell.getAttribute('colspan') ?? 1);
      const rowspan = Number(cell.getAttribute('rowspan') ?? 1);
      if (!Number.isInteger(colspan) || !Number.isInteger(rowspan) || colspan < 1 || rowspan < 1
        || colspan > MAX_COLUMNS || r + rowspan > rows.length) throw new Error('Invalid span');
      width += colspan;
      area += rowspan * colspan;
      // Widths are layout formatting, not part of the supported public output.
      cell.removeAttribute('colwidth');
      const align = ['left', 'center', 'right'].find(value => cell.classList.contains(`wagtail-table-align-${value}`));
      if (align && !cell.style.textAlign) cell.style.textAlign = align;
    }
    if (width > MAX_COLUMNS || area > MAX_CELLS) throw new RangeError('Table too large');
  });
  template.content.querySelectorAll('colgroup, caption').forEach(node => node.remove());
  // Outside text was rejected above; ignore empty source wrappers/paragraphs.
  return tables[0].outerHTML;
}

function sourceTable(slice: Slice, schema: Schema): ProseMirrorNode | null {
  const first = slice.content.firstChild;
  if (!first) return null;
  if (first.type.name === 'table' && slice.content.childCount === 1) return first;
  const nodes: ProseMirrorNode[] = [];
  slice.content.forEach(node => nodes.push(node));
  if (nodes.every(node => node.type.name === 'tableRow')) {
    return schema.nodes.table.create(null, slice.content);
  }
  if (nodes.every(node => ['tableCell', 'tableHeader'].includes(node.type.name))) {
    return schema.nodes.table.create(null, schema.nodes.tableRow.create(null, slice.content));
  }
  return null;
}

export function clipboardProps(notify: Notify): EditorProps {
  const reject = (error: unknown) => notify([error instanceof RangeError ? 'pasteLimit' : 'pasteUnsupported']);
  const protectClipboard = (view: EditorView, event: Event) => {
    if (!containsBlock(view.state.selection.content().content)) return false;
    event.preventDefault();
    notify(['pasteBlocks']);
    return true;
  };
  return {
    handleDOMEvents: { copy: protectClipboard, cut: protectClipboard, dragstart: protectClipboard },
    handleDrop(view) {
      if (!containsBlock(view.state.doc)) return false;
      notify(['pasteBlocks']);
      return true;
    },
    transformPastedHTML(html) {
      notify([]);
      try { return prepareHTML(html); }
      catch (error) { reject(error); return ''; }
    },
    clipboardTextParser(text, $context) {
      notify([]);
      try {
        const rows = parseTSV(text);
        const schema = $context.doc.type.schema;
        if (rows) return tsvSlice(rows, schema);
        // The hook requires a Slice, including for prose. Use native paragraph
        // nodes and ProseMirror's open-slice fitting, with its usual newline split.
        return Slice.maxOpen(Fragment.from(text.split(/(?:\r\n?|\n)+/).map(line =>
          schema.nodes.paragraph.create(null, line ? schema.text(line) : undefined),
        )));
      } catch (error) { reject(error); return Slice.empty; }
    },
    handlePaste(view, _event, slice) {
      // An explicitly rejected parse must never reach native CellSelection
      // handling: an empty slice there would clear the selected cells.
      if (!slice.size) return true;
      if (slice.size > MAX_TEXT) { notify(['pasteLimit']); return true; }
      const table = sourceTable(slice, view.state.schema);
      if (containsBlock(view.state.selection.content().content)
        || (table && containsBlock(view.state.doc))) {
        notify(['pasteBlocks']);
        return true;
      }
      if (!table) {
        if (!isInTable(view.state)) { notify(['pasteFirst']); return true; }
        return false;
      }
      const source = TableMap.get(table);
      let width = source.width;
      let height = source.height;
      const notices: ClipboardNotice[] = [];
      if (isInTable(view.state)) {
        const destination = selectedRect(view.state);
        if (view.state.selection instanceof CellSelection) {
          if (width !== destination.right - destination.left || height !== destination.bottom - destination.top) {
            notices.push('pasteFit');
          }
        } else {
          width = Math.max(destination.map.width, destination.left + width);
          height = Math.max(destination.map.height, destination.top + height);
        }
        if (hasSpans(table) || hasSpans(destination.table)) notices.push('pasteMerged');
      }
      if (width > MAX_COLUMNS || height > MAX_ROWS || width * height > MAX_CELLS) {
        notify(['pasteLimit']); return true;
      }
      notify(notices);
      return false;
    },
  };
}

function hasSpans(table: ProseMirrorNode): boolean {
  let merged = false;
  table.descendants(node => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      merged ||= node.attrs.colspan > 1 || node.attrs.rowspan > 1;
      return false;
    }
  });
  return merged;
}
