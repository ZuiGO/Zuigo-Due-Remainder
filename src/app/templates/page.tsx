'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Smartphone, Mail, Plus, Save, Sparkles, Check, Copy } from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [bodyText, setBodyText] = useState('');
  const [subjectText, setSubjectText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const variables = [
    { label: 'Customer Name', tag: '{{customer_name}}' },
    { label: 'Contact Person', tag: '{{contact_person}}' },
    { label: 'Due Amount', tag: '{{due_amount}}' },
    { label: 'Due Date', tag: '{{due_date}}' },
    { label: 'Days Overdue', tag: '{{days_overdue}}' },
    { label: 'Company Name', tag: '{{company_name}}' },
    { label: 'Bank Details', tag: '{{company_bank_details}}' },
    { label: 'Remaining Due', tag: '{{remaining_balance}}' },
    { label: 'Next Installment', tag: '{{next_installment_date}}' },
  ];

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        const first = data.templates.find((t: any) => t.channel === selectedChannel);
        if (first) {
          setSelectedTemplate(first);
          setBodyText(first.templateBody);
          setSubjectText(first.subject || '');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleChannelSwitch = (channel: 'WHATSAPP' | 'SMS' | 'EMAIL') => {
    setSelectedChannel(channel);
    const match = templates.find((t) => t.channel === channel);
    if (match) {
      setSelectedTemplate(match);
      setBodyText(match.templateBody);
      setSubjectText(match.subject || '');
    }
  };

  const handleSelectTemplate = (t: any) => {
    setSelectedTemplate(t);
    setBodyText(t.templateBody);
    setSubjectText(t.subject || '');
  };

  const insertVariable = (tag: string) => {
    setBodyText((prev) => prev + ' ' + tag);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    try {
      setSaving(true);
      const res = await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplate.id,
          name: selectedTemplate.name,
          subject: subjectText || undefined,
          templateBody: bodyText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('Template updated successfully!');
        fetchTemplates();
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch (e: any) {
      alert('Error: ' + e?.message);
    } finally {
      setSaving(false);
    }
  };

  // Live preview mockup data
  const renderPreview = (text: string) => {
    return text
      .replace(/\{\{\s*customer_name\s*\}\}/g, 'PARASON MACHINERY PVT LTD')
      .replace(/\{\{\s*contact_person\s*\}\}/g, 'Mr. Smit Satpute')
      .replace(/\{\{\s*due_amount\s*\}\}/g, '49,317')
      .replace(/\{\{\s*remaining_balance\s*\}\}/g, '49,317')
      .replace(/\{\{\s*due_date\s*\}\}/g, '15-Nov-2026')
      .replace(/\{\{\s*days_overdue\s*\}\}/g, '7')
      .replace(/\{\{\s*company_name\s*\}\}/g, 'Abhiyadna Machine Tools')
      .replace(/\{\{\s*company_bank_details\s*\}\}/g, 'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234')
      .replace(/\{\{\s*next_installment_date\s*\}\}/g, '30-Nov-2026');
  };

  const filteredTemplates = templates.filter((t) => t.channel === selectedChannel);

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-amber-500" />
            Message Template Designer
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Customize multi-channel messages for WhatsApp, SMS, and Email with dynamic variables.
          </p>
        </div>

        {/* Channel Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => handleChannelSwitch('WHATSAPP')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              selectedChannel === 'WHATSAPP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <button
            onClick={() => handleChannelSwitch('SMS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              selectedChannel === 'SMS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> SMS
          </button>
          <button
            onClick={() => handleChannelSwitch('EMAIL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              selectedChannel === 'EMAIL' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveMsg}</span>
        </div>
      )}

      {/* Editor & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Templates List */}
        <div className="lg:col-span-3 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {selectedChannel} Templates
          </h3>
          <div className="space-y-1.5">
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                  selectedTemplate?.id === t.id
                    ? 'border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{t.name}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center Column: Template Body Editor */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">
              Editing: {selectedTemplate?.name || 'Template'}
            </h3>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>

          {selectedChannel === 'EMAIL' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Subject Line</label>
              <input
                type="text"
                value={subjectText}
                onChange={(e) => setSubjectText(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          )}

          {/* Insertable Dynamic Tag Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Click to Insert Placeholder Variable:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-700 transition"
                >
                  +{v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Template Content</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={12}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          {selectedChannel === 'SMS' && (
            <div className="text-[11px] text-slate-400 text-right">
              Character Count: {bodyText.length} ({Math.ceil(bodyText.length / 160)} SMS segment)
            </div>
          )}
        </div>

        {/* Right Column: Live Mobile / Delivery Simulation Preview */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Real-time Live Preview
          </h3>

          <div className="bg-slate-100 p-4 rounded-3xl border border-slate-200 shadow-inner min-h-[460px] flex flex-col justify-start">
            {selectedChannel === 'WHATSAPP' && (
              <div className="bg-[#e5ddd5] p-3 rounded-2xl shadow-sm border border-slate-300 flex-1 flex flex-col justify-end space-y-2">
                <div className="text-[10px] text-center text-slate-500 uppercase font-semibold">Today</div>
                <div className="bg-white p-3.5 rounded-2xl rounded-tr-none shadow-sm text-xs leading-relaxed max-w-[95%] self-end border border-emerald-100">
                  <div className="whitespace-pre-line text-slate-800">
                    {renderPreview(bodyText)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1">
                    <span>10:30 AM</span>
                    <span className="text-sky-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            )}

            {selectedChannel === 'SMS' && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col justify-end">
                <div className="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none text-xs leading-relaxed max-w-[90%] self-end">
                  <div className="whitespace-pre-line">
                    {renderPreview(bodyText)}
                  </div>
                  <div className="text-[9px] text-indigo-200 text-right mt-1">Delivered • SMS</div>
                </div>
              </div>
            )}

            {selectedChannel === 'EMAIL' && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 text-xs space-y-3 overflow-y-auto">
                <div className="border-b border-slate-100 pb-2">
                  <div className="text-[10px] text-slate-400 uppercase">Subject:</div>
                  <div className="font-bold text-slate-900">{renderPreview(subjectText || 'Payment Reminder')}</div>
                </div>
                <div 
                  className="prose prose-sm text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderPreview(bodyText) }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
