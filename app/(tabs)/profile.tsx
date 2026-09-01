import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import AppHeader from '@/components/AppHeader';
import ScreenWrapper from '@/components/ScreenWrapper';
import { Colors, getInitials, Radius, Shadow } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, activeBranch, logout } = useAuth();


  const handleSignOut = () => {
    const executeLogout = async () => {
      await logout();
      router.replace('/');
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to sign out?')) {
        executeLogout();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out of Vritico ERP?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: executeLogout,
          },
        ]
      );
    }
  };

  const displayName = user?.name || 'Milan Thapa';
  const displayEmail = user?.email || 'milan.thapa@vritico.com';
  const displayRole = user?.role || 'Software Engineer • Mobile ERP';
  const displayEmployeeId = user?.employee_code || (user?.id ? `VRT-${user?.id}` : 'VRT-84920');

  return (
    <ScreenWrapper>
      <AppHeader
        title="My Profile"
        userName={displayName}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar Card */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userRole}>{displayRole}</Text>
        </View>

        {/* Content Section */}
        <View style={styles.contentBody}>
          {/* Employee Details Card */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Employee Information</Text>

            <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="mail-outline" size={20} color="#0041E8" />
              </View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{displayEmail}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="card-outline" size={20} color="#16A34A" />
              </View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Employee ID</Text>
                <Text style={styles.infoValue}>{displayEmployeeId}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, { backgroundColor: '#F0FDFA' }]}>
                <Ionicons name="business-outline" size={20} color="#0D9488" />
              </View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Active Branch</Text>
                <Text style={styles.infoValue}>{activeBranch?.name || 'Om Surgical Concern'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="location-outline" size={20} color="#9333EA" />
              </View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Office Location</Text>
                <Text style={styles.infoValue}>Kathmandu HQ, Nepal</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="call-outline" size={20} color="#D97706" />
              </View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Contact Number</Text>
                <Text style={styles.infoValue}>+977 9801234567</Text>
              </View>
            </View>
          </View>

          {/* Account Options Card */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account Settings</Text>

            <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
                <Text style={styles.menuText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" />
                <Text style={styles.menuText}>Privacy & Security</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  avatarSection: {
    backgroundColor: Colors.card,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatarBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#C7D2FE',
    ...Shadow.sm,
  },
  avatarText: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  userRole: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  contentBody: {
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: 18,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextGroup: { gap: 2 },
  infoLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerLight,
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: Radius.lg,
    height: 52,
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
});
