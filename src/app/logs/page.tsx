'use client';

import React, { useState, useEffect } from 'react';
import { History, MessageSquare, Smartphone, Mail, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-purple-600" />
            Reminder Audit & Delivery Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete audit trail of all automated and manually dispatched payment reminders.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-6">Timestamp</th>
                <th className="py-3 px-6">Customer</th>
                <th className="py-3 px-6">Channel & Target</th>
                <th className="py-3 px-6">Type</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Content Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Loading delivery logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">No reminder logs found yet.</td>
                </tr>
              ) : (
                logs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-6 text-xs text-slate-500 font-mono">
                        {new Date(log.dispatchedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-6 font-semibold text-xs text-slate-900">
                        {log.customer?.rawLedgerName.replace(/\[.*?\]/g, '').trim()}
                      </td>

                      <td className="py-3 px-6">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          {log.channel === 'WHATSAPP' && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                          {log.channel === 'SMS' && <Smartphone className="w-3.5 h-3.5 text-indigo-600" />}
                          {log.channel === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-sky-600" />}
                          <span className="text-slate-800">{log.channel}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{log.recipient}</div>
                      </td>

                      <td className="py-3 px-6">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.triggerType === 'AUTOMATIC' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.triggerType}
                        </span>
                      </td>

                      <td className="py-3 px-6">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {log.status}
                        </span>
                      </td>

                      <td className="py-3 px-6 text-xs text-slate-600 max-w-xs truncate font-mono">
                        {log.messageContent}
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
