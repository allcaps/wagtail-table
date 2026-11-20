import { expect, test } from '@playwright/test';
import { widgetArguments } from './widget-template';

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login/');
  await page.locator('input[name="username"]').fill('editor');
  await page.locator('input[name="password"]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Add a demo page' }).click();
  await page.locator('input[name="title"]').fill('Menu checks');
  await page.getByTitle('Insert a block', { exact: true }).click();
  await page.getByRole('option', { name: 'Table', exact: true }).click();
});

test('native Wagtail menus switch, dismiss, and keep metadata visible', async ({ page }) => {
  const widget = page.locator('[data-wagtail-table]');
  const column = widget.getByRole('button', { name: 'Column', exact: true });
  const row = widget.getByRole('button', { name: 'Row', exact: true });
  await expect(widget.locator('[data-table-menu] > .w-dropdown__toggle'))
    .toHaveText(['Row', 'Column', 'Cell']);
  await expect(widget.getByLabel('Caption', { exact: true })).toBeVisible();
  await expect(widget.getByLabel('Summary', { exact: true })).toBeVisible();
  await expect(widget.getByLabel('Caption', { exact: true }))
    .toHaveAccessibleDescription('Identifies the overall topic of a table and is useful in most situations.');
  await expect(widget.getByLabel('Summary', { exact: true }))
    .toHaveAccessibleDescription('Provides orientation or navigation hints in complex tables.');
  const before = await widget.locator('input[type=hidden]').inputValue();
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(widget.getByRole('button', { name: 'First row headers', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await row.click();
  await column.click();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(column).toHaveAttribute('aria-expanded', 'true');
  await widget.getByLabel('Caption', { exact: true }).click();
  await expect(column).toHaveAttribute('aria-expanded', 'false');
  await expect(widget.locator('input[type=hidden]')).toHaveValue(before);

  const rowHeader = widget.locator('[data-table-menu=row] [data-table-command=toggleHeaderRow]');
  const columnHeader = widget.locator('[data-table-menu=column] [data-table-command=toggleHeaderColumn]');
  await row.click();
  await expect(rowHeader).toHaveAttribute('aria-pressed', 'true');
  await rowHeader.click();
  await expect(widget.locator('th')).toHaveCount(0);
  await row.click();
  await expect(rowHeader).toHaveAttribute('aria-pressed', 'false');
  await rowHeader.click();
  await column.click();
  await expect(columnHeader).toHaveAttribute('aria-pressed', 'false');
  await columnHeader.click();
  await column.click();
  await expect(columnHeader).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 480, height: 720 });
  await widget.getByRole('button', { name: 'Cell', exact: true }).click();
  const menu = widget.locator('[data-table-menu=cell] [data-w-dropdown-target=content]');
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(480);
  expect(bounds!.height).toBeLessThanOrEqual(720);
});

test('alignment groups expose icons, tooltips, and keyboard actions', async ({ page }) => {
  const widget = page.locator('[data-wagtail-table]');
  await widget.locator('td p').first().click();
  const cellMenu = widget.getByRole('button', { name: 'Cell', exact: true });
  await cellMenu.click();
  const horizontal = widget.getByRole('group', { name: 'Horizontal alignment', exact: true });
  const vertical = widget.getByRole('group', { name: 'Vertical alignment', exact: true });
  await expect(horizontal.getByRole('button')).toHaveCount(4);
  await expect(vertical.getByRole('button')).toHaveCount(4);
  await expect(horizontal.getByRole('button').last()).toHaveText('Clear');
  await expect(vertical.getByRole('button').last()).toHaveText('Clear');
  for (const alignment of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
    await expect(page.locator(`#icon-wagtail-table-align-${alignment}`)).toHaveCount(1);
  }
  await horizontal.getByRole('button', { name: 'Left', exact: true }).focus();
  await expect(horizontal.getByRole('button', { name: 'Left', exact: true })).toBeFocused();
  await expect(page.getByRole('tooltip', { name: 'Left', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(horizontal.getByRole('button', { name: 'Center', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(cellMenu).toHaveAttribute('aria-expanded', 'false');
  await expect(widget.locator('.tiptap')).toBeFocused();
  const saved = JSON.parse(await widget.locator('input[type=hidden]').inputValue());
  expect(saved.table.content[1].content[0].attrs.align).toBe('center');
  await cellMenu.click();
  await horizontal.getByRole('button', { name: 'Right', exact: true }).hover();
  await expect(page.getByRole('tooltip', { name: 'Right', exact: true })).toBeVisible();
  await horizontal.getByRole('button', { name: 'Right', exact: true }).focus();
  await page.keyboard.press('Tab');
  const clear = horizontal.getByRole('button', { name: 'Clear', exact: true });
  await expect(clear).toBeFocused();
  expect(await clear.getAttribute('aria-pressed')).toBeNull();
  await expect(page.getByRole('tooltip', { name: 'Clear to use the default', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  const cleared = JSON.parse(await widget.locator('input[type=hidden]').inputValue());
  expect(cleared.table.content[1].content[0].attrs.align).toBeNull();
  await cellMenu.click();
  await expect(horizontal.locator('[aria-pressed=true]')).toHaveCount(0);
  await clear.focus();
  await page.keyboard.press('Escape');
  await expect(cellMenu).toBeFocused();
});

test('cell alignment handles mixed ranges, defaults, headers, and merged cells', async ({ page }) => {
  const widget = page.locator('[data-wagtail-table]');
  const cellMenu = widget.getByRole('button', { name: 'Cell', exact: true });
  const rows = widget.locator('tr');
  await rows.nth(0).locator('th').first().click();
  await rows.nth(1).locator('td').nth(1).click({ modifiers: ['Shift'] });
  await cellMenu.click();
  await widget.getByRole('button', { name: 'Right', exact: true }).click();
  await expect(widget.locator('.selectedCell')).toHaveCount(4);
  let saved = JSON.parse(await widget.locator('input[type=hidden]').inputValue());
  expect(saved.table.content.slice(0, 2).flatMap((row: any) => row.content.slice(0, 2))
    .map((cell: any) => cell.attrs.align)).toEqual(['right', 'right', 'right', 'right']);
  expect(saved.table.content[2].content.every((cell: any) => cell.attrs.align === null)).toBe(true);

  await rows.nth(1).locator('td').first().click();
  await cellMenu.click();
  await widget.getByRole('button', { name: 'Left', exact: true }).click();
  await rows.nth(0).locator('th').first().click();
  await rows.nth(1).locator('td').nth(1).click({ modifiers: ['Shift'] });
  await cellMenu.click();
  await expect(widget.locator('[data-table-align][aria-pressed=true]')).toHaveCount(0);
  await widget.getByRole('button', { name: 'Right', exact: true }).click();
  await cellMenu.click();
  await expect(widget.getByRole('button', { name: 'Right', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await widget.getByRole('group', { name: 'Horizontal alignment', exact: true }).getByRole('button', { name: 'Clear', exact: true }).click();
  await cellMenu.click();
  await widget.getByRole('button', { name: 'Bottom', exact: true }).click();
  await cellMenu.click();
  await widget.getByRole('group', { name: 'Vertical alignment', exact: true }).getByRole('button', { name: 'Clear', exact: true }).click();
  saved = JSON.parse(await widget.locator('input[type=hidden]').inputValue());
  expect(saved.table.content.slice(0, 2).flatMap((row: any) => row.content.slice(0, 2))
    .every((cell: any) => cell.attrs.align === null && cell.attrs.verticalAlign === null)).toBe(true);

  await rows.nth(1).locator('td').first().click();
  await rows.nth(1).locator('td').nth(1).click({ modifiers: ['Shift'] });
  await cellMenu.click();
  await widget.getByRole('button', { name: 'Merge cells', exact: true }).click();
  await expect(rows.nth(1).locator('td[colspan="2"]')).toHaveCount(1);
  await cellMenu.click();
  await widget.getByRole('button', { name: 'Middle', exact: true }).click();
  saved = JSON.parse(await widget.locator('input[type=hidden]').inputValue());
  expect(saved.table.content[1].content[0].attrs.verticalAlign).toBe('middle');
  expect(saved.table.content[1].content[1].attrs.verticalAlign).toBeNull();
});

test('duplicated widgets and deleted-block dropdowns have independent lifecycles', async ({ page }) => {
  await page.getByTitle('Duplicate', { exact: true }).click();
  const widgets = page.locator('[data-wagtail-table]');
  await expect(widgets).toHaveCount(2);
  const first = widgets.first();
  const second = widgets.last();
  await first.getByRole('button', { name: 'Cell', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Cell', exact: true })).not.toHaveAttribute('aria-expanded', 'true');
  expect(await first.getByLabel('Caption', { exact: true }).getAttribute('id'))
    .not.toBe(await second.getByLabel('Caption', { exact: true }).getAttribute('id'));
  await first.evaluate(root => {
    (window as any).removedDropdowns = [...root.querySelectorAll('[data-table-menu]')]
      .map(menu => (window as any).wagtail.app.getControllerForElementAndIdentifier(menu, 'w-dropdown'));
    (window as any).removedTooltips = [...root.querySelectorAll('[data-controller="w-tooltip"]')]
      .map(button => (window as any).wagtail.app.getControllerForElementAndIdentifier(button, 'w-tooltip'));
  });
  await first.locator('xpath=ancestor::*[@data-streamfield-child][1]').getByTitle('Delete', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).removedDropdowns.every((controller: any) => controller.tippy.state.isDestroyed))).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).removedTooltips.every((controller: any) => controller.tippy.state.isDestroyed))).toBe(true);
  await second.getByRole('button', { name: 'Row', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Row', exact: true })).toHaveAttribute('aria-expanded', 'true');

  // Use the documented widget API to restore an invalid saved value. It must not
  // create a fresh table or leave an actionable menu open.
  await second.evaluate((root, args) => {
    const adapter = (window as any).telepath.unpack({ _type: 'wagtail_table.TableInput', _args: args });
    const input = root.querySelector('input')!;
    adapter.getByName(input.name, root).setState('{invalid saved JSON');
  }, widgetArguments);
  await expect(second.locator('[data-table-menu]:visible')).toHaveCount(0);
  await expect(second.getByRole('button', { name: 'Insert table', exact: true })).toBeVisible();
  await expect(second.getByRole('button', { name: 'Insert table', exact: true })).toBeDisabled();
  await expect(second.locator('input[type=hidden]')).toHaveValue('{invalid saved JSON');
  await expect(second.locator('[data-table-error]')).toBeVisible();
});
