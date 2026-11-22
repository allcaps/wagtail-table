import { expect, test } from '@playwright/test';

test('quiet cells share one edit interaction and preserve native selection and unsaved values', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin/login/');
  await page.locator('input[name=username]').fill('editor');
  await page.locator('input[name=password]').fill('table-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/table-cell-content-comparison/');
  await page.getByRole('link', { name: 'Edit this page', exact: true }).click();
  const tables = page.locator('[data-wagtail-table]');
  // Direct text, direct rich text, a one-item choice, and a multi-item stream.
  for (const table of await tables.all()) {
    const cell = table.locator('[data-wagtail-cell]').first();
    const pencil = cell.locator('[data-cell-edit]');
    await expect(cell.locator('[data-cell-fields]')).toBeHidden();
    await expect(cell.locator('[data-cell-quiet]')).toBeVisible();
    await expect(cell.locator('[data-cell-quiet] input, [data-cell-quiet] button, [data-cell-quiet] a')).toHaveCount(0);
    await expect(pencil).toHaveAccessibleName(/Edit cell, row \d+, column \d+/);
    await pencil.focus();
    await page.keyboard.press('Enter');
    await expect(cell.locator('[data-cell-fields]')).toBeVisible();
    await expect(table.getByRole('button', { name: 'Row', exact: true })).toBeEnabled();
    await expect(table.locator('[data-cell-edit]').nth(1)).toBeEnabled();
    expect(await cell.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(300);
    const done = cell.getByRole('button', { name: 'Done', exact: true });
    await done.click();
    await expect(pencil).toBeFocused();
    await expect(cell.locator('[data-cell-quiet]')).not.toHaveAttribute('aria-busy', 'true');
    await expect(table.getByRole('button', { name: 'Row', exact: true })).toBeEnabled();
  }
  const table = tables.first();
  const cells = table.locator('td');
  const block = cells.first().locator('[data-wagtail-cell]');
  await block.locator('[data-cell-edit]').click();
  await block.locator('input[type=text]').fill('Preserved when switching');
  await cells.nth(1).locator('[data-cell-edit]').click();
  await expect(block.locator('[data-cell-fields]')).toBeHidden();
  await expect(block.locator('[data-cell-quiet]')).toHaveText('Preserved when switching');
  await expect(table.locator('[data-cell-fields]:visible')).toHaveCount(1);
  // A table action finishes editing without requiring Done first.
  await table.getByRole('button', { name: 'Row', exact: true }).click();
  await expect(table.locator('[data-cell-fields]:visible')).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Returning to a native text cell also finishes block editing and preserves typing.
  await block.locator('[data-cell-edit]').click();
  await table.locator('th p').first().click();
  await expect(block.locator('[data-cell-fields]')).toBeHidden();
  await page.keyboard.type(' Updated');
  await expect(table.locator('th p').first()).toContainText('Updated');
  // Dragging a range can finish an edit without losing the resulting selection.
  await block.locator('[data-cell-edit]').click();
  const dragStart = await cells.nth(1).boundingBox();
  const dragEnd = await cells.nth(2).boundingBox();
  await page.mouse.move(dragStart!.x + 10, dragStart!.y + 10);
  await page.mouse.down();
  await page.mouse.move(dragEnd!.x + 10, dragEnd!.y + 10, { steps: 12 });
  await page.mouse.up();
  await expect(block.locator('[data-cell-fields]')).toBeHidden();
  await expect(table.locator('.selectedCell')).toHaveCount(2);
  await cells.first().click({ clickCount: 3 });
  await expect(table.locator('.selectedCell')).toHaveCount(1);
  const first = await cells.first().boundingBox();
  const last = await cells.nth(2).boundingBox();
  await page.mouse.move(first!.x + 10, first!.y + 10);
  await page.mouse.down();
  await page.mouse.move(last!.x + 10, last!.y + 10, { steps: 12 });
  await page.mouse.up();
  await expect(table.locator('.selectedCell')).toHaveCount(3);
  await block.locator('[data-cell-edit]').click();
  await block.locator('input[type=text]').fill('Quiet current unsaved value');
  await block.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(block.locator('[data-cell-quiet]')).toHaveText('Quiet current unsaved value');
  const submitted = await table.locator(':scope > input[type=hidden]').inputValue();
  expect(submitted).not.toContain('"quiet"');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(tables.first().locator('[data-cell-quiet]').first()).toHaveText('Quiet current unsaved value');
  expect(errors).toEqual([]);
});
