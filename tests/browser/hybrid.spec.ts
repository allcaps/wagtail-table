import { expect, test, type Locator, type Page } from '@playwright/test';

async function addContent(page: Page, cell: Locator, name: string) {
  await cell.getByTitle('Insert a block', { exact: true }).last().click();
  await page.getByRole('option', { name, exact: true }).click();
}

test('inline rich text, image, and emoji share a cell and survive duplication and publication', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin/login/');
  await page.locator('input[name=username]').fill('editor');
  await page.locator('input[name=password]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Add a demo page' }).click();
  await page.locator('input[name=title]').fill('Hybrid browser');
  await page.getByTitle('Insert a block', { exact: true }).click();
  await page.getByRole('option', { name: 'Hybrid table', exact: true }).click();
  const widgets = page.locator('[data-wagtail-table]');
  const widget = widgets.first();
  const cellMenu = widget.getByRole('button', { name: 'Cell', exact: true });
  const row = widget.locator('.tiptap > .tableWrapper > table > tbody > tr').nth(1);
  const cell = row.locator(':scope > td').nth(1);
  await cell.locator('p').click();
  await cellMenu.click();
  await widget.getByRole('button', { name: 'Use Wagtail block', exact: true }).click();
  await expect(cell.locator('[data-wagtail-cell]')).toHaveCount(1);

  // Batch conversion confirms once, and cancellation preserves both content and selection.
  const batchCells = widget.locator('.tiptap > .tableWrapper > table > tbody > tr').last().locator(':scope > td');
  await batchCells.first().locator('p').click();
  await page.keyboard.type('Content to replace');
  await batchCells.first().click({ position: { x: 3, y: 3 } });
  await batchCells.last().click({ position: { x: 3, y: 3 }, modifiers: ['Shift'] });
  await expect(widget.locator('.selectedCell')).toHaveCount(3);
  await cellMenu.click();
  const beforeConversion = await widget.locator(':scope > input[type=hidden]').inputValue();
  page.once('dialog', async dialog => {
    expect(dialog.message()).toBe('This destroys the contents of the selected cells, are you sure?');
    await dialog.dismiss();
  });
  await widget.getByRole('button', { name: 'Use Wagtail block', exact: true }).click();
  await expect(widget.locator(':scope > input[type=hidden]')).toHaveValue(beforeConversion);
  await expect(widget.locator('.selectedCell')).toHaveCount(3);
  page.once('dialog', dialog => dialog.accept());
  await widget.getByRole('button', { name: 'Use Wagtail block', exact: true }).click();
  await expect(batchCells.locator('[data-wagtail-cell]')).toHaveCount(3);
  await cellMenu.click();
  await widget.getByRole('button', { name: 'Use text', exact: true }).click();
  await expect(batchCells.locator('[data-wagtail-cell]')).toHaveCount(0);
  await expect(batchCells.locator('p')).toHaveText(['', '', '']);
  await cell.locator('[data-wagtail-cell]').click({ position: { x: 3, y: 3 } });

  await addContent(page, cell, 'Rich text');
  const rich = cell.locator('.Draftail-Editor [contenteditable=true]');
  await rich.click();
  await page.keyboard.type('Helpful hybrid details');
  await expect(rich).toHaveText('Helpful hybrid details');
  await addContent(page, cell, 'Emoji');
  await cell.locator('select').selectOption('✅');
  await addContent(page, cell, 'Image');
  await cell.getByRole('button', { name: 'Choose an image', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-chooser-modal-choice]').filter({ hasText: 'Browser sample' }).click();
  await expect(dialog).toBeHidden();
  await cell.getByLabel('Alt text', { exact: true }).fill('Green sample for table');
  await expect(cell.locator('[data-streamfield-child]:not([aria-hidden=true])')).toHaveCount(3);

  // Native table paste must not overwrite the cell's Wagtail content.
  await row.locator(':scope > td').first().click();
  await row.locator(':scope > td').last().click({ modifiers: ['Shift'] });
  await cellMenu.click();
  await expect(widget.getByRole('button', { name: 'Merge cells', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  const before = await widget.locator(':scope > input[type=hidden]').inputValue();
  await widget.evaluate(root => {
    const data = new DataTransfer();
    data.setData('text/plain', 'A\tB\tC');
    root.querySelector('.tiptap')!.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: data, bubbles: true, cancelable: true,
    }));
  });
  await expect(widget.locator(':scope > input[type=hidden]')).toHaveValue(before);
  await expect(widget.locator('[data-table-status]')).toContainText('block cells');

  await widget.locator('xpath=ancestor::*[@data-streamfield-child][1]')
    .getByTitle('Duplicate', { exact: true }).first().click();
  await expect(widgets).toHaveCount(2);
  await expect(widgets.last().locator('.Draftail-Editor [contenteditable=true]')).toHaveText('Helpful hybrid details');
  await widgets.last().locator('select').selectOption('⭐');
  await expect(widget.locator('select')).toHaveValue('✅');
  const ids = await widgets.evaluateAll(roots => roots.flatMap(root =>
    [...root.querySelectorAll('[id]')].map(el => el.id)));
  expect(new Set(ids).size).toBe(ids.length);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(widgets).toHaveCount(2);
  for (const table of await widgets.all()) {
    await expect(table.locator('.Draftail-Editor [contenteditable=true]')).toHaveText('Helpful hybrid details');
  }
  await expect(widgets.last().locator('select')).toHaveValue('⭐');
  await expect(widgets.first().getByLabel('Alt text', { exact: true })).toHaveValue('Green sample for table');
  await page.getByRole('navigation', { name: 'Actions (footer)' })
    .getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.goto('/hybrid-browser/');
  await expect(page.locator('table')).toHaveCount(2);
  await expect(page.getByText('Helpful hybrid details', { exact: true })).toHaveCount(2);
  await expect(page.getByAltText('Green sample for table')).toHaveCount(2);
  await expect.poll(() => page.getByAltText('Green sample for table').first()
    .evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
