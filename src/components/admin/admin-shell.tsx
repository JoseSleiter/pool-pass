'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { browserClient } from '@/lib/db/browser-client';

const NAV = [
  { href: '/admin', label: 'Hoy', icon: '🏠' },
  { href: '/admin/settings', label: 'Configuración', icon: '⚙️' },
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
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname === item.href ? 'bg-sky-700 text-white' : 'text-sky-200 hover:bg-sky-900'
          }`}
        >
          <span aria-hidden>{item.icon}</span>
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
      className="cursor-pointer text-left text-xs text-sky-300 underline underline-offset-2"
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

function AdminAccount() {
  return (
    <div className="mt-auto rounded-xl bg-sky-950/60 p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-sky-400 text-sm font-bold text-sky-950">A</span>
        <span className="text-sm font-semibold text-white">Administrador</span>
      </div>
      <div className="mt-2">
        <LogoutButton />
      </div>
    </div>
  );
}

function Topbar(props: { context: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b bg-white/70 px-4 py-3">
      <div className="min-w-0 truncate text-sm font-semibold text-slate-700">{props.context}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notificaciones"
          className="grid size-9 cursor-pointer place-items-center rounded-full border bg-white text-slate-600 hover:bg-sky-50"
        >
          <Bell className="size-4" />
        </button>
        <span className="flex cursor-pointer items-center gap-2 rounded-full border bg-white px-2 py-1 text-sm">
          <span className="grid size-6 place-items-center rounded-full bg-sky-400 text-xs font-bold text-sky-950">A</span>
          Admin
        </span>
      </div>
    </div>
  );
}

export function AdminShell(props: { email: string; topbar?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 flex-col bg-[#0c4a6e] p-4 md:flex">
        <p className="font-extrabold text-white">🌊 Club La Piscina</p>
        <p className="mb-5 text-xs text-sky-300">Panel de administración</p>
        <NavLinks />
        <AdminAccount />
      </aside>

      {/* Top bar móvil con hamburguesa */}
      <div className="bg-[#0c4a6e] p-3 md:hidden">
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-white">🌊 Admin</p>
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={open}
            className="min-h-11 min-w-11 cursor-pointer rounded-lg text-xl text-white"
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

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar context={props.topbar ?? 'Panel administrativo'} />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </div>
  );
}
