import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { usePlan } from '../lib/PlanContext';
import { useEvents } from '../hooks/useEvents';
import { generatePlan } from '../lib/planGenerator/generate';
import { defaultPlanData } from '../lib/training/planData';
import {
  ExperienceLevel,
  OnboardingAnswers,
  OnboardingGoal,
  PlanDataV2,
  RaceDistanceChoice,
  SportChoice,
} from '../types';

const SPORTS: Array<{ key: SportChoice; label: string; desc: string }> = [
  { key: 'run', label: 'Running', desc: 'Rodajes, series y tiradas largas' },
  { key: 'swim', label: 'Natación', desc: 'Técnica y resistencia en piscina' },
  { key: 'gym', label: 'Gimnasio', desc: 'Fuerza funcional y movilidad' },
  { key: 'hyrox', label: 'Hyrox', desc: 'Circuitos funcionales y simulaciones' },
];

const GOALS: Array<{ key: OnboardingGoal; label: string; desc: string }> = [
  { key: 'race', label: 'Preparar una carrera', desc: '5K, 10K, media, maratón o Hyrox' },
  { key: 'general_fitness', label: 'Mejorar mi forma', desc: 'Salud y condición física general' },
  { key: 'lose_weight', label: 'Perder peso', desc: 'Más volumen aeróbico en tu semana' },
  { key: 'gain_strength', label: 'Ganar fuerza', desc: 'Más gimnasio y progresión de cargas' },
];

const DISTANCES: Array<{ key: RaceDistanceChoice; label: string }> = [
  { key: '5k', label: '5K' },
  { key: '10k', label: '10K' },
  { key: 'half', label: 'Media maratón' },
  { key: 'marathon', label: 'Maratón' },
  { key: 'hyrox', label: 'Hyrox' },
];

const LEVELS: Array<{ key: ExperienceLevel; label: string; desc: string }> = [
  { key: 'beginner', label: 'Principiante', desc: 'Menos de un año entrenando con regularidad' },
  { key: 'intermediate', label: 'Intermedio', desc: 'Entrenas con constancia desde hace tiempo' },
  { key: 'advanced', label: 'Avanzado', desc: 'Compites o entrenas con estructura' },
];

const RACE_KM: Record<RaceDistanceChoice, number> = {
  '5k': 5, '10k': 10, half: 21.1, marathon: 42.2, hyrox: 8,
};
const RACE_TITLES: Record<RaceDistanceChoice, string> = {
  '5k': 'Carrera 5K', '10k': 'Carrera 10K', half: 'Media maratón', marathon: 'Maratón', hyrox: 'Hyrox',
};

// Alert.alert no bloquea en react-native-web; mismo patrón que plan/[day].tsx.
function notifyWarning(msg: string) {
  if (Platform.OS === 'web') { window.alert(msg); return; }
  Alert.alert('Aviso', msg);
}

