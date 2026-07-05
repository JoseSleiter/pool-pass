import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// the spec files query Supabase directly, so they need .env.local too
dotenv.config({ path: '.env.local' });

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3100' },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      MERCANTIL_MOCK: '1',
      RESEND_API_KEY: 're_dummy',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3100',
    },
  },
});
