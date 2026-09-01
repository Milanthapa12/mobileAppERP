import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '@/constants/theme';

export type NotificationItem = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  time: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: NotificationItem[];
};

export const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    icon: 'checkmark-circle',
    iconBg: Colors.successLight,
    iconColor: Colors.success,
    title: 'Leave Approved',
    body: 'Your Annual Leave request has been processed.',
    time: '2 hours ago',
  },
  {
    id: '2',
    icon: 'hourglass',
    iconBg: Colors.primaryLight,
    iconColor: Colors.primary,
    title: 'Overtime Claim Received',
    body: 'Overtime request for 4.0 hrs is under manager review.',
    time: '1 day ago',
  },
  {
    id: '3',
    icon: 'document-text',
    iconBg: Colors.warningLight,
    iconColor: Colors.warning,
    title: 'New Policy Document',
    body: 'HR published updated Travel & Expense Guidelines 2026.',
    time: '3 days ago',
  },
];

export default function NotificationsModal({ visible, onClose, items }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
              <Text style={styles.headerTitle}>Notifications</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {items.map((n) => (
              <View key={n.id} style={styles.item}>
                <View style={[styles.iconBox, { backgroundColor: n.iconBg }]}>
                  <Ionicons name={n.icon} size={20} color={n.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={styles.itemBody}>{n.body}</Text>
                  <Text style={styles.itemTime}>{n.time}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bg,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  itemBody: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemTime: {
    fontSize: 10,
    color: Colors.textPlaceholder,
    marginTop: 4,
    fontWeight: '600',
  },
  closeBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...Shadow.primary,
  },
  closeBtnText: {
    color: Colors.card,
    fontSize: 15,
    fontWeight: '700',
  },
});
