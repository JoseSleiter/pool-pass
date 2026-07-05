import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount any React trees rendered by @testing-library/react between tests.
// Safe under both jsdom and node environments: cleanup() is a no-op when
// nothing was rendered (node-env tests never call render()).
afterEach(() => {
  cleanup();
});
