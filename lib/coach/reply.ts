import { validateProposal } from './validate';
import type { CoachReply } from './types';

// Definición de tools en formato OpenAI (Groq). Los schemas son orientativos
// para el modelo; la validación real y estricta es validateProposal.
const METRICS_SCHEMA = {
  type: 'object',
  description: 'Métricas del deporte. Solo las que el atleta mencione.',
  properties: {
    distancia_km: { type: 'number' },
    ritmo_min_km: { type: 'string', description: 'mm:ss por km, ej "4:35"' },
    fc_media: { type: 'integer' },
    fc_max: { type: 'integer' },
    metros: { type: 'integer', description: 'metros totales de natación' },
    series: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reps: { type: 'integer' }, distancia_m: { type: 'integer' }, descripcion: { type: 'string' },
        },
        required: ['reps', 'distancia_m'],
      },
    },
    ejercicios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' }, series: { type: 'integer' }, reps: { type: 'string' }, kg: { type: 'number' },
        },
        required: ['nombre', 'series', 'reps'],
      },
    },
  },
};

const SESSION_FIELDS = {
  session_date: { type: 'string', description: 'YYYY-MM-DD' },
  session_type: {
    type: 'string',
    enum: ['running_easy', 'running_threshold', 'running_long', 'running_intervals',
           'swimming', 'gym_strength', 'gym_hyrox', 'hyrox_simulation', 'rest', 'active_recovery'],
  },
  subtype: {
    type: 'string',
    enum: ['easy', 'long_run', 'intervals', 'threshold', 'race',
           'swim_technique', 'swim_sets', 'strength', 'hyrox_circuit', 'recovery'],
  },
  duration_min: { type: 'integer' },
  rpe: { type: 'integer', minimum: 1, maximum: 10 },
  fatigue: { type: 'integer', minimum: 1, maximum: 10 },
  notes: { type: 'string' },
  metrics: METRICS_SCHEMA,
};

export const COACH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'log_session',
      description: 'Registrar una sesión de entrenamiento completada que el atleta te cuenta.',
      parameters: {
        type: 'object',
        properties: SESSION_FIELDS,
        required: ['session_date', 'session_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_session',
      description: 'Corregir campos de una sesión ya registrada, identificada por su fecha.',
      parameters: {
        type: 'object',
        properties: SESSION_FIELDS,
        required: ['session_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_session',
      description: 'Eliminar la sesión registrada de una fecha.',
      parameters: {
        type: 'object',
        properties: { session_date: { type: 'string', description: 'YYYY-MM-DD' } },
        required: ['session_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_plan',
      description: 'Modificar días del plan semanal. Incluye cada día modificado COMPLETO.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
                dayName: { type: 'string' },
                sessionType: { type: 'string' },
                title: { type: 'string' },
                duration: { type: 'integer' },
                description: { type: 'string' },
                warmup: { type: 'string' },
                cooldown: { type: 'string' },
                notes: { type: 'string' },
                exercises: { type: 'array', items: { type: 'object' } },
              },
              required: ['day'],
            },
          },
        },
        required: ['days'],
      },
    },
  },
];

const FALLBACK_TEXT = 'No he podido preparar la acción con seguridad. ¿Me lo repites con la fecha y los datos concretos?';

// Convierte la respuesta cruda de Groq en CoachReply. Defensivo: cualquier
// forma inesperada degrada a texto, nunca lanza.
export function mapGroqResponse(data: unknown): CoachReply {
  const message = (data as { choices?: Array<{ message?: Record<string, unknown> }> } | null)
    ?.choices?.[0]?.message;
  if (!message || typeof message !== 'object') {
    return { kind: 'text', content: 'El coach no ha devuelto respuesta. Inténtalo de nuevo.' };
  }

  const content = typeof message.content === 'string' ? message.content : '';
  const toolCalls = message.tool_calls;

  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const fn = (toolCalls[0] as { function?: { name?: unknown; arguments?: unknown } }).function;
    const name = typeof fn?.name === 'string' ? fn.name : '';
    let rawArgs: unknown = null;
    if (typeof fn?.arguments === 'string') {
      try { rawArgs = JSON.parse(fn.arguments); } catch { rawArgs = null; }
    }
    const proposal = validateProposal(name, rawArgs);
    if (proposal) return { kind: 'proposal', content, proposal };
    return { kind: 'text', content: content || FALLBACK_TEXT };
  }

  return { kind: 'text', content: content || FALLBACK_TEXT };
}
