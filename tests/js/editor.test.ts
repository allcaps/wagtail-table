import { describe, expect, it } from 'vitest';
import { tableValue, type TableValue } from '../../frontend/editor';
import basic from '../fixtures/basic.json';
import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TableKit } from '@tiptap/extension-table';
import { VerticalAlignment } from '../../frontend/alignment';
import { headerConfiguration } from '../../frontend/editor';

describe('the one-table persistence boundary', () => {
  it('wraps a native table without changing its content', () => {
    expect(tableValue({ type: 'doc', content: [basic.table] }, null)).toEqual(basic);
  });

  it('retains metadata while replacing the native table value', () => {
    const previous: TableValue = { ...basic, version: 1, caption: 'Stock', description: 'Counts' };
    expect(tableValue({ type: 'doc', content: [basic.table] }, previous)).toEqual(previous);
  });

  it('ignores only empty top-level paragraphs', () => {
    expect(tableValue({ type: 'doc', content: [
      { type: 'paragraph' }, basic.table, { type: 'paragraph' },
    ] }, null)).toEqual(basic);
    expect(tableValue({ type: 'doc', content: [{ type: 'paragraph' }] }, null)).toBeNull();
  });

  it('rejects additional tables rather than dropping them', () => {
    expect(() => tableValue({ type: 'doc', content: [basic.table, basic.table] }, null)).toThrow();
  });

  it('rejects outside text rather than dropping it', () => {
    expect(() => tableValue({ type: 'doc', content: [basic.table,
      { type: 'paragraph', content: [{ type: 'text', text: 'Keep this' }] },
    ] }, null)).toThrow();
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
    }
  });

  it('reports individual interior headers as custom', () => {
    const table = structuredClone(basic.table);
    table.content[1].content[1].type = 'tableHeader';
    expect(headerConfiguration(schema.nodeFromJSON(table))).toBe('custom');
  });

  it('uses logical columns when a header is merged', () => {
    const table: any = structuredClone(basic.table);
    table.content[0].content = [table.content[0].content[0]];
    table.content[0].content[0].attrs = { colspan: 2 };
    expect(headerConfiguration(schema.nodeFromJSON(table))).toBe('row');
  });

  it('registers vertical alignment on both native cell types', () => {
    for (const type of ['tableCell', 'tableHeader']) {
      const cell = schema.nodeFromJSON({ type, attrs: { verticalAlign: 'middle' }, content: [{ type: 'paragraph' }] });
      expect(cell.toJSON().attrs?.verticalAlign).toBe('middle');
      expect(cell.type.spec.attrs?.align).toBeDefined();
    }
  });
});
