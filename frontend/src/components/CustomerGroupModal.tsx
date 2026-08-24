import React, { useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import type { CustomerGroup } from '@/lib/customer-groups';

export default function CustomerGroupModal({
  isOpen,
  onClose,
  onSave,
  groupToEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: CustomerGroup) => void;
  groupToEdit?: CustomerGroup | null;
}) {
  const [name, setName] = useState(groupToEdit?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('نام گروه نمی‌تواند خالی باشد.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const url = groupToEdit ? `/api/customer-groups/${groupToEdit.id}` : '/api/customer-groups';
      const method = groupToEdit ? 'PATCH' : 'POST';

      const payload = groupToEdit ? { name } : { identifier: `custom_${Date.now()}`, name };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'خطا در ذخیره گروه');

      onSave(data.group);
      onClose();
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        <h2>{groupToEdit ? 'ویرایش گروه' : 'گروه جدید'}</h2>

        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="account-field">
            <span>نام گروه</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <div className="confirm-actions mt-4">
            <button type="submit" className="document-primary-button" disabled={loading}>
              {loading ? <LoaderCircle size={15} className="spin" /> : null}
              ذخیره
            </button>
            <button type="button" className="document-secondary-button" onClick={onClose}>
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
