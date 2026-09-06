import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RNDateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

type PickerMode = 'date' | 'time';

type Props = {
  mode: PickerMode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

const toPickerDate = (mode: PickerMode, value: string): Date => {
  const d = new Date();
  d.setSeconds(0, 0);
  if (mode === 'date') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else {
    const m = value.match(/^(\d{1,2}):(\d{2})$/);
    if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    else d.setHours(9, 0, 0, 0);
  }
  return d;
};

const formatValue = (mode: PickerMode, date: Date): string => {
  if (mode === 'date') {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const stripSeconds = (t: string): string => {
  const m = t.replace(/^(\d{2}):(\d{2}):\d{2}$/, '$1:$2');
  return /^\d{1,2}:\d{2}$/.test(m) ? m : t;
};

export default function DateTimePickerField({ mode, value, onChange, placeholder }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const isDate = mode === 'date';

  const commit = (date?: Date) => {
    if (date) onChange(formatValue(mode, date));
  };

  if (Platform.OS === 'web') {
    const webStyle: React.CSSProperties = {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 14,
      color: value ? '#0F172A' : '#CBD5E1',
      outline: 'none',
      fontFamily: 'inherit',
      width: '100%',
      boxSizing: 'border-box',
      minWidth: 0,
    };
    return React.createElement('input', {
      type: isDate ? 'date' : 'time',
      value,
      placeholder,
      style: webStyle,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(stripSeconds(e.currentTarget.value)),
    });
  }

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toPickerDate(mode, value),
        mode,
        is24Hour: true,
        onChange: (event, date) => {
          if (event.type !== 'dismissed' && date) onChange(formatValue(mode, date));
        },
      });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.field} activeOpacity={0.8} onPress={openPicker}>
        <Ionicons name={isDate ? 'calendar-outline' : 'time-outline'} size={16} color="#64748B" />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1} ellipsizeMode="tail">
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#94A3B8" />
      </TouchableOpacity>

      {Platform.OS === 'ios' && iosOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setIosOpen(false)} hitSlop={8}>
                  <Text style={styles.sheetCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>{isDate ? 'Select Date' : 'Select Time'}</Text>
                <TouchableOpacity onPress={() => setIosOpen(false)} hitSlop={8}>
                  <Text style={styles.sheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <RNDateTimePicker
                value={toPickerDate(mode, value)}
                mode={mode}
                is24Hour
                display="spinner"
                onChange={(event, date) => {
                  if (event.type !== 'dismissed') commit(date);
                }}
                style={styles.spinner}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldText: { flex: 1, fontSize: 13, color: '#0F172A', fontVariant: ['tabular-nums'] },
  fieldPlaceholder: { color: '#CBD5E1' },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingBottom: 16, overflow: 'hidden' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sheetCancel: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  sheetDone: { fontSize: 15, color: '#0041E8', fontWeight: '700' },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  spinner: { alignSelf: 'center' },
});