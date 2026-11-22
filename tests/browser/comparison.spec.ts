import { expect, test } from '@playwright/test';

test('comparison page restores and saves native and Tiptap table editors together', async ({ page }) => {
  await page.goto('/admin/login/');
  await page.locator('input[name=username]').fill('editor');
  await page.locator('input[name=password]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/table-editor-comparison/');
  await expect(page.locator('table')).toHaveCount(10);
  await expect(page.locator('[data-comparison-block=legacy_table]')).toHaveCount(2);
  await expect(page.locator('[data-comparison-block=typed_table]')).toHaveCount(3);
  await expect(page.locator('[data-comparison-block=research_hybrid_table]')).toHaveCount(3);
  await page.getByRole('link', { name: 'Edit this page', exact: true }).click();
  await expect(page.locator('[data-wagtail-table]')).toHaveCount(5);
  const legacy = page.locator('#body-3-value-handsontable-container');
  await legacy.locator('.ht_master tbody tr').nth(1).locator('td').first().dblclick();
  await legacy.locator('textarea.handsontableInput:visible').fill('Native apples');
  await page.keyboard.press('Enter');
  await page.locator('input[name=body-5-value-cell-0-0]').fill('Typed apples');
  const text = page.locator('#body-7-value').locator('..').locator('.tiptap');
  await text.locator('td p').first().click();
  await page.keyboard.type(' Edited');
  const hybrid = page.locator('#body-23-value').locator('..');
  const nestedInput = hybrid.locator('[data-wagtail-cell] input[type=text]').first();
  await nestedInput.fill('Updated hybrid details');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(legacy.locator('.ht_master tbody')).toContainText('Native apples');
  await expect(page.locator('input[name=body-5-value-cell-0-0]')).toHaveValue('Typed apples');
  await expect(text.locator('td p').first()).toContainText('Edited');
  await expect(nestedInput).toHaveValue('Updated hybrid details');
});

test('direct fields and one-item choices preserve native editing, duplication, and conversion', async ({ page }) => {
  await page.goto('/admin/login/');
  await page.locator('input[name=username]').fill('editor');
  await page.locator('input[name=password]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/table-cell-content-comparison/');
  await expect(page.locator('table')).toHaveCount(8);
  await page.getByRole('link', { name: 'Edit this page', exact: true }).click();
  const tables = page.locator('[data-wagtail-table]');
  await expect(tables).toHaveCount(4);
  const directText = tables.nth(0).locator('[data-wagtail-cell]').first();
  const directRich = tables.nth(1).locator('[data-wagtail-cell]').first();
  await expect(directText.locator('[data-streamfield-child]')).toHaveCount(0);
  await expect(directRich.locator('[data-streamfield-child]')).toHaveCount(0);
  await expect(tables.nth(2).locator('[data-wagtail-cell]').first()
    .locator('[data-streamfield-child]')).toHaveCount(1);
  await expect(tables.nth(3).locator('[data-wagtail-cell]').first()
    .locator('[data-streamfield-child]')).toHaveCount(2);
  await directText.locator('input[type=text]').fill('Direct field updated');
  await directRich.locator('[contenteditable=true]').click();
  await page.keyboard.type(' revised');
  await expect(directRich.locator('[contenteditable=true]')).toContainText('revised');
  await tables.nth(0).locator('xpath=ancestor::*[@data-streamfield-child][1]')
    .getByTitle('Duplicate', { exact: true }).first().click();
  await expect(tables).toHaveCount(5);
  await expect(tables.nth(1).locator('[data-wagtail-cell] input[type=text]').first())
    .toHaveValue('Direct field updated');
  await tables.nth(2).locator('xpath=ancestor::*[@data-streamfield-child][1]')
    .getByTitle('Duplicate', { exact: true }).first().click();
  await expect(tables).toHaveCount(6);
  await expect(tables.nth(3).locator('[data-wagtail-cell] [contenteditable=true]').first())
    .toContainText('revised');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(tables).toHaveCount(6);
  for (const index of [0, 1]) {
    await expect(tables.nth(index).locator('[data-wagtail-cell] input[type=text]').first())
      .toHaveValue('Direct field updated');
  }
  for (const index of [2, 3]) {
    await expect(tables.nth(index).locator('[data-wagtail-cell] [contenteditable=true]').first())
      .toContainText('revised');
  }
  // Conversion back to native text remains available for populated direct cells.
  const cell = tables.nth(1).locator('td').first();
  await cell.locator('input[type=text]').click();
  await tables.nth(1).getByRole('button', { name: 'Cell', exact: true }).click();
  page.once('dialog', async dialog => {
    expect(dialog.message()).toBe('This destroys the contents of the selected cells, are you sure?');
    await dialog.accept();
  });
  await tables.nth(1).getByRole('button', { name: 'Use text', exact: true }).click();
  await expect(cell.locator('[data-wagtail-cell]')).toHaveCount(0);
  await expect(cell.locator('p')).toHaveText('');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(cell.locator('[data-wagtail-cell]')).toHaveCount(0);
  await expect(tables.nth(0).locator('[data-wagtail-cell] input[type=text]').first())
    .toHaveValue('Direct field updated');
});
