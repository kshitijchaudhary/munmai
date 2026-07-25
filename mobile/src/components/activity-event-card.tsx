import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getActivityEventPresentation,
  getActivitySplitAccessibilityLabel,
} from '@/activity/activity-event-presentation';
import type {
  ActivityEvent,
  ActivityEventSplit,
} from '@/activity/activity-model';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
import { formatCurrency } from '@/dashboard/dashboard-model';

interface ActivityEventCardProps {
  context: 'main' | 'space';
  event: ActivityEvent;
  onPress?: () => void;
}

function SplitRow({ split }: { split: ActivityEventSplit }) {
  return (
    <View
      accessibilityLabel={getActivitySplitAccessibilityLabel(split)}
      style={styles.splitRow}>
      <View style={styles.splitAvatar}>
        <Text style={styles.splitAvatarText}>
          {split.userName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.splitName}>
        {split.userName}
      </Text>
      <View style={styles.splitMarkers}>
        {split.isPayer ? <Text style={styles.marker}>Payer</Text> : null}
        {split.isCurrentUser ? <Text style={styles.marker}>You</Text> : null}
      </View>
      <Text numberOfLines={1} style={styles.splitAmount}>
        {formatCurrency(split.amount)}
      </Text>
    </View>
  );
}

export function ActivityEventCard({
  context,
  event,
  onPress,
}: ActivityEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const presentation = getActivityEventPresentation(event, context);
  const isShared = event.type === 'shared-expense';
  const canExpand = isShared && Boolean(event.splits?.length);
  const amountColor =
    event.type === 'income'
      ? colors.income
      : event.type === 'expense'
        ? colors.expense
        : colors.text;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityHint={onPress ? 'Opens activity details' : undefined}
        accessibilityLabel={`${presentation.title}, ${presentation.typeLabel}, ${presentation.metadata}, ${presentation.amount}`}
        accessibilityRole={onPress ? 'button' : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.eventButton,
          pressed && styles.eventButtonPressed,
        ]}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.title}>
            {presentation.title}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={[styles.amount, { color: amountColor }]}>
            {presentation.amount}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.metadata}>
          {presentation.metadata}
        </Text>
        {presentation.footer ? (
          <Text numberOfLines={1} style={styles.footer}>
            {presentation.footer}
          </Text>
        ) : null}
      </Pressable>

      {canExpand ? (
        <Pressable
          accessibilityHint={
            expanded ? 'Hides participant amounts' : 'Shows participant amounts'
          }
          accessibilityLabel={`${expanded ? 'Hide' : 'Show'} split details for ${presentation.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [
            styles.expandButton,
            pressed && styles.expandButtonPressed,
          ]}>
          <Text style={styles.expandButtonText}>{presentation.people}</Text>
          <Text accessibilityElementsHidden style={styles.chevron}>
            {expanded ? '\u2303' : '\u2304'}
          </Text>
        </Pressable>
      ) : null}

      {expanded && canExpand ? (
        <View style={styles.splitContainer}>
          {event.splits?.map((split) => (
            <SplitRow key={split.userId} split={split} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  eventButton: { gap: 4, paddingHorizontal: spacing.md, paddingVertical: 13 },
  eventButtonPressed: { backgroundColor: colors.surfaceRaised },
  titleLine: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  title: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  amount: {
    maxWidth: '46%',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  metadata: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  footer: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  expandButton: {
    minHeight: touchTargets.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  expandButtonPressed: { backgroundColor: colors.surfaceRaised },
  expandButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  chevron: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  splitContainer: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  splitRow: {
    minHeight: touchTargets.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  splitAvatar: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.round,
    backgroundColor: colors.accentSoft,
  },
  splitAvatarText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  splitName: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  splitMarkers: { flexDirection: 'row', gap: 4 },
  marker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  splitAmount: {
    flexShrink: 0,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
