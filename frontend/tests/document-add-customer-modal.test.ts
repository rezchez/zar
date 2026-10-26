import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Document Registration - Add Customer Quick Modal', () => {
  const customerSectionPath = path.resolve(
    __dirname,
    '../features/accounting/documents/components/CustomerSection.tsx',
  );
  const addCustomerModalPath = path.resolve(
    __dirname,
    '../features/accounting/documents/components/AddCustomerModal.tsx',
  );

  it('1. CustomerSection includes UserPlus icon and Add Customer button placed before EyeStar button', () => {
    const customerSectionSrc = fs.readFileSync(customerSectionPath, 'utf8');

    expect(customerSectionSrc).toContain('UserPlus');
    expect(customerSectionSrc).toContain('AddCustomerModal');
    expect(customerSectionSrc).toContain('isAddCustomerModalOpen');
    expect(customerSectionSrc).toContain('setIsAddCustomerModalOpen(true)');
    expect(customerSectionSrc).toContain('title="افزودن طرف‌حساب جدید"');
    expect(customerSectionSrc).toContain('aria-label="افزودن طرف‌حساب جدید"');

    // Verify UserPlus is rendered before EyeStar in the search input action bar
    const userPlusIndex = customerSectionSrc.indexOf('title="افزودن طرف‌حساب جدید"');
    const eyeStarIndex = customerSectionSrc.indexOf('<EyeStar');
    expect(userPlusIndex).toBeGreaterThan(0);
    expect(eyeStarIndex).toBeGreaterThan(0);
    expect(userPlusIndex).toBeLessThan(eyeStarIndex);
  });

  it('2. AddCustomerModal component implements dialog structure inspired by CustomerForm', () => {
    const modalSrc = fs.readFileSync(addCustomerModalPath, 'utf8');

    // Dialog & Accessibility
    expect(modalSrc).toContain('role="dialog"');
    expect(modalSrc).toContain('aria-modal="true"');
    expect(modalSrc).toContain('add-customer-modal-title');
    expect(modalSrc).toContain('تعریف و افزودن طرف‌حساب جدید');

    // Main Customer Information
    expect(modalSrc).toContain('نام / عنوان طرف‌حساب');
    expect(modalSrc).toContain('شماره تماس همراه');
    expect(modalSrc).toContain('کد حساب');
    expect(modalSrc).toContain('کد خودکار');
    expect(modalSrc).toContain('گروه طرف‌حساب');
    expect(modalSrc).toContain('جنس فلز اصلی');
    expect(modalSrc).toContain('نوع ارز اول');

    // Collapsible Sections inspired by CustomerForm
    expect(modalSrc).toContain('اطلاعات تکمیلی');
    expect(modalSrc).toContain('کد ملی / شناسه اقتصادی');
    expect(modalSrc).toContain('استان');
    expect(modalSrc).toContain('شهر');
    expect(modalSrc).toContain('آدرس');

    // Opening balances intentionally omitted from quick-add modal to keep it streamlined
    expect(modalSrc).not.toContain('مانده‌های اول دوره (طلا و ریال)');
    expect(modalSrc).not.toContain('مانده طلای اولیه (گرم)');
    expect(modalSrc).not.toContain('مانده ریالی اولیه (ریال)');

    // Submission and API Integration
    expect(modalSrc).toContain("fetch('/api/customers'");
    expect(modalSrc).toContain("method: 'POST'");
    expect(modalSrc).toContain('onCustomerCreated');
    expect(modalSrc).toContain('ثبت و انتخاب طرف‌حساب');
  });

  it('3. CustomerSection handles customer creation by refreshing customers and auto-selecting the newly created customer', () => {
    const customerSectionSrc = fs.readFileSync(customerSectionPath, 'utf8');

    expect(customerSectionSrc).toContain('handleCustomerCreated');
    expect(customerSectionSrc).toContain('refreshCustomers');
    expect(customerSectionSrc).toContain('onCustomerCreated?.(newCustomer)');
    expect(customerSectionSrc).toContain('onSelectCustomer(newCustomer)');
    expect(customerSectionSrc).toContain('setIsAddCustomerModalOpen(false)');
  });

  it('4. AddCustomerModal disables background scroll when open and restores it when closed', () => {
    const modalSrc = fs.readFileSync(addCustomerModalPath, 'utf8');

    expect(modalSrc).toContain("document.body.style.overflow = 'hidden'");
    expect(modalSrc).toContain("document.documentElement.style.overflow = 'hidden'");
    expect(modalSrc).toContain('originalBodyOverflow');
    expect(modalSrc).toContain('originalHtmlOverflow');
  });
});
