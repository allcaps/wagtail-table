import type { Page } from '@playwright/test';

export async function saveDraftAndReload(page: Page) {
  // Saving an existing page redirects to the same URL. Wait for the next
  // document load, not a URL match that can resolve against the old document.
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Save draft', exact: true }).click(),
  ]);
  await page.reload();
}
