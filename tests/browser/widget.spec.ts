import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { widgetArguments } from './widget-template';

const wagtailScripts = execFileSync('.venv/bin/python', ['-c',
  'from pathlib import Path; import wagtail; print(Path(wagtail.__file__).parent / "admin/static/wagtailadmin/js")',
], { encoding: 'utf8' }).trim();

test('native editor synchronization, independent state, and disposal', async ({ page }) => {
  await page.setContent('<form><div data-streamfield-child><div id="first"></div></div><div data-streamfield-child><div id="second"></div></div></form>');
  await page.evaluate(() => {
    (window as any).telepath = {
      register(_name: string, constructor: unknown) { (window as any).TableAdapter = constructor; },
    };
  });
  await page.addScriptTag({ path: resolve('src/wagtail_table/static/wagtail_table/table.js') });
  const results = await page.evaluate(async args => {
    const adapter = new (window as any).TableAdapter(...args);
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
  }, widgetArguments);
  expect(results.initialChanges).toBe(0);
  expect(results.original).not.toContain('Copy');
  expect(results.copied).toContain('Copy Original');
  expect(results.saved.table.content[0].content[0].content[0].content[0].text).toBe('Original');
  expect(results.reorderSurvived).toBe(true);
  expect(results.deletedDestroyed).toBe(true);
  expect(results.removedDestroyed).toBe(true);
});

test('native Draftail values flush before duplication and immediate form submission', async ({ page }) => {
  await page.setContent('<form><div id="first"></div><div id="second"></div></form>');
  await page.evaluate(() => {
    const browser = window as any;
    browser.gettext = (text: string) => text;
    browser.ngettext = (singular: string, plural: string, count: number) => count === 1 ? singular : plural;
    browser.Registry = {};
    browser.telepath = { register(name: string, constructor: unknown) { browser.Registry[name] = constructor; } };
  });
  for (const script of ['vendor/jquery-3.6.0.min.js', 'vendor.js', 'draftail.js']) {
    await page.addScriptTag({ path: resolve(wagtailScripts, script) });
  }
  await page.addScriptTag({ path: resolve('src/wagtail_table/static/wagtail_table/table.js') });
  const result = await page.evaluate(args => {
    const browser = window as any;
    const raw = JSON.stringify({ blocks: [{ key: 'test1', text: 'Helpful hybrid details',
      type: 'unstyled', depth: 0, inlineStyleRanges: [], entityRanges: [], data: {},
    }], entityMap: {} });
    // Make the native debounce deliberately long. Correctness must not depend
    // on how quickly an editor duplicates a table and submits the page.
    const draftail = new browser.Registry['wagtail.widgets.DraftailRichTextArea']({
      blockTypes: [], inlineStyles: [], entityTypes: [], stateSaveInterval: 60_000,
    });
    const block = { defaultValue: 'null', defaultState: 'null', definition: {
      render(mount: HTMLElement, prefix: string, state: unknown) {
        return draftail.render(mount, prefix, prefix, state);
      },
    } };
    const adapter = new browser.Registry['wagtail_table.TableInput'](args[0], args[1], block);
    const value = { version: 2, caption: '', description: '', table: { type: 'table', content: [
      { type: 'tableRow', content: [{ type: 'tableCell', content: [
        { type: 'wagtailBlock', attrs: { value: raw, state: raw } },
      ] }] },
    ] } };
    const first = adapter.render(document.querySelector('#first'), 'first', 'first', value);
    const second = adapter.render(document.querySelector('#second'), 'second', 'second', first.getState());
    browser.draftailCopy = second;
    const before = second.root.querySelector('[data-wagtail-cell] input').value;
    const saved = JSON.parse(second.getValue());
    document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const form = new FormData(document.querySelector('form')!);
    return { before, value: saved.table.content[0].content[0].content[0].attrs.value,
      nativeField: form.get('second-cell-0'), posted: JSON.parse(form.get('second') as string),
    };
  }, widgetArguments);
  expect(result.before).toBe('null');
  expect(JSON.parse(result.value).blocks[0].text).toBe('Helpful hybrid details');
  expect(JSON.parse(result.nativeField as string).blocks[0].text).toBe('Helpful hybrid details');
  expect(JSON.parse(result.posted.table.content[0].content[0].content[0].attrs.value).blocks[0].text).toBe('Helpful hybrid details');
  const editors = page.locator('.Draftail-Editor [contenteditable=true]');
  await expect(editors).toHaveText(['Helpful hybrid details', 'Helpful hybrid details']);
  await page.locator('[data-wagtail-table]').last().locator('[data-cell-edit]').click();
  await expect(editors.last()).toBeVisible();
  await editors.last().click();
  await page.keyboard.type('Independent copy');
  const edited = await page.evaluate(() => JSON.parse((window as any).draftailCopy.getValue()));
  expect(JSON.parse(edited.table.content[0].content[0].content[0].attrs.value).blocks[0].text).toContain('Independent copy');
  await expect(editors.first()).toHaveText('Helpful hybrid details');
});
