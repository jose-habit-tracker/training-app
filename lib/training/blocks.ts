// lib/training/blocks.ts
import { DayPlan } from '../../types';

export interface SessionBlock {
  key: 'warmup' | 'main' | 'cooldown';
  label: string;
  detail: string;
}

// Bloques para la hero card y la sesión en vivo. Solo se emiten los que
// tienen contenido; un día de descanso no tiene bloques.
export function deriveBlocks(plan: DayPlan): SessionBlock[] {
  if (plan.sessionType === 'rest') return [];
  const blocks: SessionBlock[] = [];

  const warmup = plan.warmup?.trim();
  if (warmup) blocks.push({ key: 'warmup', label: 'Calentamiento', detail: warmup });

  const main = plan.exercises?.length
    ? `${plan.exercises.length} ejercicio${plan.exercises.length === 1 ? '' : 's'}`
    : plan.description?.trim() ?? '';
  if (main) blocks.push({ key: 'main', label: 'Principal', detail: main });

  const cooldown = plan.cooldown?.trim();
  if (cooldown) blocks.push({ key: 'cooldown', label: 'Enfriamiento', detail: cooldown });

  return blocks;
}