type Step = 'sports' | 'goal' | 'race' | 'availability' | 'summary';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { hasPlan, replacePlan } = usePlan();
  const { addEvent, setGoalRace } = useEvents();

  const [step, setStep] = useState<Step>('sports');
  const [sports, setSports] = useState<SportChoice[]>([]);
  const [goal, setGoal] = useState<OnboardingGoal | null>(null);
  const [raceDistance, setRaceDistance] = useState<RaceDistanceChoice | null>(null);
  const [raceDate, setRaceDate] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: Step[] = useMemo(
    () => (goal === 'race'
      ? ['sports', 'goal', 'race', 'availability', 'summary']
      : ['sports', 'goal', 'availability', 'summary']),
    [goal],
  );
  const stepIndex = steps.indexOf(step);

  const canContinue = (() => {
    if (step === 'sports') return sports.length > 0;
    if (step === 'goal') return goal !== null;
    if (step === 'race') {
      if (!raceDistance) return false;
      return raceDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(raceDate);
    }
    if (step === 'availability') return daysPerWeek !== null && level !== null;
    return true;
  })();

  const goNext = () => { setError(null); setStep(steps[stepIndex + 1]); };
  const goBack = () => {
    setError(null);
    if (stepIndex === 0) { if (hasPlan) router.back(); return; }
    setStep(steps[stepIndex - 1]);
  };

  const toggleSport = (key: SportChoice) => {
    setSports((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  async function finish(useDefault: boolean) {
    if (!goal || !daysPerWeek || !level) return;
    setSaving(true);
    setError(null);

    const answers: OnboardingAnswers = {
      sports,
      goal,
      raceDistance: goal === 'race' && raceDistance ? raceDistance : undefined,
      raceDate: goal === 'race' && raceDate ? raceDate : undefined,
      daysPerWeek,
      level,
    };
    const data: PlanDataV2 = useDefault
      ? defaultPlanData()
      : { version: 2, profile: answers, weeks: generatePlan(answers) };

    const err = await replacePlan(data);
    if (err) { setError(err); setSaving(false); return; }

    // El plan ya está guardado: un fallo creando el evento solo genera aviso.
    if (!useDefault && goal === 'race' && raceDistance && raceDate) {
      const { id, error: evErr } = await addEvent({
        title: RACE_TITLES[raceDistance],
        date: raceDate,
        kind: 'race',
        race: { distance_km: RACE_KM[raceDistance], is_goal: true },
      });
      const goalErr = id ? await setGoalRace(id) : (evErr ?? 'No se pudo crear la carrera');
      if (goalErr) notifyWarning(`El plan se ha creado, pero la carrera no se pudo añadir a la agenda: ${goalErr}. Puedes crearla a mano.`);
    }

    setSaving(false);
    router.replace('/(tabs)/hoy');
  }

  const summarySports = sports.map((k) => SPORTS.find((s) => s.key === k)?.label).join(', ');

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={s.progressRow}>
        {steps.map((st, i) => (
          <View
            key={st}
            style={[s.progressSeg, { backgroundColor: i <= stepIndex ? colors.accent : colors.border }]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 'sports' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>¿Qué practicas?</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              Elige los deportes que practicas o quieres practicar. Puedes marcar varios.
            </Text>
            {SPORTS.map((sp) => (
              <OptionCard
                key={sp.key}
                label={sp.label}
                desc={sp.desc}
                selected={sports.includes(sp.key)}
                onPress={() => toggleSport(sp.key)}
              />
            ))}
          </>
        )}

        {step === 'goal' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>¿Cuál es tu objetivo?</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              El reparto de tu semana se adapta a lo que busques.
            </Text>
            {GOALS.map((g) => (
              <OptionCard
                key={g.key}
                label={g.label}
                desc={g.desc}
                selected={goal === g.key}
                onPress={() => setGoal(g.key)}
              />
            ))}
          </>
        )}

        {step === 'race' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>Tu carrera</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              Distancia y, si ya la sabes, la fecha: la añadimos a tu agenda como carrera objetivo.
            </Text>
            <View style={s.chipsRow}>
              {DISTANCES.map((d) => (
                <Chip
                  key={d.key}
                  label={d.label}
                  selected={raceDistance === d.key}
                  onPress={() => setRaceDistance(d.key)}
                />
              ))}
            </View>
            <Input
              label="Fecha (AAAA-MM-DD, opcional)"
              value={raceDate}
              onChangeText={setRaceDate}
              placeholder="2026-10-25"
              autoCapitalize="none"
            />
          </>
        )}

        {step === 'availability' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>Tu disponibilidad</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>¿Cuántos días puedes entrenar a la semana?</Text>
            <View style={s.chipsRow}>
              {[3, 4, 5, 6, 7].map((n) => (
                <Chip key={n} label={`${n}`} selected={daysPerWeek === n} onPress={() => setDaysPerWeek(n)} />
              ))}
            </View>
            <Text style={[s.sectionLabel, { color: colors.text3 }]}>TU NIVEL</Text>
            {LEVELS.map((l) => (
              <OptionCard
                key={l.key}
                label={l.label}
                desc={l.desc}
                selected={level === l.key}
                onPress={() => setLevel(l.key)}
              />
            ))}
          </>
        )}

        {step === 'summary' && (
          <>
            <Text style={[s.title, { color: colors.text }]}>Tu plan de 4 semanas</Text>
            <Text style={[s.subtitle, { color: colors.text3 }]}>
              3 semanas de carga progresiva y una de descarga, repartidas según tus respuestas.
            </Text>
            <SummaryRow label="Deportes" value={summarySports} />
            <SummaryRow label="Objetivo" value={GOALS.find((g) => g.key === goal)?.label ?? ''} />
            {goal === 'race' && raceDistance && (
              <SummaryRow
                label="Carrera"
                value={`${RACE_TITLES[raceDistance]}${raceDate ? ` · ${raceDate}` : ''}`}
              />
            )}
            <SummaryRow label="Días por semana" value={String(daysPerWeek ?? '')} />
            <SummaryRow label="Nivel" value={LEVELS.find((l) => l.key === level)?.label ?? ''} />

            {hasPlan && (
              <Text style={[s.warning, { color: colors.text3 }]}>
                ⚠️ Generar un plan nuevo sustituirá tu plan actual. Tus sesiones registradas no se tocan.
              </Text>
            )}
            {error && <Text style={s.error}>{error}</Text>}
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step === 'summary' ? (
          <>
            <Button label="Generar mi plan" onPress={() => finish(false)} loading={saving} fullWidth />
            <Button
              label="Usar plan por defecto"
              variant="ghost"
              onPress={() => finish(true)}
              disabled={saving}
              fullWidth
            />
          </>
        ) : (
          <Button label="Continuar" onPress={goNext} disabled={!canContinue} fullWidth />
        )}
        {(stepIndex > 0 || hasPlan) && (
          <Button label="Atrás" variant="ghost" onPress={goBack} disabled={saving} fullWidth />
        )}
      </View>
    </SafeAreaView>
  );
}

function OptionCard({ label, desc, selected, onPress }: {
  label: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        s.option,
        {
          backgroundColor: colors.glassBg,
          borderColor: selected ? colors.accent : colors.glassBorder,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={s.optionMain}>
        <Text style={[s.optionLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[s.optionDesc, { color: colors.text3 }]}>{desc}</Text>
      </View>
      <View style={[s.radio, { borderColor: selected ? colors.accent : colors.border }]}>
        {selected && <View style={[s.radioInner, { backgroundColor: colors.accent }]} />}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        s.chip,
        {
          backgroundColor: selected ? colors.accent : colors.glassBg,
          borderColor: selected ? colors.accent : colors.glassBorder,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.chipText, { color: selected ? '#fff' : colors.text2 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.summaryRow, { borderBottomColor: colors.glassBorder }]}>
      <Text style={[s.summaryLabel, { color: colors.text3 }]}>{label}</Text>
      <Text style={[s.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  progressRow: {
    flexDirection: 'row',
    gap: Spacing.gapSm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.base,
  },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.gapMd },
  title: { fontSize: FontSize.xxxl, fontWeight: FontWeight.black, letterSpacing: -0.5, marginTop: Spacing.base },
  subtitle: { fontSize: FontSize.md, lineHeight: 20, marginBottom: Spacing.gapSm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.65,
    marginTop: Spacing.base,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.base,
  },
  optionMain: { flex: 1, gap: 2 },
  optionLabel: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  optionDesc: { fontSize: FontSize.md, lineHeight: 18 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.gapMd,
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapSm },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapSm,
  },
  chipText: { fontSize: FontSize.md, fontWeight: FontWeight.label },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.gapMd,
    borderBottomWidth: 1,
    gap: Spacing.gapMd,
  },
  summaryLabel: { fontSize: FontSize.md },
  summaryValue: { fontSize: FontSize.md, fontWeight: FontWeight.label, flexShrink: 1, textAlign: 'right' },
  warning: { fontSize: FontSize.md, lineHeight: 18, marginTop: Spacing.gapSm },
  error: { color: '#ff453a', fontSize: FontSize.sm, marginTop: Spacing.gapSm },
  footer: { padding: Spacing.lg, gap: Spacing.gapSm },
});
