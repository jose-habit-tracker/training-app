import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SESSION_LABELS } from '../../constants/trainingPlan';
import { SessionType } from '../../types';
import { tapLight } from '../../lib/haptics';

interface VariantDropdownProps {
  options: SessionType[];
  value: SessionType;
  onChange: (t: SessionType) => void;
}

// Solo se renderiza si el deporte tiene más de una variante.
export function VariantDropdown({ options, value, onChange }: VariantDropdownProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;

  return (
    <View>
      <Text style={[s.label, { color: colors.text3 }]}>VARIANTE</Text>
      <TouchableOpacity
        style={[s.trigger, { backgroundColor: colors.glassBg, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[s.value, { color: colors.text }]}>{SESSION_LABELS[value] ?? value}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.text3} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {options.map((t) => {
              const active = t === value;
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.option, active && { backgroundColor: colors.accentSoft }]}
                  onPress={() => { tapLight(); onChange(t); setOpen(false); }}
                >
                  <Text style={[s.optionText, { color: active ? colors.accent : colors.text }]}>
                    {SESSION_LABELS[t] ?? t}
                  </Text>
                  {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, letterSpacing: 0.65, marginBottom: Spacing.gapXs },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.inputPaddingH, minHeight: 42 },
  value: { fontSize: FontSize.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.xxl },
  sheet: { borderRadius: Radius.modal, borderWidth: 1, overflow: 'hidden' },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.base },
  optionText: { fontSize: FontSize.md, fontWeight: FontWeight.label },
});
