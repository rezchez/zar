import { describe, it, expect } from 'bun:test';
import { en, fa } from '@/lib/utils';
import { NumberField, purityStep } from '@/components/ui/number-field';
import React from 'react';

describe('VibeFarsi NumberField & Digit Utils', () => {
  describe('en() utility', () => {
    it('converts Persian digits to ASCII', () => {
      expect(en('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
    });

    it('converts Arabic-Indic digits to ASCII', () => {
      expect(en('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    });

    it('converts Persian decimal separators', () => {
      expect(en('۱۲٫۳۴')).toBe('12.34');
      expect(en('۵۶،۷۸')).toBe('56.78');
    });

    it('handles mixed content and numbers', () => {
      expect(en(123)).toBe('123');
      expect(en('')).toBe('');
      expect(en(null)).toBe('');
      expect(en(undefined)).toBe('');
    });
  });

  describe('fa() utility', () => {
    it('converts ASCII digits to Persian digits', () => {
      expect(fa('1234567890')).toBe('۱۲۳۴۵۶۷۸۹۰');
      expect(fa(1234567890)).toBe('۱۲۳۴۵۶۷۸۹۰');
      expect(fa(12.34)).toBe('۱۲.۳۴');
    });

    it('handles empty and null values', () => {
      expect(fa('')).toBe('');
      expect(fa(null)).toBe('');
      expect(fa(undefined)).toBe('');
    });
  });

  describe('purityStep() utility', () => {
    it('increments by 1 when current < 999', () => {
      expect(purityStep(750, 'up')).toBe(751);
      expect(purityStep(900, 'up')).toBe(901);
      expect(purityStep(998, 'up')).toBe(999);
    });

    it('increments by 0.1 when current >= 999 up to MAX_PURITY 999.9', () => {
      expect(purityStep(999, 'up')).toBe(999.1);
      expect(purityStep(999.1, 'up')).toBe(999.2);
      expect(purityStep(999.8, 'up')).toBe(999.9);
      expect(purityStep(999.9, 'up')).toBe(999.9);
    });

    it('decrements by 0.1 when current > 999', () => {
      expect(purityStep(999.9, 'down')).toBe(999.8);
      expect(purityStep(999.2, 'down')).toBe(999.1);
      expect(purityStep(999.1, 'down')).toBe(999);
    });

    it('decrements by 1 when current <= 999', () => {
      expect(purityStep(999, 'down')).toBe(998);
      expect(purityStep(998, 'down')).toBe(997);
      expect(purityStep(751, 'down')).toBe(750);
    });
  });

  describe('NumberField component rendering', () => {
    it('is a valid React component function', () => {
      expect(typeof NumberField).toBe('function');
      const element = React.createElement(NumberField, {
        value: 750,
        min: 1,
        max: 999.9,
        step: 'purity',
      });
      expect(element).toBeDefined();
      expect(element.type).toBe(NumberField);
      expect(element.props.value).toBe(750);
      expect(element.props.step).toBe('purity');
    });
  });
});
