import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  children?: React.ReactNode; // p. ej. una ProposalCard debajo del texto
}

export function MessageBubble({ role, content, children }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = role === 'user';
  return (
    <View style={[s.row, isUser ? s.rowUser : s.rowAi]}>
      {!isUser && (
        <View style={[s.avatar, { backgroundColor: colors.accent }]}>
          <Text style={s.avatarText}>C</Text>
        </View>
      )}
      <View
        style={[
          s.bubble,
          isUser
            ? { backgroundColor: colors.text }
            : { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
        ]}
      >
        {content.length > 0 && (
          <Text style={[s.text, { color: isUser ? colors.card : colors.text }]}>{content}</Text>
        )}
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: Spacing.base, alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.gapSm, marginBottom: 2,
  },
  avatarText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.black },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.gapMd,
    borderRadius: Radius.lg,
    gap: Spacing.gapSm,
  },
  text: { fontSize: FontSize.body, lineHeight: 22 },
});
