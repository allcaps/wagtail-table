import { expect, test } from '@playwright/test';
import { saveDraftAndReload } from './admin';

test('native table operations, headers, alignment, and metadata survive publishing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin/login/');
  await page.locator('input[name="username"]').fill('editor');
  await page.locator('input[name="password"]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Add a demo page' }).click();
  await page.locator('input[name="title"]').fill('Editing features');
  await page.getByTitle('Insert a block', { exact: true }).click();
  await page.getByRole('option', { name: 'Table', exact: true }).click();
  const widget = page.locator('[data-wagtail-table]');
  await expect(widget.locator('tr')).toHaveCount(3);
  const cells = widget.locator('th, td');
  await cells.nth(4).locator('p').fill('Keep this');
  await widget.getByRole('button', { name: 'Row', exact: true }).click();
  await widget.getByRole('button', { name: 'Add row after', exact: true }).click();
  await expect(widget.locator('tr')).toHaveCount(4);
  await widget.getByRole('button', { name: 'Column', exact: true }).click();
  await widget.getByRole('button', { name: 'Add column before', exact: true }).click();
  await expect(widget.locator('tr').first().locator('th,td')).toHaveCount(4);
  await widget.locator('.tiptap').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(widget.locator('tr').first().locator('th,td')).toHaveCount(3);
  await widget.locator('.tiptap').focus();
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expect(widget.locator('tr').first().locator('th,td')).toHaveCount(4);
  await widget.getByRole('button', { name: 'Column', exact: true }).click();
  await widget.getByRole('button', { name: 'Delete column', exact: true }).click();
  await expect(widget.locator('tr').first().locator('th,td')).toHaveCount(3);
  await widget.getByRole('button', { name: 'Row', exact: true }).click();
  await widget.getByRole('button', { name: 'Delete row', exact: true }).click();
  await expect(widget.locator('tr')).toHaveCount(3);

  // Native keyboard navigation must still work while our controls are mounted.
  await widget.locator('tr').nth(1).locator('td').first().locator('p').click();
  await page.keyboard.press('Tab');
  await page.keyboard.type('Aligned');
  await page.keyboard.press('Escape');
  await expect(widget.getByRole('button', { name: 'Row', exact: true })).toBeFocused();
  await widget.getByRole('button', { name: 'Column', exact: true }).click();
  await widget.getByRole('button', { name: 'First column headers', exact: true }).click();
  await expect(widget.locator('[data-table-command=toggleHeaderRow]')).toHaveAttribute('aria-pressed', 'true');
  await expect(widget.locator('[data-table-command=toggleHeaderColumn]')).toHaveAttribute('aria-pressed', 'true');
  await widget.getByRole('button', { name: 'Cell', exact: true }).click();
  await widget.getByRole('button', { name: 'Right', exact: true }).click();
  await widget.getByRole('button', { name: 'Cell', exact: true }).click();
  await widget.getByRole('button', { name: 'Bottom', exact: true }).click();
  await widget.getByLabel('Caption', { exact: true }).fill('Stock counts');
  await widget.getByLabel('Summary', { exact: true }).fill('Each row lists one product.');

  // Shift-click selects a native rectangle; our merge button preserves it.
  const dataRow = widget.locator('tr').nth(2);
  const merge = widget.locator('[data-table-command=mergeCells]');
  const split = widget.locator('[data-table-command=splitCell]');
  await dataRow.locator('td').first().click();
  await expect(merge).toBeDisabled();
  await expect(split).toBeDisabled();
  await expect(merge).toHaveCSS('opacity', '0.4');
  await dataRow.locator('td').last().click({ modifiers: ['Shift'] });
  await expect(merge).toBeEnabled();
  await expect(split).toBeDisabled();
  await widget.getByRole('button', { name: 'Cell', exact: true }).click();
  await widget.getByRole('button', { name: 'Merge cells', exact: true }).click();
  await expect(dataRow.locator('td[colspan="2"]')).toHaveCount(1);
  await expect(merge).toBeDisabled();
  await expect(split).toBeEnabled();
  await widget.getByRole('button', { name: 'Cell', exact: true }).click();
  await widget.getByRole('button', { name: 'Split cell', exact: true }).click();
  await expect(dataRow.locator('td')).toHaveCount(2);
  // Native split keeps the resulting cells selected, so they can be merged again.
  await expect(merge).toBeEnabled();
  await expect(split).toBeDisabled();
  await dataRow.locator('td').first().click();
  await expect(merge).toBeDisabled();
  await expect(split).toBeDisabled();

  await saveDraftAndReload(page);
  await expect(widget.getByLabel('Caption', { exact: true })).toHaveValue('Stock counts');
  await expect(widget.getByLabel('Summary', { exact: true })).toHaveValue('Each row lists one product.');
  await page.getByRole('navigation', { name: 'Actions (footer)' })
    .getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.goto('/editing-features/');
  await expect(page.locator('caption')).toHaveText('Stock counts');
  await expect(page.locator('thead')).toHaveCount(1);
  await expect(page.locator('th[scope="row"]')).toHaveCount(2);
  await expect(page.locator('td.wagtail-table-align-right.wagtail-table-valign-bottom')).toHaveCount(1);
  const descriptionId = await page.locator('table').getAttribute('aria-describedby');
  await expect(page.locator(`[id="${descriptionId}"]`)).toHaveText('Each row lists one product.');
  expect(errors).toEqual([]);
});
