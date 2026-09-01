export const Colors = {
  primary: '#0041E8',
  primaryLight: '#EEF2FF',
  primaryMuted: '#DBEAFE',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  teal: '#0D9488',
  tealLight: '#F0FDFA',
  purple: '#9333EA',
  purpleLight: '#F3E8FF',
  sky: '#0284C7',
  skyLight: '#E0F2FE',
  orange: '#EA580C',
  orangeLight: '#FFF7ED',
  emerald: '#059669',
  emeraldLight: '#ECFDF5',

  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textPlaceholder: '#94A3B8',

  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  bg: '#F8FAFC',
  card: '#FFFFFF',
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  primary: {
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const getInitials = (name?: string): string => {
  if (!name) return 'VT';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const useLiveClock = () => {
  // Hook version is in hooks/useLiveClock.ts — this is a utility export
};
