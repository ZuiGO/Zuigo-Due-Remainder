'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Phone, 
  Sparkles, 
  Upload, 
  FileSpreadsheet, 
  FileUp, 
  RefreshCw, 
  Clock, 
  Filter, 
  CalendarClock, 
  Layers 
} from 'lucide-react';

export default function DuesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState<'PAYMENT' | 'INSTALLMENT' | 'REMIND' | 'UPLOAD' | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Payment form states
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);

  // Promise-to-Pay states
  const [enablePromiseToPay, setEnablePromiseToPay] = useState(false);
  const [promisedAmount, setPromisedAmount] = useState('');
  const [promisedDate, setPromisedDate] = useState('');

  // Installment form states
  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentDays, setInstallmentDays] = useState(15);

  // Remind form states
  const [remindChannel, setRemindChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP');
  const [customRemindMessage, setCustomRemindMessage] = useState('');
  const [generatingGroq, setGeneratingGroq] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const url = `/api/dues?filter=${filter}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || data.dues || []);
      }
    } catch (e) {
      console.error('Fetch dues error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, [filter, search]);

  const handleOpenPayment = (inv: any) => {
    setSelectedInvoice(inv);
    setPaymentAmount(String(inv.outstandingAmount));
    setReferenceNo('');
    setPaymentNotes('');

    // Default promised date = next week
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setPromisedDate(defaultDate.toISOString().split('T')[0]);
    setPromisedAmount('');
    setEnablePromiseToPay(false);

    setActiveModal('PAYMENT');
  };

  const handleOpenInstallment = (inv: any) => {
    setSelectedInvoice(inv);
    setInstallmentCount(3);
    setInstallmentDays(15);
    setActiveModal('INSTALLMENT');
  };

  const handleOpenRemind = (inv: any) => {
    setSelectedInvoice(inv);
    setCustomRemindMessage('');
    setActiveModal('REMIND');
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || paymentAmount === '') return;
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          amountPaid: Number(paymentAmount),
          promisedAmount: enablePromiseToPay && promisedAmount ? Number(promisedAmount) : undefined,
          promisedDate: enablePromiseToPay && promisedDate ? promisedDate : undefined,
          paymentMode,
          referenceNumber: referenceNo,
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
      } else {
        alert(data.error || 'Payment error');
      }
    } catch (err: any) {
      alert('Error recording payment: ' + err?.message);
    }
  };

  const submitInstallmentSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      const res = await fetch('/api/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
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

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/invoices/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        fetchDues();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      alert('Error updating status: ' + err?.message);
    }
  };

  const handleGenerateWithGroq = async () => {
    if (!selectedInvoice) return;
    try {
      setGeneratingGroq(true);
      const contact = selectedInvoice.customer.contacts?.[0];
      const res = await fetch('/api/groq/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: (selectedInvoice.customer.partyName || selectedInvoice.customer.rawLedgerName).trim(),
          contactPerson: contact?.personName || 'Sir / Madam',
          billNo: selectedInvoice.billNo,
          outstandingAmount: selectedInvoice.outstandingAmount,
          dueDate: new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN'),
          daysOverdue: selectedInvoice.daysOverdue || 0,
          agingBucket: selectedInvoice.agingBucket,
          priority: selectedInvoice.priority,
          channel: remindChannel,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setCustomRemindMessage(data.message);
      }
    } catch (err: any) {
      alert('Groq AI error: ' + err?.message);
    } finally {
      setGeneratingGroq(false);
    }
  };

  const submitManualReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      const res = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: [selectedInvoice.id],
          channel: remindChannel,
          customMessage: customRemindMessage || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        if (data.results?.[0]?.actionUrl) {
          window.open(data.results[0].actionUrl, '_blank');
        }
        setActiveModal(null);
        fetchDues();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      alert('Error dispatching reminder: ' + err?.message);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    try {
      setUploading(true);
      setUploadMsg(null);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadMsg(data.message || 'Import successful!');
        setTimeout(() => {
          setActiveModal(null);
          setSelectedFile(null);
          setUploadMsg(null);
          fetchDues();
        }, 1800);
      } else {
        setUploadMsg(data.error || 'Upload error');
      }
    } catch (err: any) {
      setUploadMsg('Error: ' + err?.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            Invoices & Dues Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Separated Bill Amount, Paid / Adjusted, and Outstanding Dues. Track multiple invoices, contacts, and Promise-to-Pay commitments.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedFile(null);
            setUploadMsg(null);
            setActiveModal('UPLOAD');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-sm transition"
        >
          <Upload className="w-4 h-4 text-indigo-600" />
          Import SAP Dues / Contacts
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Filter Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party, bill no, or contact..."
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
                <th className="py-3 px-6">Customer & Contacts</th>
                <th className="py-3 px-6">Bill No & Date</th>
                <th className="py-3 px-6">Bill Amount (₹)</th>
                <th className="py-3 px-6">Paid / Adjusted (₹)</th>
                <th className="py-3 px-6 text-rose-600">Outstanding Due (₹)</th>
                <th className="py-3 px-6">Due Date & Commitment</th>
                <th className="py-3 px-6">Payment Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading invoices...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-sm font-bold text-slate-700">No Invoices Found</p>
                      <p className="text-xs text-slate-500">
                        {filter === 'ALL' && !search 
                          ? 'Upload your SAP Outstanding Receivable export or Contact sheet to populate real customer bills.'
                          : 'No records match the selected filter criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => {
                  const contacts = inv.customer?.contacts || [];
                  const primaryContact = contacts.find((c: any) => c.isPrimary) || contacts[0];
                  const commitment = inv.commitments && inv.commitments.length > 0 ? inv.commitments[0] : null;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      {/* Customer & Contacts */}
                      <td className="py-4 px-6 font-medium text-slate-900 max-w-xs">
                        <div>
                          <span className="font-bold">{inv.customer.partyName || inv.customer.rawLedgerName}</span>
                          {inv.customer.isFlagged && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              <ShieldAlert className="w-3 h-3" /> Flagged (≥5 Notices)
                            </span>
                          )}
                        </div>
                        {contacts.length > 0 ? (
                          <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                            <div>
                              <span className="font-semibold text-slate-700">{primaryContact?.personName || 'Contact'}:</span>{' '}
                              {primaryContact?.mobileNumber || primaryContact?.whatsappNumber || 'No phone'}
                            </div>
                            {primaryContact?.emailId && (
                              <div className="text-slate-400 truncate">{primaryContact.emailId}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 mt-0.5">No contacts on file</div>
                        )}
                      </td>

                      {/* Bill No & Date */}
                      <td className="py-4 px-6 text-slate-700">
                        <div className="font-mono text-xs font-bold text-indigo-700">{inv.billNo}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(inv.billDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Bill Amount */}
                      <td className="py-4 px-6 font-semibold text-slate-700">
                        ₹{inv.billAmount.toLocaleString('en-IN')}
                      </td>

                      {/* Paid / Adjusted */}
                      <td className="py-4 px-6 font-semibold text-emerald-700">
                        {inv.adjustment > 0 ? `₹${inv.adjustment.toLocaleString('en-IN')}` : '₹0'}
                      </td>

                      {/* Outstanding Due (Distinct & Highlighted) */}
                      <td className="py-4 px-6 font-black text-slate-900">
                        <div className={`text-sm ${inv.outstandingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          ₹{inv.outstandingAmount.toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* Due Date & Commitment */}
                      <td className="py-4 px-6">
                        <div className="text-xs font-semibold text-slate-800">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] mt-0.5 font-medium">
                          {inv.daysOverdue > 0 ? (
                            <span className="text-rose-600 font-bold">{inv.daysOverdue} days overdue</span>
                          ) : inv.daysOverdue === 0 ? (
                            <span className="text-amber-600 font-bold">Due today</span>
                          ) : (
                            <span className="text-slate-400">Due in {Math.abs(inv.daysOverdue)} days</span>
                          )}
                        </div>

                        {/* Promise to Pay Badge */}
                        {commitment && (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <CalendarClock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>
                              Promised ₹{commitment.promisedAmount.toLocaleString('en-IN')} on{' '}
                              {new Date(commitment.promisedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Payment Status Dropdown */}
                      <td className="py-4 px-6">
                        <select
                          value={inv.status}
                          onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none transition ${
                            inv.status === 'Payment Received' || inv.status === 'Closed'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : inv.status === 'Partially Paid'
                              ? 'bg-amber-50 border-amber-300 text-amber-800'
                              : inv.status === 'Promise to Pay'
                              ? 'bg-sky-50 border-sky-300 text-sky-800'
                              : inv.status === 'Disputed' || inv.status === 'Escalated'
                              ? 'bg-purple-50 border-purple-300 text-purple-800'
                              : 'bg-rose-50 border-rose-300 text-rose-800'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Payment Received">Payment Received</option>
                          <option value="Partially Paid">Partially Paid</option>
                          <option value="Promise to Pay">Promise to Pay</option>
                          <option value="Disputed">Disputed</option>
                          <option value="Escalated">Escalated</option>
                          <option value="Legal Notice">Legal Notice</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        {inv.status !== 'Payment Received' && inv.status !== 'Closed' && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'Payment Received')}
                            title="Quick 1-Click Mark as Paid"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition inline-flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenPayment(inv)}
                          title="Record payment or Promise to Pay commitment"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1"
                        >
                          <CreditCard className="w-3 h-3" /> Record Pay
                        </button>

                        <button
                          onClick={() => handleOpenInstallment(inv)}
                          title="Split remaining amount into milestone installments"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition inline-flex items-center gap-1"
                        >
                          <Split className="w-3 h-3" /> Split
                        </button>

                        <button
                          onClick={() => handleOpenRemind(inv)}
                          title="Send reminder via WhatsApp, SMS, or Email"
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

      {/* MODAL 1: RECORD PAYMENT & PROMISE-TO-PAY COMMITMENT */}
      {activeModal === 'PAYMENT' && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Record Payment & Commitment</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900">{selectedInvoice.customer.partyName || selectedInvoice.customer.rawLedgerName}</div>
              <div>Bill No: <span className="font-mono font-bold text-indigo-600">{selectedInvoice.billNo}</span></div>
              <div>Current Outstanding: <strong className="text-rose-600">₹{selectedInvoice.outstandingAmount.toLocaleString('en-IN')}</strong></div>
            </div>

            <form onSubmit={submitPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid Today (₹)*</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPaymentAmount(val);
                    const diff = selectedInvoice.outstandingAmount - Number(val);
                    if (diff > 0) {
                      setPromisedAmount(String(diff));
                      setEnablePromiseToPay(true);
                    } else {
                      setEnablePromiseToPay(false);
                    }
                  }}
                  className="w-full text-sm font-semibold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Promise-to-Pay Commitment Section */}
              {Number(paymentAmount) < selectedInvoice.outstandingAmount && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <CalendarClock className="w-4 h-4 text-amber-600" />
                      Promise-to-Pay (PTP) Commitment
                    </label>
                    <input
                      type="checkbox"
                      id="enablePTP"
                      checked={enablePromiseToPay}
                      onChange={(e) => setEnablePromiseToPay(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                  </div>

                  {enablePromiseToPay && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-800 mb-1">Promised Future Balance (₹)</label>
                        <input
                          type="number"
                          step="any"
                          value={promisedAmount}
                          onChange={(e) => setPromisedAmount(e.target.value)}
                          className="w-full text-xs font-bold p-2 rounded-lg border border-amber-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-800 mb-1">Promised Payment Date</label>
                        <input
                          type="date"
                          value={promisedDate}
                          onChange={(e) => setPromisedDate(e.target.value)}
                          className="w-full text-xs font-bold p-2 rounded-lg border border-amber-300 bg-white"
                        />
                      </div>
                      <p className="text-[10px] text-amber-700 col-span-2">
                        💡 Setting a commitment date automatically pauses reminder alerts until that date arrives.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UTR / Cheque No</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="UTR / Ref Number"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Narration</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Paid ₹5,000 via UPI; promised balance next Monday"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md transition"
                >
                  Confirm Payment & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SPLIT INTO INSTALLMENTS */}
      {activeModal === 'INSTALLMENT' && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <Split className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Split into Installments</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 text-xs text-slate-700 space-y-1">
              <div>Party: <strong>{selectedInvoice.customer.partyName || selectedInvoice.customer.rawLedgerName}</strong></div>
              <div>Bill No: <span className="font-mono font-bold text-indigo-600">{selectedInvoice.billNo}</span></div>
              <div>Outstanding to Split: <strong className="text-indigo-600">₹{selectedInvoice.outstandingAmount.toLocaleString('en-IN')}</strong></div>
            </div>

            <form onSubmit={submitInstallmentSplit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Number of Installments</label>
                  <select
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value={2}>2 Installments</option>
                    <option value={3}>3 Installments</option>
                    <option value={4}>4 Installments</option>
                    <option value={5}>5 Installments</option>
                    <option value={6}>6 Installments</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Interval Days</label>
                  <select
                    value={installmentDays}
                    onChange={(e) => setInstallmentDays(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value={7}>Every 7 Days (Weekly)</option>
                    <option value={10}>Every 10 Days</option>
                    <option value={15}>Every 15 Days (Bi-weekly)</option>
                    <option value={30}>Every 30 Days (Monthly)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900">
                Each installment will be approximately <strong>₹{(selectedInvoice.outstandingAmount / installmentCount).toFixed(0)}</strong> spaced every {installmentDays} days.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition"
                >
                  Confirm Installment Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL REMINDER WITH GROQ AI */}
      {activeModal === 'REMIND' && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <Send className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Dispatch Reminder</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 text-xs text-slate-700 space-y-1">
              <div>Party: <strong>{selectedInvoice.customer.partyName || selectedInvoice.customer.rawLedgerName}</strong></div>
              <div>Bill No: <span className="font-mono font-bold text-indigo-600">{selectedInvoice.billNo}</span></div>
              <div>Outstanding Amount: <strong className="text-rose-600">₹{selectedInvoice.outstandingAmount.toLocaleString('en-IN')}</strong></div>
              <div>Due Date: {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')} ({selectedInvoice.daysOverdue} days overdue)</div>
            </div>

            <form onSubmit={submitManualReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Channel Selection
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRemindChannel('WHATSAPP')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      remindChannel === 'WHATSAPP'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemindChannel('SMS')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      remindChannel === 'SMS'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" /> SMS Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemindChannel('EMAIL')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      remindChannel === 'EMAIL'
                        ? 'bg-sky-50 border-sky-500 text-sky-800 ring-2 ring-sky-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Message Copy
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateWithGroq}
                    disabled={generatingGroq}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${generatingGroq ? 'animate-spin' : ''}`} />
                    {generatingGroq ? 'Drafting...' : '✨ Generate with Groq AI'}
                  </button>
                </div>
                <textarea
                  value={customRemindMessage}
                  onChange={(e) => setCustomRemindMessage(e.target.value)}
                  placeholder="Click 'Generate with Groq AI' or type custom copy..."
                  rows={4}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                {remindChannel === 'EMAIL'
                  ? 'Target: Direct link opening mailto: to jayesh@zuigo.ai'
                  : 'Target: Direct link opening WhatsApp/SMS to +918530383141'}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center gap-2 ${
                    remindChannel === 'WHATSAPP'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : remindChannel === 'SMS'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {remindChannel === 'WHATSAPP' && 'Open WhatsApp (+918530383141)'}
                  {remindChannel === 'SMS' && 'Open SMS (+918530383141)'}
                  {remindChannel === 'EMAIL' && 'Open Email (jayesh@zuigo.ai)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: UPLOAD SAP DUES / CONTACTS */}
      {activeModal === 'UPLOAD' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileSpreadsheet className="w-6 h-6" />
                <h3 className="font-bold text-base text-slate-900">Import SAP Dues / Contacts</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload your daily SAP Outstanding Receivable export (ALV HTML, .xls, .xlsx, .csv) or Customer Contact sheet. Structure is automatically detected by headers.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-50/50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .html"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <FileUp className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                {selectedFile ? (
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-700">Click to choose file or drag & drop</p>
                    <p className="text-[11px] text-slate-400 mt-1">Supports SAP ALV (.xls), Excel (.xlsx), and CSV files</p>
                  </div>
                )}
              </div>

              {uploadMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium ${
                  uploadMsg.includes('successful') || uploadMsg.includes('processed')
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {uploadMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-md transition flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Diffing & Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ingest & Reconcile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
