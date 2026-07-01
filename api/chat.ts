import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Solo permitimos el modelo del coach; nada de que el cliente elija otro.
const ALLOWED_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS_CAP = 1024;

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace('/rest/v1/', '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// Valida el JWT del usuario contra Supabase Auth (no necesita service_role).
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Portero: exige una sesión de Supabase válida ─────────────────────────────
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // ─── BYOK: cada usuario usa su propia key de Groq (leída con su JWT vía RLS) ───
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: keyRow } = await userClient
    .from('user_ai_keys')
    .select('groq_key')
    .eq('user_id', user.id)
    .single();
  const groqKey = keyRow?.groq_key;
  if (!groqKey) {
    return res.status(400).json({ error: 'NO_GROQ_KEY' });
  }

  // ─── Saneado del body: no reenviamos lo que mande el cliente tal cual ─────────
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requerido' });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: ALLOWED_MODEL,
      messages,
      max_tokens: MAX_TOKENS_CAP,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return res.status(response.status).json(data);
}
