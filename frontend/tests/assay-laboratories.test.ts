import { describe, expect, test, mock } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setMockAuthUser } from './setup';
import {
  DEFAULT_ASSAY_LABORATORIES,
  IRAN_PROVINCES,
  type AssayLaboratory,
} from '../lib/assay-laboratories';
import { GET, POST } from '../app/api/assay-laboratories/route';
import { AssayLaboratorySelect } from '../components/AssayLaboratorySelect';

describe('Assay Laboratories (ری‌گیری‌ها و آزمایشگاه‌های عیارسنجی) Tests', () => {
  describe('Catalog & Data Integrity', () => {
    test('contains comprehensive list of assay laboratories across Iran', () => {
      expect(DEFAULT_ASSAY_LABORATORIES.length).toBeGreaterThanOrEqual(40);
    });

    test('ensures Tehran laboratories are well represented and have phone numbers', () => {
      const tehranLabs = DEFAULT_ASSAY_LABORATORIES.filter((l) => l.province === 'تهران');
      expect(tehranLabs.length).toBeGreaterThanOrEqual(15);
      expect(tehranLabs.some((l) => l.name === 'اعتماد (تهران)')).toBe(true);
      expect(tehranLabs.some((l) => l.name === 'آذین (تهران)')).toBe(true);

      for (const lab of tehranLabs) {
        expect(lab.name.trim().length).toBeGreaterThan(0);
      }
      expect(tehranLabs.filter((l) => Boolean(l.phone)).length).toBeGreaterThanOrEqual(15);
    });

    test('verifies that all laboratory names include their city in parentheses and do not start with "ری‌گیری"', () => {
      for (const lab of DEFAULT_ASSAY_LABORATORIES) {
        expect(lab.name.startsWith('ری‌گیری')).toBe(false);
        expect(lab.name.startsWith('ری گیری')).toBe(false);
        expect(lab.name).toMatch(/\(.*\)$/);
      }
    });

    test('ensures major provinces are represented with valid names and phones', () => {
      const isfahanLabs = DEFAULT_ASSAY_LABORATORIES.filter((l) => l.province === 'اصفهان');
      const mashhadLabs = DEFAULT_ASSAY_LABORATORIES.filter((l) => l.province === 'خراسان رضوی');
      const tabrizLabs = DEFAULT_ASSAY_LABORATORIES.filter((l) => l.province === 'آذربایجان شرقی');
      const yazdLabs = DEFAULT_ASSAY_LABORATORIES.filter((l) => l.province === 'یزد');
      const farsLabs = DEFAULT_ASSAY_LABORATORIES.filter((l) => l.province === 'فارس');

      expect(isfahanLabs.length).toBeGreaterThan(0);
      expect(mashhadLabs.length).toBeGreaterThan(0);
      expect(tabrizLabs.length).toBeGreaterThan(0);
      expect(yazdLabs.length).toBeGreaterThan(0);
      expect(farsLabs.length).toBeGreaterThan(0);

      expect(isfahanLabs.some((l) => l.phone?.includes('031') || l.phone?.includes('۰۳۱'))).toBe(true);
      expect(mashhadLabs.some((l) => l.phone?.includes('051') || l.phone?.includes('۰۵۱'))).toBe(true);
      expect(tabrizLabs.some((l) => l.phone?.includes('041') || l.phone?.includes('۰۴۱'))).toBe(true);
      expect(yazdLabs.some((l) => l.phone?.includes('035') || l.phone?.includes('۰۳۵'))).toBe(true);
      expect(farsLabs.some((l) => l.phone?.includes('071') || l.phone?.includes('۰۷۱'))).toBe(true);
    });

    test('verifies Iran provinces catalog contains 31 provinces', () => {
      expect(IRAN_PROVINCES.length).toBe(31);
      expect(IRAN_PROVINCES).toContain('تهران');
      expect(IRAN_PROVINCES).toContain('اصفهان');
      expect(IRAN_PROVINCES).toContain('خراسان رضوی');
      expect(IRAN_PROVINCES).toContain('فارس');
      expect(IRAN_PROVINCES).toContain('آذربایجان شرقی');
      expect(IRAN_PROVINCES).toContain('یزد');
    });
  });

  describe('API Routes Authentication and Permissions', () => {
    test('GET /api/assay-laboratories returns 401 when not authenticated', async () => {
      setMockAuthUser(null);
      const req = new Request('http://localhost:3000/api/assay-laboratories');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('ابتدا وارد حساب شوید.');
    });

    test('POST /api/assay-laboratories returns 401 when not authenticated', async () => {
      setMockAuthUser(null);
      const req = new Request('http://localhost:3000/api/assay-laboratories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'ری‌گیری آزمایشی', province: 'تهران' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('ابتدا وارد حساب شوید.');
    });

    test('GET /api/assay-laboratories returns catalog when authenticated', async () => {
      setMockAuthUser({
        id: 'admin1',
        name: 'مدیر سیستم',
        email: 'admin@zar.local',
        role: 'admin',
        status: 'active',
      });
      const req = new Request('http://localhost:3000/api/assay-laboratories');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
    });

    test('POST /api/assay-laboratories creates and returns a new laboratory when authenticated', async () => {
      setMockAuthUser({
        id: 'admin1',
        name: 'مدیر سیستم',
        email: 'admin@zar.local',
        role: 'admin',
        status: 'active',
      });
      const req = new Request('http://localhost:3000/api/assay-laboratories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ری‌گیری نمونه آزمون',
          province: 'تهران',
          city: 'تهران',
          phone: '۰۲۱۱۲۳۴۵۶۷۸',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Automatically strips redundant "ری‌گیری" prefix and formats with city
      expect(data.item.name).toBe('نمونه آزمون (تهران)');
      expect(data.item.province).toBe('تهران');
    });

    test('POST /api/assay-laboratories rejects empty name or province', async () => {
      setMockAuthUser({
        id: 'admin1',
        name: 'مدیر سیستم',
        email: 'admin@zar.local',
        role: 'admin',
        status: 'active',
      });
      const req = new Request('http://localhost:3000/api/assay-laboratories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', province: 'تهران' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('UI Component Rendering', () => {
    test('AssayLaboratorySelect renders input with placeholder and default values', () => {
      const html = renderToStaticMarkup(
        React.createElement(AssayLaboratorySelect, {
          value: 'اعتماد (تهران)',
          onChange: () => {},
          placeholder: 'انتخاب ری‌گیری...',
        }),
      );

      expect(html).toContain('value="اعتماد (تهران)"');
      expect(html).toContain('placeholder="انتخاب ری‌گیری..."');
      expect(html).toContain('تهران (تهران)');
      expect(html).toContain('021-55696782');
    });

    test('AssayLaboratorySelect supports dynamic upward/downward dropdown placement structure', () => {
      const html = renderToStaticMarkup(
        React.createElement(AssayLaboratorySelect, {
          value: '',
          onChange: () => {},
          placeholder: 'انتخاب ری‌گیری...',
        }),
      );

      expect(html).toContain('relative');
      expect(html).toContain('placeholder="انتخاب ری‌گیری..."');
    });
  });
});
