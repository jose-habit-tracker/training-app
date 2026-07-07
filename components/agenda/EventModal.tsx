// components/agenda/EventModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, RaceDetails } from '../../types';
import { parseClock } from '../../lib/agenda/time';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PresetChips } from '../training/PresetChips';
import { tapSuccess } from '../../lib/haptics';

const ICONS = ['📌', '✈️', '🩺', '🎂', '💼', '🏖️', '⛰️', '🎉'];
const DISTANCES = ['5', '10', '21.1', '42.2'];

export type EventDraft = Omit<CalendarEvent, 'id' | 'user_id' | 'created_at'>;

interface EventModalProps {
  visible: boolean;
  initialDate: string;
  editing: CalendarEvent | null;      // null = alta
  onClose: () => void;
  onSave: (draft: EventDraft, id?: string) => Promise<string | null>;
  onDelete?: (id: string) => Promise<string | null>;
}

export function EventModal({ visible, initialDate, editing, onClose, onSave, onDelete }: EventModalProps) {
  const { colors } = useTheme();
  const [kind, setKind] = useState<'event' | 'race'>('event');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [endDate, setEndDate] = useState('');
  const [icon, setIcon] = useState('📌');
  const [notes, setNotes] = useState('');
  const [distance, setDistance] = useState('');
  const [target, setTarget] = useState('');
  const [isGoal, setIsGoal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setKind(editing?.kind ?? 'event');
    setTitle(editing?.title ?? '');
    setDate(editing?.date ?? initialDate);
    setEndDate(editing?.end_date ?? '');
    setIcon(editing?.icon ?? '📌');
    setNotes(editing?.notes ?? '');
    setDistance(editing?.race ? String(editing.race.distance_km) : '');
    setTarget(editing?.race?.target_time ?? '');
    setIsGoal(editing?.race?.is_goal ?? false);
  }, [visible, editing, initialDate]);

  const validate = (): string | null => {
    if (!title.trim()) return 'Pon un título';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Fecha en formato AAAA-MM-DD';
    if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < date)) return 'Fecha fin inválida';
    if (kind === 'race') {
      const km = parseFloat(distance.replace(',', '.'));
      if (!km || km <= 0) return 'Distancia en km (p. ej. 21.1)';
      if (target && parseClock(target) === null) return 'Objetivo como 1:29:59 o 41:32';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Revisa el evento', err); return; }
    setSaving(true);
    const race: RaceDetails | null = kind === 'race'
      ? {
          ...(editing?.race ?? {}),
          distance_km: parseFloat(distance.replace(',', '.')),
          target_time: target || undefined,
          is_goal: isGoal,
        }
      : null;
    const draft: EventDraft = {
      title: title.trim(), date, end_date: endDate || null, kind,
      icon: kind === 'event' ? icon : null, notes: notes || null, race,
    };
    const saveErr = await onSave(draft, editing?.id);
    setSaving(false);
    if (saveErr) { Alert.alert('Error al guardar', saveErr); return; }
    tapSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: colors.text }]}>{editing ? 'Editar' : 'Nuevo'} evento</Text>

            <View style={[s.kindTrack, { backgroundColor: colors.glassBg, borderColor: colors.border }]}>
              {(['event', 'race'] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[s.kindSegment, kind === k && { backgroundColor: k === 'race' ? '#ff375f' : colors.accent }]}
                  onPress={() => setKind(k)}
                >
                  <Text style={[s.kindText, { color: kind === k ? '#fff' : colors.text3 }]}>
                    {k === 'race' ? '🏁 Carrera' : '📌 Evento'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Título" value={title} onChangeText={setTitle} placeholder={kind === 'race' ? 'Media Maratón Valencia' : 'Viaje a Berlín'} />
            <Input label="Fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-10-25" />
            <Input label="Fecha fin (opcional)" value={endDate} onChangeText={setEndDate} placeholder="Para eventos de varios días" />

            {kind === 'event' && (
              <View>
                <Input label="Icono" value={icon} onChangeText={setIcon} placeholder="📌" />
                <PresetChips presets={ICONS} value={icon} onSelect={setIcon} accent={colors.accent} />
              </View>
            )}

            {kind === 'race' && (
              <>
                <View>
                  <Input label="Distancia (km)" value={distance} onChangeText={setDistance} placeholder="21.1" keyboardType="decimal-pad" />
                  <PresetChips presets={DISTANCES} value={distance} onSelect={setDistance} accent="#ff375f" />
                </View>
                <Input label="Tiempo objetivo (opcional)" value={target} onChangeText={setTarget} placeholder="1:29:59" />
                <TouchableOpacity style={s.goalRow} onPress={() => setIsGoal((g) => !g)} activeOpacity={0.75}>
                  <Text style={[s.goalText, { color: colors.text }]}>Carrera objetivo del plan</Text>
                  <Text style={{ fontSize: FontSize.lg }}>{isGoal ? '✅' : '⬜️'}</Text>
                </TouchableOpacity>
              </>
            )}

            <Input label="Notas" value={notes} onChangeText={setNotes} multiline placeholder="Opcional" />

            <Button label={saving ? 'Guardando...' : 'Guardar'} onPress={handleSave} disabled={saving} fullWidth />
            {editing && onDelete && (
              <Button
                label="Eliminar evento"
                variant="danger"
                fullWidth
                onPress={async () => {
                  const err = await onDelete(editing.id);
                  if (err) Alert.alert('Error', err); else onClose();
                }}
              />
            )}
            <Button label="Cancelar" variant="ghost" fullWidth onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, borderWidth: 1, maxHeight: '88%' },
  content: { padding: Spacing.lg, gap: Spacing.base, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  kindTrack: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: 3, gap: 2 },
  kindSegment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  kindText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  goalText: { fontSize: FontSize.md, fontWeight: FontWeight.label },
});
