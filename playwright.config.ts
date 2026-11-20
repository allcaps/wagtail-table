import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: process.env.WAGTAIL_TABLE_WIDGET_ONLY ? '**/{widget,clipboard}.spec.ts' : '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8009',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.WAGTAIL_TABLE_WIDGET_ONLY ? undefined : {
    command: '.venv/bin/python tests/browser/server.py',
    url: 'http://127.0.0.1:8009/admin/login/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
