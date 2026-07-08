import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, RaceDetails } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { useSessions } from '../../hooks/useTraining';
import { usePlan } from '../../lib/PlanContext';
import { computePhases, compliancePct } from '../../lib/agenda/phases';
import { RaceHeroCard } from '../../components/agenda/RaceHeroCard';
import { EventsCalendar } from '../../components/agenda/EventsCalendar';
import { EventRow } from '../../components/agenda/EventRow';
import { EventModal, EventDraft } from '../../components/agenda/EventModal';
import { ResultModal } from '../../components/agenda/ResultModal';
import { Confetti } from '../../components/ui/Confetti';
import { PressableScale } from '../../components/ui/PressableScale';

const todayIso = () => new Date().toISOString().split('T')[0];

export default function AgendaScreen() {
  const { colors } = useTheme();
  const { events, loading, addEvent, updateEvent, removeEvent, setGoalRace } = useEvents();
  const { sessions } = useSessions(200);
  const { days } = usePlan();

  const [modalDate, setModalDate] = useState(todayIso());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [resultRace, setResultRace] = useState<CalendarEvent | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  const today = todayIso();
  const races = events.filter((e) => e.kind === 'race');
  const goalRace = races.find((e) => e.race?.is_goal && e.date >= today)
    ?? races.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    ?? null;

  const phases = useMemo(() => {
    if (!goalRace) return [];
    // start del plan: 12 semanas antes por defecto si la fila del plan no está cargada aquí.
    const start = new Date(new Date(`${goalRace.date}T00:00:00`).getTime() - 15 * 7 * 86_400_000);
    return computePhases(start.toISOString().split('T')[0], goalRace.date);
  }, [goalRace]);

  const compliance = useMemo(() => {
    if (phases.length === 0) return 0;
    const start = phases[0].start;
    const plannedPerWeek = days.filter((d) => d.sessionType !== 'rest').length;
    const weeksElapsed = Math.max(0, Math.min(
      (Date.now() - new Date(`${start}T00:00:00`).getTime()) / (7 * 86_400_000),
      phases.length * 20,
    ));
    const completed = sessions.filter((s) => s.session_date >= start).length;
    return compliancePct(completed, Math.round(weeksElapsed * plannedPerWeek));
  }, [phases, sessions, days]);

  const upcoming = events.filter((e) => (e.end_date ?? e.date) >= today && e.id !== goalRace?.id);
  const pastRaces = races.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const pendingResults = pastRaces.filter((e) => !e.race?.result_time);
  const results = pastRaces.filter((e) => e.race?.result_time);

  const openNew = (date: string) => { setEditing(null); setModalDate(date); setModalOpen(true); };
  const openEdit = (ev: CalendarEvent) => { setEditing(ev); setModalDate(ev.date); setModalOpen(true); };

  const handleSave = async (draft: EventDraft, id?: string): Promise<string | null> => {
    let savedId = id ?? null;
    let err: string | null;
    if (id) {
      err = await updateEvent(id, draft);
    } else {
      const res = await addEvent(draft);
      err = res.error;
      savedId = res.id;
    }
    if (!err && savedId && draft.kind === 'race' && draft.race?.is_goal) {
      await setGoalRace(savedId);
    }
    return err;
  };

  const handleResultSave = async (id: string, race: RaceDetails) => updateEvent(id, { race });

  const handleDayPress = (iso: string, dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) { openNew(iso); return; }
    const ev = dayEvents[0];
    if (ev.kind === 'race' && ev.date < today && !ev.race?.result_time) setResultRace(ev);
    else openEdit(ev);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {goalRace ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <RaceHeroCard race={goalRace} phases={phases} compliance={compliance} />
          </Animated.View>
        ) : (
          <PressableScale
            style={[s.emptyHero, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
            onPress={() => openNew(today)}
          >
            <Text style={s.emptyIcon}>🏁</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Añade tu primera carrera</Text>
            <Text style={[s.emptyText, { color: colors.text3 }]}>Cuenta atrás, objetivo y fases del plan hacia la meta.</Text>
          </PressableScale>
        )}

        <EventsCalendar events={events} onDayPress={handleDayPress} />

        {pendingResults.map((e) => (
          <EventRow key={e.id} event={e} onPress={() => setResultRace(e)} />
        ))}

        {upcoming.length > 0 && <Text style={[s.label, { color: colors.text3 }]}>PRÓXIMOS EVENTOS</Text>}
        {upcoming.map((e, i) => (
          <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).duration(250)}>
            <EventRow event={e} onPress={() => openEdit(e)} />
          </Animated.View>
        ))}

        {results.length > 0 && <Text style={[s.label, { color: colors.text3 }]}>RESULTADOS</Text>}
        {results.map((e) => (
          <EventRow key={e.id} event={e} onPress={() => setResultRace(e)} />
        ))}

        {!loading && events.length === 0 && (
          <Text style={[s.emptyText, { color: colors.text3, textAlign: 'center' }]}>
            Toca un día del calendario o el botón + para crear tu primer evento.
          </Text>
        )}
      </ScrollView>

      <PressableScale style={[s.fab, { backgroundColor: colors.accent }]} onPress={() => openNew(today)}>
        <Ionicons name="add" size={26} color="#fff" />
      </PressableScale>

      <EventModal
        visible={modalOpen}
        initialDate={modalDate}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={removeEvent}
      />
      <ResultModal
        visible={resultRace !== null}
        race={resultRace}
        history={races}
        onClose={() => setResultRace(null)}
        onSave={handleResultSave}
        onPB={() => setCelebrate((c) => c + 1)}
      />
      <Confetti trigger={celebrate} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 96, gap: Spacing.base },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65, marginTop: Spacing.gapSm },
  emptyHero: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.gapXs },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  emptyText: { fontSize: FontSize.base, lineHeight: 18 },
  fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 8 },
});
