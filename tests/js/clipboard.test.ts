import { describe, expect, it } from 'vitest';
import { parseTSV } from '../../frontend/clipboard';

describe('tab-separated clipboard data', () => {
  it('leaves ordinary prose and single-column multiline text as prose', () => {
    expect(parseTSV('ordinary text')).toBeNull();
    expect(parseTSV('first\nsecond')).toBeNull();
  });
  it('handles spreadsheet CRLF and one terminating newline', () => {
    expect(parseTSV('A\tB\r\nC\tD\r\n')).toEqual([['A', 'B'], ['C', 'D']]);
  });
  it('preserves empty fields, trailing columns, and interior empty rows', () => {
    expect(parseTSV('\tB\t\n\nC\t\t')).toEqual([['', 'B', ''], ['', '', ''], ['C', '', '']]);
  });
  it('pads a ragged plain-text range to a rectangle', () => {
    expect(parseTSV('A\tB\nC')).toEqual([['A', 'B'], ['C', '']]);
  });
  it('handles quoted tabs, newlines, and doubled quotes', () => {
    expect(parseTSV('"a\tb"\t"a\nline"\n"say ""hi"""\tx')).toEqual([
      ['a\tb', 'a\nline'], ['say "hi"', 'x'],
    ]);
  });
  it('retains quotes inside unquoted text and treats formulas as text', () => {
    expect(parseTSV('12"\t=SUM(A1:A2)')).toEqual([['12"', '=SUM(A1:A2)']]);
  });
  it('rejects incomplete quoting rather than falling back to destructive paste', () => {
    expect(() => parseTSV('"unfinished\tfield')).toThrow();
    expect(() => parseTSV('"quoted"extra\tfield')).toThrow();
  });
  it('bounds raw text, dimensions, and total grid size', () => {
    expect(() => parseTSV('x'.repeat(2_000_001))).toThrow(RangeError);
    expect(() => parseTSV(Array(101).fill('x').join('\t'))).toThrow(RangeError);
    expect(() => parseTSV(Array(1001).fill('a\tb').join('\n'))).toThrow(RangeError);
    expect(() => parseTSV(Array(101).fill(Array(100).fill('x').join('\t')).join('\n'))).toThrow(RangeError);
  });
});
