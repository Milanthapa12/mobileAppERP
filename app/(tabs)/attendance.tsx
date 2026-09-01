import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAttendance } from '@/context/AttendanceContext';
import AppHeader from '@/components/AppHeader';
import ScreenWrapper from '@/components/ScreenWrapper';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useLiveClock } from '@/hooks/useLiveClock';

const { width } = Dimensions.get('window');

export default function AttendanceScreen() {
  const { isCheckedIn, timeIn, timeOut, totalHours, toggleClockIn } = useAttendance();
  const [activeSegment, setActiveSegment] = useState<'history' | 'map' | 'statistic'>('history');
  const [selectedMonth, setSelectedMonth] = useState('FEBRUARY, 2026');
  const [selectedYear, setSelectedYear] = useState('2026');

  const { timeStr, dateStr } = useLiveClock('24h');

  const handleRecordClockIn = async () => {
    const actionType = isCheckedIn ? 'out' : 'in';
    try {
      await toggleClockIn();
      const msg = actionType === 'in'
        ? `Clocked in successfully!`
        : `Clocked out successfully!`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err?.message || `Failed to punch ${actionType}.`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Punch Error', msg);
    }
  };

  const handleSendReport = () => {
    const msg = 'Monthly attendance report sent to HR successfully!';
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Report Sent', msg);
  };

  return (
    <ScreenWrapper>
      <AppHeader
        title={
          activeSegment === 'history'
            ? 'Attendance History'
            : activeSegment === 'map'
            ? 'Clock In / Location'
            : 'Attendance Statistic'
        }
      />

      {/* Segmented Sub-tabs */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === 'history' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('history')}
        >
          <Text style={[styles.segmentText, activeSegment === 'history' && styles.segmentTextActive]}>HISTORY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === 'map' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('map')}
        >
          <Text style={[styles.segmentText, activeSegment === 'map' && styles.segmentTextActive]}>CLOCK IN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === 'statistic' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('statistic')}
        >
          <Text style={[styles.segmentText, activeSegment === 'statistic' && styles.segmentTextActive]}>STATISTIC</Text>
        </TouchableOpacity>
      </View>

      {/* SEGMENT 1: HISTORY VIEW */}
      {activeSegment === 'history' && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Filter Dropdown */}
            <TouchableOpacity style={styles.filterDropdown} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={18} color="#0041E8" />
              <Text style={styles.filterDropdownText}>{selectedMonth}</Text>
              <Ionicons name="chevron-down" size={16} color="#0041E8" />
            </TouchableOpacity>

            {/* Timeline Item 1: MON 10 Feb */}
            <View style={styles.historyCard}>
              <View style={styles.dayCol}>
                <Text style={styles.dayName}>MON</Text>
                <Text style={styles.dayDate}>10 Feb, 2026</Text>
              </View>
              <View style={styles.detailsCol}>
                <View style={styles.timeRow}>
                  <View style={[styles.timeDot, { backgroundColor: '#16A34A' }]}>
                    <Ionicons name="arrow-forward" size={10} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.timeValue}>08:00</Text>
                    <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B, Jalan Kebon K...</Text>
                  </View>
                </View>

                <View style={styles.timeRow}>
                  <View style={[styles.timeDot, { backgroundColor: '#DC2626' }]}>
                    <Ionicons name="arrow-back" size={10} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.timeValue}>17:00</Text>
                    <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B, Jalan Kebon K...</Text>
                  </View>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>8 H 0 M of working hours</Text>
                </View>
              </View>
            </View>

            {/* Timeline Item 2: SUN 9 Feb (Off Day) */}
            <View style={styles.historyCard}>
              <View style={styles.dayCol}>
                <Text style={[styles.dayName, { color: '#94A3B8' }]}>SUN</Text>
                <Text style={styles.dayDate}>9 Feb, 2026</Text>
              </View>
              <View style={styles.detailsCol}>
                <View style={styles.offDayBanner}>
                  <Text style={styles.offDayText}>Off Day</Text>
                </View>
              </View>
            </View>

            {/* Timeline Item 3: SAT 8 Feb (Overtime) */}
            <View style={styles.historyCard}>
              <View style={styles.dayCol}>
                <Text style={styles.dayName}>SAT</Text>
                <Text style={styles.dayDate}>8 Feb, 2026</Text>
              </View>
              <View style={styles.detailsCol}>
                <View style={styles.timeRow}>
                  <View style={[styles.timeDot, { backgroundColor: '#16A34A' }]}>
                    <Ionicons name="arrow-forward" size={10} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.timeValue}>13:02</Text>
                    <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B...</Text>
                  </View>
                </View>

                <View style={styles.timeRow}>
                  <View style={[styles.timeDot, { backgroundColor: '#DC2626' }]}>
                    <Ionicons name="arrow-back" size={10} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.timeValue}>17:00</Text>
                    <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B...</Text>
                  </View>
                </View>

                <View style={[styles.statusPill, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.statusPillText, { color: '#0284C7' }]}>
                    OVERTIME CLAIM | 4 H 2 M of working hours
                  </Text>
                </View>
              </View>
            </View>

            {/* Timeline Item 4: FRI 7 Feb (Late) */}
            <View style={styles.historyCard}>
              <View style={styles.dayCol}>
                <Text style={styles.dayName}>FRI</Text>
                <Text style={styles.dayDate}>7 Feb, 2026</Text>
              </View>
              <View style={styles.detailsCol}>
                <View style={styles.timeRow}>
                  <View style={[styles.timeDot, { backgroundColor: '#16A34A' }]}>
                    <Ionicons name="arrow-forward" size={10} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.timeValue}>08:13</Text>
                    <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B...</Text>
                  </View>
                </View>

                <View style={styles.timeRow}>
                  <View style={[styles.timeDot, { backgroundColor: '#DC2626' }]}>
                    <Ionicons name="arrow-back" size={10} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.timeValue}>17:00</Text>
                    <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B...</Text>
                  </View>
                </View>

                <View style={[styles.statusPill, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.statusPillText, { color: '#DC2626' }]}>
                    2 MIN LATE | 10 H 3 M of working hours
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Send Monthly Report Fixed Button */}
          <View style={styles.bottomBarFixed}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={handleSendReport}
            >
              <Text style={styles.primaryActionButtonText}>SEND MONTHLY REPORT</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SEGMENT 2: MAP CLOCK-IN VIEW */}
      {activeSegment === 'map' && (
        <View style={{ flex: 1 }}>
          {/* Simulated Map Workspace */}
          <View style={styles.mapContainer}>
            <View style={styles.mapGridBackground}>
              {/* Map Road Graphics */}
              <View style={styles.mapRoad1} />
              <View style={styles.mapRoad2} />
              <View style={styles.mapLandmark1}>
                <Text style={styles.landmarkText}>Jakarta Pusat</Text>
              </View>
              <View style={styles.mapLandmark2}>
                <Text style={styles.landmarkText}>Monumen Nasional</Text>
              </View>
            </View>

            {/* Top Floating Time Pin */}
            <View style={styles.timeBadgeFloating}>
              <Text style={styles.timeBadgeDate}>{dateStr}</Text>
              <Text style={styles.timeBadgeClock}>{timeStr}</Text>
            </View>

            {/* Central Radar Location Pin */}
            <View style={styles.pinWrapper}>
              <View style={styles.pinRadarPulse} />
              <View style={styles.pinBubble}>
                <Ionicons name="location" size={24} color="#FFF" />
              </View>
              <Text style={styles.pinLabel}>Theresa Jakarta (HQ)</Text>
            </View>
          </View>

          {/* Bottom Attendance Card Sheet */}
          <View style={styles.bottomSheet}>
            <View style={styles.sheetTimeRow}>
              <View style={styles.sheetTimeBlock}>
                <View style={[styles.timeDot, { backgroundColor: '#16A34A' }]}>
                  <Ionicons name="arrow-forward" size={10} color="#FFF" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.timeValue}>{timeIn}</Text>
                    {isCheckedIn && <Text style={styles.lateTag}>Checked In</Text>}
                  </View>
                  <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B, Kebon Kacang...</Text>
                </View>
              </View>

              <View style={styles.sheetTimeBlock}>
                <View style={[styles.timeDot, { backgroundColor: timeOut !== 'not yet' ? '#DC2626' : '#CBD5E1' }]}>
                  <Ionicons name="ellipse-outline" size={10} color="#FFF" />
                </View>
                <View>
                  <Text style={[styles.timeValue, { color: timeOut !== 'not yet' ? '#DC2626' : '#94A3B8' }]}>
                    {timeOut}
                  </Text>
                  <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B, Kebon Kacang...</Text>
                </View>
              </View>

              <View style={[styles.statusPill, { backgroundColor: '#E0F2FE', marginTop: 4 }]}>
                <Text style={[styles.statusPillText, { color: '#0284C7' }]}>{totalHours}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  isCheckedIn && { backgroundColor: '#DC2626' },
                ]}
                activeOpacity={0.88}
                onPress={handleRecordClockIn}
              >
                <Text style={styles.primaryActionButtonText}>
                  {!isCheckedIn ? 'RECORD / CLOCK IN' : 'CLOCK OUT'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* SEGMENT 3: STATISTIC VIEW */}
      {activeSegment === 'statistic' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Year Filter */}
          <TouchableOpacity style={styles.filterDropdown} activeOpacity={0.8}>
            <Ionicons name="calendar-outline" size={18} color="#0041E8" />
            <Text style={styles.filterDropdownText}>{selectedYear}</Text>
            <Ionicons name="chevron-down" size={16} color="#0041E8" />
          </TouchableOpacity>

          {/* Inspirational Punctuality Banner */}
          <View style={styles.punctualityBanner}>
            <View style={styles.bannerIconCircle}>
              <Ionicons name="trending-up" size={24} color="#FFF" />
            </View>
            <Text style={styles.bannerText}>
              It is great! Your punctuality increased <Text style={styles.bannerHighlight}>10%</Text> from last
              month. Keep it up!
            </Text>
          </View>

          {/* Monthly Bar Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Monthly Punctuality Overview</Text>
            <View style={styles.barChartRow}>
              {[
                { m: 'Jan', h1: 65, h2: 30 },
                { m: 'Feb', h1: 85, h2: 15 },
                { m: 'Mar', h1: 50, h2: 20 },
                { m: 'Apr', h1: 70, h2: 10 },
                { m: 'May', h1: 40, h2: 25 },
                { m: 'Jun', h1: 60, h2: 15 },
                { m: 'Jul', h1: 75, h2: 20 },
                { m: 'Aug', h1: 80, h2: 10 },
                { m: 'Sep', h1: 65, h2: 15 },
                { m: 'Oct', h1: 70, h2: 10 },
                { m: 'Nov', h1: 60, h2: 20 },
                { m: 'Dec', h1: 90, h2: 10 },
              ].map((item, idx) => (
                <View key={idx} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barStackRed, { height: item.h2 }]} />
                    <View style={[styles.barStackBlue, { height: item.h1 }]} />
                  </View>
                  <Text style={styles.barLabel}>{item.m}</Text>
                </View>
              ))}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#0041E8' }]} />
                <Text style={styles.legendText}>On Time</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.legendText}>Late / Overtime</Text>
              </View>
            </View>
          </View>

          {/* Approved Request Statistic Section */}
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>Approved Request Statistic</Text>
            <View style={styles.ringsRow}>
              {/* Leave Ring */}
              <View style={styles.ringCard}>
                <View style={[styles.ringCircle, { borderColor: '#F43F5E' }]}>
                  <Text style={[styles.ringPercentText, { color: '#F43F5E' }]}>70%</Text>
                </View>
                <Text style={styles.ringTitle}>Leave</Text>
                <Text style={styles.ringSubApproved}>20 Approved</Text>
                <Text style={styles.ringSubRejected}>8 Rejected</Text>
              </View>

              {/* Overtime Ring */}
              <View style={styles.ringCard}>
                <View style={[styles.ringCircle, { borderColor: '#10B981' }]}>
                  <Text style={[styles.ringPercentText, { color: '#10B981' }]}>70%</Text>
                </View>
                <Text style={styles.ringTitle}>Overtime</Text>
                <Text style={styles.ringSubApproved}>12 Approved</Text>
                <Text style={styles.ringSubRejected}>4 Rejected</Text>
              </View>

              {/* Claim Ring */}
              <View style={styles.ringCard}>
                <View style={[styles.ringCircle, { borderColor: '#EAB308' }]}>
                  <Text style={[styles.ringPercentText, { color: '#EAB308' }]}>100%</Text>
                </View>
                <Text style={styles.ringTitle}>Claim</Text>
                <Text style={styles.ringSubApproved}>12 Approved</Text>
                <Text style={styles.ringSubRejected}>0 Rejected</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    padding: 10,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  segmentTextActive: {
    color: Colors.card,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterDropdownText: {
    color: '#0041E8',
    fontSize: 13,
    fontWeight: '700',
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dayCol: {
    width: 85,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingRight: 10,
    justifyContent: 'center',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0041E8',
  },
  dayDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  detailsCol: {
    flex: 1,
    paddingLeft: 14,
    gap: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  timeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  locText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  statusPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0041E8',
  },
  offDayBanner: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  offDayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  bottomBarFixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryActionButton: {
    backgroundColor: '#0041E8',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  /* Map View Styling */
  mapContainer: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGridBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E7EB',
  },
  mapRoad1: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-15deg' }],
  },
  mapRoad2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 28,
    backgroundColor: '#FFFFFF',
  },
  mapLandmark1: {
    position: 'absolute',
    top: '25%',
    right: '15%',
    backgroundColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapLandmark2: {
    position: 'absolute',
    top: '12%',
    left: '20%',
    backgroundColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  landmarkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  timeBadgeFloating: {
    alignSelf: 'center',
    backgroundColor: '#0041E8',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  timeBadgeDate: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '500',
  },
  timeBadgeClock: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  pinWrapper: {
    position: 'absolute',
    top: '42%',
    left: width / 2 - 40,
    alignItems: 'center',
  },
  pinRadarPulse: {
    position: 'absolute',
    top: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 65, 232, 0.2)',
  },
  pinBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  pinLabel: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
    elevation: 3,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetTimeRow: {
    gap: 12,
  },
  sheetTimeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lateTag: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  /* Statistic View Styling */
  punctualityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0041E8',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  bannerHighlight: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 8,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 10,
    height: 95,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barStackBlue: {
    backgroundColor: '#0041E8',
    width: '100%',
  },
  barStackRed: {
    backgroundColor: '#DC2626',
    width: '100%',
  },
  barLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    elevation: 2,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  ringCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    marginHorizontal: 4,
    borderRadius: 14,
  },
  ringCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ringPercentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  ringTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  ringSubApproved: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  ringSubRejected: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 2,
  },
});
