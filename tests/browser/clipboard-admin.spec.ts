import { expect, test } from '@playwright/test';
import { publishAndView, saveDraftAndReload } from './admin';

test('real clipboard TSV and HTML paste survive draft reload and publication', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:8009' });
  await page.goto('/admin/login/');
  await page.locator('input[name="username"]').fill('editor');
  await page.locator('input[name="password"]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Add a demo page' }).click();
  await page.locator('input[name="title"]').fill('Pasted table');
  await page.getByTitle('Insert a block', { exact: true }).click();
  await page.getByRole('option', { name: 'Table', exact: true }).click();
  const widgets = page.locator('[data-wagtail-table]');
  const widget = widgets.first();
  await expect(widget.locator('tr')).toHaveCount(3);
  await widget.locator('th p').first().click();
  await page.evaluate(() => navigator.clipboard.writeText('Product\tCount\nApples\t4\nPears\t9'));
  await page.keyboard.press('ControlOrMeta+V');
  await expect(widget.locator('tr').nth(1).locator('td').first()).toHaveText('Apples');
  await page.getByTitle('Insert a block', { exact: true }).last().click();
  await page.getByRole('option', { name: 'Table', exact: true }).click();
  const htmlWidget = widgets.nth(1);
  await htmlWidget.locator('th p').first().click();
  await page.evaluate(() => navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob(['<table><tr><th colspan="2">Notes</th></tr><tr><td>Fresh<br>green</td><td>5</td></tr></table>'], { type: 'text/html' }),
    'text/plain': new Blob(['Notes\nFresh green\t5'], { type: 'text/plain' }),
  })]));
  await page.keyboard.press('ControlOrMeta+V');
  await expect(htmlWidget.locator('th[colspan="2"]')).toHaveText('Notes');
  await expect(htmlWidget.locator('td').first().locator('br')).toHaveCount(1);
  await saveDraftAndReload(page);
  await expect(widget.locator('tr').nth(2).locator('td').first()).toHaveText('Pears');
  await expect(htmlWidget.locator('td').first().locator('br')).toHaveCount(1);
  await publishAndView(page, '/pasted-table/');
  await expect(page.locator('table')).toHaveCount(2);
  await expect(page.locator('table').first().locator('tr').nth(1).locator('td')).toHaveText(['Apples', '4', '']);
  await expect(page.locator('table').nth(1).locator('th[colspan="2"]')).toHaveText('Notes');
  await expect(page.locator('table').nth(1).locator('td').first().locator('br')).toHaveCount(1);
});
