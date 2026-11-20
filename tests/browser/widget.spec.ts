import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('panel buttons stay in the toolbar and open only one panel at a time', async ({ page }) => {
  await page.setContent('<form style="max-width: 320px"><div id="first"></div><div id="second"></div></form>');
  await page.addStyleTag({ path: resolve('src/wagtail_table/static/wagtail_table/table.css') });
  await page.evaluate(() => {
    (window as any).telepath = {
      register(_name: string, constructor: unknown) { (window as any).TableAdapter = constructor; },
    };
  });
  await page.addScriptTag({ path: resolve('src/wagtail_table/static/wagtail_table/table.js') });
  await page.evaluate(() => {
    const adapter = new (window as any).TableAdapter(
      '<div class="wagtail-table" data-wagtail-table><input type="hidden"><div data-table-toolbar></div><div data-table-editor></div><p data-table-error hidden></p></div>',
      { insert: 'Insert table', editor: 'Table contents', unsupported: 'Unsupported', invalid: 'Invalid' },
    );
    const first = adapter.render(document.querySelector('#first'), 'first', 'first', null);
    first.editor.commands.insertTable();
    adapter.render(document.querySelector('#second'), 'second', 'second', first.getState());
  });
  const first = page.locator('[data-wagtail-table]').first();
  const second = page.locator('[data-wagtail-table]').last();
  const toolbar = first.locator('[data-table-toolbar]');
  const actions = toolbar.getByRole('button', { name: 'Table actions', exact: true });
  const settings = toolbar.getByRole('button', { name: 'Table settings', exact: true });
  const actionPanel = first.locator('[data-table-actions]');
  const settingsPanel = first.locator('[data-table-settings]');
  const initialPosition = await actions.boundingBox();
  const initialValue = await first.locator('input[type="hidden"]').inputValue();
  await expect(actions).toHaveAttribute('aria-controls', 'first-actions-panel');
  await expect(actions).toHaveAttribute('aria-expanded', 'false');
  await expect(actionPanel).toBeHidden();
  await actions.click();
  await expect(actions).toBeVisible();
  await expect(settings).toBeVisible();
  await expect(actions).toHaveAttribute('aria-expanded', 'true');
  await expect(actions).not.toHaveCSS('box-shadow', 'none');
  await expect(actionPanel).toBeVisible();
  const cellButtons = first.locator('[data-table-cell-actions] button');
  await expect(cellButtons).toHaveText(['Merge cells', 'Split cell', 'Header cell']);
  const cellButtonTops = await cellButtons.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
  expect(new Set(cellButtonTops).size).toBe(1);
  expect(await actions.boundingBox()).toEqual(initialPosition);
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(settings).not.toHaveCSS('box-shadow', 'none');
  await expect(settingsPanel).toBeVisible();
  await expect(actionPanel).toBeHidden();
  await expect(actions).toHaveAttribute('aria-expanded', 'false');
  await expect(actions).toHaveCSS('box-shadow', 'none');
  await page.keyboard.press('Space');
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(settingsPanel).toBeHidden();
  await actions.click();
  await expect(actions).toHaveAttribute('aria-expanded', 'true');
  await expect(actionPanel).toBeVisible();
  await expect(settingsPanel).toBeHidden();
  await settings.click();
  await actions.click();
  await expect(settingsPanel).toBeHidden();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await actions.click();
  await expect(actions).toHaveAttribute('aria-expanded', 'false');
  await expect(actions).toHaveCSS('box-shadow', 'none');
  await expect(actionPanel).toBeHidden();
  await expect(second.getByRole('button', { name: 'Table actions', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(second.locator('[data-table-actions]')).toBeHidden();
  await expect(first.locator('input[type="hidden"]')).toHaveValue(initialValue);

  // Individual headers must not clear the active first-row/column indicators.
  await actions.click();
  const rowHeaders = first.getByRole('button', { name: 'First row headers', exact: true });
  const columnHeaders = first.getByRole('button', { name: 'First column headers', exact: true });
  await first.locator('td').last().click();
  await first.getByRole('button', { name: 'Header cell', exact: true }).click();
  await settings.click();
  await expect(rowHeaders).toHaveAttribute('aria-pressed', 'true');
  await expect(rowHeaders).not.toHaveCSS('box-shadow', 'none');
  await rowHeaders.click();
  await expect(rowHeaders).toHaveAttribute('aria-pressed', 'false');
  await rowHeaders.click();
  await expect(rowHeaders).toHaveAttribute('aria-pressed', 'true');
  await columnHeaders.click();
  await expect(columnHeaders).toHaveAttribute('aria-pressed', 'true');
  await expect(columnHeaders).not.toHaveCSS('box-shadow', 'none');
  await expect(rowHeaders).toHaveAttribute('aria-pressed', 'true');
});

test('native editor synchronization, independent state, and disposal', async ({ page }) => {
  await page.setContent('<form><div data-streamfield-child><div id="first"></div></div><div data-streamfield-child><div id="second"></div></div></form>');
  await page.evaluate(() => {
    (window as any).telepath = {
      register(_name: string, constructor: unknown) { (window as any).TableAdapter = constructor; },
    };
  });
  await page.addScriptTag({ path: resolve('src/wagtail_table/static/wagtail_table/table.js') });
  const results = await page.evaluate(async () => {
    const adapter = new (window as any).TableAdapter(
      '<div data-wagtail-table><input type="hidden"><div data-table-toolbar></div><div data-table-editor></div><p data-table-error hidden></p></div>',
      { insert: 'Insert table', editor: 'Table contents', unsupported: 'Unsupported', invalid: 'Invalid' },
    );
    let changes = 0;
    document.querySelector('form')!.addEventListener('change', () => changes++);
    const first = adapter.render(document.querySelector('#first'), 'first', 'first', null);
    const initialChanges = changes;
    first.editor.commands.insertTable();
    first.editor.commands.insertContentAt(4, 'Original');
    const saved = JSON.parse(first.getValue());
    const second = adapter.render(document.querySelector('#second'), 'second', 'second', first.getState());
    second.editor.commands.insertContentAt(4, 'Copy ');
    const original = first.editor.getText();
    const copied = second.editor.getText();
    const firstEditor = first.editor;
    const wrapper = first.root.closest('[data-streamfield-child]');
    wrapper.remove();
    document.querySelector('form')!.append(wrapper);
    await new Promise(resolve => setTimeout(resolve, 0));
    const reorderSurvived = !firstEditor.isDestroyed;
    const secondEditor = second.editor;
    second.root.closest('[data-streamfield-child]').setAttribute('aria-hidden', 'true');
    await new Promise(resolve => setTimeout(resolve, 0));
    const deletedDestroyed = secondEditor.isDestroyed;
    first.root.remove();
    await new Promise(resolve => setTimeout(resolve, 0));
    return { initialChanges, original, copied, saved, reorderSurvived, deletedDestroyed, removedDestroyed: firstEditor.isDestroyed };
  });
  expect(results.initialChanges).toBe(0);
  expect(results.original).not.toContain('Copy');
  expect(results.copied).toContain('Copy Original');
  expect(results.saved.table.content[0].content[0].content[0].content[0].text).toBe('Original');
  expect(results.reorderSurvived).toBe(true);
  expect(results.deletedDestroyed).toBe(true);
  expect(results.removedDestroyed).toBe(true);
});
