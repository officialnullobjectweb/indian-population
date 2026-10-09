import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  use: { baseURL: 'http://localhost:8135' },
  webServer: {
    command: 'npx -y serve . -l 8135',
    url: 'http://localhost:8135',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
