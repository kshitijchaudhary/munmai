import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { GroupListItem } from '@/groups/group-model';

interface GroupCardProps {
  group: GroupListItem;
  onPress: () => void;
}

export function GroupCard({ group, onPress }: GroupCardProps) {
  const [focused, setFocused] = useState(false);
  const updated = group.updatedAt
    ? new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(group.updatedAt))
    : null;

  return (
    <Pressable
      accessibilityLabel={`${group.name}, ${group.memberIds.length} ${group.memberIds.length === 1 ? 'member' : 'members'}${updated ? `, updated ${updated}` : ''}`}
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.card, focused && styles.focused, pressed && styles.pressed]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{group.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{group.name}</Text>
        <Text style={styles.meta}>
          {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
          {updated ? ` · Updated ${updated}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, padding: 15 },
  pressed: { opacity: 0.7 },
  focused: { borderColor: colors.accent },
  avatar: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.accentSoft },
  avatarText: { color: colors.accent, fontSize: 20, fontWeight: '900' },
  copy: { flex: 1, gap: 5 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  meta: { color: colors.textMuted, fontSize: 12 },
  chevron: { color: colors.textMuted, fontSize: 28 },
});
