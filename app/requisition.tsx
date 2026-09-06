import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  OptionItem,
  RequisitionItem,
  RequisitionPayload,
  RequisitionProductPayload,
  RequisitionRecord,
  requisitionService,
} from '@/services/api/requisitionService';
import DateTimePickerField from '@/components/DateTimePickerField';

// ─── Helpers ────────────────────────────────────────────────────────────────

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const niceDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[3]} ${months[Number(m[2]) - 1]}, ${m[1]}`;
};

const STATUS_META: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#B45309' },
  in_review: { bg: '#DBEAFE', text: '#1D4ED8' },
  approved:  { bg: '#DCFCE7', text: '#15803D' },
  rejected:  { bg: '#FEE2E2', text: '#B91C1C' },
};

const statusMeta = (status: string) =>
  STATUS_META[String(status ?? '').toLowerCase()] ?? { bg: '#DBEAFE', text: '#1D4ED8' };

const statusLabel = (status?: string | null): string => {
  const s = String(status ?? '').toLowerCase();
  if (s === 'pending' || s === 'approved' || s === 'rejected' || s === 'in_review') {
    return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return status ? status : 'No Workflow';
};

const canModify = (r: RequisitionRecord): boolean => Boolean(r.allow_edit);

const alertMessage = (title: string, msg: string) => {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
};

// ─── Form product row ───────────────────────────────────────────────────────

interface FormProductRow {
  key: number;
  id?: number;
  product_id: number | null;
  unit_id: number | null;
  quantity: string;
  description: string;
}

// ─── Single select dropdown modal (scrollable for large option lists) ──────

function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: number | string; label: string }[];
  selectedValue?: number | string | null;
  onSelect: (value: number | string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.pickerSheet} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {options.length === 0 ? (
              <Text style={styles.pickerEmpty}>No options available.</Text>
            ) : (
              options.map((opt) => {
                const selected = selectedValue === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.pickerItem, selected && styles.pickerItemActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelect(opt.value);
                      onClose();
                    }}
                  >
                    <Text style={[styles.pickerItemText, selected && styles.pickerItemTextActive]}>{opt.label}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#0041E8" />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Detail modal ───────────────────────────────────────────────────────────

function DetailModal({
  record,
  items,
  itemsLoading,
  loading,
  visible,
  onClose,
  onEdit,
  onDelete,
  deleting,
}: {
  record: RequisitionRecord | null;
  items: RequisitionItem[];
  itemsLoading: boolean;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit: (record: RequisitionRecord) => void;
  onDelete: (record: RequisitionRecord) => void;
  deleting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Requisition</Text>
              <Text style={styles.modalSubtitle}>{record?.req_number ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading || !record ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="large" color="#0041E8" />
              <Text style={styles.detailLoadingText}>Loading request...</Text>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
                <View style={styles.detailTopRow}>
                  <View style={[styles.statusPill, { backgroundColor: statusMeta(record.status ?? '').bg }]}>
                    <Text style={[styles.statusPillText, { color: statusMeta(record.status ?? '').text }]}>
                      {statusLabel(record.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.empGrid}>
                  {[
                    ['Requisition No', record.req_number],
                    ['Requested By', record.contact_name ?? record.creator_name ?? '—'],
                    ['Requested To', record.requested_to_name ?? '—'],
                    ['Date', niceDate(record.date)],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.empGridItem}>
                      <Text style={styles.empGridLabel}>{label}:</Text>
                      <Text style={styles.empGridValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.itemsHeaderRow}>
                  <Text style={styles.sectionLabel}>PRODUCTS</Text>
                  {itemsLoading && <ActivityIndicator size="small" color="#0041E8" />}
                </View>
                <View style={styles.itemsBox}>
                  {items.length === 0 && !itemsLoading ? (
                    <Text style={styles.itemsEmpty}>No products added.</Text>
                  ) : (
                    items.map((it) => (
                      <View key={it.id} style={styles.itemRow}>
                        <View style={styles.itemRowTop}>
                          <Text style={styles.itemName} numberOfLines={1}>{it.product_name}</Text>
                          <Text style={styles.itemQty}>
                            {it.quantity}{it.unit_symbol ? ` ${it.unit_symbol}` : ''}
                          </Text>
                        </View>
                        {it.description ? (
                          <Text style={styles.itemDesc} numberOfLines={2}>{it.description}</Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>

                {record.requested_to_name ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>REQUESTED TO</Text>
                    <Text style={styles.reasonText}>{record.requested_to_name}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.detailActions}>
                {canModify(record) && (
                  <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(record)} activeOpacity={0.88}>
                    <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {canModify(record) && record.allow_delete && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDelete(record)}
                    disabled={deleting}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function RequisitionScreen() {
  const router = useRouter();

  // List state
  const [requests, setRequests] = useState<RequisitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Detail state
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<RequisitionRecord | null>(null);
  const [detailItems, setDetailItems] = useState<RequisitionItem[]>([]);
  const [detailItemsLoading, setDetailItemsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState(false);
  const [editing, setEditing] = useState<RequisitionRecord | null>(null);
  const [code, setCode] = useState('');
  const [requestedTo, setRequestedTo] = useState<number | null>(null);
  const [date, setDate] = useState(toDateStr(new Date()));
  const [notes, setNotes] = useState('');
  const [specialInstruction, setSpecialInstruction] = useState('');
  const [productRows, setProductRows] = useState<FormProductRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Option state
  const [userOptions, setUserOptions] = useState<OptionItem[]>([]);
  const [productOptions, setProductOptions] = useState<OptionItem[]>([]);
  const [unitOptions, setUnitOptions] = useState<OptionItem[]>([]);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [productPickerRow, setProductPickerRow] = useState<number | null>(null);
  const [unitPickerRow, setUnitPickerRow] = useState<number | null>(null);

  const keySeq = useRef(0);
  const nextKey = () => ++keySeq.current;

  const emptyRow = (): FormProductRow => ({
    key: nextKey(),
    product_id: null,
    unit_id: null,
    quantity: '',
    description: '',
  });

  const loadList = useCallback(async () => {
    try {
      const res = await requisitionService.list();
      setRequests(res?.data ?? []);
      setListError(null);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load requisitions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const generateNewCode = useCallback(async () => {
    setGenerating(true);
    try {
      const generated = await requisitionService.generateCode();
      if (generated) setCode(generated);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [users, products, units] = await Promise.all([
        requisitionService.userOptions(),
        requisitionService.productOptions(),
        requisitionService.unitOptions(),
      ]);
      setUserOptions(users);
      setProductOptions(products);
      setUnitOptions(units);
    } catch {
      // Options are optional; submission time validates anyway.
    }
  }, []);

  const initializeForm = useCallback(
    (record: RequisitionRecord | null) => {
      if (record) {
        setCode(record.req_number);
        setRequestedTo(null);
        setDate(record.date || toDateStr(new Date()));
        setNotes('');
        setSpecialInstruction('');
        setProductRows([]);
      } else {
        setCode('');
        setRequestedTo(null);
        setDate(toDateStr(new Date()));
        setNotes('');
        setSpecialInstruction('');
        setProductRows([]);
        if (!editing) generateNewCode();
      }
    },
    [editing, generateNewCode]
  );

  const loadItemsIntoForm = useCallback(async (id: number) => {
    setItemsLoading(true);
    try {
      const res = await requisitionService.items(id);
      const rows: FormProductRow[] = (res?.data ?? []).map((it) => ({
        key: nextKey(),
        id: it.id,
        product_id: it.product_id,
        unit_id: it.unit_id,
        quantity: String(it.quantity),
        description: it.description ?? '',
      }));
      setProductRows(rows.length > 0 ? rows : [emptyRow()]);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load requisition products.');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormMode(true);
    loadOptions();
    initializeForm(null);
    setProductRows([emptyRow()]);
  };

  const openEdit = async (record: RequisitionRecord) => {
    setShowDetail(false);
    setEditing(record);
    setFormMode(true);
    loadOptions();
    initializeForm(record);
    await loadItemsIntoForm(record.id);
  };

  const closeForm = () => {
    setFormMode(false);
    setEditing(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadList();
    setRefreshing(false);
  };

  const handleView = async (record: RequisitionRecord) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailItems([]);
    setDetailItemsLoading(true);
    try {
      const res = await requisitionService.show(record.id);
      setDetail(res?.data ?? record);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load requisition details.');
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
    try {
      const items = await requisitionService.items(record.id);
      setDetailItems(items?.data ?? []);
    } catch {
      setDetailItems([]);
    } finally {
      setDetailItemsLoading(false);
    }
  };

  const handleDelete = async (record: RequisitionRecord) => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        const res = await requisitionService.destroy(record.id);
        alertMessage('Deleted', res?.message || 'Requisition deleted.');
        setShowDetail(false);
        await loadList();
      } catch (e: any) {
        alertMessage('Error', e?.message || 'Delete failed.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this requisition?')) doDelete();
    } else {
      Alert.alert('Delete Request', 'Delete this requisition?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const updateRow = (key: number, patch: Partial<FormProductRow>) => {
    setProductRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: number) => {
    setProductRows((rows) => rows.filter((r) => r.key !== key));
  };

  const selectedUserLabel = userOptions.find((o) => o.value === requestedTo)?.label ?? '';

  const validateForm = (): string | null => {
    if (!code.trim()) return 'Requisition number is missing. Tap the refresh icon to generate one.';
    if (!requestedTo) return 'Select who the requisition is requested to.';
    const validRows = productRows.filter((r) => r.product_id);
    if (validRows.length === 0) return 'Add at least one product.';
    for (const r of validRows) {
      if (!r.quantity || Number.isNaN(Number(r.quantity))) {
        return 'Enter a quantity for each product.';
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      alertMessage('Missing information', error);
      return;
    }

    const products: RequisitionProductPayload[] = productRows
      .filter((r) => r.product_id)
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        product_id: r.product_id as number,
        quantity: Number(r.quantity),
        unit_id: r.unit_id,
        ...(r.description.trim() ? { description: r.description.trim() } : {}),
      }));

    const payload: RequisitionPayload = {
      req_number: code.trim(),
      requested_to: requestedTo as number,
      date,
      notes: notes.trim() || null,
      special_instruction: specialInstruction.trim() || null,
      products,
    };

    setSaving(true);
    try {
      const res = editing
        ? await requisitionService.update(editing.id, payload)
        : await requisitionService.store(payload);
      alertMessage('Success', res?.message || 'Requisition submitted.');
      setFormMode(false);
      setEditing(null);
      await loadList();
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to submit requisition.');
    } finally {
      setSaving(false);
    }
  };

  const addProductRow = () => {
    setProductRows((rows) => [...rows, emptyRow()]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderList = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0041E8" />
          <Text style={styles.centerStateText}>Loading requisitions...</Text>
        </View>
      );
    }

    if (listError) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text style={[styles.centerStateText, { color: '#DC2626' }]}>{listError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadList} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (requests.length === 0) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="clipboard-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No requisitions yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Create Requisition</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0041E8']} tintColor="#0041E8" />
        }
      >
        <Text style={styles.sectionLabel}>MY REQUISITIONS</Text>
        {requests.map((record) => {
          const meta = statusMeta(record.status ?? '');
          return (
            <TouchableOpacity key={record.id} style={styles.requestCard} activeOpacity={0.85} onPress={() => handleView(record)}>
              <View style={styles.requestTopRow}>
                <Text style={styles.requestCode}>{record.req_number}</Text>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusPillText, { color: meta.text }]}>{statusLabel(record.status)}</Text>
                </View>
              </View>

              <View style={styles.requestMetaRow}>
                <Ionicons name="calendar-outline" size={13} color="#0041E8" />
                <Text style={styles.requestDatesText}>{niceDate(record.date)}</Text>
              </View>

              <View style={styles.requestMetaRow}>
                <Ionicons name="person-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText}>To: {record.requested_to_name ?? '—'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderProductRows = () => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>
        Products <Text style={styles.requiredStar}>*</Text>
      </Text>
      {itemsLoading && (
        <View style={styles.itemsLoadingRow}>
          <ActivityIndicator size="small" color="#0041E8" />
          <Text style={styles.itemsLoadingText}>Loading existing products...</Text>
        </View>
      )}
      {productRows.map((row, index) => {
        const productLabel = productOptions.find((o) => o.value === row.product_id)?.label ?? '';
        const unitLabel = unitOptions.find((o) => o.value === row.unit_id)?.label ?? '';
        return (
          <View key={row.key} style={styles.productCard}>
            <View style={styles.productCardHeader}>
              <Text style={styles.productCardTitle}>Product {index + 1}</Text>
              <TouchableOpacity onPress={() => removeRow(row.key)} hitSlop={8} style={styles.removeRowBtn}>
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.selectField}
              activeOpacity={0.8}
              onPress={() => productOptions.length > 0 && setProductPickerRow(row.key)}
            >
              <Text style={productLabel ? styles.selectFieldValue : styles.selectFieldPlaceholder} numberOfLines={1}>
                {productLabel || (productOptions.length === 0 ? 'Loading products...' : 'Select product')}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.quantityRow}>
              <View style={[styles.fieldBlock, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.smallLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={row.quantity}
                  onChangeText={(t) => updateRow(row.key, { quantity: t })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
              <View style={[styles.fieldBlock, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.smallLabel}>Unit (optional)</Text>
                <TouchableOpacity
                  style={styles.selectField}
                  activeOpacity={0.8}
                  onPress={() => unitOptions.length > 0 && setUnitPickerRow(row.key)}
                >
                  <Text style={unitLabel ? styles.selectFieldValue : styles.selectFieldPlaceholder} numberOfLines={1}>
                    {unitLabel || 'Select unit'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={[styles.input, styles.descInput]}
              value={row.description}
              onChangeText={(t) => updateRow(row.key, { description: t })}
              placeholder="Description (max 50 chars, optional)"
              placeholderTextColor="#CBD5E1"
              maxLength={50}
            />
          </View>
        );
      })}
      <TouchableOpacity style={styles.addProductBtn} activeOpacity={0.85} onPress={addProductRow}>
        <Ionicons name="add" size={18} color="#0041E8" />
        <Text style={styles.addProductBtnText}>Add Product</Text>
      </TouchableOpacity>
    </View>
  );

  const renderForm = () => (
    <KeyboardAvoidingView style={styles.formContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>REQUISITION DETAILS</Text>

        {/* Requisition Number */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Requisition Number <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, styles.codeInput, styles.codeInputReadOnly]}
              value={code}
              editable={false}
              selectTextOnFocus={false}
              autoCapitalize="characters"
              placeholder="REQS-…"
              placeholderTextColor="#CBD5E1"
            />
            {!editing && (
              <TouchableOpacity style={styles.codeRefreshBtn} onPress={generateNewCode} disabled={generating}>
                <Ionicons name={generating ? 'sync-outline' : 'refresh-outline'} size={18} color="#0041E8" />
              </TouchableOpacity>
            )}
          </View>
          {!editing && <Text style={styles.fieldHint}>Tap the refresh icon to generate a new number.</Text>}
        </View>

        {/* Requested To */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Requested To <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.selectField}
            activeOpacity={0.8}
            onPress={() => userOptions.length > 0 && setUserPickerOpen(true)}
          >
            <Text style={selectedUserLabel ? styles.selectFieldValue : styles.selectFieldPlaceholder} numberOfLines={1}>
              {selectedUserLabel || (userOptions.length === 0 ? 'Loading users...' : 'Select user')}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Date */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Date</Text>
          <DateTimePickerField mode="date" value={date} onChange={setDate} placeholder="Select date" />
        </View>

        {renderProductRows()}

        {/* Notes */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Enter notes (optional)..."
            placeholderTextColor="#CBD5E1"
          />
        </View>

        {/* Special Instruction */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Special Instruction</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={specialInstruction}
            onChangeText={setSpecialInstruction}
            multiline
            placeholder="Enter special instruction (optional)..."
            placeholderTextColor="#CBD5E1"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>{editing ? 'UPDATE REQUISITION' : 'SUBMIT REQUISITION'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // When editing, pre-fill requested_to from the user options by name.
  useEffect(() => {
    if (!formMode || !editing || !recordRequestedToName) return;
    const match = userOptions.find((o) => o.label === recordRequestedToName);
    if (match) setRequestedTo(match.value);
  }, [formMode, editing, userOptions]);

  let recordRequestedToName: string | null = null; // placeholder hook dependency target

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0041E8" />
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (formMode ? closeForm() : router.back())}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {formMode ? (editing ? 'Edit Requisition' : 'New Requisition') : 'Requisition'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {formMode ? (
        renderForm()
      ) : (
        <>
          {renderList()}
          <View style={styles.bottomBarFixed}>
            <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.88} onPress={openCreate}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionButtonText}>NEW REQUISITION</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <DetailModal
        record={detail}
        items={detailItems}
        itemsLoading={detailItemsLoading}
        loading={detailLoading}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onEdit={(r) => openEdit(r)}
        onDelete={handleDelete}
        deleting={deleting}
      />

      <OptionPickerModal
        visible={userPickerOpen}
        title="Select Requested To"
        options={userOptions}
        selectedValue={requestedTo}
        onSelect={(v) => setRequestedTo(Number(v))}
        onClose={() => setUserPickerOpen(false)}
      />

      <OptionPickerModal
        visible={productPickerRow !== null}
        title="Select Product"
        options={productOptions}
        selectedValue={productRows.find((r) => r.key === productPickerRow)?.product_id ?? null}
        onSelect={(v) => {
          if (productPickerRow !== null) updateRow(productPickerRow, { product_id: Number(v) });
          setProductPickerRow(null);
        }}
        onClose={() => setProductPickerRow(null)}
      />

      <OptionPickerModal
        visible={unitPickerRow !== null}
        title="Select Unit"
        options={unitOptions}
        selectedValue={productRows.find((r) => r.key === unitPickerRow)?.unit_id ?? null}
        onSelect={(v) => {
          if (unitPickerRow !== null) updateRow(unitPickerRow, { unit_id: Number(v) });
          setUnitPickerRow(null);
        }}
        onClose={() => setUnitPickerRow(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  blueHeader: {
    backgroundColor: '#0041E8',
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerStateText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  retryBtn: {
    marginTop: 4,
    backgroundColor: '#0041E8',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#64748B',
    marginBottom: 12,
    marginTop: 4,
  },
  listContent: { padding: 16, paddingBottom: 100 },

  /* Requests list */
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  requestTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  requestCode: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' },
  requestMetaText: { fontSize: 12, color: '#64748B', flex: 1 },
  requestDatesText: { fontSize: 12, color: '#0041E8', fontWeight: '600' },

  /* Bottom bar */
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
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  /* Detail modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { padding: 6 },
  detailLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  detailLoadingText: { fontSize: 13, color: '#64748B' },
  modalContent: { padding: 20, paddingBottom: 32 },
  detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  empGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  empGridItem: { width: '48%', flexGrow: 1 },
  empGridLabel: { fontSize: 11, color: '#64748B' },
  empGridValue: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  itemsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  itemsEmpty: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },
  itemRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  itemRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  itemName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  itemQty: { fontSize: 13, fontWeight: '800', color: '#0041E8' },
  itemDesc: { fontSize: 12, color: '#64748B', marginTop: 4 },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  reasonLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#64748B', marginBottom: 4 },
  reasonText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#0041E8',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },

  /* Form */
  formContainer: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 40 },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6 },
  smallLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 5 },
  requiredStar: { color: '#DC2626' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeInput: { flex: 1 },
  codeInputReadOnly: { backgroundColor: '#F1F5F9' },
  codeRefreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldHint: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectFieldValue: { fontSize: 13, color: '#0F172A', flex: 1, marginRight: 8 },
  selectFieldPlaceholder: { fontSize: 13, color: '#94A3B8', flex: 1, marginRight: 8 },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
  descInput: { marginTop: 10 },

  /* Product rows */
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productCardTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  removeRowBtn: { padding: 2 },
  quantityRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BFDBFE',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingVertical: 12,
  },
  addProductBtnText: { fontSize: 13, fontWeight: '600', color: '#0041E8' },
  itemsLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemsLoadingText: { fontSize: 12, color: '#64748B' },

  submitBtn: {
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
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  /* Picker */
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 24 },
  pickerSheet: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 8, maxHeight: '70%' },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', padding: 12, paddingBottom: 8 },
  pickerEmpty: { fontSize: 13, color: '#94A3B8', padding: 14, textAlign: 'center' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pickerItemActive: { backgroundColor: '#EEF2FF' },
  pickerItemText: { fontSize: 14, color: '#334155' },
  pickerItemTextActive: { color: '#0041E8', fontWeight: '700' },
});