import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { ExerciseTemplate } from '../../types';
import { EditorSport, EXERCISE_FIELDS, ExerciseFieldKey } from '../../lib/training/fields';
import { exerciseSummary } from '../../lib/training/summary';
import { Input } from '../ui/Input';
import { Stepper } from './Stepper';
import { PresetChips } from './PresetChips';
import { tapLight } from '../../lib/haptics';

interface ExerciseAccordionProps {
  exercise: ExerciseTemplate;
  index: number;
  total: number;
  sport: EditorSport;
  accent: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ExerciseTemplate>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

export function ExerciseAccordion({
  exercise, index, total, sport, accent, expanded, onToggle, onChange, onRemove, onMove,
}: ExerciseAccordionProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(expanded ? 90 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 90 : 0, { duration: 180 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const summary = exerciseSummary(exercise);
  const fields = EXERCISE_FIELDS[sport];

  return (
    <View style={[s.card, { backgroundColor: colors.glassBg, borderColor: expanded ? accent : colors.glassBorder }]}>
      <TouchableOpacity style={s.header} onPress={() => { tapLight(); onToggle(); }} activeOpacity={0.8}>
        <View style={s.headerLeft}>
          <Text style={[s.index, { color: accent }]}>#{index + 1}</Text>
          <View style={s.headerText}>
            <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>
              {exercise.name || 'Ejercicio sin nombre'}
            </Text>
            {!expanded && !!summary && (
              <Text style={[s.summary, { color: accent }]} numberOfLines={1}>{summary}</Text>
            )}
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={16} color={colors.text3} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(180)} style={s.body}>
          <Input value={exercise.name} onChangeText={(v) => onChange({ name: v })} placeholder="Nombre del ejercicio" />

          {fields.map((f) =>
            f.key === 'sets' ? (
              <Stepper key={f.key} label={f.label} value={exercise.sets} onChange={(v) => onChange({ sets: v })} />
            ) : (
              <View key={f.key}>
                <Input
                  label={f.label}
                  value={exercise[f.key as Exclude<ExerciseFieldKey, 'sets'>] ?? ''}
                  onChangeText={(v) => onChange({ [f.key]: v || undefined })}
                  placeholder={f.placeholder}
                />
                {f.presets && (
                  <PresetChips
                    presets={f.presets}
                    value={exercise[f.key as Exclude<ExerciseFieldKey, 'sets'>]}
                    onSelect={(v) => onChange({ [f.key]: v })}
                    accent={accent}
                  />
                )}
              </View>
            ),
          )}

          <View style={s.actions}>
            <View style={s.moveButtons}>
              <TouchableOpacity
                onPress={() => onMove(-1)}
                disabled={index === 0}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Subir ejercicio"
                accessibilityState={{ disabled: index === 0 }}
              >
                <Ionicons name="arrow-up-circle-outline" size={22} color={index === 0 ? colors.border : colors.text3} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onMove(1)}
                disabled={index === total - 1}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Bajar ejercicio"
                accessibilityState={{ disabled: index === total - 1 }}
              >
                <Ionicons name="arrow-down-circle-outline" size={22} color={index === total - 1 ? colors.border : colors.text3} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
              <Text style={[s.remove, { color: colors.danger }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  headerText: { flex: 1 },
  index: { fontSize: FontSize.md, fontWeight: FontWeight.black },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.heavy },
  summary: { fontSize: FontSize.base, marginTop: 2 },
  body: { gap: Spacing.gapSm, marginTop: Spacing.base },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.gapXs },
  moveButtons: { flexDirection: 'row', gap: Spacing.gapSm },
  remove: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});
