import { supabase } from '../supabase';
import { apiUrl } from '../apiBase';
import type { ChatMessage } from '../../types';
import type { CoachReply } from './types';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión para usar el coach.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

function mapApiError(status: number, body: string): Error {
  if (body.includes('NO_GROQ_KEY')) {
    return new Error('Configura tu API key de Groq en Ajustes para usar el coach.');
  }
  if (body.includes('AUDIO_TOO_LARGE')) {
    return new Error('El audio es demasiado largo. Máximo ~2 minutos.');
  }
  return new Error(`Error del coach (${status}). Inténtalo de nuevo.`);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el audio'));
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? '');
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const headers = await authHeaders();
  const audio = await blobToBase64(blob);
  const response = await fetch(apiUrl('/api/transcribe'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ audio, mime: blob.type || 'audio/webm' }),
  });
  if (!response.ok) throw mapApiError(response.status, await response.text());
  const data = await response.json();
  return typeof data.text === 'string' ? data.text : '';
}

export async function askCoach(messages: ChatMessage[]): Promise<CoachReply> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl('/api/coach'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) throw mapApiError(response.status, await response.text());
  const data = (await response.json()) as CoachReply;
  if (data?.kind === 'proposal' && data.proposal) return data;
  return { kind: 'text', content: data?.kind === 'text' ? data.content : 'Respuesta inesperada del coach.' };
}
