export interface StatusMeta {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

/**
 * Mirrors the web portal's STATUS_META lookup for attendance statuses.
 */
const STATUS_META: Record<string, StatusMeta> = {
  present:       { label: 'Present',            bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' },
  absent:        { label: 'Absent',             bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' },
  late:          { label: 'Late',               bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' },
  half_day:      { label: 'Half Day',           bg: '#FFEDD5', text: '#EA580C', dot: '#FB923C' },
  on_leave:      { label: 'On Leave',           bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  half_day_leave:{ label: 'On Half Day Leave',  bg: '#FFEDD5', text: '#EA580C', dot: '#FB923C' },
  travel:        { label: 'Travel',             bg: '#F3E8FF', text: '#9333EA', dot: '#A855F7' },
  training:      { label: 'Training',           bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  in_lieu:       { label: 'In Lieu',            bg: '#F0FDFA', text: '#0D9488', dot: '#14B8A6' },
  holiday:       { label: 'Holiday',            bg: '#F3E8FF', text: '#9333EA', dot: '#A855F7' },
  off:           { label: 'Off Day',            bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' },
  weekend:       { label: 'Weekend',            bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' },
  punched:       { label: 'Punched',            bg: '#CFFAFE', text: '#0891B2', dot: '#06B6D4' },
};

export function getStatusMeta(status: string): StatusMeta {
  const meta = STATUS_META[status];
  if (meta) return meta;
  return {
    label: status.replace(/_/g, ' '),
    bg: '#F1F5F9',
    text: '#64748B',
    dot: '#94A3B8',
  };
}