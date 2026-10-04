// e2e/admin-finance-audit.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Local admin credentials live outside the repo. In a worktree, point
// ADMIN_CREDENTIALS_FILE at the main checkout's file; CI has none → skip.
const CREDS_FILE =
  process.env.ADMIN_CREDENTIALS_FILE ?? path.join(process.cwd(), 'supabase', '.local-admin-credentials.txt');

function readCreds(): { email: string; password: string } | null {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const txt = fs.readFileSync(CREDS_FILE, 'utf8');
  const email = /^email:\s*(.+)$/m.exec(txt)?.[1]?.trim();
  const password = /^password:\s*(.+)$/m.exec(txt)?.[1]?.trim();
  return email && password ? { email, password } : null;
}

const creds = readCreds();
test.skip(!creds, 'local admin credentials not available');

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(creds!.email);
  await page.getByLabel('Password').fill(creds!.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('finance and audit pages render for the local admin', async ({ page }) => {
  await login(page);

  await page.goto('/admin/finance/transactions');
  await expect(page.getByRole('heading', { level: 1, name: 'Transacciones C2P' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Totales del rango' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Filtros de transacciones' })).toBeVisible();

  await page.goto('/admin/finance/bcv');
  await expect(page.getByRole('heading', { level: 1, name: 'Tasas BCV' })).toBeVisible();

  await page.goto('/admin/audit');
  await expect(page.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeVisible();
});

test('the transactions filter goes back to page 1 and keeps the range in the URL', async ({ page }) => {
  await login(page);
  await page.goto('/admin/finance/transactions?page=3');
  await page.getByLabel('Estado').selectOption('confirmed');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/status=confirmed/);
  await expect(page).not.toHaveURL(/page=3/);
  await expect(page.getByLabel('Estado')).toHaveValue('confirmed');
});
