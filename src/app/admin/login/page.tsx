'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserClient } from '@/lib/db/browser-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError(null);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError('Credenciales inválidas');
      return;
    }
    const next = params.get('next') ?? '/admin';
    // only allow same-site admin paths as redirect targets
    router.push(next.startsWith('/admin') ? next : '/admin');
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" className="h-11" value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" className="h-11" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="h-11 w-full" disabled={busy} onClick={login}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 to-sky-300 p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-xl font-extrabold text-sky-900">🌊 Admin — Pool Pass</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
