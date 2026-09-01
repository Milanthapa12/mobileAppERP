import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

type Status = 'Pending' | 'Approved' | 'Rejected' | string;

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Pending:  { bg: Colors.warningLight, text: Colors.warning },
  Approved: { bg: Colors.successLight, text: Colors.success },
  Rejected: { bg: Colors.dangerLight,  text: Colors.danger },
};

const DEFAULT_STYLE = { bg: Colors.primaryLight, text: Colors.primary };

type Props = {
  status: Status;
  style?: ViewStyle;
};

export default function StatusBadge({ status, style }: Props) {
  const { bg, text } = STATUS_STYLES[status] ?? DEFAULT_STYLE;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
