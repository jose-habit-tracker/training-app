import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { SessionColors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS, SUBTYPE_LABELS } from '../../constants/trainingPlan';
import { TrainingSession, SessionType } from '../../types';
import { StatGrid, StatCard } from '../../components/ui/Card';
import { useSessions, useWeekSessions } from '../../hooks/useTraining';
import { useTheme } from '../../hooks/useTheme';

// ─── Filter types ─────────────────────────────────────────────────────────────
type Filter = 'all' | 'running' | 'gym' | 'swimming' | 'hyrox';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'running', label: 'Running' },
  { key: 'gym', label: 'Gym' },
  { key: 'swimming', label: 'Natación' },
  { key: 'hyrox', label: 'Hyrox' },
];

function matchesFilter(type: SessionType, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'running') return type.startsWith('running');
  if (filter === 'gym') return type.startsWith('gym') && !type.includes('hyrox');
  if (filter === 'swimming') return type === 'swimming';
  if (filter === 'hyrox') return type.includes('hyrox');
  return true;
}

// ─── RPE chart ────────────────────────────────────────────────────────────────
type ChartPoint = { day: string; rpe: number };

function buildChartData(sessions: TrainingSession[]): ChartPoint[] {
  return sessions
    .slice(0, 7)
    .reverse()
    .map((s) => ({
      day: s.day_name.slice(0, 2),
      rpe: s.rpe_perceived ?? 0,
    }));
}

const BAR_W = 28;
const BAR_GAP = 8;
const CHART_H = 88;
const LABEL_H = 18;
const SVG_H = CHART_H + LABEL_H;

