'use client';

import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Send, 
  CreditCard, 
  Calendar, 
  ShieldAlert, 
  Split, 
  CheckCircle, 
  MessageSquare, 
  Mail, 
  Smartphone,
  Check,
  ChevronDown,
  Clock
} from 'lucide-react';

export default function DuesPage() {
  const [dues, setDues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState<'PAYMENT' | 'INSTALLMENT' | 'REMIND' | null>(null);
  const [selectedDue, setSelectedDue] = useState<any>(null);

  // Form states
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [nextInstallmentDate, setNextInstallmentDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);

  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentDays, setInstallmentDays] = useState(15);

  const [remindChannel, setRemindChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP');
  const [customRemindMessage, setCustomRemindMessage] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const url = `/api/dues?filter=${filter}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setDues(data.dues);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, [filter, search]);

  const handleOpenPayment = (due: any) => {
    setSelectedDue(due);
    setPaymentAmount(String(due.remainingBalance));
    setReferenceNo('');
    setNextInstallmentDate('');
    setActiveModal('PAYMENT');
  };

  const handleOpenInstallment = (due: any) => {
    setSelectedDue(due);
    setInstallmentCount(3);
    setInstallmentDays(15);
    setActiveModal('INSTALLMENT');
  };

  const handleOpenRemind = (due: any) => {
    setSelectedDue(due);
    setCustomRemindMessage('');
    setActiveModal('REMIND');
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDue || !paymentAmount) return;
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueId: selectedDue.id,
          amountPaid: Number(paymentAmount),
          paymentMode,
          referenceNumber: referenceNo,
          nextInstallmentDate: nextInstallmentDate || undefined,
          notes: paymentNotes,
          sendReceipt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        setActiveModal(null);
        fetchDues();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      alert('Error recording payment: ' + err?.message);
    }
  };

  const submitInstallmentSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDue) return;
    try {
      const res = await fetch('/api/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueId: selectedDue.id,
          numberOfInstallments: Number(installmentCount),
          intervalDays: Number(installmentDays),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        setActiveModal(null);
        fetchDues();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      alert('Error splitting installments: ' + err?.message);
    }
  };

  const submitManualReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDue) return;
    try {
      const res = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueIds: [selectedDue.id],
          channel: remindChannel,
          customMessage: customRemindMessage || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        setActiveModal(null);
        fetchDues();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      alert('Error dispatching reminder: ' + err?.message);
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            Dues & Installment Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track customer balances, configure milestone installments, record partial payments, and dispatch reminders.
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Filter Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold overflow-x-auto">
          {['ALL', 'UPCOMING', 'DUE_TODAY', 'OVERDUE', 'FLAGGED', 'SETTLED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                filter === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or ledger..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-6">Customer Name</th>
                <th className="py-3 px-6">Total Due</th>
                <th className="py-3 px-6">Paid / Remaining</th>
                <th className="py-3 px-6">Due Date & Status</th>
                <th className="py-3 px-6">Installments</th>
                <th className="py-3 px-6">Reminders</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading dues...</td>
                </tr>
              ) : dues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">No records found matching criteria.</td>
                </tr>
              ) : (
                dues.map((due: any) => {
                  const contact = due.customer.contacts?.[0];
                  return (
                    <tr key={due.id} className="hover:bg-slate-50/70 transition">
                      {/* Customer */}
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div>
                          <span>{due.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()}</span>
                          {due.customer.isFlagged && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              <ShieldAlert className="w-3 h-3" /> Flagged (5 Unanswered)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {contact?.personName} • {contact?.mobileNumber || contact?.emailId || 'No direct phone'}
                        </div>
                      </td>

                      {/* Total Balance */}
                      <td className="py-4 px-6 font-semibold text-slate-700">
                        ₹{due.originalBalance.toLocaleString('en-IN')}
                      </td>

                      {/* Paid & Remaining */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <div>₹{due.remainingBalance.toLocaleString('en-IN')}</div>
                        {due.totalPaid > 0 && (
                          <div className="text-[11px] font-medium text-emerald-600">
                            ₹{due.totalPaid.toLocaleString('en-IN')} paid
                          </div>
                        )}
                      </td>

                      {/* Due Date & Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          due.customer.isFlagged
                            ? 'bg-rose-100 text-rose-800'
                            : due.status === 'SETTLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : due.status === 'OVERDUE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {due.customer.isFlagged ? 'FLAGGED DEFAULTER' : due.status}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {new Date(due.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Installments */}
                      <td className="py-4 px-6 text-xs text-slate-600">
                        {due.installments && due.installments.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 font-medium">
                            <Split className="w-3 h-3 text-indigo-500" />
                            {due.installments.length} Part Installments
                          </span>
                        ) : (
                          <span className="text-slate-400">Lump Sum</span>
                        )}
                      </td>

                      {/* Reminders count */}
                      <td className="py-4 px-6">
                        <div className="text-xs font-bold text-slate-800">
                          {due.customer.consecutiveRemindersCount} / 5
                        </div>
                        <div className="text-[10px] text-slate-400">attempts</div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenPayment(due)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1"
                        >
                          <CreditCard className="w-3 h-3" /> Pay / Part
                        </button>

                        <button
                          onClick={() => handleOpenInstallment(due)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition inline-flex items-center gap-1"
                        >
                          <Split className="w-3 h-3" /> Split
                        </button>

                        <button
                          onClick={() => handleOpenRemind(due)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition inline-flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Remind
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: RECORD PAYMENT / PARTIAL INSTALLMENT */}
      {activeModal === 'PAYMENT' && selectedDue && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Record Payment / Installment</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-700">
              <div className="font-bold text-slate-900">{selectedDue.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()}</div>
              <div>Current Remaining Balance: <strong>₹{selectedDue.remainingBalance.toLocaleString('en-IN')}</strong></div>
            </div>

            <form onSubmit={submitPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (₹)*</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full text-sm font-semibold p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="NEFT_RTGS">NEFT / RTGS</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UTR / Ref No.</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. 1234567890"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Next Installment Due Date (Optional)</label>
                <input
                  type="date"
                  value={nextInstallmentDate}
                  onChange={(e) => setNextInstallmentDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">If customer is paying in parts, set when the remainder is due.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sendReceipt"
                  checked={sendReceipt}
                  onChange={(e) => setSendReceipt(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="sendReceipt" className="text-xs font-medium text-slate-700">
                  Send instant Payment Receipt / Acknowledgment to customer
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Save & Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SPLIT INTO MILESTONE INSTALLMENTS */}
      {activeModal === 'INSTALLMENT' && selectedDue && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <Split className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Split into Installments</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-500">
              Break ₹{selectedDue.remainingBalance.toLocaleString('en-IN')} into automated milestone installments.
            </p>

            <form onSubmit={submitInstallmentSplit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Number of Installments</label>
                <select
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value={2}>2 Installments (50% each)</option>
                  <option value={3}>3 Installments (33.3% each)</option>
                  <option value={4}>4 Installments (25% each)</option>
                  <option value={5}>5 Installments (20% each)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Interval Between Installments</label>
                <select
                  value={installmentDays}
                  onChange={(e) => setInstallmentDays(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value={7}>Every 7 Days (Weekly)</option>
                  <option value={15}>Every 15 Days (Bi-weekly)</option>
                  <option value={30}>Every 30 Days (Monthly)</option>
                </select>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                <div>Each installment will be approximately: <strong>₹{Math.round(selectedDue.remainingBalance / installmentCount).toLocaleString('en-IN')}</strong></div>
                <div className="mt-1 text-[11px] text-indigo-700">Reminders will automatically target each installment date!</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Apply Installment Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL REMINDER DISPATCH (WHATSAPP, TEXT, EMAIL WITH INSTANT OPEN) */}
      {activeModal === 'REMIND' && selectedDue && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <Send className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">Send Payment Reminder</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Target Account Summary */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Target Customer</span>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedDue.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Pending Due</span>
                <div className="font-bold text-emerald-600 text-sm">
                  ₹{selectedDue.remainingBalance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Channel Options */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                1. Select Channel (Whichever you click can open directly)
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {/* WhatsApp Option */}
                <button
                  type="button"
                  onClick={() => setRemindChannel('WHATSAPP')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    remindChannel === 'WHATSAPP'
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp
                    </span>
                    {remindChannel === 'WHATSAPP' && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 truncate">
                    +918530383141
                  </div>
                </button>

                {/* Text Message (SMS) Option */}
                <button
                  type="button"
                  onClick={() => setRemindChannel('SMS')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    remindChannel === 'SMS'
                      ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-indigo-800 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" /> Text (SMS)
                    </span>
                    {remindChannel === 'SMS' && <Check className="w-3.5 h-3.5 text-indigo-600 font-bold" />}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 truncate">
                    +918530383141
                  </div>
                </button>

                {/* Email Option */}
                <button
                  type="button"
                  onClick={() => setRemindChannel('EMAIL')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    remindChannel === 'EMAIL'
                      ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-sky-800 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-sky-600" /> Email
                    </span>
                    {remindChannel === 'EMAIL' && <Check className="w-3.5 h-3.5 text-sky-600 font-bold" />}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 truncate">
                    jayesh@zuigo.ai
                  </div>
                </button>
              </div>
            </div>

            {/* Configured Route Notice */}
            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 flex items-center justify-between">
              <div>
                <strong>Active Route:</strong>{' '}
                {remindChannel === 'EMAIL'
                  ? 'Email will open & dispatch to: jayesh@zuigo.ai'
                  : `Text & WhatsApp will open & dispatch to: +918530383141`}
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                Verified
              </span>
            </div>

            {/* Message Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  2. Message Text Preview (Editable)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const sampleText = `Dear Customer, this is a reminder from Abhiyadna Machine Tools that payment of Rs ${selectedDue.remainingBalance.toLocaleString('en-IN')} for ${selectedDue.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()} is pending. Due Date: ${new Date(selectedDue.dueDate).toLocaleDateString('en-IN')}. Please remit to HDFC Bank A/C: 50200012345678, IFSC: HDFC0001234. Thank you!`;
                    setCustomRemindMessage(sampleText);
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  Load Standard Template
                </button>
              </div>
              <textarea
                value={
                  customRemindMessage ||
                  `Dear Customer, this is a reminder from Abhiyadna Machine Tools that payment of Rs ${selectedDue.remainingBalance.toLocaleString('en-IN')} for ${selectedDue.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()} is pending. Due Date: ${new Date(selectedDue.dueDate).toLocaleDateString('en-IN')}. Please remit to HDFC Bank A/C: 50200012345678, IFSC: HDFC0001234. Thank you!`
                }
                onChange={(e) => setCustomRemindMessage(e.target.value)}
                rows={5}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Action Buttons: Open Directly & Record in DB */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const txt = customRemindMessage || `Payment reminder for Rs ${selectedDue.remainingBalance}`;
                  navigator.clipboard.writeText(txt);
                  alert('Message copied to clipboard!');
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Copy Text
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={async (e) => {
                    const txt =
                      customRemindMessage ||
                      `Dear Customer, payment of Rs ${selectedDue.remainingBalance} for ${selectedDue.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()} is pending. Due Date: ${new Date(selectedDue.dueDate).toLocaleDateString('en-IN')}. Please remit to Abhiyadna Machine Tools.`;

                    // 1. Open the selected app directly
                    if (remindChannel === 'WHATSAPP') {
                      window.open(`https://wa.me/918530383141?text=${encodeURIComponent(txt)}`, '_blank');
                    } else if (remindChannel === 'SMS') {
                      window.location.href = `sms:+918530383141?body=${encodeURIComponent(txt)}`;
                    } else if (remindChannel === 'EMAIL') {
                      window.location.href = `mailto:jayesh@zuigo.ai?subject=${encodeURIComponent('Payment Due Reminder - Abhiyadna Machine Tools')}&body=${encodeURIComponent(txt)}`;
                    }

                    // 2. Submit to backend API to log in PostgreSQL
                    await submitManualReminder(e);
                  }}
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center gap-2 ${
                    remindChannel === 'WHATSAPP'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : remindChannel === 'SMS'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {remindChannel === 'WHATSAPP' && 'Open in WhatsApp (+918530383141) & Log'}
                  {remindChannel === 'SMS' && 'Open Text SMS (+918530383141) & Log'}
                  {remindChannel === 'EMAIL' && 'Open Mail (jayesh@zuigo.ai) & Log'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
