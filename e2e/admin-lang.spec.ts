// e2e/admin-lang.spec.ts
import { test, expect } from '@playwright/test';

test('admin pages are lang="es" even when pp_lang is en', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'pp_lang', value: 'en', url: baseURL! }]);

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/admin/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});