function RpeBarChart({ data, color }: { data: ChartPoint[]; color: string }) {
  const n = data.length;
  if (n === 0) return null;
  const vbW = n * (BAR_W + BAR_GAP) - BAR_GAP;
  return (
    <Svg width="100%" height={SVG_H} viewBox={`0 0 ${vbW} ${SVG_H}`}>
      {data.map((d, i) => {
        const barH = Math.max(3, Math.round((d.rpe / 10) * CHART_H));
        const x = i * (BAR_W + BAR_GAP);
        const y = CHART_H - barH;
        return (
          <React.Fragment key={`${d.day}-${i}`}>
            <Rect x={x} y={y} width={BAR_W} height={barH} rx={3} ry={3} fill={color} />
            <SvgText
              x={x + BAR_W / 2}
              y={SVG_H - 2}
              textAnchor="middle"
              fontSize={10}
              fill="#888888"
              fontWeight="bold"
            >
              {d.day}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  colors,
}: {
  session: TrainingSession;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const [expanded, setExpanded] = useState(false);
  const barColor = SessionColors[session.session_type] ?? colors.accent;

  return (
    <TouchableOpacity
      style={[s.sessionCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
    >
      <View style={[s.sessionBar, { backgroundColor: barColor }]} />
      <View style={s.sessionBody}>
        {/* Row 1: day + date */}
        <View style={s.sessionRow}>
          <Text style={[s.sessionDay, { color: colors.text }]}>{session.day_name}</Text>
          <Text style={[s.sessionDate, { color: colors.text3 }]}>
            {new Date(session.session_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </Text>
        </View>

        {/* Row 2: type label */}
        <Text style={[s.sessionType, { color: colors.text2 }]}>
          {SESSION_LABELS[session.session_type] ?? session.session_type}
        </Text>

        {/* Row 3: chips */}
        <View style={s.chips}>
          {session.duration_min && (
            <Chip label={`${session.duration_min} min`} color={colors.text3} bg={colors.border} />
          )}
          {session.rpe_perceived != null && (
            <Chip label={`RPE ${session.rpe_perceived}`} color={barColor} bg={barColor + '1A'} />
          )}
          {session.fatigue != null && (
            <Chip label={`Fatiga ${session.fatigue}`} color={colors.orange} bg={colors.orange + '1A'} />
          )}
          {session.subtype && (
            <Chip label={SUBTYPE_LABELS[session.subtype]} color={colors.text2} bg={colors.border} />
          )}
          {session.metrics?.distancia_km != null && (
            <Chip label={`${session.metrics.distancia_km} km`} color={barColor} bg={barColor + '1A'} />
          )}
          {session.metrics?.ritmo_min_km && (
            <Chip label={`${session.metrics.ritmo_min_km}/km`} color={barColor} bg={barColor + '1A'} />
          )}
          {session.metrics?.metros != null && (
            <Chip label={`${session.metrics.metros} m`} color={barColor} bg={barColor + '1A'} />
          )}
          {session.metrics?.fc_media != null && (
            <Chip label={`FC ${session.metrics.fc_media}`} color={colors.text3} bg={colors.border} />
          )}
          {session.metrics?.ejercicios?.some((e) => e.kg != null) && (
            <Chip
              label={`máx ${Math.max(...session.metrics.ejercicios.filter((e) => e.kg != null).map((e) => e.kg as number))} kg`}
              color={colors.text3}
              bg={colors.border}
            />
          )}
          <Chip label={expanded ? '▲ Menos' : '▼ Más'} color={colors.text3} bg={colors.border} />
        </View>

        {/* Expanded: notes + AI feedback */}
        {expanded && (
          <View style={s.expandedBlock}>
            {session.notes ? (
              <View style={[s.noteBlock, { backgroundColor: colors.border }]}>
                <Text style={[s.noteLabel, { color: colors.text3 }]}>NOTAS</Text>
                <Text style={[s.noteText, { color: colors.text2 }]}>{session.notes}</Text>
              </View>
            ) : null}
            {session.ai_feedback ? (
              <View style={[s.feedbackBlock, { backgroundColor: barColor + '12', borderColor: barColor + '33' }]}>
                <Text style={[s.feedbackLabel, { color: barColor }]}>FEEDBACK COACH</Text>
                <Text style={[s.feedbackText, { color: colors.text }]}>{session.ai_feedback}</Text>
              </View>
            ) : (
              <Text style={[s.noFeedback, { color: colors.text3 }]}>Sin feedback de IA para esta sesión.</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HistorialScreen() {
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<Filter>('all');

  const { sessions, loading, error, refetch } = useSessions(40);
  const { sessions: weekSessions } = useWeekSessions();

  const filtered = useMemo(
    () => sessions.filter((s) => matchesFilter(s.session_type, activeFilter)),
    [sessions, activeFilter],
  );

  const weekStats = useMemo(() => {
    const total = weekSessions.length;
    const totalMin = weekSessions.reduce((a, s) => a + (s.duration_min ?? 0), 0);
    const avgRpe = total > 0
      ? weekSessions.reduce((a, s) => a + (s.rpe_perceived ?? 0), 0) / total
      : 0;
    // Consecutive days with a session ending today
    const sorted = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date));
    let streak = 0;
    const today = new Date();
    for (const sess of sorted) {
      const d = new Date(sess.session_date);
      const expected = new Date(today);
      expected.setDate(today.getDate() - streak);
      if (d.toDateString() === expected.toDateString()) streak++;
      else break;
    }
    return { total, totalMin, avgRpe, streak };
  }, [sessions, weekSessions]);

  const chartData = useMemo(() => buildChartData(weekSessions), [weekSessions]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Week stats ── */}
        <StatGrid columns={4} style={{ marginHorizontal: 0, marginTop: 0 }}>
          <StatCard>
            <Text style={[s.statNum, { color: colors.text }]}>{weekStats.total}</Text>
            <Text style={[s.statUnit, { color: colors.text3 }]}>sesiones</Text>
            <Text style={[s.statLabel, { color: colors.text3 }]}>Semana</Text>
          </StatCard>
          <StatCard>
            <Text style={[s.statNum, { color: colors.text }]}>{weekStats.totalMin}</Text>
            <Text style={[s.statUnit, { color: colors.text3 }]}>min</Text>
            <Text style={[s.statLabel, { color: colors.text3 }]}>Tiempo</Text>
          </StatCard>
          <StatCard>
            <Text style={[s.statNum, { color: colors.text }]}>
              {weekStats.avgRpe > 0 ? weekStats.avgRpe.toFixed(1) : '—'}
            </Text>
            <Text style={[s.statUnit, { color: colors.text3 }]}>/10</Text>
            <Text style={[s.statLabel, { color: colors.text3 }]}>RPE</Text>
          </StatCard>
          <StatCard>
            <Text style={[s.statNum, { color: colors.accent }]}>{weekStats.streak}</Text>
            <Text style={[s.statUnit, { color: colors.text3 }]}>días</Text>
            <Text style={[s.statLabel, { color: colors.text3 }]}>Racha</Text>
          </StatCard>
        </StatGrid>

        {/* ── RPE chart ── */}
        {chartData.length > 0 && (
          <View style={s.chartSection}>
            <Text style={[s.sectionTitle, { color: colors.text3 }]}>RPE ESTA SEMANA</Text>
            <View style={[s.chartCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
              <RpeBarChart data={chartData} color={colors.accent} />
            </View>
          </View>
        )}

        {/* ── Filter tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
        >
          {FILTERS.map((f) => {
            const active = f.key === activeFilter;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  s.filterBtn,
                  {
                    backgroundColor: active ? colors.text : colors.glassBg,
                    borderColor: active ? colors.text : colors.border,
                  },
                ]}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.filterText, { color: active ? colors.card : colors.text3 }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Session list ── */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[s.loadingText, { color: colors.text3 }]}>Cargando sesiones...</Text>
          </View>
        ) : error ? (
          <View style={s.loadingBox}>
            <Text style={[s.loadingText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.loadingBox}>
            <Text style={[s.loadingText, { color: colors.text3 }]}>
              {sessions.length === 0
                ? 'Aún no hay sesiones registradas. ¡Empieza hoy!'
                : 'Sin sesiones para este filtro.'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[s.sectionTitle, { color: colors.text3 }]}>
              SESIONES RECIENTES ({filtered.length})
            </Text>
            {filtered.map((session) => (
              <SessionCard key={session.id} session={session} colors={colors} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.lg },

  // Stats
  statNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, letterSpacing: -0.8 },
  statUnit: { fontSize: FontSize.xs, marginTop: 1 },
  statLabel: { fontSize: FontSize.sm, marginTop: Spacing.gapXxs, fontWeight: FontWeight.label },

  // Chart
  chartSection: { gap: Spacing.gapSm },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65 },
  chartCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.base,
  },

  // Filters
  filtersRow: { gap: Spacing.gapSm, paddingVertical: 2 },
  filterBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapXs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  filterText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },

  // Loading / empty
  loadingBox: { alignItems: 'center', gap: Spacing.gapSm, paddingVertical: Spacing.xxl },
  loadingText: { fontSize: FontSize.md, textAlign: 'center' },

  // Session card
  sessionCard: {
    flexDirection: 'row',
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sessionBar: { width: 4 },
  sessionBody: { flex: 1, padding: Spacing.base, gap: Spacing.gapXs },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDay: { fontSize: FontSize.body, fontWeight: FontWeight.label },
  sessionDate: { fontSize: FontSize.md },
  sessionType: { fontSize: FontSize.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gapXs },
  chip: { paddingHorizontal: Spacing.gapSm, paddingVertical: 3, borderRadius: Radius.xs },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },

  // Expanded
  expandedBlock: { gap: Spacing.gapSm, marginTop: Spacing.gapSm },
  noteBlock: { borderRadius: Radius.sm, padding: Spacing.gapMd },
  noteLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.black, letterSpacing: 0.5, marginBottom: 4 },
  noteText: { fontSize: FontSize.md, lineHeight: 18 },
  feedbackBlock: { borderRadius: Radius.sm, padding: Spacing.gapMd, borderWidth: 1 },
  feedbackLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.black, letterSpacing: 0.5, marginBottom: 4 },
  feedbackText: { fontSize: FontSize.md, lineHeight: 20 },
  noFeedback: { fontSize: FontSize.sm, fontStyle: 'italic' },
});
