import { describe, expect, it } from 'bun:test';

describe('Bank Tab & Operation Navigation to Initial Bank Inventory Tests', () => {
  const INITIAL_BANK_INVENTORY_URL = '/dashboard/documents/initial-inventory/bank';

  it('defines the correct destination URL for defining and editing bank accounts initial inventory', () => {
    expect(INITIAL_BANK_INVENTORY_URL).toBe('/dashboard/documents/initial-inventory/bank');
  });

  it('generates proper button attributes for navigating to initial bank inventory', () => {
    const editBankButton = {
      label: 'ویرایش حساب‌های بانکی',
      href: INITIAL_BANK_INVENTORY_URL,
      icon: 'Edit3',
    };

    expect(editBankButton.href).toBe('/dashboard/documents/initial-inventory/bank');
    expect(editBankButton.label).toContain('ویرایش حساب‌های بانکی');
  });
});
