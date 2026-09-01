import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, getInitials } from '@/constants/theme';

type Props = {
  /** Title shown in the center (e.g. screen name or branch name) */
  title: string;
  /** Optional subtitle under the title */
  subtitle?: string;
  /** Current user's display name, used to derive initials */
  userName?: string;
  /** Notification count for badge; 0 hides the badge */
  notificationCount?: number;
  /** Called when the avatar is tapped */
  onAvatarPress?: () => void;
  /** Called when the bell icon is tapped */
  onNotificationPress?: () => void;
  /** Show a back arrow instead of avatar */
  showBack?: boolean;
  /** Called when back arrow is tapped */
  onBackPress?: () => void;
};

export default function AppHeader({
  title,
  subtitle,
  userName,
  notificationCount = 0,
  onAvatarPress,
  onNotificationPress,
  showBack = false,
  onBackPress,
}: Props) {
  return (
    <View style={styles.topBar}>
      {/* Left: Avatar or Back */}
      {showBack ? (
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={onBackPress}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.avatarCircle} activeOpacity={0.8} onPress={onAvatarPress}>
          <Text style={styles.avatarText}>{getInitials(userName)}</Text>
        </TouchableOpacity>
      )}

      {/* Center: Title */}
      <View style={styles.titleArea}>
        <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {/* Right: Bell */}
      <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={onNotificationPress}>
        <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
        {notificationCount > 0 && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  avatarText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  titleArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 1,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.danger,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.card,
  },
  bellBadgeText: {
    color: Colors.card,
    fontSize: 8,
    fontWeight: '900',
  },
});
