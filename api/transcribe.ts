import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Límite de Vercel para el body: 4.5 MB. 3M chars de base64 ≈ 2.2 MB de audio
// opus ≈ >8 min — de sobra para notas de voz de 2 min.
const MAX_BASE64_CHARS = 3_000_000;
const WHISPER_MODEL = 'whisper-large-v3';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace('/rest/v1/', '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Portero: mismo patrón que /api/chat ────────────────────────────────────
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'No autorizado' });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: keyRow } = await userClient
    .from('user_ai_keys')
    .select('groq_key')
    .eq('user_id', user.id)
    .single();
  const groqKey = keyRow?.groq_key;
  if (!groqKey) return res.status(400).json({ error: 'NO_GROQ_KEY' });

  // ─── Saneado del body ────────────────────────────────────────────────────────
  const { audio, mime } = req.body ?? {};
  if (typeof audio !== 'string' || audio.length === 0) {
    return res.status(400).json({ error: 'audio (base64) requerido' });
  }
  if (audio.length > MAX_BASE64_CHARS) {
    return res.status(413).json({ error: 'AUDIO_TOO_LARGE' });
  }
  const mimeType = typeof mime === 'string' && /^audio\/[\w.+-]+(;.*)?$/.test(mime)
    ? mime
    : 'audio/webm';

  let buf: Buffer;
  try {
    buf = Buffer.from(audio, 'base64');
  } catch {
    return res.status(400).json({ error: 'base64 inválido' });
  }

  // ─── Groq Whisper (multipart) ────────────────────────────────────────────────
  const form = new FormData();
  const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
  form.append('file', new Blob([new Uint8Array(buf)], { type: mimeType }), `audio.${ext}`);
  form.append('model', WHISPER_MODEL);
  form.append('language', 'es');
  form.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  return res.status(200).json({ text: typeof data.text === 'string' ? data.text.trim() : '' });
}
