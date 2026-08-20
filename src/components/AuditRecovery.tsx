'use client';

import { useEffect, useState } from 'react';

type Item = { id: string; name?: string; documentNumber?: string; description?: string; deleted_at?: string };

export default function AuditRecovery() {
  const [contacts, setContacts] = useState<Item[]>([]);
  const [documents, setDocuments] = useState<Item[]>([]);
  const [tab, setTab] = useState<'contacts' | 'documents'>('contacts');
  async function load() {
    const response = await fetch('/api/audit-logs', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setContacts(data.contacts ?? []);
    setDocuments(data.documents ?? []);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function restore(type: 'contact' | 'document', id: string) {
    await fetch('/api/audit-logs', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, id }) });
    await load();
  }
  const rows = tab === 'contacts' ? contacts : documents;
  return (
    <div className="customer-management-page">
      <div className="dashboard-page-heading"><div><p className="eyebrow">کنترل دسترسی</p><h1>بازیابی اطلاعات حذف‌شده</h1><p>حذف‌ها در این سامانه نرم هستند و قابل بازیابی‌اند.</p></div></div>
      <div className="flex gap-2 mb-4">
        <button type="button" className="dashboard-secondary-button" onClick={() => setTab('contacts')}>طرف‌حساب‌های حذف‌شده ({contacts.length})</button>
        <button type="button" className="dashboard-secondary-button" onClick={() => setTab('documents')}>اسناد حذف‌شده ({documents.length})</button>
      </div>
      <section className="dashboard-panel users-table-panel"><div className="users-table-wrap"><table className="users-table"><tbody>
        {rows.length ? rows.map((item) => <tr key={item.id}><td>{tab === 'contacts' ? item.name : item.documentNumber}</td><td>{item.description ?? ''}</td><td><button type="button" className="user-events-button" onClick={() => void restore(tab === 'contacts' ? 'contact' : 'document', item.id)}>بازیابی</button></td></tr>) : <tr><td className="users-table-empty">موردی وجود ندارد.</td></tr>}
      </tbody></table></div></section>
    </div>
  );
}
