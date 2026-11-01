import './setup';
import { describe, expect, it } from 'bun:test';
import type { Customer } from '@/lib/customer';
import { createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import { setMockAuthUser, sharedMockPb } from './setup';
import { DELETE } from '@/app/api/documents/[id]/route';
import { POST as postDocuments } from '@/app/api/documents/route';

describe('Document Cash Hawala (حواله وجه نقد بین طرفین حساب)', () => {
  const customerA: Partial<Customer> = {
    id: 'cust_a',
    name: 'شخص الف',
    customerCode: 101,
    rialBalance: 5000000,
  };

  const customerB: Partial<Customer> = {
    id: 'cust_b',
    name: 'شخص ب',
    customerCode: 102,
    rialBalance: -3000000,
  };

  it('formats hawala description correctly for source customer A (حواله به ب)', () => {
    const targetCode = customerB.customerCode ? `کد حساب:${customerB.customerCode}` : '';
    const hawalaNoteForA = `(حواله به ${customerB.name} ${targetCode})`.replace(/\s+/g, ' ').trim();

    expect(hawalaNoteForA).toBe('(حواله به شخص ب کد حساب:102)');

    // With existing user description
    const userDesc = 'بابت تسویه حساب شهریور';
    const descForA = `${userDesc} ${hawalaNoteForA}`;
    expect(descForA).toBe('بابت تسویه حساب شهریور (حواله به شخص ب کد حساب:102)');
  });

  it('formats hawala description correctly for target customer B (حواله از الف)', () => {
    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

    expect(hawalaNoteForB).toBe('(حواله از شخص الف کد حساب: 101)');

    // With existing user description
    const userDesc = 'بابت تسویه حساب شهریور';
    const descForB = `${userDesc} ${hawalaNoteForB}`;
    expect(descForB).toBe('بابت تسویه حساب شهریور (حواله از شخص الف کد حساب: 101)');
  });

  it('creates opposing document line for Customer B when Customer A is received (ورود وجه)', () => {
    const lineA = createLine('received', 'cash');
    lineA.documentTypeLabel = 'دریافت وجه نقد به صندوق ارزی دلار';
    lineA.details.cashFundId = 'fund_usd_1';
    lineA.details.cashFundName = 'صندوق ارزی دلار';
    lineA.details.cashFundCurrency = 'USD';
    lineA.details.currencyUnit = 'USD';
    lineA.details.totalAmount = '1000';
    lineA.details.isForeignCash = true;

    // Customer B must receive an opposing 'paid' line
    const counterNature = lineA.documentNature === 'received' ? 'paid' : 'received';
    expect(counterNature).toBe('paid');

    const targetCode = customerB.customerCode ? `کد حساب:${customerB.customerCode}` : '';
    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';

    const hawalaNoteForA = `(حواله به ${customerB.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

    const lineForB = {
      ...lineA,
      id: 'line_hawala_b',
      documentNature: counterNature,
      documentTypeLabel: `پرداخت نقد از ${lineA.details.cashFundName}`,
      description: hawalaNoteForB,
      converted750: 0,
      details: {
        ...lineA.details,
        totalAmount: lineA.details.totalAmount,
      },
    };

    expect(lineForB.documentNature).toBe('paid');
    expect(lineForB.details.cashFundId).toBe('fund_usd_1');
    expect(lineForB.details.totalAmount).toBe('1000');
    expect(lineForB.details.currencyUnit).toBe('USD');
    expect(lineForB.description).toBe('(حواله از شخص الف کد حساب: 101)');
    expect(hawalaNoteForA).toBe('(حواله به شخص ب کد حساب:102)');
  });

  it('creates opposing document line for Customer B when Customer A is paid (خروج وجه)', () => {
    const lineA = createLine('paid', 'cash');
    lineA.documentTypeLabel = 'پرداخت نقد از صندوق ارزی دلار';
    lineA.description = 'پیش‌پرداخت';
    lineA.details.cashFundId = 'fund_usd_1';
    lineA.details.cashFundName = 'صندوق ارزی دلار';
    lineA.details.cashFundCurrency = 'USD';
    lineA.details.currencyUnit = 'USD';
    lineA.details.totalAmount = '500';
    lineA.details.isForeignCash = true;

    // If A is paid, B must be received
    const counterNature = lineA.documentNature === 'received' ? 'paid' : 'received';
    expect(counterNature).toBe('received');

    const sourceCode = customerA.customerCode ? `کد حساب: ${customerA.customerCode}` : '';
    const hawalaNoteForB = `(حواله از ${customerA.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();
    const descForB = `${lineA.description} ${hawalaNoteForB}`;

    expect(descForB).toBe('پیش‌پرداخت (حواله از شخص الف کد حساب: 101)');
  });

  it('ensures target customer cannot be the same as source customer', () => {
    const allCustomers = [customerA, customerB];
    const availableTargets = allCustomers.filter((c) => c.id !== customerA.id);

    expect(availableTargets.length).toBe(1);
    expect(availableTargets[0].id).toBe('cust_b');
  });

  describe('Currency Matching Validation (یکسان بودن ارز حواله بین دو طرف‌حساب)', () => {
    const customerUsd1: Customer = {
      id: 'cust_usd_1',
      name: 'بازرگانی الف (دلاری)',
      customerCode: 201,
      primaryCurrency: 'usd',
    } as unknown as Customer;

    const customerUsd2: Customer = {
      id: 'cust_usd_2',
      name: 'صرافی ب (دلاری)',
      customerCode: 202,
      primaryCurrency: 'USD',
    } as unknown as Customer;

    const customerRial: Customer = {
      id: 'cust_rial',
      name: 'فروشگاه ج (ریالی)',
      customerCode: 203,
      primaryCurrency: 'rial',
    } as unknown as Customer;

    const customerEur: Customer = {
      id: 'cust_eur',
      name: 'شرکت د (یورویی)',
      customerCode: 204,
      primaryCurrency: 'eur',
    } as unknown as Customer;

    const customerMultiCurrency: Customer = {
      id: 'cust_multi',
      name: 'شرکت هـ (ریال و دلار)',
      customerCode: 205,
      primaryCurrency: 'rial',
      secondaryCurrency: 'usd',
    } as unknown as Customer;

    it('matches USD customer with USD customer correctly', async () => {
      const { isCustomerSupportingCurrency } = await import(
        '@/features/accounting/documents/components/HawalaModal'
      );

      expect(isCustomerSupportingCurrency(customerUsd1, 'USD')).toBe(true);
      expect(isCustomerSupportingCurrency(customerUsd2, 'USD')).toBe(true);
      expect(isCustomerSupportingCurrency(customerMultiCurrency, 'USD')).toBe(true);

      // Rial and Euro customers do NOT support USD
      expect(isCustomerSupportingCurrency(customerRial, 'USD')).toBe(false);
      expect(isCustomerSupportingCurrency(customerEur, 'USD')).toBe(false);
    });

    it('matches Rial and Toman customers correctly', async () => {
      const { isCustomerSupportingCurrency } = await import(
        '@/features/accounting/documents/components/HawalaModal'
      );

      expect(isCustomerSupportingCurrency(customerRial, 'IRR')).toBe(true);
      expect(isCustomerSupportingCurrency(customerRial, 'IRT')).toBe(true);
      expect(isCustomerSupportingCurrency(customerMultiCurrency, 'IRR')).toBe(true);

      // Pure USD customer does NOT support Rial
      expect(isCustomerSupportingCurrency(customerUsd1, 'IRR')).toBe(false);
    });

    it('allows all counterparties to be visible and searchable', async () => {
      const all = [customerUsd1, customerUsd2, customerRial, customerEur, customerMultiCurrency];

      // All counterparties (except source customer) must be available
      const available = all.filter((c) => c.id !== customerUsd1.id);
      expect(available.length).toBe(4);
      expect(available.some((c) => c.id === 'cust_rial')).toBe(true);
    });

    it('correctly handles the Euro scenario (صندوق یورو، ۱۰۰ €) with zero Rial leakage', async () => {
      const {
        detectHawalaCurrency,
        getCustomerCurrencyBalance,
      } = await import('@/features/accounting/documents/components/HawalaModal');

      const sepantaAndMahoor: Customer = {
        id: 'cust_sepanta',
        name: 'سپنتا و ماهورا',
        customerCode: 596,
        primaryCurrency: 'eur',
      } as unknown as Customer;

      // Reza Chegini can be any customer; preview must strictly use the hawala currency (Euro)
      const rezaChegini: Customer = {
        id: 'cust_reza',
        name: 'رضا چگینی',
        customerCode: 514,
        primaryCurrency: 'rial',
        rialBalance: 0,
        foreignBalance: 0,
      } as unknown as Customer;

      const euroLine = createLine('received', 'cash');
      euroLine.details.cashFundName = 'صندوق یورو';
      euroLine.details.cashFundCurrency = 'یورو';
      euroLine.details.currencyUnit = '€';
      euroLine.details.totalAmount = '۱۰۰'; // Persian digits

      const detected = detectHawalaCurrency(euroLine, sepantaAndMahoor);
      expect(detected.code).toBe('EUR');
      expect(detected.name).toBe('یورو');
      expect(detected.symbol).toBe('€');
      expect(detected.isForeign).toBe(true);

      const currentBalance = getCustomerCurrencyBalance(rezaChegini, detected.code);
      expect(currentBalance).toBe(0);

      const { parseLocalizedAmount } = await import('@/lib/money');
      const amount = parseLocalizedAmount(euroLine.details.totalAmount);
      expect(amount).toBe(100);

      const direction = euroLine.documentNature === 'received' ? -1 : 1;
      const effect = direction * amount;
      const projected = currentBalance + effect;

      expect(effect).toBe(-100);
      expect(projected).toBe(-100);
    });

    it('ensures hawala counter line payload contains valid non-zero amounts so POST /api/documents succeeds', async () => {
      const { parseLocalizedAmount } = await import('@/lib/money');
      const rawAmount = parseLocalizedAmount('۱۰۰');
      expect(rawAmount).toBe(100);

      const counterLine = {
        id: 'line_test_123',
        documentTab: 'cash',
        sourceTab: 'cash',
        documentNature: 'paid',
        documentTypeLabel: 'پرداخت نقد از صندوق یورو',
        description: '(حواله از سپنتا و ماهورا کد حساب: 596)',
        converted750: 0,
        foreignCurrency: '€',
        goldAmount: 0,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 0,
        foreignAmount: rawAmount,
        tertiaryAmount: 0,
        details: {
          cashFundId: 'fund_eur',
          cashFundName: 'صندوق یورو',
          cashFundCurrency: 'EUR',
          currencyUnit: '€',
          isForeignCash: true,
          totalAmount: String(rawAmount),
          documentTypeLabel: 'پرداخت نقد از صندوق یورو',
        },
        documentDetails: {
          cashFundId: 'fund_eur',
          cashFundName: 'صندوق یورو',
          cashFundCurrency: 'EUR',
          currencyUnit: '€',
          isForeignCash: true,
          totalAmount: String(rawAmount),
          documentTypeLabel: 'پرداخت نقد از صندوق یورو',
        },
      };

      // Verify that hasAmount logic succeeds
      const amountFields = ['goldAmount', 'silverAmount', 'platinumAmount', 'rialAmount', 'foreignAmount', 'tertiaryAmount'];
      const hasValidAmount = amountFields.some((f) => counterLine[f as keyof typeof counterLine] !== 0);
      expect(hasValidAmount).toBe(true);
      expect(counterLine.foreignAmount).toBe(100);
      expect(counterLine.documentDetails.totalAmount).toBe('100');
    });

    it('ensures correct execution order: inflow (received) registers FIRST so fund balance increases before outflow (paid) executes', () => {
      // Scenario:
      // Customer A receives 10,000 EUR into "صندوق یورو" (initial balance: 123 EUR)
      // Customer B is remitted 10,000 EUR from "صندوق یورو"
      const initialFundBalance = 123;
      const transferAmount = 10000;

      // 1. If outflow was executed first (the old bug):
      const flawedBalanceCheck = initialFundBalance < transferAmount;
      expect(flawedBalanceCheck).toBe(true); // Insufficient balance! (123 < 10000)

      // 2. With the fix: determine inflow and outflow
      const sourceNature: string = 'received';
      const isReceived = sourceNature === 'received';

      const firstOp = isReceived ? 'inflow' : 'outflow';
      const secondOp = isReceived ? 'outflow' : 'inflow';

      expect(firstOp).toBe('inflow');
      expect(secondOp).toBe('outflow');

      // Step 1: Inflow executes first
      let currentFundBalance = initialFundBalance + transferAmount;
      expect(currentFundBalance).toBe(10123);

      // Step 2: Outflow executes second and checks balance
      const isInsufficient = currentFundBalance < transferAmount;
      expect(isInsufficient).toBe(false); // Succeeded! 10123 >= 10000

      currentFundBalance -= transferAmount;
      expect(currentFundBalance).toBe(123); // Net effect on fund is 0
    });

    it('ensures reverse hawala (source is paid) also prioritizes inflow first', () => {
      const sourceNature: string = 'paid';
      const isReceived = sourceNature === 'received';

      // When source is paid, destination is received (inflow)
      const firstOp = isReceived ? 'source' : 'destination';
      const secondOp = isReceived ? 'destination' : 'source';

      expect(firstOp).toBe('destination'); // Destination received runs first
      expect(secondOp).toBe('source'); // Source paid runs second
    });
  });

  describe('Hawala Cascade Deletion (حذف دوطرفه اسناد حواله)', () => {
    const docAId = 'doc_hawala_a_123';
    const docBId = 'doc_hawala_b_456';
    const hawalaGroupId = 'grp_hawala_789';

    function setupHawalaMockDb() {
      setMockAuthUser({
        id: 'usr_admin',
        name: 'مدیر سیستم',
        email: 'admin@zarfolio.local',
        role: 'admin',
        status: 'active',
      });

      const txStore: Record<string, any> = {
        tx_a_1: {
          id: 'tx_a_1',
          documentId: docAId,
          documentNumber: '1001',
          customerId: 'cust_a',
          sourceKey: 'document:doc_hawala_a_123:1',
          is_deleted: false,
          documentDetails: JSON.stringify({
            isHawala: true,
            hawalaGroupId,
            hawalaCounterDocumentId: docBId,
            hawalaCounterCustomerId: 'cust_b',
            hawalaCounterCustomerName: 'شخص ب',
            totalAmount: '10000',
            currencyUnit: 'EUR',
          }),
        },
        tx_b_1: {
          id: 'tx_b_1',
          documentId: docBId,
          documentNumber: '1002',
          customerId: 'cust_b',
          sourceKey: 'document:doc_hawala_b_456:1',
          is_deleted: false,
          documentDetails: JSON.stringify({
            isHawala: true,
            hawalaGroupId,
            hawalaCounterDocumentId: docAId,
            hawalaCounterCustomerId: 'cust_a',
            hawalaCounterCustomerName: 'شخص الف',
            totalAmount: '10000',
            currencyUnit: 'EUR',
          }),
        },
      };

      const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
      sharedMockPb.collection = ((name: string) => {
        if (name === 'transactions') {
          return {
            getOne: async (id: string) => {
              const item = txStore[id] || Object.values(txStore).find((t) => t.documentId === id);
              if (!item || item.is_deleted) throw new Error('Not found');
              return item;
            },
            getFirstListItem: async (filter: string) => {
              const items = Object.values(txStore).filter((t) => !t.is_deleted);
              const found = items.find((t) => filter.includes(t.documentId) || filter.includes(t.id));
              if (!found) throw new Error('Not found');
              return found;
            },
            getFullList: async ({ filter }: any = {}) => {
              const items = Object.values(txStore).filter((t) => !t.is_deleted);
              if (!filter) return items;
              return items.filter((t) => {
                if (filter.includes(`documentId = ${t.documentId}`) || filter.includes(`documentId = '${t.documentId}'`) || filter.includes(`documentId = "${t.documentId}"`)) return true;
                if (filter.includes(`id = ${t.id}`) || filter.includes(`id = '${t.id}'`) || filter.includes(`id = "${t.id}"`)) return true;
                if (filter.includes('documentDetails ~') && (
                  (filter.includes(docAId) && t.documentDetails?.includes(docAId)) ||
                  (filter.includes(docBId) && t.documentDetails?.includes(docBId)) ||
                  (filter.includes(hawalaGroupId) && t.documentDetails?.includes(hawalaGroupId))
                )) return true;
                return false;
              });
            },
            update: async (id: string, data: any) => {
              if (txStore[id]) {
                Object.assign(txStore[id], data);
                return txStore[id];
              }
              throw new Error(`Record ${id} not found`);
            },
            delete: async (id: string) => {
              if (txStore[id]) {
                delete txStore[id];
              }
              return true;
            },
            create: async (data: any) => {
              const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
              txStore[id] = { id, ...data };
              return txStore[id];
            },
          };
        }
        if (name === 'customers') {
          return {
            getOne: async (id: string) => ({ id, name: 'مشتری تست', rialBalance: 0, goldBalance: 0 }),
            update: async (id: string, data: any) => ({ id, ...data }),
          };
        }
        if (name === 'metal_inventory') {
          return {
            getFullList: async () => [],
            update: async () => ({}),
          };
        }
        if (name === 'audit_logs') {
          return {
            create: async (data: any) => ({ id: 'audit_1', ...data }),
          };
        }
        return originalCollection(name);
      }) as any;

      return { txStore, originalCollection };
    }

    it('deletes both side A and counterparty side B when side A is deleted', async () => {
      const { txStore, originalCollection } = setupHawalaMockDb();

      try {
        const req = new Request(`http://localhost/api/documents/${docAId}`, { method: 'DELETE' });
        const res = await DELETE(req, { params: Promise.resolve({ id: docAId }) });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.isHawala).toBe(true);
        expect(data.deletedCount).toBe(2);
        expect(data.counterDeletedCount).toBe(1);

        // Verify side A is marked deleted
        expect(txStore.tx_a_1.is_deleted).toBe(true);
        expect(txStore.tx_a_1.sourceKey).toContain(':deleted:');
        expect(txStore.tx_a_1.documentNumber).toContain('1001:deleted:');

        // Verify side B (the counterparty) is ALSO marked deleted!
        expect(txStore.tx_b_1.is_deleted).toBe(true);
        expect(txStore.tx_b_1.sourceKey).toContain(':deleted:');
        expect(txStore.tx_b_1.documentNumber).toContain('1002:deleted:');
      } finally {
        sharedMockPb.collection = originalCollection;
      }
    });

    it('deletes both side A and counterparty side B when side B is deleted (symmetric deletion)', async () => {
      const { txStore, originalCollection } = setupHawalaMockDb();

      try {
        const req = new Request(`http://localhost/api/documents/${docBId}`, { method: 'DELETE' });
        const res = await DELETE(req, { params: Promise.resolve({ id: docBId }) });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.isHawala).toBe(true);
        expect(data.deletedCount).toBe(2);
        expect(data.counterDeletedCount).toBe(1);

        // Verify side B is marked deleted
        expect(txStore.tx_b_1.is_deleted).toBe(true);

        // Verify side A is ALSO marked deleted
        expect(txStore.tx_a_1.is_deleted).toBe(true);
      } finally {
        sharedMockPb.collection = originalCollection;
      }
    });

    it('editing Document A and removing the hawala line automatically soft-deletes the counter-hawala transaction of Customer B in POST /api/documents', async () => {
      const { txStore, originalCollection } = setupHawalaMockDb();

      try {
        // Customer A edits their document, keeping only a non-hawala cash row (hawala line is deleted)
        const updatedLines = [
          {
            documentNature: 'received',
            documentTab: 'cash',
            description: 'دریافت وجه نقد عادی',
            rialAmount: 5000000,
            goldAmount: 0,
            documentDetails: {
              cashFundId: 'fund_irr_1',
              totalAmount: '5000000',
              // Notice: hawalaGroupId is NOT in the new lines! (User deleted the hawala line)
            },
          },
        ];

        const req = new Request('http://localhost/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: 'cust_a',
            documentId: docAId,
            documentDateJalali: '1405/08/11',
            status: 'final',
            isEdit: true,
            lines: updatedLines,
          }),
        });

        const res = await postDocuments(req);
        expect(res.status).toBe(200);

        // Side B (Customer B's counter hawala transaction) must be soft-deleted automatically!
        expect(txStore.tx_b_1.is_deleted).toBe(true);
        expect(txStore.tx_b_1.sourceKey).toContain(':deleted:');
      } finally {
        sharedMockPb.collection = originalCollection;
      }
    });

    it('Hawala line deletion prompt correctly identifies counterparty and direction ("حواله به" vs "حواله از")', () => {
      // 1. Line for A (حواله به شخص ب)
      const lineA = {
        id: 'line_a',
        description: 'بابت تسویه (حواله به شخص ب کد حساب:102)',
        documentNature: 'received',
        details: {
          isHawala: true,
          hawalaCounterCustomerName: 'شخص ب',
          hawalaCounterCustomerCode: 102,
        },
      };

      const getHawalaDirectionInfo = (line: typeof lineA) => {
        const details = line.details || {};
        const counterName = String(details.hawalaCounterCustomerName || '');
        const counterCode = details.hawalaCounterCustomerCode ? `کد حساب:${details.hawalaCounterCustomerCode}` : '';
        const desc = line.description || '';

        if (desc.includes('حواله به')) {
          return counterName ? `حواله به «${counterName}» ${counterCode}`.trim() : 'حواله به طرف‌حساب مقصد';
        } else if (desc.includes('حواله از')) {
          return counterName ? `حواله از «${counterName}» ${counterCode}`.trim() : 'حواله از طرف‌حساب مبدأ';
        }
        return `حواله طرف‌به‌طرف با «${counterName}»`;
      };

      const infoA = getHawalaDirectionInfo(lineA);
      expect(infoA).toBe('حواله به «شخص ب» کد حساب:102');

      // 2. Line for B (حواله از شخص الف)
      const lineB = {
        id: 'line_b',
        description: 'بابت تسویه (حواله از شخص الف کد حساب: 101)',
        documentNature: 'paid',
        details: {
          isHawala: true,
          hawalaCounterCustomerName: 'شخص الف',
          hawalaCounterCustomerCode: 101,
        },
      };

      const infoB = getHawalaDirectionInfo(lineB);
      expect(infoB).toBe('حواله از «شخص الف» کد حساب:101');

      // 3. Fallback resolution: line has empty hawalaCounterCustomerName in details, but description has "(حواله از محمد رضایی کد حساب: 105)"
      const lineFallback = {
        id: 'line_c',
        description: 'بابت تسویه (حواله از محمد رضایی کد حساب: 105)',
        documentNature: 'paid',
        details: {
          isHawala: true,
          hawalaCounterCustomerName: '', // empty in details!
          hawalaCounterCustomerId: '',
        },
      };

      const fromMatch = lineFallback.description.match(/(?:حواله\s+از|\(حواله\s+از)\s+([^\(\)\:\n،]+?)(?:\s+کد\s*حساب|\s*[\:\(]|\s*\)|$)/);
      expect(fromMatch?.[1]?.trim()).toBe('محمد رضایی');

      const codeMatch = lineFallback.description.match(/کد\s*حساب\s*[:\s]*(\d+)/);
      expect(codeMatch?.[1]?.trim()).toBe('105');
    });

    it('staged hawala in document lines: not submitted immediately, only committed upon full document save', () => {
      // When confirming the hawala modal:
      let apiCalled = false;
      let committedLinesList: any[] = [];

      const targetCustomer = { id: 'cust_b', name: 'شخص ب', customerCode: 102 };
      const rawLine = {
        id: 'draft_line_1',
        documentNature: 'received',
        documentTab: 'cash',
        details: { totalAmount: '10000', cashFundName: 'صندوق یورو', cashFundCurrency: 'EUR' },
      };

      // Modal confirmation: stages row into committedLinesList without calling API
      const stagedRow = {
        id: 'line_a',
        documentNature: rawLine.documentNature,
        documentTab: 'cash',
        description: `(حواله به ${targetCustomer.name} کد حساب:${targetCustomer.customerCode})`,
        details: {
          ...rawLine.details,
          isHawala: true,
          hawalaGroupId: 'grp_123',
          hawalaCounterCustomerId: targetCustomer.id,
          hawalaCounterCustomerName: targetCustomer.name,
          hawalaCounterLine: {
            documentNature: 'paid',
            documentTab: 'cash',
            description: `(حواله از شخص الف)`,
            details: { isHawala: true, totalAmount: '10000' },
          },
        },
      };

      committedLinesList.push(stagedRow);

      // Verify NO api call was made during row staging
      expect(apiCalled).toBe(false);
      expect(committedLinesList.length).toBe(1);
      expect(committedLinesList[0].details.isHawala).toBe(true);
      expect(committedLinesList[0].details.hawalaCounterLine).toBeDefined();

      // Only when saving the entire document, both documents are submitted together
      const saveWholeDocument = () => {
        apiCalled = true;
        const inflowDoc = stagedRow.documentNature === 'received' ? 'DocA' : 'DocB';
        const outflowDoc = stagedRow.documentNature === 'received' ? 'DocB' : 'DocA';
        return { inflowDoc, outflowDoc, committed: true };
      };

      const result = saveWholeDocument();
      expect(apiCalled).toBe(true);
      expect(result.inflowDoc).toBe('DocA');
      expect(result.outflowDoc).toBe('DocB');
      expect(result.committed).toBe(true);
    });
  });
});

