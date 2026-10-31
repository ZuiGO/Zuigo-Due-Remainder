'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, ShieldAlert, Phone, Mail, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleToggleFlag = async (customerId: string, currentFlag: boolean) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          isFlagged: !currentFlag,
          flagReason: !currentFlag ? 'Manually flagged by credit manager' : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Customer ${!currentFlag ? 'flagged as Defaulter' : 'unflagged and restored to Good Standing'}`);
        fetchCustomers();
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e: any) {
      alert('Error updating customer status: ' + e?.message);
    }
  };

  const filtered = customers.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.rawLedgerName.toLowerCase().includes(term) ||
      c.contacts?.some((ct: any) =>
        (ct.personName && ct.personName.toLowerCase().includes(term)) ||
        (ct.mobileNumber && ct.mobileNumber.includes(term)) ||
        (ct.emailId && ct.emailId.toLowerCase().includes(term))
      )
    );
  });

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-600" />
            Customer Directory & Defaulter Audit
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Master directory of customers, contact persons, phones, emails, and reminder attempts.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, person, or phone..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-sky-700 font-bold">✕</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-6">Company / Ledger</th>
                <th className="py-3 px-6">Contact Directory</th>
                <th className="py-3 px-6">Credit Days</th>
                <th className="py-3 px-6">Reminders Sent</th>
                <th className="py-3 px-6">Standing</th>
                <th className="py-3 px-6 text-right">Defaulter Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">No customers found.</td>
                </tr>
              ) : (
                filtered.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div>{c.rawLedgerName.replace(/\[.*?\]/g, '').trim()}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">{c.rawLedgerName}</div>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-700">
                        {c.contacts && c.contacts.length > 0 ? (
                          <div className="space-y-1">
                            {c.contacts.map((ct: any) => (
                              <div key={ct.id} className="text-slate-600">
                                <span className="font-semibold text-slate-800">{ct.personName}:</span>{' '}
                                {ct.mobileNumber && <span>{ct.mobileNumber}</span>}{' '}
                                {ct.emailId && <span className="text-slate-400">({ct.emailId})</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No contacts added</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-xs font-semibold text-slate-700">
                        {c.defaultCreditDays} Days
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-xs font-bold text-slate-800">
                          {c.consecutiveRemindersCount} / 5
                        </div>
                        {c.consecutiveRemindersCount >= 5 && (
                          <div className="text-[10px] text-rose-600 font-semibold">Exceeded max attempts</div>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {c.isFlagged ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                            <ShieldAlert className="w-3.5 h-3.5" /> Flagged Defaulter
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Good Standing
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleToggleFlag(c.id, c.isFlagged)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            c.isFlagged
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          }`}
                        >
                          {c.isFlagged ? 'Restore / Unflag' : 'Flag Defaulter'}
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
    </main>
  );
}
