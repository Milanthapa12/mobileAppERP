import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import AppHeader from '@/components/AppHeader';
import ScreenWrapper from '@/components/ScreenWrapper';
import { API_CONFIG } from '@/constants/api';
import { Colors, getInitials, Radius, Shadow } from '@/constants/theme';
import {
  profileService,
  EmployeeProfileResponse,
  ProfileEmploymentInfoRow,
  ProfileDocument,
} from '@/services/api/profileService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Small presentational helpers ──────────────────────────────────────────────

function FieldRow({ label, value, last }: { label: string; value?: string | number | null; last?: boolean }) {
  return (
    <View style={[styles.fieldRow, last && styles.fieldRowLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>
        {value != null && value !== '' ? String(value) : <Text style={styles.fieldMissing}>—</Text>}
      </Text>
    </View>
  );
}

function RecordBox({ title, badge, children }: { title: string; badge?: string | null; children: React.ReactNode }) {
  return (
    <View style={styles.recordBox}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordTitle} numberOfLines={1}>{title}</Text>
        {badge ? <Text style={styles.recordBadge}>{badge}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function EmptyNote({ message }: { message: string }) {
  return <Text style={styles.emptyText}>{message}</Text>;
}

// ── Additional-info category configuration ────────────────────────────────────

interface CatMeta {
  key: string;
  title: string;
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
}

interface GroupMeta {
  label: string;
  items: CatMeta[];
}

const GROUPS: GroupMeta[] = [
  {
    label: 'Personal',
    items: [
      { key: 'background', title: 'Background', icon: 'person-outline', iconBg: '#EFF6FF', iconColor: '#0041E8' },
      { key: 'health', title: 'Health', icon: 'heart-outline', iconBg: '#FEF2F2', iconColor: '#DC2626' },
      { key: 'families', title: 'Family', icon: 'people-outline', iconBg: '#F0FDF4', iconColor: '#16A34A' },
      { key: 'nominees', title: 'Nominees', icon: 'person-add-outline', iconBg: '#F3E8FF', iconColor: '#9333EA' },
    ],
  },
  {
    label: 'Professional',
    items: [
      { key: 'skills', title: 'Skills', icon: 'star-outline', iconBg: '#FEF3C7', iconColor: '#D97706' },
      { key: 'academic', title: 'Academic', icon: 'school-outline', iconBg: '#E0F2FE', iconColor: '#0284C7' },
      { key: 'work', title: 'Work History', icon: 'briefcase-outline', iconBg: '#F1F5F9', iconColor: '#475569' },
      { key: 'trainings', title: 'Trainings', icon: 'ribbon-outline', iconBg: '#FCE7F3', iconColor: '#DB2777' },
      { key: 'seminars', title: 'Seminars', icon: 'mic-outline', iconBg: '#EDE9FE', iconColor: '#7C3AED' },
      { key: 'awards', title: 'Awards', icon: 'trophy-outline', iconBg: '#FEF3C7', iconColor: '#B45309' },
      { key: 'publications', title: 'Publications', icon: 'book-outline', iconBg: '#F0FDFA', iconColor: '#0D9488' },
      { key: 'licenses', title: 'Licenses', icon: 'shield-checkmark-outline', iconBg: '#ECFDF5', iconColor: '#059669' },
      { key: 'references', title: 'References', icon: 'clipboard-outline', iconBg: '#F1F5F9', iconColor: '#334155' },
    ],
  },
  {
    label: 'HR & Logistics',
    items: [
      { key: 'addresses', title: 'Addresses', icon: 'home-outline', iconBg: '#FEF3C7', iconColor: '#D97706' },
      { key: 'contacts', title: 'Contacts', icon: 'call-outline', iconBg: '#EFF6FF', iconColor: '#2563EB' },
      { key: 'assets', title: 'Assets', icon: 'cube-outline', iconBg: '#EEF2FF', iconColor: '#4F46E5' },
      { key: 'facilities', title: 'Facilities', icon: 'business-outline', iconBg: '#F0FDF4', iconColor: '#16A34A' },
    ],
  },
];

const INFO_FIELDS: { type: string; label: string; icon: IoniconName; iconBg: string; iconColor: string }[] = [
  { type: 'department', label: 'Department', icon: 'business-outline', iconBg: '#EFF6FF', iconColor: '#0041E8' },
  { type: 'job_level', label: 'Job Level', icon: 'layers-outline', iconBg: '#FEF3C7', iconColor: '#D97706' },
  { type: 'job_title', label: 'Job Title', icon: 'briefcase-outline', iconBg: '#F1F5F9', iconColor: '#475569' },
  { type: 'designation', label: 'Designation', icon: 'medal-outline', iconBg: '#F3E8FF', iconColor: '#9333EA' },
  { type: 'work_location', label: 'Work Location', icon: 'location-outline', iconBg: '#F0FDFA', iconColor: '#0D9488' },
  { type: 'report_to', label: 'Report To', icon: 'people-outline', iconBg: '#ECFDF5', iconColor: '#059669' },
  { type: 'employee_type', label: 'Employee Type', icon: 'person-circle-outline', iconBg: '#FEF2F2', iconColor: '#DC2626' },
];

const ADDRESS_TYPE_LABEL: Record<string, string> = {
  current_address: 'Current Address',
  permanent_address: 'Permanent Address',
  temporary_address: 'Temporary Address',
  office_address: 'Office Address',
};

type TabKey = 'info' | 'additional' | 'documents';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'additional', label: 'Additional' },
  { key: 'documents', label: 'Documents' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, activeBranch, logout } = useAuth();

  const [data, setData] = useState<EmployeeProfileResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedInfo, setExpandedInfo] = useState<Set<string>>(new Set());
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<TabKey>('info');
  const scrollRef = useRef<ScrollView>(null);

  const switchTab = (key: TabKey) => {
    setTab(key);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await profileService.getProfile();
      setData(res?.data ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const toggleInfo = (type: string) => {
    setExpandedInfo((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleCat = (key: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          { text: 'Sign Out', style: 'destructive', onPress: executeLogout },
        ]
      );
    }
  };

  const openDoc = (doc: ProfileDocument, mode: 'view' | 'download') => {
    const id = doc?.id;
    if (!id) return;
    const url = `${API_CONFIG.BASE_URL}/auth/device/employee-document/${mode}/${id}?branch_id=${activeBranch?.id ?? ''}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Unable to open document', 'The document file could not be opened.')
    );
  };

  const cap = (s?: string | null) => (s && s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const infoValue = (row?: ProfileEmploymentInfoRow | null): string => {
    if (!row) return '—';
    if (row.display_name) return cap(row.display_name) ?? '—';
    if (row.employment_info?.name) return row.employment_info.name;
    if (row.info_value) return cap(row.info_value) ?? '—';
    return '—';
  };

  const emp = data?.employee;
  const contact = emp?.employee_contact;
  const body = (data?.employeeInfo ?? {}) as Record<string, ProfileEmploymentInfoRow | null>;

  const name = data?.basic?.name || emp?.name || user?.name || 'Employee';
  const code = data?.basic?.code || emp?.code || user?.employee_code || '';
  const designation = data?.basic?.designation || user?.role || '';
  const department = data?.basic?.department || '';
  const joiningDate = data?.basic?.joining_date || contact?.joining_date || null;
  const email = emp?.email || user?.email || '';
  const phone = emp?.phone_number || '';
  const avatarUrl = (data?.profileUrl ?? [])[0]?.url;

  const countOf = (key: string): number => {
    switch (key) {
      case 'background':
        return [contact?.qualification_gap, data?.basic?.nationality, data?.basic?.ethnicity, data?.basic?.religion].some(
            Boolean
          )
          ? 1
          : 0;
      case 'health':
        return emp?.employee_health ? 1 : 0;
      case 'families':
        return emp?.employee_families?.length ?? 0;
      case 'nominees':
        return emp?.employee_nominees?.length ?? 0;
      case 'skills':
        return emp?.employee_skills?.length ?? 0;
      case 'academic':
        return emp?.employee_academic_records?.length ?? 0;
      case 'work':
        return emp?.employee_work_experiences?.length ?? 0;
      case 'trainings':
        return emp?.training?.length ?? 0;
      case 'seminars':
        return emp?.employee_seminars?.length ?? 0;
      case 'awards':
        return emp?.employee_awards?.length ?? 0;
      case 'publications':
        return emp?.employee_publications?.length ?? 0;
      case 'licenses':
        return emp?.employee_professional_licenses?.length ?? 0;
      case 'references':
        return emp?.employee_references?.length ?? 0;
      case 'addresses':
        return emp?.employee_addresses?.length ?? 0;
      case 'contacts':
        return emp?.employee_additional_contacts?.length ?? 0;
      case 'assets':
        return emp?.employee_assets?.length ?? 0;
      case 'facilities':
        return emp?.employee_facilities?.length ?? 0;
      default:
        return 0;
    }
  };

  const renderCat = (key: string): React.ReactNode => {
    const list = (arr?: any[]) =>
      arr && arr.length > 0 ? arr : null;

    switch (key) {
      case 'background': {
        const rows: { label: string; value?: string | null }[] = [
          { label: 'Nationality', value: data?.basic?.nationality },
          { label: 'Ethnicity', value: data?.basic?.ethnicity },
          { label: 'Religion', value: data?.basic?.religion },
          { label: 'Qualification Gap', value: contact?.qualification_gap },
        ];
        if (!rows.some((r) => r.value)) {
          return <EmptyNote message="No background details on record." />;
        }
        return rows.map((r, i) => (
          <FieldRow key={r.label} label={r.label} value={r.value} last={i === rows.length - 1} />
        ));
      }

      case 'health': {
        const h = emp?.employee_health;
        if (!h) return <EmptyNote message="No health record on file." />;
        const rows: [string, any][] = [
          ['Blood group', h.blood_group],
          ['Height', h.height],
          ['Weight', h.weight ? `${h.weight} kg` : null],
          ['Birthmark', h.birthmark],
          ['Health status', h.health_status],
          ['Has disability', h.has_disability ? 'Yes' : 'No'],
          ['Disability type', h.disability_type],
          ['Disability description', h.disability_description],
          ['Certificate no.', h.disability_certificate_number],
          ['Allergies', h.allergies],
          ['Chronic conditions', h.chronic_conditions],
          ['Emergency notes', h.emergency_medical_notes],
        ];
        return rows.map(([l, v], i, all) => <FieldRow key={l} label={l} value={v} last={i === all.length - 1} />);
      }

      case 'families': {
        const items = list(emp?.employee_families);
        if (!items) return <EmptyNote message="No family records." />;
        return items.map((f, i) => (
          <RecordBox key={i} title={f.full_name ?? `Member ${i + 1}`}>
            <FieldRow label="DOB" value={f.dob} />
            <FieldRow label="Occupation" value={f.occupation} />
            <FieldRow label="Citizenship no." value={f.citizenship_no} />
            <FieldRow label="National ID" value={f.national_id_no} />
            <FieldRow label="Health insurance" value={f.eligible_for_health_insurance ? 'Eligible' : 'Not eligible'} />
            <FieldRow label="Note" value={f.note} last />
          </RecordBox>
        ));
      }

      case 'nominees': {
        const items = list(emp?.employee_nominees);
        if (!items) return <EmptyNote message="No nominees on record." />;
        return items.map((n, i) => (
          <RecordBox key={i} title={n.nominee_name ?? `Nominee ${i + 1}`}>
            <FieldRow label="Phone" value={n.phone_number} />
            <FieldRow label="Local body" value={n.local_body} />
            <FieldRow label="Ward no." value={n.ward_no} />
            <FieldRow label="Address" value={n.house_number_and_locality} last />
          </RecordBox>
        ));
      }

      case 'skills': {
        const items = list(emp?.employee_skills);
        if (!items) return <EmptyNote message="No skills on record." />;
        return items.map((s, i) => (
          <RecordBox key={i} title={s.skill_name ?? `Skill ${i + 1}`}>
            <FieldRow label="Category" value={s.skill_set?.name} />
            <FieldRow label="Proficiency" value={s.proficiency_level ? cap(s.proficiency_level) : null} />
            <FieldRow
              label="Exp."
              value={s.years_of_experience ? `${s.years_of_experience} yr${Number(s.years_of_experience) !== 1 ? 's' : ''}` : null}
              last
            />
          </RecordBox>
        ));
      }

      case 'academic': {
        const items = list(emp?.employee_academic_records);
        if (!items) return <EmptyNote message="No academic records on record." />;
        return items.map((rec, i) => (
          <RecordBox key={i} title={rec.institution_name ?? `Record ${i + 1}`}>
            <FieldRow label="Field of Study" value={rec.study_field} />
            <FieldRow label="GPA / Score" value={rec.gpa_number} />
            <FieldRow label="Type" value={rec.gpa_type ? cap(rec.gpa_type) : null} last />
          </RecordBox>
        ));
      }

      case 'work': {
        const items = list(emp?.employee_work_experiences);
        if (!items) return <EmptyNote message="No work experience on record." />;
        return items.map((w, i) => (
          <RecordBox
            key={i}
            title={w.company_name ?? `Experience ${i + 1}`}
            badge={`${w.start_date ?? '?'} → ${w.end_date ?? 'Present'}`}
          >
            <FieldRow label="Position" value={w.job_position} />
            <FieldRow label="Responsibilities" value={w.job_responsibilities} last />
          </RecordBox>
        ));
      }

      case 'trainings': {
        const items = list(emp?.training);
        if (!items) return <EmptyNote message="No training records." />;
        return items.map((t, i) => (
          <RecordBox key={i} title={t.training_name ?? `Training ${i + 1}`}>
            <FieldRow label="Institution" value={t.institution_name} />
            <FieldRow label="Start" value={t.start_date} />
            <FieldRow label="Days" value={t.days} />
            <FieldRow label="Cost" value={t.training_cost ? Number(t.training_cost).toLocaleString() : null} />
            <FieldRow label="Bond" value={t.has_bond ? `${t.bond_months} mo.` : 'No'} last />
          </RecordBox>
        ));
      }

      case 'seminars': {
        const items = list(emp?.employee_seminars);
        if (!items) return <EmptyNote message="No seminar records." />;
        return items.map((s, i) => (
          <RecordBox key={i} title={s.organizer ?? `Seminar ${i + 1}`}>
            <FieldRow label="Place" value={s.place} />
            <FieldRow label="Start" value={s.start_date} />
            <FieldRow label="End" value={s.end_date} />
            <FieldRow
              label="Duration"
              value={s.duration ? `${s.duration} ${s.duration_type ?? ''}` : null}
              last
            />
          </RecordBox>
        ));
      }

      case 'awards': {
        const items = list(emp?.employee_awards);
        if (!items) return <EmptyNote message="No awards on record." />;
        return items.map((a, i) => (
          <RecordBox key={i} title={a.award_name ?? `Award ${i + 1}`} badge={a.award_date}>
            <FieldRow label="Given by" value={a.award_given_by} />
            <FieldRow label="Note" value={a.note} last />
          </RecordBox>
        ));
      }

      case 'publications': {
        const items = list(emp?.employee_publications);
        if (!items) return <EmptyNote message="No publications on record." />;
        return items.map((p, i) => (
          <RecordBox key={i} title={p.publication_name ?? `Publication ${i + 1}`} badge={p.publication_date}>
            <FieldRow label="Publisher" value={p.publisher} last />
          </RecordBox>
        ));
      }

      case 'licenses': {
        const items = list(emp?.employee_professional_licenses);
        if (!items) return <EmptyNote message="No licenses on record." />;
        return items.map((l, i) => (
          <RecordBox key={i} title={l.license?.name ?? `License ${i + 1}`}>
            <FieldRow label="Issued" value={l.issue_date} />
            <FieldRow label="Valid for" value={l.valid_for} />
            <FieldRow label="Expires" value={l.expiry_date} last />
          </RecordBox>
        ));
      }

      case 'references': {
        const items = list(emp?.employee_references);
        if (!items) return <EmptyNote message="No references on record." />;
        return items.map((r, i) => (
          <RecordBox key={i} title={r.person_name ?? `Reference ${i + 1}`} badge={r.job_title}>
            <FieldRow label="Organization" value={r.organization} />
            <FieldRow label="Email" value={r.email} />
            <FieldRow label="Phone" value={r.phone} last />
          </RecordBox>
        ));
      }

      case 'addresses': {
        const items = list(emp?.employee_addresses);
        if (!items) return <EmptyNote message="No addresses on record." />;
        return items.map((addr, i) => (
          <RecordBox key={i} title={ADDRESS_TYPE_LABEL[addr.contact_type] ?? cap(addr.contact_type) ?? `Address ${i + 1}`}>
            <FieldRow label="Street" value={addr.street} />
            <FieldRow label="Zip Code" value={addr.zip_code} last />
          </RecordBox>
        ));
      }

      case 'contacts': {
        const items = list(emp?.employee_additional_contacts);
        if (!items) return <EmptyNote message="No additional contacts on record." />;
        return items.map((c, i) => (
          <RecordBox key={i} title={c.full_name ?? `Contact ${i + 1}`} badge={c.gender ? cap(c.gender) : null}>
            <FieldRow label="Phone" value={c.phone_number} />
            <FieldRow label="Email" value={c.email} />
            <FieldRow label="Occupation" value={c.occupation} />
            <FieldRow label="Full Address" value={c.full_address} last />
          </RecordBox>
        ));
      }

      case 'assets': {
        const items = list(emp?.employee_assets);
        if (!items) return <EmptyNote message="No assets on record." />;
        return items.map((a, i) => (
          <RecordBox key={i} title={a.asset_name ?? `Asset ${i + 1}`}>
            <FieldRow label="Code" value={a.asset_code} />
            <FieldRow label="Type" value={a.asset_type ? cap(a.asset_type) : null} />
            <FieldRow label="Assigned" value={a.assigned_date} />
            <FieldRow label="Return" value={a.return_date} />
            <FieldRow label="Condition" value={a.condition ? cap(a.condition) : null} />
            <FieldRow label="Status" value={a.status ? cap(a.status) : null} last />
          </RecordBox>
        ));
      }

      case 'facilities': {
        const items = list(emp?.employee_facilities);
        if (!items) return <EmptyNote message="No facilities on record." />;
        return items.map((f, i) => (
          <RecordBox key={i} title={f.facility_name ?? `Facility ${i + 1}`}>
            <FieldRow label="Type" value={f.facility_type ? cap(f.facility_type) : null} />
            <FieldRow label="Amount" value={f.amount ? Number(f.amount).toLocaleString() : null} />
            <FieldRow label="From" value={f.effective_from} />
            <FieldRow label="To" value={f.effective_to} />
            <FieldRow label="Status" value={f.status ? cap(f.status) : null} last />
          </RecordBox>
        ));
      }

      default:
        return null;
    }
  };

  return (
    <ScreenWrapper>
      <AppHeader title="My Profile" userName={name} />

      {/* ── Segments (sticky) ─────────────────────────────── */}
      <View style={styles.segControl}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.8}
            style={[styles.segItem, tab === t.key && styles.segItemActive]}
            onPress={() => switchTab(t.key)}
          >
            <Text style={[styles.segText, tab === t.key && styles.segTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchProfile} colors={['#0041E8']} tintColor="#0041E8" />
        }
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.headerCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            </View>
          )}
          <Text style={styles.userName}>{name}</Text>
          {(designation || department) && (
            <Text style={styles.userRole}>
              {[designation, department].filter(Boolean).join(' • ')}
            </Text>
          )}
          <View style={styles.headerPills}>
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activePillText}>Active</Text>
            </View>
            {code ? (
              <View style={styles.codePill}>
                <Text style={styles.codePillText}>{code}</Text>
              </View>
            ) : null}
          </View>
          {joiningDate ? (
            <Text style={styles.joinedText}>Joined {String(joiningDate).slice(0, 10)}</Text>
          ) : null}
        </View>

        {/* ── Loading / Error ─────────────────────────────────── */}
        {loading && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#0041E8" />
            <Text style={styles.centerStateText}>Loading profile…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerState}>
            <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
            <Text style={[styles.centerStateText, { color: '#DC2626' }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { marginTop: 12 }]}
              activeOpacity={0.85}
              onPress={fetchProfile}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && data && (
          <View style={styles.contentBody}>
            {/* ── Info tab ─────────────────────────────────────── */}
            {tab === 'info' && (
              <>
            {/* ── Personal Information ─────────────────────────── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="person-outline" size={18} color="#0041E8" />
                </View>
                <Text style={styles.sectionTitle}>Personal Information</Text>
              </View>
              <FieldRow label="Gender" value={cap(contact?.gender)} />
              <FieldRow label="Date of Birth (A.D)" value={contact?.dob} />
              <FieldRow label="PAN" value={emp?.pan_number} />
              <FieldRow label="Marital Status" value={cap(contact?.marital_status)} />
              <FieldRow label="Tax Marital Status" value={cap(contact?.tax_marital_status)} />
              <FieldRow label="Email" value={email} />
              <FieldRow label="Phone" value={phone} />
              <FieldRow label="Handicapped" value={contact?.handicapped ? 'Yes' : 'No'} last />
            </View>

            {/* ── Employment Overview ──────────────────────────── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="briefcase-outline" size={18} color="#16A34A" />
                </View>
                <Text style={styles.sectionTitle}>Employment Overview</Text>
              </View>
              <FieldRow label="Joining Date" value={contact?.joining_date} />
              <FieldRow label="Contract End Date" value={contact?.contract_end_date} />
              <FieldRow label="Employment Status" value={contact?.employee_status?.name} />
              <FieldRow label="Is Consultant" value={Number(contact?.is_consultant) === 1 ? 'Yes' : 'No'} last />
            </View>

            {/* ── Bank Information ─────────────────────────────── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="card-outline" size={18} color="#D97706" />
                </View>
                <Text style={styles.sectionTitle}>Bank Information</Text>
              </View>
              <FieldRow label="Bank Name" value={contact?.bank?.name} />
              <FieldRow label="Account Number" value={contact?.bank_account_number} />
              <FieldRow label="Branch Name" value={contact?.branch_name} />
              <FieldRow label="Payment Frequency" value={cap(contact?.payment_frequency)} />
              <FieldRow label="Payment Mode" value={cap(contact?.payment_mode)} last />
            </View>

            {/* ── Employee Information ─────────────────────────── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="stats-chart-outline" size={18} color="#9333EA" />
                </View>
                <Text style={styles.sectionTitle}>Employee Information</Text>
                <Ionicons name="information-circle-outline" size={15} color="#94A3B8" />
              </View>

              {INFO_FIELDS.map((field) => {
                const row = body?.[field.type] as ProfileEmploymentInfoRow | null | undefined;
                const history = (data.employeeInfoHistory?.[field.type] ?? []) as ProfileEmploymentInfoRow[];
                const isOpen = expandedInfo.has(field.type);
                return (
                  <TouchableOpacity
                    key={field.type}
                    activeOpacity={0.7}
                    onPress={() => (history.length > 0 ? toggleInfo(field.type) : undefined)}
                    style={styles.infoFieldRow}
                  >
                    <View style={[styles.infoFieldIcon, { backgroundColor: field.iconBg }]}>
                      <Ionicons name={field.icon} size={15} color={field.iconColor} />
                    </View>
                    <View style={styles.infoFieldBody}>
                      <Text style={styles.infoFieldLabel}>{field.label}</Text>
                      <Text style={styles.infoFieldValue}>
                        {infoValue(row)}
                        {row?.is_department_head ? '  · Head' : ''}
                      </Text>
                    </View>
                    {row?.effective_from ? (
                      <Text style={styles.infoFieldDate}>{String(row.effective_from).slice(0, 10)}</Text>
                    ) : history.length > 0 && !isOpen ? (
                      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                    ) : history.length > 0 ? (
                      <Ionicons name="chevron-up" size={16} color="#94A3B8" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {expandedInfo.size > 0 && (
                <View style={styles.infoHistoryNote}>
                  <Text style={styles.infoHistoryNoteText}>Tap a row to view its revision history.</Text>
                </View>
              )}

              {Array.from(expandedInfo).map((type) => {
                const history = (data.employeeInfoHistory?.[type] ?? []) as ProfileEmploymentInfoRow[];
                if (history.length === 0) return null;
                const field = INFO_FIELDS.find((f) => f.type === type);
                return (
                  <View key={type} style={styles.historyBlock}>
                    <Text style={styles.historyBlockTitle}>{field?.label ?? type} History</Text>
                    {history.map((h, i) => (
                      <View key={i} style={styles.historyRow}>
                        <Text style={styles.historyValue}>
                          {infoValue(h)}{' '}
                          <Text style={styles.historyRev}>r{h.revision ?? ''}</Text>
                        </Text>
                        <Text style={styles.historyDate}>{h.effective_from ? String(h.effective_from).slice(0, 10) : '—'}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>

            {/* ── Account Settings ─────────────────────────────── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="settings-outline" size={18} color="#475569" />
                </View>
                <Text style={styles.sectionTitle}>Account Settings</Text>
              </View>
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

            {/* ── Sign Out ─────────────────────────────────────── */}
            <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
              </>
            )}

            {/* ── Additional tab ───────────────────────────────── */}
            {tab === 'additional' && (
              <View style={styles.tabBody}>
            {/* ── Additional Info ──────────────────────────────── */}
            {GROUPS.map((group) => (
              <View key={group.label} style={styles.groupBlock}>
                <Text style={styles.groupHeader}>{group.label.toUpperCase()}</Text>
                {group.items.map((cat) => {
                  const open = openCats.has(cat.key);
                  const count = countOf(cat.key);
                  return (
                    <View key={cat.key} style={styles.accCard}>
                      <TouchableOpacity style={styles.accHeader} activeOpacity={0.7} onPress={() => toggleCat(cat.key)}>
                        <View style={[styles.accIcon, { backgroundColor: cat.iconBg }]}>
                          <Ionicons name={cat.icon} size={16} color={cat.iconColor} />
                        </View>
                        <Text style={styles.accTitle}>{cat.title}</Text>
                        <View style={styles.accRight}>
                          {count > 0 && (
                            <View style={styles.countPill}>
                              <Text style={styles.countText}>{count}</Text>
                            </View>
                          )}
                          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                        </View>
                      </TouchableOpacity>
                      {open && <View style={styles.accBody}>{renderCat(cat.key)}</View>}
                    </View>
                  );
                })}
              </View>
            ))}
              </View>
            )}

            {/* ── Documents tab ────────────────────────────────── */}
            {tab === 'documents' && (
              <View style={styles.tabBody}>
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="folder-open-outline" size={18} color="#059669" />
                    </View>
                    <Text style={styles.sectionTitle}>Employee Documents</Text>
                    <View style={styles.countPill}>
                      <Text style={styles.countText}>{(data.documents ?? []).length}</Text>
                    </View>
                  </View>

                  {!data.documents || data.documents.length === 0 ? (
                    <EmptyNote message="No documents on record." />
                  ) : (
                    data.documents.map((doc) => (
                      <View key={doc.id} style={styles.docCard}>
                        <View style={styles.docIconBox}>
                          <Ionicons name="document-text-outline" size={20} color="#0041E8" />
                        </View>
                        <View style={styles.docBody}>
                          <View style={styles.docTitleRow}>
                            <Text style={styles.docName} numberOfLines={1}>
                              {doc.name || 'Document'}
                            </Text>
                            {doc.document_type ? (
                              <View style={styles.docTypePill}>
                                <Text style={styles.docTypePillText} numberOfLines={1}>
                                  {doc.document_type}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {doc.number ? <Text style={styles.docMeta}>No. {doc.number}</Text> : null}
                          <Text style={styles.docMeta}>
                            {[
                              doc.issue_date ? `Issued ${String(doc.issue_date).slice(0, 10)}` : null,
                              doc.expiry_date ? `Expires ${String(doc.expiry_date).slice(0, 10)}` : null,
                            ]
                              .filter(Boolean)
                              .join('  ·  ')}
                          </Text>
                        </View>
                        {doc.attachment_id ? (
                          <View style={styles.docActions}>
                            <TouchableOpacity style={styles.docActionBtn} activeOpacity={0.7} onPress={() => openDoc(doc, 'view')}>
                              <Ionicons name="eye-outline" size={14} color="#0041E8" />
                              {/* <Text style={styles.docActionText}>View</Text> */}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.docActionBtn} activeOpacity={0.7} onPress={() => openDoc(doc, 'download')}>
                              <Ionicons name="download-outline" size={14} color="#059669" />
                              {/* <Text style={styles.docActionText}>Download</Text> */}
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  headerCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 26,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingHorizontal: 20,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#C7D2FE',
    ...Shadow.sm,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#C7D2FE',
  },
  avatarText: {
    color: Colors.primary,
    fontSize: 30,
    fontWeight: '800',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  userRole: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 3,
    fontWeight: '500',
    textAlign: 'center',
  },
  headerPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  codePill: {
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  codePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  joinedText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
    fontWeight: '500',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  centerStateText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#0041E8',
    paddingHorizontal: 24,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  contentBody: {
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 16,
  },
  segControl: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F7',
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: Radius.full,
  },
  segItemActive: {
    backgroundColor: '#FFFFFF',
    ...Shadow.sm,
  },
  segText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segTextActive: {
    color: Colors.primary,
  },
  tabBody: {
    gap: 10,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBody: {
    flex: 1,
    gap: 2,
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  docTypePill: {
    backgroundColor: '#EEF2F7',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  docTypePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  docMeta: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  docActions: {
    flexDirection: 'row',
    gap: 6,
  },
  docActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  docActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: 18,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  fieldRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  fieldLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  fieldMissing: {
    color: '#CBD5E1',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  infoFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  infoFieldIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoFieldBody: { flex: 1 },
  infoFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  infoFieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 1,
  },
  infoFieldDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  infoHistoryNote: {
    marginTop: 10,
  },
  infoHistoryNoteText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  historyBlock: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: 12,
    gap: 8,
  },
  historyBlockTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  historyRev: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  historyDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  groupBlock: {
    gap: 10,
    marginTop: 4,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#94A3B8',
  },
  accCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  accHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  accIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  accRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    backgroundColor: '#EEF2F7',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  accBody: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 4,
  },
  recordBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 0,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  recordTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  recordBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 14,
    textAlign: 'center',
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