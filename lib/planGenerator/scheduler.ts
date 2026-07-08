import type { OnboardingAnswers, SessionType, SportChoice } from '../../types';

const HARD = new Set<SessionType>(['running_intervals', 'running_threshold', 'hyrox_simulation']);

function sportWeights(answers: OnboardingAnswers): Map<SportChoice, number> {
  const weights = new Map<SportChoice, number>();
  for (const sport of answers.sports) weights.set(sport, 1);

  if (answers.goal === 'lose_weight') {
    const table: Record<SportChoice, number> = { run: 2, swim: 2, hyrox: 1.5, gym: 1 };
    for (const sport of answers.sports) weights.set(sport, table[sport]);
  } else if (answers.goal === 'gain_strength') {
    const table: Record<SportChoice, number> = { gym: 3, hyrox: 2, run: 1, swim: 1 };
    for (const sport of answers.sports) weights.set(sport, table[sport]);
  } else if (answers.goal === 'race') {
    const raceSport: SportChoice = answers.raceDistance === 'hyrox' ? 'hyrox' : 'run';
    if (weights.has(raceSport)) weights.set(raceSport, 3);
  }
  return weights;
}

// Reparto por resto mayor: 1 día garantizado por deporte y el resto proporcional
// al peso del objetivo. Si no caben todos, ganan los de más peso (empate: orden
// en que el usuario los eligió — sort es estable).
export function sessionCounts(answers: OnboardingAnswers, total: number): Map<SportChoice, number> {
  const weights = sportWeights(answers);
  const sports = answers.sports;
  const counts = new Map<SportChoice, number>();

  if (total < sports.length) {
    const ranked = [...sports].sort((a, b) => weights.get(b)! - weights.get(a)!);
    ranked.slice(0, total).forEach((sp) => counts.set(sp, 1));
    sports.forEach((sp) => { if (!counts.has(sp)) counts.set(sp, 0); });
    return counts;
  }

  const weightSum = sports.reduce((acc, sp) => acc + weights.get(sp)!, 0);
  const spare = total - sports.length;
  const exact = sports.map((sp) => ({ sp, value: (spare * weights.get(sp)!) / weightSum }));
  exact.forEach(({ sp, value }) => counts.set(sp, 1 + Math.floor(value)));

  let assigned = [...counts.values()].reduce((a, b) => a + b, 0);
  // Desempate de restos iguales por peso: el deporte prioritario del objetivo
  // se lleva el día extra (p. ej. gain_strength con run+gym → gym).
  const byRemainder = [...exact].sort(
    (a, b) => (b.value % 1) - (a.value % 1) || weights.get(b.sp)! - weights.get(a.sp)!,
  );
  for (const { sp } of byRemainder) {
    if (assigned >= total) break;
    counts.set(sp, counts.get(sp)! + 1);
    assigned += 1;
  }
  return counts;
}

function runVariants(count: number): SessionType[] {
  if (count === 1) return ['running_easy'];
  if (count === 2) return ['running_easy', 'running_long'];
  if (count === 3) return ['running_easy', 'running_intervals', 'running_long'];
  return [
    'running_easy',
    'running_threshold',
    'running_intervals',
    'running_long',
    ...Array<SessionType>(count - 4).fill('running_easy'),
  ];
}

function hyroxVariants(count: number): SessionType[] {
  if (count === 1) return ['gym_hyrox'];
  return ['gym_hyrox', 'hyrox_simulation', ...Array<SessionType>(count - 2).fill('gym_hyrox')];
}

function variantsFor(sport: SportChoice, count: number): SessionType[] {
  if (count <= 0) return [];
  if (sport === 'run') return runVariants(count);
  if (sport === 'hyrox') return hyroxVariants(count);
  if (sport === 'swim') return Array<SessionType>(count).fill('swimming');
  return Array<SessionType>(count).fill('gym_strength');
}

export function buildSessionList(answers: OnboardingAnswers): SessionType[] {
  const daysPerWeek = Math.min(7, Math.max(3, answers.daysPerWeek));
  const withRecovery = daysPerWeek >= 6;
  const active = daysPerWeek - (withRecovery ? 1 : 0);
  const counts = sessionCounts(answers, active);
  const sessions = answers.sports.flatMap((sp) => variantsFor(sp, counts.get(sp) ?? 0));
  if (withRecovery) sessions.push('active_recovery');
  return sessions;
}

// Anclas fijas (recuperación domingo, tirada larga sábado) y días duros en
// días alternos para no encadenar dos duros. Los huecos restantes son descanso.
export function placeSessions(sessions: SessionType[]): SessionType[] {
  const slots: (SessionType | null)[] = Array(7).fill(null);
  const pool = [...sessions];
  const take = (type: SessionType): SessionType | null => {
    const i = pool.indexOf(type);
    return i >= 0 ? pool.splice(i, 1)[0] : null;
  };

  const recovery = take('active_recovery');
  if (recovery) slots[6] = recovery;
  const longRun = take('running_long');
  if (longRun) slots[5] = longRun;

  const isHard = (s: SessionType | null | undefined) => s != null && HARD.has(s);
  const hards = pool.filter((s) => HARD.has(s));
  const easies = pool.filter((s) => !HARD.has(s));

  for (const hard of hards) {
    const idx =
      [0, 2, 4, 1, 3].find((i) => slots[i] === null && !isHard(slots[i - 1]) && !isHard(slots[i + 1])) ??
      slots.findIndex((s) => s === null);
    if (idx >= 0) slots[idx] = hard;
  }
  for (const easy of easies) {
    const idx = [0, 2, 4, 1, 3, 5, 6].find((i) => slots[i] === null);
    if (idx !== undefined) slots[idx] = easy;
  }
  return slots.map((s) => s ?? 'rest');
}

// Semana tipo (lunes primero) a partir de las respuestas del onboarding.
export function scheduleWeek(answers: OnboardingAnswers): SessionType[] {
  return placeSessions(buildSessionList(answers));
}
