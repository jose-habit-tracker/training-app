import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';
import { Input } from '../ui/Input';
import { useRecorder } from '../../hooks/useRecorder';

interface CoachInputProps {
  onSendText: (text: string) => void;
  onSendAudio: (blob: Blob) => void;
  busy: boolean; // el coach está pensando o transcribiendo
  recorder: ReturnType<typeof useRecorder>; // inyectado para poder disparar el micro desde los chips
}

export function CoachInput({ onSendText, onSendAudio, busy, recorder }: CoachInputProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const { status, seconds, supported, start, stop, cancel } = recorder;

  function handleSend() {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onSendText(t);
  }

  async function handleMicPress() {
    if (status === 'recording') {
      const blob = await stop();
      if (blob) onSendAudio(blob);
    } else {
      await start();
    }
  }

  if (status === 'recording') {
    return (
      <View style={[s.row, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[s.recordingPill, { backgroundColor: colors.danger + '18', borderColor: colors.danger + '55' }]}>
          <View style={[s.recDot, { backgroundColor: colors.danger }]} />
          <Text style={[s.recText, { color: colors.text }]}>
            Grabando… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </Text>
          <TouchableOpacity onPress={cancel} hitSlop={8}>
            <Text style={[s.cancelText, { color: colors.text3 }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.micBtn, { backgroundColor: colors.danger }]}
          onPress={handleMicPress}
          activeOpacity={0.8}
        >
          <Ionicons name="stop" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.row, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      <Input
        value={text}
        onChangeText={setText}
        placeholder="Cuéntale al coach…"
        multiline
        containerStyle={s.inputContainer}
        returnKeyType="send"
        onSubmitEditing={handleSend}
        maxLength={600}
      />
      {text.trim().length > 0 ? (
        <TouchableOpacity
          style={[s.micBtn, { backgroundColor: busy ? colors.border : colors.text }]}
          onPress={handleSend}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator size="small" color={colors.text3} /> : <Ionicons name="arrow-up" size={18} color={colors.card} />}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[s.micBtn, { backgroundColor: supported && !busy ? colors.accent : colors.border }]}
          onPress={handleMicPress}
          disabled={!supported || busy}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="mic" size={18} color="#fff" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderTopWidth: 0.5,
    gap: Spacing.gapMd,
  },
  inputContainer: { flex: 1 },
  micBtn: {
    width: 40, height: 40, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  recordingPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.gapMd,
    borderRadius: Radius.pill, borderWidth: 1,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.gapMd,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  recText: { fontSize: FontSize.md, flex: 1 },
  cancelText: { fontSize: FontSize.md },
});
