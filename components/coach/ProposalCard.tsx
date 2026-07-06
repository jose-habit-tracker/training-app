import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS, SUBTYPE_LABELS } from '../../constants/trainingPlan';
import type { ActionProposal } from '../../lib/coach/types';

export type ProposalStatus = 'idle' | 'applying' | 'done' | 'error';

const ACTION_TITLES: Record<ActionProposal['action'], string> = {
  log_session: 'Propuesta de registro',
  edit_session: 'Propuesta de corrección',
  delete_session: 'Eliminar sesión',
  adjust_plan: 'Cambio en el plan',
};

// Resumen legible de la propuesta, línea a línea.
export function describeProposal(p: ActionProposal): string[] {
  if (p.action === 'adjust_plan') {
    return p.args.days.map((d) => `${d.dayName ?? d.day}: ${d.title ?? 'modificado'}${d.duration ? ` · ${d.duration} min` : ''}`);
  }
  if (p.action === 'delete_session') {
    return [`Sesión del ${p.args.session_date}`];
  }
  const a = p.args;
  const lines: string[] = [`Fecha: ${a.session_date}`];
  if (a.session_type) lines.push(`Tipo: ${SESSION_LABELS[a.session_type] ?? a.session_type}${a.subtype ? ` · ${SUBTYPE_LABELS[a.subtype]}` : ''}`);
  const nums: string[] = [];
  if (a.duration_min != null) nums.push(`${a.duration_min} min`);
  if (a.rpe != null) nums.push(`RPE ${a.rpe}`);
  if (a.fatigue != null) nums.push(`Fatiga ${a.fatigue}`);
  if (nums.length) lines.push(nums.join(' · '));
  const m = a.metrics;
  if (m) {
    const mm: string[] = [];
    if (m.distancia_km != null) mm.push(`${m.distancia_km} km`);
    if (m.ritmo_min_km) mm.push(`${m.ritmo_min_km}/km`);
    if (m.fc_media != null) mm.push(`FC ${m.fc_media}`);
    if (m.metros != null) mm.push(`${m.metros} m`);
    if (m.ejercicios?.length) mm.push(`${m.ejercicios.length} ejercicios con carga`);
    if (mm.length) lines.push(mm.join(' · '));
  }
  if (a.notes) lines.push(`Notas: «${a.notes}»`);
  return lines;
}

interface ProposalCardProps {
  proposal: ActionProposal;
  status: ProposalStatus;
  error?: string;
  onConfirm: () => void;
  onEdit?: () => void; // solo log/edit_session
}

export function ProposalCard({ proposal, status, error, onConfirm, onEdit }: ProposalCardProps) {
  const { colors } = useTheme();
  const isDestructive = proposal.action === 'delete_session';
  const accent = isDestructive ? colors.danger : colors.accent;

  return (
    <View style={[s.card, { borderColor: accent + '55', backgroundColor: accent + '10' }]}>
      <Text style={[s.title, { color: accent }]}>{ACTION_TITLES[proposal.action].toUpperCase()}</Text>
      {describeProposal(proposal).map((line, i) => (
        <Text key={i} style={[s.line, { color: colors.text }]}>{line}</Text>
      ))}

      {status === 'done' ? (
        <Text style={[s.doneText, { color: accent }]}>✓ Aplicado</Text>
      ) : (
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: accent }]}
            onPress={onConfirm}
            disabled={status === 'applying'}
            activeOpacity={0.8}
          >
            {status === 'applying'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.btnText}>{isDestructive ? 'Eliminar' : 'Confirmar'}</Text>}
          </TouchableOpacity>
          {onEdit && (
            <TouchableOpacity
              style={[s.btn, s.btnGhost, { borderColor: colors.border }]}
              onPress={onEdit}
              disabled={status === 'applying'}
              activeOpacity={0.8}
            >
              <Text style={[s.btnText, { color: colors.text2 }]}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {status === 'error' && !!error && (
        <Text style={[s.errorText, { color: colors.danger }]}>{error} — vuelve a tocar Confirmar para reintentar.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.base,
    gap: Spacing.gapXs,
    marginTop: Spacing.gapXs,
  },
  title: { fontSize: FontSize.xs, fontWeight: FontWeight.black, letterSpacing: 0.5 },
  line: { fontSize: FontSize.md, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: Spacing.gapSm, marginTop: Spacing.gapSm },
  btn: {
    paddingVertical: Spacing.gapSm,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    minWidth: 104,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  doneText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, marginTop: Spacing.gapSm },
  errorText: { fontSize: FontSize.sm, marginTop: Spacing.gapXs },
});
