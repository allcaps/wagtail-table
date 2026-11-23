import { expect, type Page } from '@playwright/test';

export async function publishAndView(page: Page, path: string) {
  await page.getByRole('navigation', { name: 'Actions (footer)' })
    .getByRole('button', { name: 'More actions', exact: true }).click();
  // Do not navigate away while the publish POST or its redirect is pending.
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Publish', exact: true }).click(),
  ]);
  await expect(page.getByRole('status').locator('li.success'))
    .toContainText('has been published.');
  await page.goto(path);
}

export async function saveDraftAndReload(page: Page) {
  // Saving an existing page redirects to the same URL. Wait for the next
  // document load, not a URL match that can resolve against the old document.
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Save draft', exact: true }).click(),
  ]);
  await page.reload();
}
