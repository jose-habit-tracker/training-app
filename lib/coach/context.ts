import { DayPlan, TrainingSession } from '../../types';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { getCurrentWeek } from '../../hooks/useTraining';

export const DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

// ─── Build system prompt with recent session context ──────────────────────────
export function buildChatSystemPrompt(days: DayPlan[], recentSessions: TrainingSession[]): string {
  const weekNumber = getCurrentWeek();

  const now = new Date();
  const todayPlan = days.find((d) => d.day === DAY_MAP[now.getDay()]);
  const todayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todaySession = todayPlan
    ? `${todayPlan.title} (${SESSION_LABELS[todayPlan.sessionType] ?? todayPlan.sessionType}, ${todayPlan.duration} min)`
    : 'sin sesión definida';

  const sessionSummary = recentSessions.length > 0
    ? recentSessions.map((s) => {
        const parts = [
          `• ${s.day_name} (${s.session_date}): ${SESSION_LABELS[s.session_type] ?? s.session_type}`,
          s.rpe_perceived != null ? `RPE ${s.rpe_perceived}/10` : null,
          s.fatigue != null ? `Fatiga ${s.fatigue}/10` : null,
          s.notes ? `"${s.notes}"` : null,
        ].filter(Boolean);
        return parts.join(' — ');
      }).join('\n')
    : 'Sin sesiones recientes registradas.';

  const planJson = JSON.stringify(
    days.map((d) => ({
      day: d.day,
      dayName: d.dayName,
      sessionType: d.sessionType,
      title: d.title,
      duration: d.duration,
      description: d.description,
      warmup: d.warmup,
      cooldown: d.cooldown,
      notes: d.notes,
      exercises: (d.exercises ?? []).map(({ id, ...ex }) => ex),
    })),
  );
  const sessionTypes = Object.keys(SESSION_LABELS).join(', ');

  return `Eres el coach personal de un atleta de 23 años que se prepara para una media maratón y Hyrox posteriormente.
El atleta entrena 7 días a la semana: running, natación y gimnasio (énfasis Hyrox).
Estás en la semana ${weekNumber} del ciclo de entrenamiento.

HOY ES: ${todayStr}. La sesión programada para hoy es: ${todaySession}.
No deduzcas el día por tu cuenta; usa siempre esta fecha como "hoy".

ÚLTIMAS SESIONES REGISTRADAS:
${sessionSummary}

PLAN COMPLETO ACTUAL DEL ATLETA (JSON, fuente de verdad — incluye ejercicios, calentamiento, enfriamiento y notas de cada día):
${planJson}

CAPACIDAD DE EDICIÓN DEL PLAN:
- Tienes el plan completo arriba. Cuando el atleta te pregunte por una sesión, usa todos sus detalles (ejercicios, series, cargas, notas).
- Si el atleta te pide MODIFICAR el plan (cambiar ejercicios, tipo, duración, etc.), explica brevemente el cambio y AÑADE AL FINAL un bloque con el/los días modificados COMPLETOS, exactamente así:
\`\`\`plan
[{"day":"tuesday","dayName":"Martes","sessionType":"running_easy","title":"Carrera Suave","duration":40,"description":"...","warmup":"...","cooldown":"...","notes":"...","exercises":[{"name":"Rodaje suave","duration":"30 min","notes":"z2"}]}]
\`\`\`
- Incluye SOLO los días que cambian, con todos sus campos. El campo "day" debe ser uno de: monday, tuesday, wednesday, thursday, friday, saturday, sunday.
- "sessionType" debe ser uno de: ${sessionTypes}.
- NO incluyas el bloque \`\`\`plan si no te piden cambios.

INSTRUCCIONES:
- Responde siempre en español, de forma concisa y práctica.
- Basa tus respuestas en el contexto de sesiones recientes cuando sea relevante.
- Cuando hagas ajustes al plan, explica brevemente el razonamiento fisiológico.
- Tono motivador pero realista. Máximo 180 palabras por respuesta salvo que te pidan más detalle.`;
}

// Contexto compartido (fecha, plan del día, últimas sesiones, plan JSON) para el
// prompt del coach de la home, que actúa vía tools en lugar de bloques ```plan.
export function buildCoachSystemPrompt(days: DayPlan[], recentSessions: TrainingSession[]): string {
  const weekNumber = getCurrentWeek();
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const todayPlan = days.find((d) => d.day === DAY_MAP[now.getDay()]);
  const todayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todaySession = todayPlan
    ? `${todayPlan.title} (${SESSION_LABELS[todayPlan.sessionType] ?? todayPlan.sessionType}, ${todayPlan.duration} min, session_type=${todayPlan.sessionType})`
    : 'sin sesión definida';

  const sessionSummary = recentSessions.length > 0
    ? recentSessions.map((s) => {
        const parts = [
          `• ${s.day_name} (${s.session_date}): ${SESSION_LABELS[s.session_type] ?? s.session_type}`,
          s.rpe_perceived != null ? `RPE ${s.rpe_perceived}/10` : null,
          s.fatigue != null ? `Fatiga ${s.fatigue}/10` : null,
          s.notes ? `"${s.notes}"` : null,
        ].filter(Boolean);
        return parts.join(' — ');
      }).join('\n')
    : 'Sin sesiones recientes registradas.';

  const planJson = JSON.stringify(
    days.map((d) => ({
      day: d.day, dayName: d.dayName, sessionType: d.sessionType, title: d.title,
      duration: d.duration, description: d.description, warmup: d.warmup,
      cooldown: d.cooldown, notes: d.notes,
      exercises: (d.exercises ?? []).map(({ id, ...ex }) => ex),
    })),
  );

  return `Eres el coach personal de un atleta de 23 años que se prepara para una media maratón y Hyrox posteriormente.
El atleta entrena 7 días a la semana: running, natación y gimnasio (énfasis Hyrox).
Estás en la semana ${weekNumber} del ciclo.

HOY ES: ${todayStr} (${todayIso}). Sesión programada hoy: ${todaySession}.
No deduzcas el día por tu cuenta; usa siempre esta fecha como "hoy".

ÚLTIMAS SESIONES REGISTRADAS:
${sessionSummary}

PLAN COMPLETO ACTUAL (JSON, fuente de verdad):
${planJson}

CÓMO ACTUAR:
- Si el atleta te CUENTA un entrenamiento hecho (hoy o un día concreto), llama a log_session con la fecha correcta, el session_type adecuado y todas las métricas que mencione (distancia, ritmo mm:ss, FC, metros, series, pesos). No inventes valores que no haya dicho.
- Si pide CORREGIR un registro existente, llama a edit_session solo con los campos que cambian. Si pide borrarlo, delete_session.
- Si pide CAMBIAR el plan (mover/modificar sesiones futuras), llama a adjust_plan con los días completos modificados; "day" en inglés (monday...sunday) y sessionType uno de: ${Object.keys(SESSION_LABELS).join(', ')}.
- Si solo pregunta o charla, responde en texto normal SIN llamar herramientas.
- Llama como máximo a UNA herramienta por mensaje. El atleta siempre confirmará antes de aplicar.
- Responde siempre en español, conciso, tono motivador pero realista.`;
}
