import { describe, expect, it } from 'vitest';
import { tableValue, type TableValue } from '../../frontend/editor';
import basic from '../fixtures/basic.json';
import accessibilityExamples from '../fixtures/accessibility/wai-tables.json';
import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TableKit } from '@tiptap/extension-table';
import { VerticalAlignment } from '../../frontend/alignment';
import { headerConfiguration, headerEdges } from '../../frontend/editor';
import { selectedCellAlignment } from '../../frontend/editor';
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';

describe('the WAI-inspired native fixtures', () => {
  const schema = getSchema([Document, Paragraph, Text, TableKit, VerticalAlignment]);

  it.each(accessibilityExamples)('restores $id as a valid native table', example => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [example.value.table] });
    doc.check();
    expect(TableMap.get(doc.firstChild!).problems).toBeNull();
    expect(tableValue(doc.toJSON(), example.value as TableValue)?.caption).toBe(example.value.caption);
  });
});

describe('the one-table persistence boundary', () => {
  it('wraps a native table without changing its content', () => {
    expect(tableValue({ type: 'doc', content: [basic.table] }, null)).toEqual(basic);
  });

  it('retains metadata while replacing the native table value', () => {
    const previous: TableValue = { ...basic, version: 1, caption: 'Stock', description: 'Counts' };
    expect(tableValue({ type: 'doc', content: [basic.table] }, previous)).toEqual(previous);
  });

  it('allows only a genuinely empty document as an incomplete draft', () => {
    expect(tableValue({ type: 'doc', content: [] }, null)).toBeNull();
    expect(tableValue({ type: 'doc' }, null)).toBeNull();
    expect(() => tableValue({ type: 'paragraph' }, null)).toThrow();
  });

  it('rejects additional tables rather than dropping them', () => {
    expect(() => tableValue({ type: 'doc', content: [basic.table, basic.table] }, null)).toThrow();
  });

  it('rejects text-only documents and any paragraphs before or after a table', () => {
    for (const outside of [
      { type: 'paragraph', content: [{ type: 'text', text: 'Keep this' }] },
      { type: 'paragraph' },
    ]) {
      for (const content of [[outside], [outside, basic.table], [basic.table, outside]]) {
        expect(() => tableValue({ type: 'doc', content }, null)).toThrow();
      }
    }
  });
});

describe('header settings derived from native table nodes', () => {
  const schema = getSchema([Document, Paragraph, Text, TableKit, VerticalAlignment]);

  it('recognizes the four configurations without a stored mode flag', () => {
    for (const mode of ['none', 'row', 'column', 'both'] as const) {
      const table = structuredClone(basic.table);
      table.content.forEach((row, r) => row.content.forEach((cell, c) => {
        const header = ((mode === 'row' || mode === 'both') && r === 0)
          || ((mode === 'column' || mode === 'both') && c === 0);
        cell.type = header ? 'tableHeader' : 'tableCell';
      }));
      expect(headerConfiguration(schema.nodeFromJSON(table))).toBe(mode);
      expect(headerEdges(schema.nodeFromJSON(table))).toEqual({
        row: mode === 'row' || mode === 'both',
        column: mode === 'column' || mode === 'both',
      });
    }
  });

  it('reports individual interior headers as custom', () => {
    const table = structuredClone(basic.table);
    table.content[1].content[1].type = 'tableHeader';
    expect(headerConfiguration(schema.nodeFromJSON(table))).toBe('custom');
    expect(headerEdges(schema.nodeFromJSON(table))).toEqual({ row: true, column: false });
    table.content[1].content[0].type = 'tableHeader';
    expect(headerEdges(schema.nodeFromJSON(table))).toEqual({ row: true, column: true });
    table.content[0].content[1].type = 'tableCell';
    expect(headerEdges(schema.nodeFromJSON(table))).toEqual({ row: false, column: true });
  });

  it('uses logical columns when a header is merged', () => {
    const table: any = structuredClone(basic.table);
    table.content[0].content = [table.content[0].content[0]];
    table.content[0].content[0].attrs = { colspan: 2 };
    expect(headerConfiguration(schema.nodeFromJSON(table))).toBe('row');
    expect(headerEdges(schema.nodeFromJSON(table))).toEqual({ row: true, column: false });
  });

  it('registers vertical alignment on both native cell types', () => {
    for (const type of ['tableCell', 'tableHeader']) {
      const cell = schema.nodeFromJSON({ type, attrs: { verticalAlign: 'middle' }, content: [{ type: 'paragraph' }] });
      expect(cell.toJSON().attrs?.verticalAlign).toBe('middle');
      expect(cell.type.spec.attrs?.align).toBeDefined();
    }
  });
});

describe('alignment indicators for the native selection', () => {
  const schema = getSchema([Document, Paragraph, Text, TableKit, VerticalAlignment]);

  it('reads a cursor cell and distinguishes mixed from default alignment', () => {
    const table: any = structuredClone(basic.table);
    table.content[0].content[0].attrs = { align: 'right', verticalAlign: 'bottom' };
    const doc = schema.nodeFromJSON({ type: 'doc', content: [table] });
    const cells: number[] = [];
    doc.descendants((node, pos) => {
      if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') cells.push(pos);
    });
    const cursor = EditorState.create({ doc, selection: TextSelection.create(doc, cells[0] + 2) });
    expect(selectedCellAlignment(cursor)).toEqual({ align: 'right', verticalAlign: 'bottom' });
    const mixed = cursor.apply(cursor.tr.setSelection(CellSelection.create(doc, cells[0], cells[1])));
    expect(selectedCellAlignment(mixed)).toEqual({ align: undefined, verticalAlign: undefined });
    const defaults = cursor.apply(cursor.tr.setSelection(CellSelection.create(doc, cells[2], cells[3])));
    expect(selectedCellAlignment(defaults)).toEqual({ align: null, verticalAlign: null });
    const outside = cursor.apply(cursor.tr.setSelection(NodeSelection.create(doc, 0)));
    expect(selectedCellAlignment(outside)).toEqual({ align: undefined, verticalAlign: undefined });
  });

  it('reads uniform attributes from a range including a merged cell', () => {
    const table: any = structuredClone(basic.table);
    table.content[0].content = [table.content[0].content[0]];
    table.content[0].content[0].attrs = { colspan: 2, align: 'center', verticalAlign: 'middle' };
    for (const cell of table.content[1].content) cell.attrs = { align: 'center', verticalAlign: 'middle' };
    const doc = schema.nodeFromJSON({ type: 'doc', content: [table] });
    const cells: number[] = [];
    doc.descendants((node, pos) => {
      if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') cells.push(pos);
    });
    const state = EditorState.create({ doc, selection: CellSelection.create(doc, cells[0], cells[2]) });
    expect(selectedCellAlignment(state)).toEqual({ align: 'center', verticalAlign: 'middle' });
  });
});
