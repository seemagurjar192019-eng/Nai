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
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Ledger"
              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Staff Counter &amp; Audit Log
            </h2>
            <p className="text-xs text-slate-500">
              Multi-operator counter accountability · Every bill &amp; khata change stamped automatically
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateStaff}
          className="min-h-[42px] px-4 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff / Munim</span>
        </button>
      </div>

      {/* Active Counter Operator Switcher */}
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[var(--brand)]" />
            <span>Active Counter Operator</span>
          </p>
          <span className="text-xs font-extrabold text-[var(--brand)]">
            {activeOperator.name} ({activeOperator.role})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* Owner Default */}
          <button
            type="button"
            onClick={() => handleSelectOperator(null)}
            className={`rounded-xl border p-3 flex items-center justify-between gap-2 text-left transition ${
              activeOperator.staffId === 'owner'
                ? 'bg-[var(--brand-tint)] border-[var(--brand)]'
                : 'border-[var(--surface-border)]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center shrink-0">
                O
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold truncate">Shop Owner</p>
                <p className="text-[11px] font-medium text-slate-500">owner · Full access</p>
              </div>
            </div>
            {activeOperator.staffId === 'owner' && (
              <Check className="w-4 h-4 text-[var(--brand)] shrink-0" />
            )}
          </button>

          {staffMembers.map((stf) => {
            const isSelected = activeOperator.staffId === stf.id;
            const armed = armedDeleteId === stf.id;
            return (
              <div
                key={stf.id}
                className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)]'
                    : 'border-[var(--surface-border)]'
                } ${!stf.active ? 'opacity-55' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectOperator(stf)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  <div
                    style={{ backgroundColor: getAvatarColor(stf.name) }}
                    className="w-9 h-9 rounded-full text-white font-extrabold text-sm flex items-center justify-center shrink-0"
                  >
                    {stf.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold truncate flex items-center gap-1">
                      <span>{stf.name}</span>
                      {stf.pinHash && <KeyRound className="w-3 h-3 text-slate-400 shrink-0" />}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 truncate">
                      {stf.role}
                      {!stf.active ? ' · Paused' : ''}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditStaff(stf)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-[var(--brand)]"
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
                    className={`px-1.5 py-1 rounded-lg text-[11px] font-bold ${
                      armed ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-600'
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
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--brand)]" />
            <span>Counter Activity Audit Trail ({filteredLogs.length})</span>
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              aria-label="Filter logs by staff"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="min-h-[34px] rounded-lg border border-[var(--surface-border)] bg-transparent px-2.5 text-xs font-bold"
            >
              <option value="all">All Operators</option>
              {actorOptions.map((nameOpt) => (
                <option key={nameOpt} value={nameOpt}>
                  {nameOpt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
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
              className={`min-h-[32px] px-3 rounded-lg text-xs font-bold border whitespace-nowrap ${
                actionFilter === f.id
                  ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                  : 'border-[var(--surface-border)] text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Users className="w-7 h-7 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              No counter activity logs recorded yet.
            </p>
            <p className="text-xs text-slate-500">
              Add a khata entry, GST bill, stock change, or switch operator to create an audit trail.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border)]">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-slate-900 dark:text-white truncate">
                    {log.summary}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {log.actorName} · {log.actorRole} · {log.actionType.toUpperCase()}
                    {log.targetName ? ` · ${log.targetName}` : ''}
                    {typeof log.createdAt === 'string' ? ` · ${formatDateTime(log.createdAt)}` : ''}
                  </p>
                </div>
                {typeof log.amount === 'number' && log.amount > 0 && (
                  <span className="font-extrabold font-tabular text-sm text-[var(--brand)] shrink-0">
                    {formatINR(log.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add / Edit Staff Modal */}
      {showAddStaff && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setShowAddStaff(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {editingStaff ? `Edit ${editingStaff.name}` : 'Add Staff / Munim'}
              </h3>
              <button type="button" onClick={() => setShowAddStaff(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ramu Munim"
                  className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-500 mb-1">Role</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['munim', 'cashier', 'owner'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`min-h-[40px] rounded-xl text-xs font-extrabold capitalize border ${
                        role === r
                          ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                          : 'border-[var(--surface-border)]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-tabular font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  4-Digit Operator PIN (Optional)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder={editingStaff?.pinHash ? 'Enter 4 digits to update PIN' : 'e.g. 4321'}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-tabular font-bold"
                />
              </div>
            </div>

            {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveStaff}
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingStaff ? 'Update Staff' : 'Save Staff Member'}
            </button>
          </div>
        </div>
      )}

      {/* Operator PIN Switch Verification Modal */}
      {pendingSwitch && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingSwitch(null)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 text-center space-y-4 shadow-2xl"
          >
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Enter PIN for {pendingSwitch.name}</h3>
              <p className="text-xs text-slate-500">4-digit counter verification</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={switchPinInput}
              onChange={(e) => setSwitchPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full min-h-[48px] rounded-xl border-2 border-[var(--brand)] bg-transparent text-center text-2xl font-extrabold font-tabular tracking-[0.4em]"
            />
            {switchPinError && <p className="text-xs font-bold text-red-600">{switchPinError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleVerifySwitchPin}
                className="min-h-[44px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold"
              >
                Switch Counter
              </button>
              <button
                type="button"
                onClick={() => setPendingSwitch(null)}
                className="min-h-[44px] rounded-xl border border-[var(--surface-border)] text-xs font-bold"
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
