import { Platform } from 'react-native';
import { ChatMessage } from '../types';
import { supabase } from './supabase';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// En web el proxy es relativo; en nativo necesitamos la URL absoluta del deploy.
function chatEndpoint(): string {
  if (Platform.OS === 'web') return '/api/chat';
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!base) throw new Error('EXPO_PUBLIC_API_BASE_URL no configurada');
  return `${base.replace(/\/$/, '')}/api/chat`;
}

export async function askGroq(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const allMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: allMessages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  // La key de Groq nunca sale al cliente: el proxy la aplica tras validar la sesión.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión para usar el coach.');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };

  const response = await fetch(chatEndpoint(), { method: 'POST', headers, body });

  if (!response.ok) {
    const error = await response.text();
    if (error.includes('NO_GROQ_KEY')) {
      throw new Error('Configura tu API key de Groq en Ajustes para usar el coach.');
    }
    throw new Error(`Groq API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? '';
}

export const COACH_SYSTEM_PROMPT = `Eres un coach de entrenamiento personal experto en running (media maratón) y Hyrox.
Tu atleta es un chico de 23 años que entrena 7 días a la semana.
Objetivo principal: media maratón en octubre + Hyrox posterior.
Responde siempre en español, de forma concisa y práctica.
Cuando des feedback sobre un entrenamiento completado, analiza: RPE, fatiga, tiempo completado.
Cuando ajustes el plan, explica brevemente el razonamiento fisiológico.
Usa un tono motivador pero realista.`;
