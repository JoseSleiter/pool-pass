import 'server-only';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Node 20 has no global WebSocket, which @supabase/realtime-js requires even
// though this client never opens a realtime channel. Supplying the `ws`
// transport lets the client construct without needing Node 22+. Mirrors the
// same fix already applied in reserve-slots.integration.test.ts.

/** Service-role client. Bypasses RLS — server code only. */
export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, realtime: { transport: ws as never } }
  );
}
