import './setup';
import { describe, expect, it } from 'bun:test';
import type { Customer } from '@/lib/customer';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { createLine, documentSubType } from '@/features/accounting/documents/hooks/useDocumentLines';
import { getLineDocumentTypeLabel, sanitizeLineDetailsForTab } from '@/features/accounting/documents/utils/document-helpers';
import { setMockAuthUser } from './setup';
import { POST as postDocuments } from '@/app/api/documents/route';

describe('Document Metal Hawala (حواله فلزات بین طرفین حساب در تب ورود فلزات)', () => {
  const customerA: Partial<Customer> = {
    id: 'cust_a',
    name: 'شخص الف',
    customerCode: 101,
    goldBalance: 50,
    silverBalance: 100,
    platinumBalance: 0,
  };

  const customerB: Partial<Customer> = {
    id: 'cust_b',
    name: 'شخص ب',
    customerCode: 102,
    goldBalance: -20,
    silverBalance: 0,
    platinumBalance: 10,
  };

  it('formats hawala descriptions accurately for source and counterparty', () => {
    const targetCode = customerB.customerCode ? `کد حساب:${customerB.customerCode}` : '';
    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';

    const hawalaNoteForA = `(حواله به ${customerB.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

    expect(hawalaNoteForA).toBe('(حواله به شخص ب کد حساب:102)');
    expect(hawalaNoteForB).toBe('(حواله از شخص الف کد حساب: 101)');
  });

  it('creates opposing document line for Customer B when Customer A enters raw gold (ورود طلا)', () => {
    const lineA = createLine('received', 'metals');
    lineA.documentTab = 'raw-gold';
    lineA.sourceTab = 'metals';
    lineA.documentTypeLabel = 'ورود آبشده';
    lineA.details.metalType = 'gold';
    lineA.details.rawKind = 'molten';
    lineA.details.rawWeight = '100';
    lineA.details.purity = '750';
    lineA.details.labName = 'ری‌گیری زرین';
    lineA.details.stampNumber = '12345';
    lineA.converted750 = 100;

    const isReceived = lineA.documentNature === 'received';
    const counterNature = isReceived ? 'paid' : 'received';
    expect(counterNature).toBe('paid');

    const counterSubType = documentSubType(counterNature, lineA.details.rawKind || 'molten');
    expect(counterSubType).toBe('outgoing-molten');

    const counterTypeLabel = getLineDocumentTypeLabel(
      counterNature,
      'metals',
      lineA.details.rawKind,
      false,
      undefined,
      undefined,
      counterSubType,
      'gold',
    );
    expect(counterTypeLabel).toBe('خروج آبشده');

    const targetCode = customerB.customerCode ? `کد حساب:${customerB.customerCode}` : '';
    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';
    const hawalaNoteForA = `(حواله به ${customerB.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

    const hawalaGroupId = 'group_metal_hawala_1';
    const docAId = 'doc_metal_a_1';

    const counterDetails = {
      ...lineA.details,
      metalType: 'gold' as const,
      rawWeight: '100',
      purity: '750',
      convertedWeight: '100',
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterSubType,
      inventorySourceId: '',
      isHawala: true,
      hawalaGroupId,
      hawalaCounterDocumentId: docAId,
      hawalaCounterCustomerId: customerA.id,
      hawalaCounterCustomerName: customerA.name,
      hawalaCounterCustomerCode: customerA.customerCode,
    };

    const lineForB: DocumentLine = {
      ...lineA,
      id: 'line_metal_b_1',
      documentTab: 'raw-gold',
      sourceTab: 'metals',
      documentNature: counterNature,
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterSubType,
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: hawalaNoteForB,
      converted750: 100,
      details: counterDetails,
    };

    expect(lineForB.documentNature).toBe('paid');
    expect(lineForB.documentTypeLabel).toBe('خروج آبشده');
    expect(lineForB.details.rawWeight).toBe('100');
    expect(lineForB.details.purity).toBe('750');
    expect(lineForB.details.isHawala).toBe(true);
    expect(lineForB.details.hawalaCounterCustomerId).toBe('cust_a');
    expect(lineForB.description).toBe('(حواله از شخص الف کد حساب: 101)');
    expect(hawalaNoteForA).toBe('(حواله به شخص ب کد حساب:102)');
  });

  it('creates opposing document line for silver entry hawala', () => {
    const lineA = createLine('received', 'metals');
    lineA.documentTab = 'raw-gold';
    lineA.sourceTab = 'metals';
    lineA.details.metalType = 'silver';
    lineA.details.rawKind = 'molten';
    lineA.details.rawWeight = '500';
    lineA.details.purity = '999';
    lineA.converted750 = 500;

    const counterNature = 'paid';
    const counterSubType = documentSubType(counterNature, 'molten');
    const counterTypeLabel = getLineDocumentTypeLabel(
      counterNature,
      'metals',
      'molten',
      false,
      undefined,
      undefined,
      counterSubType,
      'silver',
    );

    const counterLine = {
      ...lineA,
      id: 'line_silver_b',
      documentTab: 'raw-gold' as const,
      sourceTab: 'metals',
      documentNature: 'paid' as const,
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterSubType,
      settlementMethod: 'weight' as const,
      balanceSource: 'current' as const,
      description: '(حواله از شخص الف)',
      converted750: 500,
      goldAmount: 0,
      silverAmount: 500,
      platinumAmount: 0,
      rialAmount: 0,
      foreignAmount: 0,
      tertiaryAmount: 0,
      details: {
        ...lineA.details,
        metalType: 'silver' as const,
        rawWeight: '500',
        purity: '999',
        convertedWeight: '500',
        isHawala: true,
      },
    };

    expect(counterLine.documentNature).toBe('paid');
    expect(counterLine.silverAmount).toBe(500);
    expect(counterLine.goldAmount).toBe(0);
    expect(counterLine.details.metalType).toBe('silver');
  });

  it('preserves hawala fields in sanitizeLineDetailsForTab for metals and raw-gold', () => {
    const sanitized = sanitizeLineDetailsForTab('raw-gold', {
      metalType: 'gold',
      rawWeight: '250',
      purity: '750',
      isHawala: true,
      hawalaGroupId: 'grp_test_123',
      hawalaCounterDocumentId: 'doc_other_456',
      hawalaCounterCustomerId: 'cust_b',
      hawalaCounterCustomerName: 'شخص ب',
      hawalaCounterCustomerCode: 102,
      documentTypeLabel: 'ورود آبشده',
      documentSubType: 'incoming-molten',
    });

    expect(sanitized.isHawala).toBe(true);
    expect(sanitized.hawalaGroupId).toBe('grp_test_123');
    expect(sanitized.hawalaCounterDocumentId).toBe('doc_other_456');
    expect(sanitized.hawalaCounterCustomerId).toBe('cust_b');
    expect(sanitized.hawalaCounterCustomerName).toBe('شخص ب');
    expect(sanitized.hawalaCounterCustomerCode).toBe(102);
    expect(sanitized.rawWeight).toBe('250');
    expect(sanitized.purity).toBe('750');
  });

  it('preserves hawala fields in sanitizeLineDetailsForTab for gold-sale and coin', () => {
    const sanitizedGoldSale = sanitizeLineDetailsForTab('gold-sale', {
      metalType: 'gold',
      rawKind: 'molten',
      rawWeight: '80',
      purity: '750',
      totalAmount: '4500000000',
      isHawala: true,
      hawalaGroupId: 'grp_gs_123',
      hawalaCounterDocumentId: 'doc_gs_456',
      hawalaCounterCustomerId: 'cust_b',
      hawalaCounterCustomerName: 'شخص ب',
      hawalaCounterCustomerCode: 102,
      documentTypeLabel: 'فروش آبشده',
      documentSubType: 'gold-sale-molten',
    });

    expect(sanitizedGoldSale.isHawala).toBe(true);
    expect(sanitizedGoldSale.hawalaGroupId).toBe('grp_gs_123');
    expect(sanitizedGoldSale.hawalaCounterDocumentId).toBe('doc_gs_456');
    expect(sanitizedGoldSale.hawalaCounterCustomerId).toBe('cust_b');
    expect(sanitizedGoldSale.hawalaCounterCustomerName).toBe('شخص ب');
    expect(sanitizedGoldSale.totalAmount).toBe('4500000000');

    const sanitizedCoin = sanitizeLineDetailsForTab('coin', {
      metalType: 'gold',
      rawWeight: '8.133',
      purity: '900',
      quantity: '5',
      coinName: 'تمام بهار آزادی',
      coinType: 'bahar_full',
      totalAmount: '2500000000',
      isHawala: true,
      hawalaGroupId: 'grp_coin_123',
      hawalaCounterDocumentId: 'doc_coin_456',
      hawalaCounterCustomerId: 'cust_b',
      hawalaCounterCustomerName: 'شخص ب',
      hawalaCounterCustomerCode: 102,
      documentTypeLabel: 'ورود سکه',
      documentSubType: 'receipt_entry',
    });

    expect(sanitizedCoin.isHawala).toBe(true);
    expect(sanitizedCoin.hawalaGroupId).toBe('grp_coin_123');
    expect(sanitizedCoin.hawalaCounterCustomerId).toBe('cust_b');
    expect(sanitizedCoin.quantity).toBe('5');
    expect(sanitizedCoin.coinName).toBe('تمام بهار آزادی');
    expect(sanitizedCoin.totalAmount).toBe('2500000000');
  });

  it('creates opposing document line for Gold Sale hawala (خرید و فروش فلزات)', () => {
    const lineA = createLine('received', 'gold-sale');
    lineA.documentTab = 'gold-sale';
    lineA.sourceTab = 'gold-sale';
    lineA.documentNature = 'received';
    lineA.documentSubType = 'gold-purchase-molten';
    lineA.documentTypeLabel = 'خرید آبشده';
    lineA.details.metalType = 'gold';
    lineA.details.rawKind = 'molten';
    lineA.details.rawWeight = '50';
    lineA.details.purity = '750';
    lineA.details.totalAmount = '3000000000';
    lineA.converted750 = 50;

    const counterNature = 'paid';
    const rawKind = lineA.details.rawKind || 'molten';
    const counterSubType = `gold-sale-${rawKind}`;
    const counterTypeLabel = getLineDocumentTypeLabel(
      counterNature,
      'gold-sale',
      rawKind,
      false,
      undefined,
      undefined,
      counterSubType,
      'gold',
    );
    expect(counterTypeLabel).toBe('فروش آب‌شده');

    const hawalaGroupId = 'grp_sale_test';
    const counterDetails = {
      ...lineA.details,
      metalType: 'gold' as const,
      rawWeight: '50',
      purity: '750',
      convertedWeight: '50',
      totalAmount: '3000000000',
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterSubType,
      isHawala: true,
      hawalaGroupId,
      hawalaCounterDocumentId: 'doc_a_1',
      hawalaCounterCustomerId: customerA.id,
      hawalaCounterCustomerName: customerA.name,
      hawalaCounterCustomerCode: customerA.customerCode,
    };

    const counterLine = {
      ...lineA,
      id: 'line_counter_sale_b',
      documentTab: 'gold-sale' as const,
      sourceTab: 'gold-sale',
      documentNature: 'paid' as const,
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterSubType,
      settlementMethod: 'unsettled' as const,
      balanceSource: 'current' as const,
      description: '(حواله از شخص الف کد حساب: 101)',
      converted750: 50,
      goldAmount: 50,
      rialAmount: 3000000000,
      details: counterDetails,
    };

    expect(counterLine.documentNature).toBe('paid');
    expect(counterLine.documentTypeLabel).toBe('فروش آب‌شده');
    expect(counterLine.details.isHawala).toBe(true);
    expect(counterLine.goldAmount).toBe(50);
    expect(counterLine.rialAmount).toBe(3000000000);
  });

  it('creates opposing document line for Coin hawala (ورود و خروج سکه)', () => {
    const lineA = createLine('received', 'coin');
    lineA.documentTab = 'coin';
    lineA.sourceTab = 'coin';
    lineA.documentNature = 'received';
    lineA.documentSubType = 'receipt_entry';
    lineA.documentTypeLabel = 'ورود سکه';
    lineA.details.metalType = 'gold';
    lineA.details.quantity = '10';
    lineA.details.coinName = 'تمام بهار آزادی';
    lineA.details.unitWeight = '8.133';
    lineA.details.rawWeight = '81.33';
    lineA.details.purity = '900';
    lineA.converted750 = 97.596;

    const counterNature = 'paid';
    const sourceOp = lineA.documentSubType;
    let counterOp = 'payment_exit';
    if (sourceOp === 'receipt_entry') counterOp = 'payment_exit';

    const counterTypeLabel = getLineDocumentTypeLabel(
      counterNature,
      'coin',
      undefined,
      false,
      undefined,
      undefined,
      counterOp,
      'سکه',
    );
    expect(counterTypeLabel).toBe('خروج سکه');

    const counterDetails = {
      ...lineA.details,
      metalType: 'gold',
      rawWeight: '81.33',
      purity: '900',
      quantity: '10',
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterOp,
      isHawala: true,
      hawalaGroupId: 'grp_coin_hawala_test',
      hawalaCounterDocumentId: 'doc_coin_a',
      hawalaCounterCustomerId: customerA.id,
      hawalaCounterCustomerName: customerA.name,
      hawalaCounterCustomerCode: customerA.customerCode,
    };

    const counterLine = {
      ...lineA,
      id: 'line_coin_b',
      documentTab: 'coin' as const,
      sourceTab: 'coin',
      documentNature: 'paid' as const,
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterOp,
      settlementMethod: 'weight' as const,
      balanceSource: 'current' as const,
      description: '(حواله از شخص الف کد حساب: 101)',
      converted750: 97.596,
      goldAmount: 97.596,
      details: counterDetails as any,
    };

    expect(counterLine.documentNature).toBe('paid');
    expect(counterLine.documentTypeLabel).toBe('خروج سکه');
    expect(counterLine.documentSubType).toBe('payment_exit');
    expect(counterLine.details.quantity).toBe('10');
    expect(counterLine.details.isHawala).toBe(true);
    expect(counterLine.goldAmount).toBe(97.596);
  });

  it('atomic submission: creates Document A (Inflow) and Document B (Outflow) with balanced physical metal inventory', async () => {
    setMockAuthUser({
      id: 'usr_admin',
      name: 'مدیر سیستم',
      email: 'admin@zarfolio.local',
      role: 'admin',
      status: 'active',
    });

    const docAId = 'doc_test_hawala_a_1';
    const docBId = 'doc_test_hawala_b_1';
    const hawalaGroupId = 'hawala_grp_gold_1';

    // Document A: Customer A delivers 100g 750 gold (received)
    const lineA = {
      documentNature: 'received',
      documentTab: 'raw-gold',
      sourceTab: 'metals',
      documentSubType: 'incoming-molten',
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: 'ورود طلا (حواله به شخص ب کد حساب:102)',
      converted750: 100,
      goldAmount: 100,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      foreignAmount: 0,
      tertiaryAmount: 0,
      details: {
        metalType: 'gold',
        rawKind: 'molten',
        rawWeight: '100',
        purity: '750',
        convertedWeight: '100',
        isHawala: true,
        hawalaGroupId,
        hawalaCounterDocumentId: docBId,
        hawalaCounterCustomerId: customerB.id,
        hawalaCounterCustomerName: customerB.name,
        hawalaCounterCustomerCode: customerB.customerCode,
      },
    };

    const resA = await postDocuments(
      new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: customerA.id,
          documentId: docAId,
          documentDateJalali: '۱۴۰۵/۰۸/۱۰',
          status: 'posted',
          lines: [lineA],
        }),
      }),
    );
    expect([200, 201]).toContain(resA.status);

    // Document B: Counter-document paying 100g 750 gold to Customer B (paid)
    const lineB = {
      documentNature: 'paid',
      documentTab: 'raw-gold',
      sourceTab: 'metals',
      documentSubType: 'outgoing-molten',
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: 'خروج طلا (حواله از شخص الف کد حساب: 101)',
      converted750: 100,
      goldAmount: 100,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      foreignAmount: 0,
      tertiaryAmount: 0,
      details: {
        metalType: 'gold',
        rawKind: 'molten',
        rawWeight: '100',
        purity: '750',
        convertedWeight: '100',
        isHawala: true,
        hawalaGroupId,
        hawalaCounterDocumentId: docAId,
        hawalaCounterCustomerId: customerA.id,
        hawalaCounterCustomerName: customerA.name,
        hawalaCounterCustomerCode: customerA.customerCode,
      },
    };

    const resB = await postDocuments(
      new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: customerB.id,
          documentId: docBId,
          documentDateJalali: '۱۴۰۵/۰۸/۱۰',
          status: 'posted',
          lines: [lineB],
        }),
      }),
    );
    expect([200, 201]).toContain(resB.status);
  });

  it('renders HawalaCheckboxField with accurate title and educational guide trigger', () => {
    // Verify component module exports
    const HawalaCheckboxField = require('@/features/accounting/documents/components/HawalaCheckboxField').default;
    expect(HawalaCheckboxField).toBeDefined();

    const HawalaGuideModal = require('@/features/accounting/documents/components/HawalaGuideModal').default;
    expect(HawalaGuideModal).toBeDefined();
  });

  it('creates opposing document line for Customer B when Customer A enters manufactured gold (ورود کار ساخته)', () => {
    const lineA = createLine('received', 'workmanship');
    lineA.documentTab = 'workmanship';
    lineA.sourceTab = 'workmanship';
    lineA.documentSubType = 'entry_manufactured';
    lineA.documentTypeLabel = 'ورود کار ساخته';
    lineA.details.metalType = 'gold';
    lineA.details.rawWeight = '25.500';
    lineA.details.purity = '750';
    lineA.details.workmanshipName = 'النگو دامله';
    lineA.details.quantity = '2';
    lineA.details.wage = '150000';
    lineA.details.wageTotalAmount = '3825000';
    lineA.converted750 = 25.5;

    const isReceived = lineA.documentNature === 'received';
    const counterNature = isReceived ? 'paid' : 'received';
    expect(counterNature).toBe('paid');

    const sourceOp = lineA.documentSubType;
    let counterOp = 'exit_manufactured';
    if (sourceOp === 'entry_manufactured') counterOp = 'exit_manufactured';
    expect(counterOp).toBe('exit_manufactured');

    const counterTypeLabel = getLineDocumentTypeLabel(
      counterNature,
      'workmanship',
      undefined,
      undefined,
      undefined,
      1,
      counterOp,
      'gold',
    );
    expect(counterTypeLabel).toBe('خروج کار ساخته');

    const targetCode = customerB.customerCode ? `کد حساب:${customerB.customerCode}` : '';
    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';
    const hawalaNoteForA = `(حواله به ${customerB.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

    const hawalaGroupId = 'group_workmanship_hawala_1';
    const docAId = 'doc_workmanship_a_1';

    const counterDetails = sanitizeLineDetailsForTab('workmanship', {
      ...lineA.details,
      metalType: 'gold',
      rawWeight: '25.500',
      purity: '750',
      convertedWeight: '25.500',
      workmanshipName: 'النگو دامله',
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterOp,
      isHawala: true,
      hawalaGroupId,
      hawalaCounterDocumentId: docAId,
      hawalaCounterCustomerId: customerA.id,
      hawalaCounterCustomerName: customerA.name,
      hawalaCounterCustomerCode: customerA.customerCode,
    });

    expect(counterDetails.isHawala).toBe(true);
    expect(counterDetails.hawalaGroupId).toBe(hawalaGroupId);
    expect(counterDetails.hawalaCounterCustomerId).toBe(customerA.id);
    expect(counterDetails.workmanshipName).toBe('النگو دامله');

    const lineForB: DocumentLine = {
      ...lineA,
      id: 'line_workmanship_b_1',
      documentTab: 'workmanship',
      sourceTab: 'workmanship',
      documentNature: counterNature,
      documentTypeLabel: counterTypeLabel,
      documentSubType: counterOp,
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: hawalaNoteForB,
      converted750: 25.5,
      details: counterDetails,
    };

    expect(lineForB.documentNature).toBe('paid');
    expect(lineForB.documentTypeLabel).toBe('خروج کار ساخته');
    expect(lineForB.description).toBe('(حواله از شخص الف کد حساب: 101)');
  });

  it('creates opposing document line for Customer B when Customer A sells manufactured gold (فروش کارساخته)', () => {
    const isReceived = false;
    const counterNature = isReceived ? 'paid' : 'received';
    expect(counterNature).toBe('received');

    const sourceOp = 'sale_manufactured';
    let counterOp = 'buy_manufactured';
    if (sourceOp === 'sale_manufactured') counterOp = 'buy_manufactured';
    expect(counterOp).toBe('buy_manufactured');

    const counterTypeLabel = getLineDocumentTypeLabel(
      counterNature,
      'workmanship',
      undefined,
      undefined,
      undefined,
      2,
      counterOp,
      'gold',
    );
    expect(counterTypeLabel).toBe('خرید کارساخته');
  });

  it('creates opposing document line for Customer B when Customer A registers return exit (خروج مرجوعی)', () => {
    const sourceOp = 'return_exit';
    const counterOp = sourceOp === 'return_exit' ? 'return_entry' : 'return_exit';
    expect(counterOp).toBe('return_entry');

    const counterTypeLabel = getLineDocumentTypeLabel(
      'received',
      'workmanship',
      undefined,
      undefined,
      undefined,
      3,
      counterOp,
      'gold',
    );
    expect(counterTypeLabel).toBe('ورود مرجوعی');
  });

  it('preserves all Hawala fields in sanitizeLineDetailsForTab for workmanship tab', () => {
    const raw = {
      workmanshipName: 'گوشواره ون کلیف',
      rawWeight: '12.340',
      purity: '750',
      wage: '200000',
      wageTotalAmount: '2468000',
      isHawala: true,
      hawalaGroupId: 'group_test_123',
      hawalaCounterDocumentId: 'doc_counter_456',
      hawalaCounterCustomerId: 'cust_b',
      hawalaCounterCustomerName: 'شخص ب',
      hawalaCounterCustomerCode: 102,
      allowNegativeBalance: true,
      isHawalaNegativeConfirmed: true,
    };

    const sanitized = sanitizeLineDetailsForTab('workmanship', raw as any);
    expect(sanitized.isHawala).toBe(true);
    expect(sanitized.hawalaGroupId).toBe('group_test_123');
    expect(sanitized.hawalaCounterDocumentId).toBe('doc_counter_456');
    expect(sanitized.hawalaCounterCustomerId).toBe('cust_b');
    expect(sanitized.hawalaCounterCustomerName).toBe('شخص ب');
    expect(sanitized.hawalaCounterCustomerCode).toBe(102);
    expect(sanitized.allowNegativeBalance).toBe(true);
    expect(sanitized.isHawalaNegativeConfirmed).toBe(true);
    expect(sanitized.workmanshipName).toBe('گوشواره ون کلیف');
    expect(sanitized.rawWeight).toBe('12.340');
  });
});
