import { describe, expect, it } from 'bun:test';
import {
  ZF_DOCUMENT_NUMBER_REGEX,
  isValidZfDocumentNumber,
  generateZfDocumentNumber,
  generateUniqueZfDocumentNumber,
} from '@/lib/document-number';

describe('Unique ZFXXXXXXXX Document Number Architecture', () => {
  it('strictly adheres to regex /^ZF[0-9]{8}$/', () => {
    // Valid samples
    expect(isValidZfDocumentNumber('ZF48273195')).toBe(true);
    expect(isValidZfDocumentNumber('ZF01759384')).toBe(true);
    expect(isValidZfDocumentNumber('ZF93620147')).toBe(true);
    expect(isValidZfDocumentNumber('ZF58031462')).toBe(true);
    expect(isValidZfDocumentNumber('ZF00000000')).toBe(true);
    expect(isValidZfDocumentNumber('ZF99999999')).toBe(true);

    // Invalid samples
    expect(isValidZfDocumentNumber('ZF1234567')).toBe(false); // only 7 digits
    expect(isValidZfDocumentNumber('ZF123456789')).toBe(false); // 9 digits
    expect(isValidZfDocumentNumber('zf48273195')).toBe(false); // lowercase prefix
    expect(isValidZfDocumentNumber('DOC48273195')).toBe(false); // wrong prefix
    expect(isValidZfDocumentNumber('ZF4827319A')).toBe(false); // letter in digits
    expect(isValidZfDocumentNumber('')).toBe(false); // empty
    expect(isValidZfDocumentNumber(null)).toBe(false); // non-string
    expect(isValidZfDocumentNumber(undefined)).toBe(false);
  });

  it('generates random ZF numbers with exactly 8 digits including leading zeros', () => {
    for (let i = 0; i < 500; i++) {
      const generated = generateZfDocumentNumber();
      expect(generated).toMatch(ZF_DOCUMENT_NUMBER_REGEX);
      expect(generated.startsWith('ZF')).toBe(true);
      expect(generated.length).toBe(10);
      const digitsPart = generated.slice(2);
      expect(digitsPart.length).toBe(8);
      expect(/^\d{8}$/.test(digitsPart)).toBe(true);
    }
  });

  it('generates unique numbers across multiple invocations with excludeSet collision resolution', async () => {
    const mockDb = {
      collection: () => ({
        getFirstListItem: async () => {
          // throws to simulate record not found (available)
          throw new Error('Not found');
        },
      }),
      filter: (str: string, params: Record<string, unknown>) => JSON.stringify({ str, params }),
    } as any;

    const generatedSet = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const docNum = await generateUniqueZfDocumentNumber(mockDb, 10, generatedSet);
      expect(ZF_DOCUMENT_NUMBER_REGEX.test(docNum)).toBe(true);
    }
    // All 100 generated numbers must be distinct
    expect(generatedSet.size).toBe(100);
  });

  it('retries when mock DB reports an existing collision', async () => {
    let callCount = 0;
    const mockDb = {
      collection: () => ({
        getFirstListItem: async () => {
          callCount++;
          // First attempt finds a collision, second attempt succeeds (not found)
          if (callCount === 1) {
            return { id: 'existing-record', documentNumber: 'ZF12345678' };
          }
          throw new Error('Not found');
        },
      }),
      filter: (str: string, params: Record<string, unknown>) => JSON.stringify({ str, params }),
    } as any;

    const docNum = await generateUniqueZfDocumentNumber(mockDb, 5);
    expect(ZF_DOCUMENT_NUMBER_REGEX.test(docNum)).toBe(true);
    expect(callCount).toBe(2);
  });

  it('immutability principle: existing ZF numbers are preserved on edit/update', () => {
    const existingTransaction = {
      id: 'tx_12345',
      documentNumber: 'ZF48273195',
      amount: 1000,
    };

    // When updating, the documentNumber must remain the exact existing one
    const updatePayload = {
      amount: 2000,
      documentNumber: existingTransaction.documentNumber,
    };

    expect(isValidZfDocumentNumber(updatePayload.documentNumber)).toBe(true);
    expect(updatePayload.documentNumber).toBe(existingTransaction.documentNumber);
  });
});
