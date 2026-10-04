// src/components/admin/use-sidebar-collapsed.ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';

export const SIDEBAR_COLLAPSED_KEY = 'pp_admin_sidebar_collapsed';

const listeners = new Set<() => void>();
// Session fallback when localStorage is unavailable: the toggle still works,
// it just isn't remembered across reloads.
let memory: boolean | null = null;

function read(): boolean {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function write(collapsed: boolean): void {
  memory = collapsed;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Not persisted; `memory` keeps the choice for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server render and hydration are expanded (the default); the stored choice applies right after. */
export function useSidebarCollapsed(): [collapsed: boolean, toggle: () => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => write(!read()), []);
  return [collapsed, toggle];
}

/** Test helper: forget the in-memory fallback between tests. */
export function resetSidebarCollapsedMemory(): void {
  memory = null;
}
