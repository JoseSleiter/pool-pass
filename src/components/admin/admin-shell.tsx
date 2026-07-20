'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { browserClient } from '@/lib/db/browser-client';

const NAV = [
  { href: '/admin', label: '📊 Hoy' },
  { href: '/admin/settings', label: '⚙️ Configuración' },
];

function NavLinks(props: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={props.onNavigate}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === item.href ? 'bg-sky-800 text-white' : 'text-sky-200 hover:bg-sky-900'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-left text-xs text-sky-300 underline underline-offset-2"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.push('/admin/login');
        router.refresh();
      }}
    >
      Cerrar sesión
    </button>
  );
}

export function AdminShell(props: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col bg-[#0c4a6e] p-4 md:flex">
        <p className="font-extrabold text-white">🌊 Club La Piscina</p>
        <p className="mb-5 text-xs text-sky-300">Panel de administración</p>
        <NavLinks />
        <div className="mt-auto space-y-1 pt-4">
          <p className="truncate text-xs text-sky-200">{props.email}</p>
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="bg-[#0c4a6e] p-3 md:hidden">
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-white">🌊 Admin</p>
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={open}
            className="min-h-11 min-w-11 rounded-lg text-xl text-white"
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
        {open && (
          <div className="mt-2 space-y-2 border-t border-sky-900 pt-2">
            <NavLinks onNavigate={() => setOpen(false)} />
            <LogoutButton />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}
