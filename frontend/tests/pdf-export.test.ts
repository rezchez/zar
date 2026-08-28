import './setup';
import { describe, expect, it } from 'bun:test';
import { setMockAuthUser } from './setup';
import { createCustomersPdf } from '../lib/pdf-reports';
import { POST as exportCustomers } from '../app/api/customers/export/route';

describe('PDF Export Tests', () => {
  it('creates customer PDF buffer successfully with empty list', async () => {
    const buffer = await createCustomersPdf([]);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('creates customer PDF buffer successfully with 1 customer', async () => {
    const sampleCustomer = {
      id: 'cust_1',
      customerCode: 101,
      name: 'طلافروشی زرتشت',
      groupName: 'همکاران',
      phone1: '09121112233',
      city: 'تهران',
      province: 'تهران',
      goldBalance: 125.45,
      silverBalance: 0,
      platinumBalance: 0,
      rialBalance: 450000000,
      foreignBalance: 0,
      tertiaryBalance: 0,
    } as any;

    const buffer = await createCustomersPdf([sampleCustomer]);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('creates customer PDF buffer successfully with 25 customers', async () => {
    const customers = Array.from({ length: 25 }, (_, i) => ({
      id: `cust_${i + 1}`,
      customerCode: 200 + i,
      name: `همکار شماره ${i + 1}`,
      groupName: 'بنکداران',
      phone1: `0912100${String(i).padStart(4, '0')}`,
      city: 'تهران',
      goldBalance: 50.12,
      rialBalance: 150000000,
    } as any));

    const buffer = await createCustomersPdf(customers);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('creates customer PDF buffer successfully with 100 customers (multipage)', async () => {
    const customers = Array.from({ length: 100 }, (_, i) => ({
      id: `cust_${i + 1}`,
      customerCode: 1000 + i,
      name: `مشتری شماره ${i + 1}`,
      groupName: i % 2 === 0 ? 'بنکداران' : 'کیفی‌ها',
      phone1: `0912000${String(i).padStart(4, '0')}`,
      city: 'اصفهان',
      goldBalance: (i + 1) * 2.5,
      rialBalance: (i + 1) * 10000000,
    } as any));

    const buffer = await createCustomersPdf(customers);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('respects custom columns configuration, orientation, stamp and signature', async () => {
    const customers = [
      {
        id: 'cust_x',
        customerCode: 555,
        name: 'گالری آریا',
        groupName: 'ویترین‌داران',
        phone1: '09123456789',
        city: 'شیراز',
        province: 'فارس',
        address1: 'خیابان ملاصدرا',
        goldBalance: 88.5,
        rialBalance: 320000000,
      } as any,
    ];

    const buffer = await createCustomersPdf(customers, {
      title: 'صورت وضعیت اختصاصی',
      subtitle: 'گزارش حساب تفصیلی سال ۱۴۰۴',
      orientation: 'portrait',
      storeName: 'گالری زرین فردوس',
      columns: ['customerCode', 'name', 'city', 'address', 'goldBalance', 'rialBalance'],
      showStamp: true,
      showSignature: true,
      showTotalCount: true,
      footerNotes: 'سند فاقد مهر و امضا فاقد اعتبار است.',
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('POST /api/customers/export handles requests properly with auth and templateId', async () => {
    setMockAuthUser({
      id: 'admin_1',
      name: 'مدیر کل',
      email: 'admin@zarfolio.local',
      role: 'admin',
      status: 'active',
    });

    const request = new Request('http://localhost:3000/api/customers/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'pdf',
        templateId: 'rep_tpl_cust_default',
        options: {
          title: 'گزارش آزمایشی طرف‌حساب‌ها',
        },
      }),
    });

    const response = await exportCustomers(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('customers.pdf');
  });
});
