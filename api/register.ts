import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  // Service role client bypasses RLS entirely
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const normalizedEmail = email.toLowerCase().trim();

  // Check invite — service role sees all rows regardless of RLS
  const { data: invite, error: inviteError } = await admin
    .from('user_invites')
    .select('id')
    .eq('email', normalizedEmail)
    .is('used_at', null)
    .maybeSingle();

  if (inviteError) {
    return res.status(500).json({ error: `Error al verificar invitación: ${inviteError.message}` });
  }

  if (!invite) {
    return res.status(403).json({ error: 'Esta app es invite-only. Contacta al administrador.' });
  }

  // Create user and auto-confirm email so they can login immediately
  const { data: created, error: signUpError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    return res.status(400).json({ error: signUpError.message });
  }

  // Mark invite as used
  await admin
    .from('user_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('email', normalizedEmail);

  return res.status(200).json({ userId: created.user?.id });
}
