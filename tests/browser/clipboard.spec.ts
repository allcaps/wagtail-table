import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Exercise the real ProseMirror DOM paste pipeline. These fixtures represent
// formats; they are not captures proving interoperability with external apps.
test.beforeEach(async ({ page }) => {
  await page.setContent('<form><div id="mount"></div></form>');
  await page.evaluate(() => {
    (window as any).telepath = { register(_name: string, ctor: unknown) { (window as any).TableAdapter = ctor; } };
  });
  await page.addScriptTag({ path: resolve('src/wagtail_table/static/wagtail_table/table.js') });
  await page.evaluate(() => {
    const adapter = new (window as any).TableAdapter(
      '<div data-wagtail-table><input type="hidden"><div data-table-toolbar></div><div data-table-editor></div><p data-table-error hidden></p></div>',
      { insert: 'Insert table', editor: 'Contents', unsupported: 'Unsupported', invalid: 'Invalid' },
    );
    (window as any).pasteWidget = adapter.render(document.querySelector('#mount'), 'paste', 'paste', null);
  });
});

async function paste(page: Page, data: { text?: string; html?: string }) {
  await page.evaluate(data => {
    const clipboard = new DataTransfer();
    if (data.text !== undefined) clipboard.setData('text/plain', data.text);
    if (data.html !== undefined) clipboard.setData('text/html', data.html);
    (window as any).pasteWidget.editor.view.dom.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: clipboard, bubbles: true, cancelable: true,
    }));
  }, data);
}

async function selectCells(page: Page, first: number, last?: number) {
  await page.evaluate(({ first, last }) => {
    const editor = (window as any).pasteWidget.editor;
    const cells: number[] = [];
    editor.state.doc.descendants((node: any, position: number) => {
      if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') cells.push(position);
    });
    if (last === undefined) editor.commands.setTextSelection(cells[first] + 2);
    else editor.commands.setCellSelection({ anchorCell: cells[first], headCell: cells[last] });
  }, { first, last });
}

async function value(page: Page) {
  return page.evaluate(() => (window as any).pasteWidget.getValue());
}

test('TSV, ordinary prose, table growth, and native undo/redo', async ({ page }) => {
  await paste(page, { text: 'prose before insertion' });
  expect(await value(page)).toBe('null');
  await expect(page.getByRole('status')).toContainText('Insert a table');
  await paste(page, { text: 'A\tB\t\r\nC\tD\t\r\n' });
  await expect(page.locator('tr')).toHaveCount(2);
  await expect(page.locator('tr').first().locator('td')).toHaveText(['A', 'B', '']);
  await selectCells(page, 0);
  await paste(page, { text: 'Plain\ntext' });
  await expect(page.locator('td').first().locator('p')).toHaveCount(2);
  await selectCells(page, 5);
  await paste(page, { html: '<table><tr><td>X</td><td>Y</td></tr><tr><td>Z</td><td>W</td></tr></table>' });
  await expect(page.locator('tr')).toHaveCount(3);
  await expect(page.locator('tr').last().locator('td')).toHaveCount(4);
  await expect(page.locator('td').first()).toContainText('Plain');
  const beforeUndo = await value(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await value(page)).not.toBe(beforeUndo);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await value(page)).toBe(beforeUndo);
});

test('selected ranges retain native clipping/repetition and merged-cell behavior', async ({ page }) => {
  await page.getByRole('button', { name: 'Insert table', exact: true }).click();
  await selectCells(page, 0, 1);
  await paste(page, { text: 'A\tB\tC' });
  await expect(page.locator('tr').first().locator('td,th')).toHaveText(['A', 'B', '']);
  await expect(page.getByRole('status')).toContainText('larger ranges are clipped');
  await selectCells(page, 0, 2);
  await paste(page, { text: 'A\tB' });
  await expect(page.locator('tr').first().locator('td')).toHaveText(['A', 'B', 'A']);
  await selectCells(page, 0, 1);
  await page.evaluate(() => (window as any).pasteWidget.editor.commands.mergeCells());
  await selectCells(page, 0);
  await paste(page, { html: '<table><tr><td>X</td><td>Y</td></tr><tr><td>Z</td><td>W</td></tr></table>' });
  await expect(page.locator('tr').first().locator('td')).toHaveText(['X', 'Y', 'A']);
  await expect(page.getByRole('status')).toContainText('merged cells');
  await selectCells(page, 0);
  await paste(page, { html: '<table><tr><th colspan="2">Group</th></tr><tr><td>C</td><td>D</td></tr></table>' });
  await expect(page.locator('th[colspan="2"]')).toHaveText('Group');
});

test('unsupported and oversized pastes do not clear a selected range', async ({ page }) => {
  await paste(page, { text: 'KEEP\tTHIS\nAND\tTHAT' });
  await selectCells(page, 0, 1);
  const before = await value(page);
  for (const data of [
    { html: '<table><tr><td>outer<table><tr><td>nested</td></tr></table></td></tr></table>' },
    { html: '<p>surrounding text</p><table><tr><td>new</td></tr></table>' },
    { html: '<table><tr><td>one</td></tr></table><table><tr><td>two</td></tr></table>' },
    { html: '<table><tr><td rowspan="0">invalid</td></tr></table>' },
    { text: '"unfinished\tfield' },
    { text: Array(101).fill('wide').join('\t') },
  ]) {
    await paste(page, data);
    expect(await value(page)).toBe(before);
    await expect(page.getByRole('status')).toContainText('not changed');
  }
  expect(await page.evaluate(() => {
    const e = (window as any).pasteWidget.editor;
    return {
      outside: e.schema.nodes.doc.contentMatch.matchType(e.schema.nodes.paragraph),
      nested: e.schema.nodes.tableCell.contentMatch.matchType(e.schema.nodes.table),
    };
  })).toEqual({ outside: null, nested: null });
});

test('HTML formats preserve text, line breaks, and supported alignment only', async ({ page }) => {
  await paste(page, { html: readFileSync('tests/fixtures/clipboard/office-like.html', 'utf8') });
  await expect(page.locator('tr')).toHaveCount(2);
  await expect(page.locator('td').nth(2).locator('br')).toHaveCount(1);
  expect(await value(page)).toContain('hardBreak');
  await selectCells(page, 0);
  await paste(page, { html: readFileSync('tests/fixtures/clipboard/sheets-like.html', 'utf8') });
  await expect(page.locator('tr').first().locator('td')).toHaveText(['Apples', '4']);
  await selectCells(page, 0);
  await paste(page, { html: '<table><tr><td class="wagtail-table-align-center wagtail-table-valign-bottom" onclick="bad()"><a href="javascript:bad()">Safe</a><script>window.pasteExecuted=true</script><img src=x onerror="bad()"></td></tr></table>' });
  const saved = await value(page);
  expect(saved).toContain('Safe');
  expect(saved).toContain('"verticalAlign":"bottom"');
  expect(saved).toContain('"align":"center"');
  expect(saved).not.toMatch(/onclick|javascript:|onerror|<script/);
  expect(await page.evaluate(() => (window as any).pasteExecuted)).toBeUndefined();
});
