// src/components/admin/finance/empty-state.tsx
import type { LucideIcon } from 'lucide-react';

/** Empty-list notice shared by the finance and audit pages (server component). */
export function EmptyState(props: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center"
    >
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <p className="font-semibold">{props.title}</p>
      {props.children && <p className="max-w-sm text-sm text-muted-foreground">{props.children}</p>}
    </div>
  );
}
