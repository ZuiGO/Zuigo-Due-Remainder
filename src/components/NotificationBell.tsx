'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  RefreshCw,
  Phone,
  Mail,
  UserPlus,
  ArrowRight,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<{
    missingContacts: Array<{
      customerId: string;
      partyName: string;
      ledgerCode?: string;
      outstandingAmount: number;
      openBillsCount: number;
      sampleBillNo?: string;
      reason: string;
    }>;
    missingContactsCount: number;
    overdue: {
      count: number;
      totalAmount: number;
    };
    latestDiff: {
      batchId: string;
      fileName: string;
      importedAt: string;
      settledEntriesCount: number;
      partialPaymentsCount: number;
      newEntriesCount: number;
      sameEntriesCount: number;
    } | null;
  } | null>(null);

  // Quick Add Contact Modal state
  const [addModal, setAddModal] = useState<{
    isOpen: boolean;
    customerId?: string;
    partyName: string;
    ledgerCode?: string;
    personName: string;
    mobileNumber: string;
    emailId: string;
    designation: string;
    submitting: boolean;
    error: string | null;
    successMessage: string | null;
  }>({
    isOpen: false,
    partyName: '',
    personName: '',
    mobileNumber: '',
    emailId: '',
    designation: '',
    submitting: false,
    error: null,
    successMessage: null,
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success && data.alerts) {
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Auto-refresh when notifications-updated event is emitted
    const handleUpdate = () => fetchNotifications();
    window.addEventListener('notifications-updated', handleUpdate);

    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      window.removeEventListener('notifications-updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOpenAddContact = (customerId?: string, partyName: string = '', ledgerCode?: string) => {
    setAddModal({
      isOpen: true,
      customerId,
      partyName,
      ledgerCode,
      personName: 'Accounts Department',
      mobileNumber: '+91 8530383141',
      emailId: 'jayesh@zuigo.ai',
      designation: 'Accounts Manager',
      submitting: false,
      error: null,
      successMessage: null,
    });
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addModal.mobileNumber && !addModal.emailId) {
      setAddModal((prev) => ({ ...prev, error: 'Please enter at least a mobile number or email ID.' }));
      return;
    }

    try {
      setAddModal((prev) => ({ ...prev, submitting: true, error: null }));
      const res = await fetch('/api/customers/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: addModal.customerId,
          partyName: addModal.partyName,
          ledgerCode: addModal.ledgerCode,
          personName: addModal.personName.trim() || 'Accounts Department',
          mobileNumber: addModal.mobileNumber.trim(),
          whatsappNumber: addModal.mobileNumber.trim(),
          emailId: addModal.emailId.trim(),
          designation: addModal.designation.trim() || 'Accounts Manager',
          isPrimary: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAddModal((prev) => ({
          ...prev,
          submitting: false,
          successMessage: `✓ Contact details registered for ${addModal.partyName}!`,
        }));
        fetchNotifications();
        window.dispatchEvent(new CustomEvent('notifications-updated'));

        setTimeout(() => {
          setAddModal((prev) => ({ ...prev, isOpen: false, successMessage: null }));
        }, 1200);
      } else {
        setAddModal((prev) => ({ ...prev, submitting: false, error: data.error || 'Failed to save contact' }));
      }
    } catch (err: any) {
      setAddModal((prev) => ({ ...prev, submitting: false, error: err?.message || 'Network error' }));
    }
  };

  const missingContactsCount = alerts?.missingContacts?.length || 0;
  const overdueCount = alerts?.overdue?.count || 0;
  // Badge must equal the "Missing Contact Details (N)" header inside the panel —
  // overdue/diff summaries are context rows, not counted alerts.
  const totalAlertsCount = missingContactsCount;

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={totalAlertsCount > 0 ? `${totalAlertsCount} active alert(s)` : 'Notifications'}
        aria-label="System notifications"
        className={`relative p-2 rounded-xl transition duration-150 focus:outline-none ${
          isOpen
            ? 'bg-[#e8f9fa] text-[#078d96]'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <Bell className="w-5 h-5" />

        {/* Unread Alert Badge */}
        {totalAlertsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold shadow-sm ring-2 ring-white animate-pulse">
            {totalAlertsCount}
          </span>
        )}
      </button>

      {/* Floating Notifications Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[370px] sm:w-[420px] rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#078d96] flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-slate-800">Notifications & Alerts</h4>
                <p className="text-[11px] text-slate-500">Live ledger changes and contact gaps</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                title="Refresh notifications"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 text-xs">
            {/* 1. Missing Contacts Critical Alerts */}
            {missingContactsCount > 0 ? (
              <div className="p-3.5 bg-rose-50/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Missing Contact Details ({missingContactsCount})</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    Action Required
                  </span>
                </div>

                <p className="text-[11px] text-rose-700 leading-snug">
                  Payment reminders cannot be dispatched to these customers until contact phone or email is registered.
                </p>

                <div className="space-y-2 pt-1">
                  {alerts?.missingContacts?.map((c) => (
                    <div
                      key={c.customerId}
                      className="p-2.5 rounded-xl bg-white border border-rose-200 shadow-2xs flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{c.partyName}</div>
                          {c.ledgerCode && (
                            <div className="text-[10px] font-mono text-slate-400">
                              Ledger Code: {c.ledgerCode}
                            </div>
                          )}
                        </div>
                        {c.outstandingAmount > 0 && (
                          <span className="text-[11px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 shrink-0">
                            ₹{c.outstandingAmount.toLocaleString('en-IN')} Due
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500 italic">No mobile or email on file</span>
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            handleOpenAddContact(c.customerId, c.partyName, c.ledgerCode);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#09AEB8] text-white text-[11px] font-bold hover:brightness-95 transition shadow-2xs"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>+ Add Contact</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50/50 flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold">All active customers have registered contact details.</span>
              </div>
            )}

            {/* 2. Overdue Receivables Alert */}
            {overdueCount > 0 && (
              <div className="p-3.5 hover:bg-slate-50/70 transition flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Overdue Invoices Alert</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      {overdueCount} bills
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ₹{(alerts?.overdue?.totalAmount || 0).toLocaleString('en-IN')} pending past credit terms.
                  </p>
                  <Link
                    href="/?filter=OVERDUE"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#078d96] hover:underline mt-1.5"
                  >
                    <span>View Overdue Bills</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* 3. Latest SAP Diff Summary */}
            {alerts?.latestDiff && (
              <div className="p-3.5 hover:bg-slate-50/70 transition flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#078d96] flex items-center justify-center font-bold shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">SAP Ledger Reconciliation</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(alerts.latestDiff.importedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5 font-mono">
                    {alerts.latestDiff.fileName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
                    {alerts.latestDiff.settledEntriesCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200">
                        ✓ {alerts.latestDiff.settledEntriesCount} Settled
                      </span>
                    )}
                    {alerts.latestDiff.newEntriesCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        +{alerts.latestDiff.newEntriesCount} New Bills
                      </span>
                    )}
                    {alerts.latestDiff.sameEntriesCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {alerts.latestDiff.sameEntriesCount} Unchanged
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/customers"
              onClick={() => setIsOpen(false)}
              className="text-slate-600 hover:text-slate-900 font-semibold text-[11px] flex items-center gap-1 hover:underline"
            >
              <span>Customer Contacts</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>

            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="font-bold text-[#078d96] text-[11px] flex items-center gap-1 hover:underline"
            >
              <span>Receivables Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* QUICK ADD CONTACT MODAL */}
      {addModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#078d96] bg-[#e8f9fa] px-2.5 py-0.5 rounded-full border border-[#b8ecef]">
                  Contact Registration
                </span>
                <h3 className="font-display font-bold text-base text-slate-900 mt-1">
                  Add Contact for {addModal.partyName}
                </h3>
                {addModal.ledgerCode && (
                  <p className="text-[11px] font-mono text-slate-400">
                    Ledger Code: {addModal.ledgerCode}
                  </p>
                )}
              </div>
              <button
                onClick={() => setAddModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addModal.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {addModal.error}
              </div>
            )}

            {addModal.successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{addModal.successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveContact} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  required
                  value={addModal.personName}
                  onChange={(e) => setAddModal((prev) => ({ ...prev, personName: e.target.value }))}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#09AEB8]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mobile Number / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addModal.mobileNumber}
                  onChange={(e) => setAddModal((prev) => ({ ...prev, mobileNumber: e.target.value }))}
                  placeholder="+91 8530383141"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#09AEB8]"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Pre-configured to safe test mobile (+91 8530383141).
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={addModal.emailId}
                  onChange={(e) => setAddModal((prev) => ({ ...prev, emailId: e.target.value }))}
                  placeholder="jayesh@zuigo.ai"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#09AEB8]"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Pre-configured to safe test email (jayesh@zuigo.ai).
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  value={addModal.designation}
                  onChange={(e) => setAddModal((prev) => ({ ...prev, designation: e.target.value }))}
                  placeholder="Accounts Manager"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#09AEB8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addModal.submitting}
                  className="px-4 py-2 rounded-lg bg-[#09AEB8] text-white font-bold hover:brightness-95 transition shadow-2xs disabled:opacity-50"
                >
                  {addModal.submitting ? 'Saving...' : 'Save Contact & Enable Reminders'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
