'use client';

import React, { useMemo, useState } from 'react';
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
  X,
} from 'lucide-react';
import {
  formatDateTime,
  formatINR,
  getAvatarColor,
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

  // Switch PIN challenge modal
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
    setEditingStaff(null);
    setName('');
    setRole('munim');
    setPhone('');
    setPin('');
    setFormError('');
    setShowAddStaff(true);
  };

  const openEditStaff = (staff: StaffMember) => {
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
      setFormError('Enter staff or munim name.');
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
      setShowAddStaff(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save staff member.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectOperator = (staff: StaffMember | null) => {
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
    onSwitchOperator({
      staffId: pendingSwitch.id,
      name: pendingSwitch.name,
      role: pendingSwitch.role,
    });
    setPendingSwitch(null);
  };

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Ledger"
              className="min-w-[44px] min-h-[44px] rounded-xl spatial-card flex items-center justify-center active:scale-95 transition shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--ink)]" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
              Staff &amp; Munim Logs
            </h2>
            <p className="text-xs text-[var(--ink-muted)] leading-snug">
              Multi-operator accountability stamped automatically
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateStaff}
          className="min-h-[44px] px-3.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 tactile-key-primary active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff</span>
        </button>
      </div>

      {/* Active Counter Operator Switcher */}
      <section className="rounded-[26px] spatial-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[var(--brand-accent)]" />
            <span>Active Operator</span>
          </p>
          <span className="text-xs font-extrabold text-[var(--brand-accent)]">
            {activeOperator.name} ({activeOperator.role})
          </span>
        </div>

        <div className="space-y-2">
          {/* Owner Default */}
          <button
            type="button"
            onClick={() => handleSelectOperator(null)}
            className={`w-full rounded-[20px] p-3 flex items-center justify-between gap-2 text-left active:scale-[0.98] transition ${
              activeOperator.staffId === 'owner'
                ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand-accent)]'
                : 'bg-[var(--surface-subtle)]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-10 h-10 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center shadow-inner shrink-0">
                O
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[var(--ink)]">Shop Owner</p>
                <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                  owner · Full access
                </p>
              </div>
            </div>
            {activeOperator.staffId === 'owner' && (
              <Check className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
            )}
          </button>

          {staffMembers.map((stf) => {
            const isSelected = activeOperator.staffId === stf.id;
            const armed = armedDeleteId === stf.id;
            return (
              <div
                key={stf.id}
                className={`rounded-[20px] p-3 flex items-center justify-between gap-2 transition ${
                  isSelected
                    ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand-accent)]'
                    : 'bg-[var(--surface-subtle)]'
                } ${!stf.active ? 'opacity-55' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectOperator(stf)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left active:scale-95 transition"
                >
                  <div
                    style={{ backgroundColor: getAvatarColor(stf.name) }}
                    className="w-10 h-10 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center shadow-inner shrink-0"
                  >
                    {stf.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-1">
                      <span className="truncate">{stf.name}</span>
                      {stf.pinHash && <KeyRound className="w-3 h-3 text-[var(--ink-muted)] shrink-0" />}
                    </p>
                    <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                      {stf.role}
                      {!stf.active ? ' · Paused' : ''}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditStaff(stf)}
                    className="min-h-[40px] px-3 rounded-xl text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--brand-accent)] hover:bg-[var(--surface)] active:scale-95 transition"
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
                    className={`min-w-[40px] min-h-[40px] px-2.5 rounded-xl text-xs font-bold flex items-center justify-center active:scale-95 transition ${
                      armed
                        ? 'bg-[var(--credit-red)] text-white shadow-sm'
                        : 'text-[var(--ink-muted)] hover:text-[var(--credit-red)] hover:bg-[var(--credit-tint)]'
                    }`}
                  >
                    {armed ? 'Delete?' : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Immutable Audit Timeline */}
      <section className="rounded-[26px] spatial-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-display text-sm font-extrabold flex items-center gap-2 text-[var(--ink)]">
            <span className="w-8 h-8 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              <History className="w-4 h-4" />
            </span>
            <span>Audit Trail ({filteredLogs.length})</span>
          </h3>

          <select
            aria-label="Filter logs by staff"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="min-h-[38px] rounded-xl bg-[var(--surface-subtle)] px-3 text-xs font-bold text-[var(--ink)] outline-none"
          >
            <option value="all">All Operators</option>
            {actorOptions.map((nameOpt) => (
              <option key={nameOpt} value={nameOpt}>
                {nameOpt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'ledger', label: 'Khata' },
              { id: 'bill', label: 'Bills' },
              { id: 'galla', label: 'Galla' },
              { id: 'stock', label: 'Stock' },
              { id: 'staff', label: 'Staff' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActionFilter(f.id)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-extrabold whitespace-nowrap active:scale-95 transition ${
                actionFilter === f.id
                  ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] ring-2 ring-[var(--brand-accent)]'
                  : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--surface-subtle)] text-[var(--ink-muted)] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[var(--ink)]">
              No counter activity logs recorded yet.
            </p>
            <p className="text-xs text-[var(--ink-muted)]">
              Add a khata entry, GST bill, stock change, or switch operator to create an audit
              trail.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, idx) => (
              <div
                key={log.id}
                style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
                className="stagger-fade-up rounded-2xl bg-[var(--surface-subtle)] p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-[var(--ink)] leading-snug">{log.summary}</p>
                  <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
                    {log.actorName} · {log.actorRole} · {log.actionType.toUpperCase()}
                    {log.targetName ? ` · ${log.targetName}` : ''}
                    {typeof log.createdAt === 'string' ? ` · ${formatDateTime(log.createdAt)}` : ''}
                  </p>
                </div>
                {typeof log.amount === 'number' && log.amount > 0 && (
                  <span className="font-extrabold font-tabular text-sm text-[var(--brand-accent)] shrink-0">
                    {formatINR(log.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add / Edit Staff Bottom Sheet */}
      {showAddStaff && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setShowAddStaff(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 pt-3 space-y-4 pb-safe max-h-[90dvh] overflow-y-auto"
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-[var(--surface-subtle)]" />

            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                {editingStaff ? `Edit ${editingStaff.name}` : 'Add Staff / Munim'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStaff(false)}
                aria-label="Close staff dialog"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ramu Munim"
                  className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Role</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['munim', 'cashier', 'owner'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`min-h-[44px] rounded-xl text-xs font-extrabold capitalize active:scale-95 transition ${
                        role === r
                          ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] ring-2 ring-[var(--brand-accent)]'
                          : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                      }`}
                    >
                      {r}
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
                  className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
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
                  className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                />
              </div>
            </div>

            {formError && <p className="text-xs font-bold text-[var(--credit-red)]">{formError}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveStaff}
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm tactile-key-primary disabled:opacity-60 active:scale-95 transition"
            >
              {saving ? 'Saving...' : editingStaff ? 'Update Staff' : 'Save Staff Member'}
            </button>
          </div>
        </div>
      )}

      {/* Operator PIN Switch Verification Bottom Sheet */}
      {pendingSwitch && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingSwitch(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 pt-3 text-center space-y-4 pb-safe"
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-[var(--surface-subtle)]" />

            <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-[var(--ink)]">
                Enter PIN for {pendingSwitch.name}
              </h3>
              <p className="text-xs text-[var(--ink-muted)]">4-digit counter verification</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={switchPinInput}
              onChange={(e) => setSwitchPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full min-h-[50px] rounded-2xl bg-[var(--surface-subtle)] ring-2 ring-[var(--brand-accent)] text-center text-2xl font-extrabold font-tabular tracking-[0.4em] text-[var(--ink)] outline-none"
            />
            {switchPinError && (
              <p className="text-xs font-bold text-[var(--credit-red)]">{switchPinError}</p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleVerifySwitchPin}
                className="min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold tactile-key-primary active:scale-95 transition"
              >
                Switch Counter
              </button>
              <button
                type="button"
                onClick={() => setPendingSwitch(null)}
                className="min-h-[46px] rounded-xl bg-[var(--surface-subtle)] text-xs font-bold text-[var(--ink)] active:scale-95 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
