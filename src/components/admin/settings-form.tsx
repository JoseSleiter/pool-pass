'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  adminUpdateSettings, adminUpsertOverride, adminDeleteOverride,
} from '@/app/admin/actions';
import type { SettingsRow } from '@/lib/db/reservations';

export function SettingsForm(props: {
  settings: SettingsRow;
  overrides: { date: string; capacity: number }[];
}) {
  const router = useRouter();
  const [capacity, setCapacity] = useState(String(props.settings.daily_capacity));
  const [adult, setAdult] = useState(String(props.settings.adult_price_usd));
  const [child, setChild] = useState(String(props.settings.child_price_usd));
  const [ovDate, setOvDate] = useState('');
  const [ovCap, setOvCap] = useState('0');
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setNotice(null);
    if (capacity.trim() === '' || adult.trim() === '' || child.trim() === '') {
      setNotice('Todos los campos son requeridos.');
      return;
    }
    const res = await adminUpdateSettings({
      daily_capacity: Number(capacity),
      adult_price_usd: Math.round(Number(adult) * 100) / 100,
      child_price_usd: Math.round(Number(child) * 100) / 100,
    });
    setNotice(res.ok ? 'Guardado ✓' : res.message ?? null);
  }

  return (
    <div className="space-y-4">
      {notice && <p role="alert" className="rounded-md bg-muted p-3 text-sm">{notice}</p>}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div>
            <Label htmlFor="capacity">Capacidad diaria (personas)</Label>
            <Input id="capacity" type="number" className="h-11" value={capacity}
              onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="adult">Precio adulto (USD)</Label>
              <Input id="adult" type="number" step="0.01" className="h-11" value={adult}
                onChange={(e) => setAdult(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label htmlFor="child">Precio niño (USD)</Label>
              <Input id="child" type="number" step="0.01" className="h-11" value={child}
                onChange={(e) => setChild(e.target.value)} />
            </div>
          </div>
          <Button className="h-11" onClick={save}>Guardar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="font-semibold">Excepciones por fecha (0 = cerrado)</h2>
          {props.overrides.map((o) => (
            <div key={o.date} className="flex items-center justify-between rounded border p-2">
              <span>{o.date} → {o.capacity === 0 ? 'Cerrado' : `${o.capacity} personas`}</span>
              <Button size="sm" variant="ghost"
                onClick={async () => {
                  setNotice(null);
                  const res = await adminDeleteOverride(o.date);
                  if (!res.ok) setNotice(res.message ?? null);
                  router.refresh();
                }}>
                Quitar
              </Button>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="ovDate">Fecha</Label>
              <Input id="ovDate" type="date" className="h-11" value={ovDate}
                onChange={(e) => setOvDate(e.target.value)} />
            </div>
            <div className="w-28">
              <Label htmlFor="ovCap">Capacidad</Label>
              <Input id="ovCap" type="number" className="h-11" value={ovCap}
                onChange={(e) => setOvCap(e.target.value)} />
            </div>
            <Button className="h-11" variant="outline" disabled={!ovDate}
              onClick={async () => {
                setNotice(null);
                if (ovCap.trim() === '') {
                  setNotice('Capacidad requerida.');
                  return;
                }
                const res = await adminUpsertOverride(ovDate, Number(ovCap));
                if (!res.ok) setNotice(res.message ?? null);
                setOvDate('');
                router.refresh();
              }}>
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
