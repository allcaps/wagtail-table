import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

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
