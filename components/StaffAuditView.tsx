'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  History,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  formatDateTime,
  formatINR,
  hashPinForUid,
  isValidIndianMobile,
  verifyStoredPin,
} from '@/lib/i18n';
import type {
  ActiveOperator,
  ActivityActionType,
  ActivityLog,
  StaffMember,
  StaffRole,
} from '@/lib/types';
import { haptics } from '@/utils/haptics';
import { DetentSheetOverlay } from './motion/DetentSheetOverlay';
import { SNAPPY_SPRING } from './motion/SpatialMotionEngine';

interface StaffAuditViewProps {
  uid: string;
  staffMembers: StaffMember[];
  activityLogs: ActivityLog[];
  activeOperator: ActiveOperator;
  onSwitchOperator: (op: ActiveOperator) => void;
  onSaveStaff: (payload: {
    existingId?: string;
    name: string;
    role: StaffRole;
    phone: string;
    pinHash?: string;
    active: boolean;
  }) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onBack?: () => void;
}

const SEG_SPRING = SNAPPY_SPRING;

export const StaffAuditView: React.FC<StaffAuditViewProps> = ({
  uid,
  staffMembers,
  activityLogs,
  activeOperator,
  onSwitchOperator,
  onSaveStaff,
  onDeleteStaff,
  onBack,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [actionFilter, setActionFilter] = useState<'all' | ActivityActionType>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('munim');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const [pendingSwitch, setPendingSwitch] = useState<StaffMember | null>(null);
  const [switchPinInput, setSwitchPinInput] = useState('');
  const [switchPinError, setSwitchPinError] = useState('');

  const actorOptions = useMemo(() => {
    const names = new Set<string>(['Shop Owner']);
    for (const s of staffMembers) names.add(s.name);
    for (const l of activityLogs) {
      if (l.actorName) names.add(l.actorName);
    }
    return Array.from(names);
  }, [staffMembers, activityLogs]);

  const filteredLogs = useMemo(() => {
    return [...activityLogs]
      .filter((l) => {
        if (actionFilter !== 'all' && l.actionType !== actionFilter) return false;
        if (actorFilter !== 'all' && l.actorName !== actorFilter) return false;
        return true;
      })
      .slice(0, 120);
  }, [activityLogs, actionFilter, actorFilter]);

  const openCreateStaff = () => {
    haptics.tap();
    setEditingStaff(null);
    setName('');
    setRole('munim');
    setPhone('');
    setPin('');
    setFormError('');
    setShowAddStaff(true);
  };

  const openEditStaff = (staff: StaffMember) => {
    haptics.tap();
    setEditingStaff(staff);
    setName(staff.name);
    setRole(staff.role);
    setPhone(staff.phone || '');
    setPin('');
    setFormError('');
    setShowAddStaff(true);
  };

  const handleSaveStaff = async () => {
    setFormError('');
    if (!name.trim()) {
      setFormError('Enter staff member name.');
      return;
    }
    if (phone && !isValidIndianMobile(phone)) {
      setFormError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (pin && pin.length !== 4) {
      setFormError('Staff PIN must be 4 digits (or leave empty for no PIN).');
      return;
    }
    setSaving(true);
    try {
      const pinHash = pin ? await hashPinForUid(pin, uid) : undefined;
      await onSaveStaff({
        existingId: editingStaff?.id,
        name: name.trim(),
        role,
        phone: phone.trim(),
        ...(pinHash !== undefined ? { pinHash } : {}),
        active: editingStaff ? editingStaff.active : true,
      });
      haptics.success();
      setShowAddStaff(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save staff member.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectOperator = (staff: StaffMember | null) => {
    haptics.tap();
    if (!staff) {
      onSwitchOperator({ staffId: 'owner', name: 'Shop Owner', role: 'owner' });
      return;
    }
    if (!staff.active) return;
    if (staff.pinHash) {
      setPendingSwitch(staff);
      setSwitchPinInput('');
      setSwitchPinError('');
      return;
    }
    onSwitchOperator({ staffId: staff.id, name: staff.name, role: staff.role });
  };

  const handleVerifySwitchPin = async () => {
    if (!pendingSwitch?.pinHash) return;
    setSwitchPinError('');
    const ok = await verifyStoredPin(switchPinInput, pendingSwitch.pinHash, uid);
    if (!ok) {
      setSwitchPinError('Incorrect 4-digit PIN.');
      return;
    }
    haptics.success();
    onSwitchOperator({
      staffId: pendingSwitch.id,
      name: pendingSwitch.name,
      role: pendingSwitch.role,
    });
    setPendingSwitch(null);
  };

  return (
    <div className="space-y-4 pb-16">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Ledger"
              className="min-w-[44px] min-h-[44px] rounded-full liquid-glass flex items-center justify-center active:scale-95 transition shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--ink)]" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              Staff &amp; Activity Logs
            </h2>
            <p className="text-xs font-medium text-[var(--ink-muted)] leading-snug">
              Operator accountability stamped on every record
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateStaff}
          className="min-h-[44px] px-4 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 tactile-key-primary active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff</span>
        </button>
      </div>

      {/* Responsive 2-col layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Active Counter Operator Switcher */}
        <section className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[var(--ink)]" />
              <span>Active Operator</span>
            </p>
            <span className="text-xs font-semibold text-[var(--ink)]">
              {activeOperator.name} ({activeOperator.role === 'munim' ? 'manager' : activeOperator.role})
            </span>
          </div>

          <div className="ios27-inset-group rounded-[22px] divide-y divide-[var(--glass-border)] overflow-hidden">
            <button
              type="button"
              onClick={() => handleSelectOperator(null)}
              className={`w-full px-4 py-3.5 flex items-center justify-between gap-2 text-left transition-colors ${
                activeOperator.staffId === 'owner' ? 'bg-[var(--surface-subtle)]' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] font-semibold text-sm flex items-center justify-center shrink-0">
                  O
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink)]">Shop Owner</p>
                  <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                    Owner · Full access
                  </p>
                </div>
              </div>
              {activeOperator.staffId === 'owner' && (
                <Check className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
              )}
            </button>

            <AnimatePresence mode="popLayout">
              {staffMembers.map((stf) => {
                const isSelected = activeOperator.staffId === stf.id;
                const armed = armedDeleteId === stf.id;
                return (
                  <motion.div
                    key={stf.id}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={SEG_SPRING}
                    className={`px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-2 transition will-change-transform ${
                      isSelected ? 'bg-[var(--brand-tint)]/45' : ''
                    } ${!stf.active ? 'opacity-55' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectOperator(stf)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left active:scale-95 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] font-semibold text-sm flex items-center justify-center shrink-0">
                        {stf.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--ink)] flex items-center gap-1">
                          <span className="truncate">{stf.name}</span>
                          {stf.pinHash && (
                            <KeyRound className="w-3 h-3 text-[var(--ink-muted)] shrink-0" />
                          )}
                        </p>
                        <p className="text-[11px] font-medium text-[var(--ink-muted)] capitalize">
                          {stf.role === 'munim' ? 'Manager' : stf.role}
                          {!stf.active ? ' · Paused' : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditStaff(stf)}
                        className="min-h-[44px] px-3 rounded-full text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (armed) {
                            await onDeleteStaff(stf.id);
                            if (isSelected) handleSelectOperator(null);
                            setArmedDeleteId(null);
                          } else {
                            setArmedDeleteId(stf.id);
                          }
                        }}
                        aria-label={`Remove ${stf.name}`}
                        className={`min-w-[44px] min-h-[44px] px-2.5 rounded-full text-xs font-semibold flex items-center justify-center active:scale-95 transition ${
                          armed
                            ? 'bg-[var(--credit-red)] text-white shadow-sm'
                            : 'text-[var(--ink-muted)] hover:text-[var(--credit-red)] hover:bg-[var(--credit-tint)]'
                        }`}
                      >
                        {armed ? 'Delete?' : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* Immutable Audit Timeline */}
        <section className="lg:col-span-7 ios27-inset-group rounded-[22px] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-display text-sm font-extrabold flex items-center gap-2 text-[var(--ink)]">
              <span className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center">
                <History className="w-4 h-4" />
              </span>
              <span className="font-tabular">Audit Trail ({filteredLogs.length})</span>
            </h3>

            <select
              aria-label="Filter logs by staff"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="min-h-[40px] rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3.5 text-xs font-semibold text-[var(--ink)] outline-none"
            >
              <option value="all">All Operators</option>
              {actorOptions.map((nameOpt) => (
                <option key={nameOpt} value={nameOpt}>
                  {nameOpt}
                </option>
              ))}
            </select>
          </div>

          <div className="relative grid grid-cols-6 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'ledger', label: 'Ledger' },
                { id: 'bill', label: 'Bills' },
                { id: 'galla', label: 'Cash' },
                { id: 'stock', label: 'Stock' },
                { id: 'staff', label: 'Staff' },
              ] as const
            ).map((f) => {
              const active = actionFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setActionFilter(f.id);
                  }}
                  className={`relative min-h-[38px] px-1 rounded-full text-[11px] font-semibold z-10 transition-colors ${
                    active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'auditFilterSeg'}
                      transition={SEG_SPRING}
                      className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-xs border border-[var(--glass-border)]"
                    />
                  )}
                  <span className="relative z-10">{f.label}</span>
                </button>
              );
            })}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink-muted)] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-[var(--ink)]">
                No activity logs recorded yet
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                Add a ledger entry, bill, stock change, or switch operator to create an audit trail.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--glass-border)]">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-[var(--ink)] leading-snug">{log.summary}</p>
                    <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
                      {log.actorName} · {log.actorRole === 'munim' ? 'Manager' : log.actorRole} ·{' '}
                      {log.actionType.toUpperCase()}
                      {log.targetName ? ` · ${log.targetName}` : ''}
                      {typeof log.createdAt === 'string'
                        ? ` · ${formatDateTime(log.createdAt)}`
                        : ''}
                    </p>
                  </div>
                  {typeof log.amount === 'number' && log.amount > 0 && (
                    <span className="font-semibold font-tabular text-sm text-[var(--ink)] shrink-0">
                      {formatINR(log.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add / Edit Staff Detent Sheet */}
      <DetentSheetOverlay
        open={showAddStaff}
        onClose={() => {
          if (!saving) setShowAddStaff(false);
        }}
        title={editingStaff ? `Edit ${editingStaff.name}` : 'Add Team Member'}
        subtitle="Role & optional 4-digit PIN"
        initialDetent="peek"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ramesh Kumar"
                className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>

            <div>
              <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Role</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'munim', label: 'Manager' },
                    { id: 'cashier', label: 'Cashier' },
                    { id: 'owner', label: 'Owner' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`min-h-[44px] rounded-full text-xs font-semibold active:scale-95 transition border ${
                      role === r.id
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)] border-transparent'
                        : 'bg-[var(--surface-subtle)] border-[var(--glass-border)] text-[var(--ink)]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Mobile Number (Optional)
              </label>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3.5 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                4-Digit Operator PIN (Optional)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={editingStaff?.pinHash ? 'Enter 4 digits to update PIN' : 'e.g. 4321'}
                className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3.5 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>
          </div>

          {formError && <p className="text-xs font-bold text-[var(--credit-red)]">{formError}</p>}

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveStaff}
            className="w-full min-h-[48px] rounded-full bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm tactile-key-primary disabled:opacity-60 active:scale-95 transition"
          >
            {saving ? 'Saving...' : editingStaff ? 'Update Staff' : 'Save Staff Member'}
          </button>
        </div>
      </DetentSheetOverlay>

      {/* Operator PIN Switch Verification Detent Sheet */}
      <DetentSheetOverlay
        open={Boolean(pendingSwitch)}
        onClose={() => setPendingSwitch(null)}
        title={`Enter PIN for ${pendingSwitch?.name || 'Operator'}`}
        subtitle="4-digit counter verification"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={switchPinInput}
            onChange={(e) => setSwitchPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="w-full min-h-[50px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-4 text-center text-xl sm:text-2xl font-extrabold font-tabular tracking-wider sm:tracking-[0.3em] text-[var(--ink)] outline-none whitespace-nowrap overflow-hidden text-ellipsis"
          />
          {switchPinError && (
            <p className="text-xs font-bold text-[var(--credit-red)]">{switchPinError}</p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleVerifySwitchPin}
              className="min-h-[46px] rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold tactile-key-primary active:scale-95 transition"
            >
              Switch Counter
            </button>
            <button
              type="button"
              onClick={() => setPendingSwitch(null)}
              className="min-h-[46px] rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-xs font-bold text-[var(--ink)] active:scale-95 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </DetentSheetOverlay>
    </div>
  );
};
