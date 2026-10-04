import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { getAdminRole, listAdminRoles, upsertAdminRole } from './admin-roles';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { transport: ws as never } }
);

const EMAIL = 'it-roles@club.com';

describe('admin roles data layer', () => {
  beforeEach(async () => {
    await supabase.from('admin_roles').delete().eq('email', EMAIL);
  });

  it('getAdminRole returns null when there is no row', async () => {
    expect(await getAdminRole(EMAIL)).toBeNull();
  });

  it('upsert creates the row, then updates it', async () => {
    await upsertAdminRole(EMAIL, 'operator');
    expect(await getAdminRole(EMAIL)).toBe('operator');
    await upsertAdminRole(EMAIL, 'owner');
    expect(await getAdminRole(EMAIL)).toBe('owner');
  });

  it('normalizes email case on write and read', async () => {
    await upsertAdminRole('IT-Roles@Club.com', 'operator');
    expect(await getAdminRole('it-roles@club.com')).toBe('operator');
    expect(await getAdminRole('IT-ROLES@CLUB.COM')).toBe('operator');
  });

  it('listAdminRoles includes the stored row', async () => {
    await upsertAdminRole(EMAIL, 'operator');
    expect(await listAdminRoles()).toContainEqual({ email: EMAIL, role: 'operator' });
  });

  it('rejects unknown roles and non-lowercase emails at the database level', async () => {
    const badRole = await supabase.from('admin_roles').insert({ email: EMAIL, role: 'admin' });
    expect(badRole.error).not.toBeNull();
    const badEmail = await supabase.from('admin_roles').insert({ email: 'IT-Roles@club.com', role: 'owner' });
    expect(badEmail.error).not.toBeNull();
  });

  it('is closed to the anon role', async () => {
    const read = await supabaseAnon.from('admin_roles').select('*');
    expect(read.error).not.toBeNull();
    const write = await supabaseAnon.from('admin_roles').insert({ email: 'evil@x.com', role: 'owner' });
    expect(write.error).not.toBeNull();
  });
});
