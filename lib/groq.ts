import { ChatMessage } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function askGroq(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const groqKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not set');

  const allMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: allMessages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
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
