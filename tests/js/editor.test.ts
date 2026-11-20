import { describe, expect, it } from 'vitest';
import { tableValue, type TableValue } from '../../frontend/editor';
import basic from '../fixtures/basic.json';

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
