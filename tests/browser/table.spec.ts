import { expect, test } from '@playwright/test';

test('starter tables save immediately; deleted tables remain empty drafts until restored', async ({ page }) => {
  await page.goto('/admin/login/');
  await page.locator('input[name="username"]').fill('editor');
  await page.locator('input[name="password"]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Add a demo page' }).click();
  await page.locator('input[name="title"]').fill('Starter table');
  await page.getByTitle('Insert a block', { exact: true }).click();
  await page.getByRole('option', { name: 'Table', exact: true }).click();
  const widget = page.locator('[data-wagtail-table]');
  const insert = widget.getByRole('button', { name: 'Insert table', exact: true });
  await expect(widget.locator('tr')).toHaveCount(3);
  await expect(widget.locator('th, td')).toHaveCount(9);
  await expect(insert).toBeHidden();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(3);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(widget.locator('th, td')).toHaveCount(9);
  await expect(insert).toBeHidden();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(3);

  await widget.locator('th p').first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await expect(widget.locator('table')).toHaveCount(0);
  await expect(insert).toBeVisible();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(0);
  await expect(widget.locator('input[type="hidden"]')).toHaveValue('null');
  await page.keyboard.press('Escape');
  await expect(insert).toBeFocused();
  await widget.locator('.tiptap').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(widget.locator('th, td')).toHaveCount(9);
  await expect(insert).toBeHidden();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(3);
  await widget.locator('.tiptap').focus();
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expect(widget.locator('table')).toHaveCount(0);
  await expect(insert).toBeVisible();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(widget.locator('table')).toHaveCount(0);
  await expect(insert).toBeVisible();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Actions (footer)' })
    .getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('This field is required.', { exact: true })).toBeVisible();
  await expect(widget.locator('table')).toHaveCount(0);
  await expect(insert).toBeVisible();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(0);

  await insert.click();
  await expect(widget.locator('th, td')).toHaveCount(9);
  await expect(insert).toBeHidden();
  await expect(widget.locator('[data-table-menu]:visible')).toHaveCount(3);
  await page.getByRole('navigation', { name: 'Actions (footer)' })
    .getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.goto('/starter-table/');
  await expect(page.locator('table')).toHaveCount(1);
  await expect(page.locator('th')).toHaveCount(3);
  await expect(page.locator('td')).toHaveCount(6);
});

test('create, duplicate, save, reload, and publish independent native tables', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin/login/');
  await page.getByLabel('Username').fill('editor');
  await page.locator('input[name="password"]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Add a demo page' }).click();
  await page.locator('input[name="title"]').fill('Browser table');
  await page.getByTitle('Insert a block', { exact: true }).click();
  await page.getByRole('option', { name: 'Table', exact: true }).click();
  const widgets = page.locator('[data-wagtail-table]');
  await expect(widgets.first().locator('tr')).toHaveCount(3);
  await expect(widgets.first().locator('th, td')).toHaveCount(9);
  await expect(widgets.first().getByRole('button', { name: 'Insert table' })).toBeHidden();
  const cells = widgets.first().locator('th, td');
  await cells.first().locator('p').fill('Original');
  await cells.nth(3).locator('p').fill('Saved immediately');

  await page.getByTitle('Duplicate', { exact: true }).click();
  await expect(widgets).toHaveCount(2);
  await expect(widgets.nth(1).locator('th').first()).toHaveText('Original');
  await widgets.nth(1).locator('th').first().locator('p').fill('Independent');
  await expect(widgets.first().locator('th').first()).toHaveText('Original');

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(widgets).toHaveCount(2);
  await expect(widgets.first().locator('th').first()).toHaveText('Original');
  await expect(widgets.nth(1).locator('th').first()).toHaveText('Independent');
  await expect(widgets.first().locator('td').first()).toHaveText('Saved immediately');

  await page.getByRole('navigation', { name: 'Actions (footer)' })
    .getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.goto('/browser-table/');
  await expect(page.locator('table')).toHaveCount(2);
  await expect(page.locator('table').first().locator('th').first()).toHaveText('Original');
  await expect(page.locator('table').nth(1).locator('th').first()).toHaveText('Independent');
  expect(errors).toEqual([]);
});
