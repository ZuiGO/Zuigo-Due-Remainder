'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, ShieldAlert, Check, RefreshCw, Smartphone, Mail, MessageSquare } from 'lucide-react';

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [schedule, setSchedule] = useState({
    reminder1DaysBefore: 3,
    reminder2DaysAfter: 0,
    reminder3DaysAfter: 3,
    reminder4DaysAfter: 7,
    reminder5DaysAfter: 15,
    maxRemindersBeforeFlag: 5,
    channels: 'WHATSAPP,SMS,EMAIL',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        if (data.integrations) setIntegrations(data.integrations);
        if (data.schedule) {
          setSchedule({
            reminder1DaysBefore: data.schedule.reminder1DaysBefore,
            reminder2DaysAfter: data.schedule.reminder2DaysAfter,
            reminder3DaysAfter: data.schedule.reminder3DaysAfter,
            reminder4DaysAfter: data.schedule.reminder4DaysAfter,
            reminder5DaysAfter: data.schedule.reminder5DaysAfter,
            maxRemindersBeforeFlag: data.schedule.maxRemindersBeforeFlag,
            channels: data.schedule.channels,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrations,
          schedule,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('Settings and automated cadences saved successfully!');
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch (e: any) {
      alert('Error: ' + e?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-700" />
            Platform & Integration Settings
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure automated cadence rules, defaulter thresholds, and API credentials for WhatsApp, SMS, and Email.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      {saveMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* SECTION 1: AUTOMATED REMINDER CADENCE & DEFAULTER RULES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Automated Cadence & Defaulter Trigger Rules</h3>
              <p className="text-[11px] text-slate-500">Relative to Invoice Due Date (T)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 1 (Gentle)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder1DaysBefore}
                  onChange={(e) => setSchedule({ ...schedule, reminder1DaysBefore: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days before</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 2 (Prompt)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder2DaysAfter}
                  disabled
                  className="w-16 p-1.5 rounded border border-slate-200 bg-slate-100 font-bold text-center text-slate-500"
                />
                <span className="text-[11px] text-slate-500">on due date</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 3 (Overdue)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder3DaysAfter}
                  onChange={(e) => setSchedule({ ...schedule, reminder3DaysAfter: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days overdue</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 4 (Urgent)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder4DaysAfter}
                  onChange={(e) => setSchedule({ ...schedule, reminder4DaysAfter: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days overdue</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 5 (Final)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder5DaysAfter}
                  onChange={(e) => setSchedule({ ...schedule, reminder5DaysAfter: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days overdue</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl text-xs space-y-2">
            <div className="font-bold text-rose-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Automated Defaulter Blacklist Threshold
            </div>
            <div className="flex items-center gap-3">
              <span className="text-rose-800">Flag customer as Defaulter after</span>
              <select
                value={schedule.maxRemindersBeforeFlag}
                onChange={(e) => setSchedule({ ...schedule, maxRemindersBeforeFlag: Number(e.target.value) })}
                className="p-1.5 rounded-lg border border-rose-300 font-bold text-rose-900 bg-white"
              >
                <option value={4}>4 consecutive unanswered reminders</option>
                <option value={5}>5 consecutive unanswered reminders (Recommended)</option>
              </select>
            </div>
            <p className="text-[11px] text-rose-700">
              When a customer hits this threshold without paying, automated reminders immediately stop to protect client relations, and the account is highlighted in the Defaulter Watchlist for senior escalation.
            </p>
          </div>
        </div>

        {/* SECTION 2: INTEGRATION CREDENTIALS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">Communication Gateway Credentials</h3>
            <p className="text-[11px] text-slate-500">
              Each channel includes a built-in Sandbox Simulator mode for testing without external API costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* WhatsApp */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp API
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                  Active
                </span>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Provider</label>
                  <select className="w-full text-xs p-2 rounded border border-slate-300 bg-white">
                    <option value="SIMULATOR">Built-in Sandbox Simulator</option>
                    <option value="META_CLOUD_API">Meta WhatsApp Cloud API</option>
                    <option value="TWILIO">Twilio WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Phone Number ID</label>
                  <input type="text" placeholder="e.g. 1029384756..." className="w-full text-xs p-2 rounded border border-slate-300" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Access Token</label>
                  <input type="password" placeholder="••••••••••••••••" className="w-full text-xs p-2 rounded border border-slate-300" />
                </div>
              </div>
            </div>

            {/* SMS */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Smartphone className="w-4 h-4 text-indigo-600" /> SMS Gateway
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-100 text-indigo-800">
                  Active
                </span>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Provider</label>
                  <select className="w-full text-xs p-2 rounded border border-slate-300 bg-white">
                    <option value="SIMULATOR">Built-in Sandbox Simulator</option>
                    <option value="TWILIO">Twilio SMS</option>
                    <option value="MSG91">MSG91 (India DLT)</option>
                    <option value="FAST2SMS">Fast2SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Sender ID / DLT Header</label>
                  <input type="text" placeholder="e.g. ABMATO" className="w-full text-xs p-2 rounded border border-slate-300" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">API Key</label>
                  <input type="password" placeholder="••••••••••••••••" className="w-full text-xs p-2 rounded border border-slate-300" />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Mail className="w-4 h-4 text-sky-600" /> Email SMTP
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-sky-100 text-sky-800">
                  Active
                </span>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Provider</label>
                  <select className="w-full text-xs p-2 rounded border border-slate-300 bg-white">
                    <option value="SIMULATOR">Built-in Sandbox Simulator</option>
                    <option value="SMTP">Custom SMTP (Gmail/cPanel)</option>
                    <option value="RESEND">Resend API</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">SMTP Host / Port</label>
                  <input type="text" placeholder="smtp.gmail.com : 587" className="w-full text-xs p-2 rounded border border-slate-300" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Sender Email</label>
                  <input type="text" placeholder="accounts@abmato.com" className="w-full text-xs p-2 rounded border border-slate-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
