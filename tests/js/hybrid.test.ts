import { describe, expect, it } from 'vitest';
import { getSchema, type Editor, type JSONContent } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { history, undo, redo } from '@tiptap/pm/history';
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { blockCellExtension, canChangeCell, cellEditorStates, cellTypeChange, changeCell, containsBlock, type CellEditors } from '../../frontend/hybrid';
import { tableValue } from '../../frontend/editor';
import hybrid from '../fixtures/hybrid.json';

const options = {
  definition: { render() { throw new Error('DOM mounting is covered in the browser.'); } },
  defaultValue: [], defaultState: [],
};

const schema = getSchema([
  Document.extend({ content: 'table?' }), Paragraph, Text,
  TableKit.configure({ tableCell: false, tableHeader: false }),
  TableCell.extend({ content: '(paragraph+ | wagtailBlock)' }),
  TableHeader.extend({ content: '(paragraph+ | wagtailBlock)' }),
  blockCellExtension(options, { cells: new Set(), prefix: 'test', counter: 0 }),
]);

describe('native hybrid documents', () => {
  it('keeps quiet rendering in duplicated form state but out of submitted JSON', () => {
    const source: JSONContent = structuredClone(hybrid.table);
    const block = source.content![1].content![1].content![0];
    Object.assign(block.attrs!, { quiet: '<p>Quiet representation</p>', state: [] });
    const doc = schema.nodeFromJSON({ type: 'doc', content: [source] });
    const editor = { state: EditorState.create({ doc }), getJSON: () => doc.toJSON() } as unknown as Editor;
    const owners: CellEditors = { cells: new Set(), prefix: 'test', counter: 0 };
    const submitted = cellEditorStates(editor, owners, false);
    const duplicated = cellEditorStates(editor, owners, true);
    expect(JSON.stringify(submitted)).not.toContain('quiet');
    expect(JSON.stringify(submitted)).not.toContain('"state"');
    expect(duplicated.content![0].content![1].content![1].content![0].attrs?.quiet)
      .toBe('<p>Quiet representation</p>');
  });

  it('restores the fixture with valid table geometry and version 2 storage', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [hybrid.table] });
    doc.check();
    expect(TableMap.get(doc.firstChild!).problems).toBeNull();
    expect(containsBlock(doc)).toBe(true);
    expect(tableValue(doc.toJSON(), null)?.version).toBe(2);
  });

  it('does not allow block nodes mixed with paragraphs in the same cell', () => {
    const table: JSONContent = structuredClone(hybrid.table);
    table.content![1].content![1].content!.push({ type: 'paragraph' });
    expect(() => schema.nodeFromJSON(table).check()).toThrow();
  });

  it('allows conversion of populated cells and ranges', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [hybrid.table] });
    const cells: number[] = [];
    const blocks: number[] = [];
    doc.descendants((node, pos) => {
      if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') cells.push(pos);
      if (node.type.name === 'wagtailBlock') blocks.push(pos);
    });
    const empty = { state: EditorState.create({ doc, selection: TextSelection.create(doc, cells[7] + 2) }) };
    expect(canChangeCell(empty, 'block')).toBe(true);
    const text = { state: EditorState.create({ doc, selection: TextSelection.create(doc, cells[0] + 2) }) };
    expect(canChangeCell(text, 'block')).toBe(true);
    const range = { state: EditorState.create({ doc, selection: CellSelection.create(doc, cells[6], cells[8]) }) };
    expect(canChangeCell(range, 'block')).toBe(true);
    const full = { state: EditorState.create({ doc, selection: NodeSelection.create(doc, blocks[0]) }) };
    expect(canChangeCell(full, 'text')).toBe(true);
    const emptyDoc = full.state.tr.replaceWith(blocks[0], blocks[0] + 1, schema.nodes.wagtailBlock.create({ value: [] })).doc;
    expect(canChangeCell({ state: EditorState.create({ doc: emptyDoc, selection: NodeSelection.create(emptyDoc, blocks[0]) }) }, 'text')).toBe(true);
  });

  it('converts a mixed range in one transaction, preserving cells already of the target type', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [hybrid.table] });
    const positions: number[] = [];
    doc.descendants((node, pos) => {
      if (['cell', 'header_cell'].includes(node.type.spec.tableRole ?? '')) positions.push(pos);
    });
    const state = EditorState.create({ doc, selection: CellSelection.create(doc, positions[3], positions[5]) });
    const change = cellTypeChange(state, 'block', options)!;
    expect(change.destructive).toBe(true);
    const converted = state.apply(change.transaction);
    converted.doc.check();
    expect(converted.doc.firstChild!.child(1).child(1)).toEqual(doc.firstChild!.child(1).child(1));
    expect(converted.doc.firstChild!.child(1).content.content.every(cell => cell.firstChild!.type.name === 'wagtailBlock')).toBe(true);
    expect(converted.selection).toBeInstanceOf(CellSelection);
    expect(canChangeCell({ state: converted }, 'block')).toBe(false);
    expect(cellTypeChange(converted, 'text', options)!.destructive).toBe(true);
    const restored = converted.apply(cellTypeChange(converted, 'text', options)!.transaction);
    expect(restored.doc.firstChild!.child(1).content.content.every(cell => cell.firstChild!.type.name === 'paragraph')).toBe(true);
  });

  it('converts empty cells without confirmation and creates independent default values', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [hybrid.table] });
    const table = doc.firstChild!;
    const map = TableMap.get(table);
    const state = EditorState.create({ doc, selection: CellSelection.create(doc, map.map[7] + 1, map.map[8] + 1) });
    const change = cellTypeChange(state, 'block', options)!;
    expect(change.destructive).toBe(false);
    const row = state.apply(change.transaction).doc.firstChild!.lastChild!;
    expect(row.child(1).firstChild!.attrs.value).not.toBe(row.child(2).firstChild!.attrs.value);
    expect(row.child(1).firstChild!.attrs.value).not.toBe(options.defaultValue);
  });

  it('retains merged header geometry when converting a selected range', () => {
    const paragraph = { type: 'paragraph' };
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [
      { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 2 }, content: [paragraph] }] },
      { type: 'tableRow', content: [0, 1].map(() => ({ type: 'tableCell', content: [paragraph] })) },
    ] }] });
    const map = TableMap.get(doc.firstChild!);
    const state = EditorState.create({ doc, selection: CellSelection.create(doc, map.map[0] + 1, map.map[3] + 1) });
    const change = cellTypeChange(state, 'block', options)!;
    expect(change.transaction.steps).toHaveLength(3);
    const converted = state.apply(change.transaction).doc;
    expect(TableMap.get(converted.firstChild!).problems).toBeNull();
    expect(converted.firstChild!.firstChild!.firstChild!.type.name).toBe('tableHeader');
    expect(converted.firstChild!.firstChild!.firstChild!.attrs.colspan).toBe(2);
  });

  it('undoes and redoes a whole range conversion together', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [hybrid.table] });
    const map = TableMap.get(doc.firstChild!);
    let state = EditorState.create({ doc, plugins: [history()],
      selection: CellSelection.create(doc, map.map[0] + 1, map.map[2] + 1) });
    state = state.apply(cellTypeChange(state, 'block', options)!.transaction);
    const converted = state.doc;
    expect(undo(state, transaction => { state = state.apply(transaction); })).toBe(true);
    expect(state.doc.eq(doc)).toBe(true);
    expect(redo(state, transaction => { state = state.apply(transaction); })).toBe(true);
    expect(state.doc.eq(converted)).toBe(true);
  });

  it('does not dispatch a destructive conversion when confirmation is cancelled', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [hybrid.table] });
    const state = EditorState.create({ doc, selection: CellSelection.create(doc, 2) });
    const editor = { state, view: { dispatch() { throw new Error('Cancelled conversion dispatched'); } } } as unknown as Editor;
    let asked = 0;
    expect(changeCell(editor, 'block', options, () => { asked++; return false; })).toBe(false);
    expect(asked).toBe(1);
    expect(editor.state.doc).toBe(doc);
  });
});
