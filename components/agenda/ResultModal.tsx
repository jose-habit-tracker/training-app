// components/agenda/ResultModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CalendarEvent, RaceDetails } from '../../types';
import { parseClock, paceMinKm } from '../../lib/agenda/time';
import { isPersonalBest } from '../../lib/agenda/pb';
import { askGroq, COACH_SYSTEM_PROMPT } from '../../lib/groq';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { tapSuccess } from '../../lib/haptics';

interface ResultModalProps {
  visible: boolean;
  race: CalendarEvent | null;
  history: CalendarEvent[];
  onClose: () => void;
  onSave: (id: string, race: RaceDetails) => Promise<string | null>;
  onPB: () => void; // dispara confeti en la pantalla
}

export function ResultModal({ visible, race, history, onClose, onSave, onPB }: ResultModalProps) {
  const { colors } = useTheme();
  const [time, setTime] = useState('');
  const [position, setPosition] = useState('');
  const [feelings, setFeelings] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTime(race?.race?.result_time ?? '');
    setPosition(race?.race?.position != null ? String(race.race.position) : '');
    setFeelings(race?.race?.feelings ?? '');
  }, [visible, race]);

  if (!race?.race) return null;
  const details = race.race;

  const handleSave = async () => {
    const seconds = parseClock(time);
    if (seconds === null) { Alert.alert('Revisa el tiempo', 'Formato 1:29:59 o 41:32'); return; }
    setSaving(true);

    const pb = isPersonalBest(details.distance_km, time, history.filter((e) => e.id !== race.id));
    const pace = paceMinKm(seconds, details.distance_km);

    let analysis: string | undefined;
    try {
      const prompt = [
        `Acabo de correr "${race.title}" (${details.distance_km} km).`,
        `Resultado: ${time}${pace ? ` (${pace}/km)` : ''}.`,
        details.target_time ? `Mi objetivo era ${details.target_time}.` : 'No tenía tiempo objetivo.',
        position ? `Posición: ${position}.` : '',
        feelings ? `Sensaciones: ${feelings}` : '',
        pb ? 'Es mi mejor marca personal en la distancia.' : '',
        'Dame un análisis breve (máx 120 palabras): valoración vs objetivo y 2-3 ajustes para la siguiente.',
      ].filter(Boolean).join(' ');
      analysis = await askGroq([{ role: 'user', content: prompt }], COACH_SYSTEM_PROMPT);
    } catch {
      analysis = undefined; // el análisis es best-effort
    }

    const err = await onSave(race.id, {
      ...details,
      result_time: time,
      position: position ? Number(position.replace(/[^0-9]/g, '')) || undefined : undefined,
      feelings: feelings || undefined,
      ai_analysis: analysis ?? details.ai_analysis,
    });
    setSaving(false);
    if (err) { Alert.alert('Error al guardar', err); return; }
    tapSuccess();
    if (pb) onPB();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { color: colors.text }]}>Resultado · {race.title}</Text>
            <Text style={[s.meta, { color: colors.text3 }]}>
              {details.distance_km} km{details.target_time ? ` · objetivo ${details.target_time}` : ''}
            </Text>
            <Input label="Tiempo final" value={time} onChangeText={setTime} placeholder="1:29:59" />
            <Input label="Posición (opcional)" value={position} onChangeText={setPosition} keyboardType="number-pad" placeholder="42" />
            <Input label="Sensaciones" value={feelings} onChangeText={setFeelings} multiline placeholder="¿Cómo fue? Ritmo, avituallamiento, cabeza..." />
            <Button label={saving ? 'Guardando y analizando...' : 'Guardar resultado'} onPress={handleSave} disabled={saving} fullWidth />
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
  meta: { fontSize: FontSize.base },
});
