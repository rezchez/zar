import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  buildAccountTree,
  enrichAccountsWithOpeningChecks,
  enrichAccountsWithBankAndCash,
  enrichAccountsWithCoinsAndMetals,
  type ChartOfAccountRecord,
  type BankAccountEnrichmentInput,
  type CashFundEnrichmentInput,
  type CoinInventoryEnrichmentInput,
  type MetalInventoryEnrichmentInput,
} from '@/features/accounting/chart-of-accounts/services/chart-of-accounts';

describe('Zarfolio — All Opening Inventories to Chart of Accounts Hierarchy Tests', () => {
  const baseAccounts: ChartOfAccountRecord[] = DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
    ...a,
    id: a.id || `acc_${a.code}`,
  }));

  describe('1110 (موجودی نقد و بانک) — Bank Accounts & Cash Funds Enrichment', () => {
    const mockBanks: BankAccountEnrichmentInput[] = [
      {
        id: 'bank_mellat',
        bankName: 'ملت',
        branchName: 'ونک',
        accountNumber: '1122334455',
        accountCodeZero: '01',
        openingBalance: 50_000_000,
        currencySymbol: 'ریال',
        isBlocked: false,
      },
      {
        id: 'bank_melli',
        bankName: 'ملی',
        branchName: 'مرکزی',
        accountNumber: '9988776655',
        accountCodeZero: '02',
        openingBalance: 20_000_000,
        currencySymbol: 'ریال',
        isBlocked: true,
      },
    ];

    const mockCashFunds: CashFundEnrichmentInput[] = [
      {
        id: 'fund_main',
        name: 'صندوق اصلی مغازه',
        currencyName: 'ریال',
        currencyCode: 'IRR',
        currencySymbol: 'ریال',
        openingBalance: 15_000_000,
        isBlocked: false,
      },
      {
        id: 'fund_usd',
        name: 'صندوق دلاری',
        currencyName: 'دلار آمریکا',
        currencyCode: 'USD',
        currencySymbol: '$',
        openingBalance: 2_000,
        isBlocked: false,
      },
    ];

    it('enriches 1110 with banks and cash funds as Level 4 (تفضیل ۱)', () => {
      const enriched = enrichAccountsWithBankAndCash(baseAccounts, mockBanks, mockCashFunds);

      // Check banks
      const bank1 = enriched.find((a) => a.id === 'coa_bank_bank_mellat_1110');
      expect(bank1).toBeDefined();
      expect(bank1?.code).toBe('111001');
      expect(bank1?.level).toBe(4);
      expect(bank1?.parentId).toBe('sys_1110');
      expect(bank1?.name).toContain('ملت');
      expect(bank1?.name).toContain('ونک');

      const bank2 = enriched.find((a) => a.id === 'coa_bank_bank_melli_1110');
      expect(bank2).toBeDefined();
      expect(bank2?.code).toBe('111002');
      expect(bank2?.level).toBe(4);
      expect(bank2?.isActive).toBe(false); // isBlocked

      // Check cash funds
      const fund1 = enriched.find((a) => a.id === 'coa_cash_fund_main_1110');
      expect(fund1).toBeDefined();
      expect(fund1?.code).toBe('111051');
      expect(fund1?.level).toBe(4);
      expect(fund1?.parentId).toBe('sys_1110');
      expect(fund1?.name).toContain('صندوق اصلی مغازه');

      const fund2 = enriched.find((a) => a.id === 'coa_cash_fund_usd_1110');
      expect(fund2).toBeDefined();
      expect(fund2?.code).toBe('111052');
      expect(fund2?.level).toBe(4);
      expect(fund2?.isMultiCurrency).toBe(true);
    });

    it('buildAccountTree correctly nests banks and cash funds under 1110', () => {
      const enriched = enrichAccountsWithBankAndCash(baseAccounts, mockBanks, mockCashFunds);
      const tree = buildAccountTree(enriched);

      const node1000 = tree.find((n) => n.code === '1000');
      expect(node1000).toBeDefined();

      const node1100 = node1000?.children.find((n) => n.code === '1100');
      expect(node1100).toBeDefined();

      const node1110 = node1100?.children.find((n) => n.code === '1110');
      expect(node1110).toBeDefined();
      expect(node1110?.childrenCount).toBe(4); // 2 banks + 2 funds

      const bankChild = node1110?.children.find((n) => n.id === 'coa_bank_bank_mellat_1110');
      expect(bankChild).toBeDefined();
      expect(bankChild?.level).toBe(4);

      const cashChild = node1110?.children.find((n) => n.id === 'coa_cash_fund_main_1110');
      expect(cashChild).toBeDefined();
      expect(cashChild?.level).toBe(4);
    });
  });

  describe('1130 (موجودی کالا و طلا) — Coins & Bullion + Multi-Metal Enrichment', () => {
    const mockCoins: CoinInventoryEnrichmentInput[] = [
      {
        id: 'coin_bahar',
        nature: 'coin',
        coin_type: 'تمام بهار آزادی',
        itemName: 'سکه بهار آزادی طرح قدیم',
        quantity: 10,
        weight: 81.3,
        purity: 900,
        unit_price: 350_000_000,
        total_price: 3_500_000_000,
        is_opening_balance: true,
      },
      {
        id: 'bullion_100g',
        nature: 'bullion',
        coin_type: 'شمش ۱۰۰ گرمی پمپ',
        itemName: 'شمش طلا ۱۰۰ گرمی سوئیسی',
        quantity: 2,
        weight: 200,
        purity: 999.9,
        unit_price: 450_000_000,
        total_price: 900_000_000,
        is_opening_balance: true,
      },
    ];

    const mockMetals: MetalInventoryEnrichmentInput[] = [
      {
        id: 'metal_gold_cond',
        metal: 'gold',
        inventoryType: 'conditional_melted',
        rawWeight: 125.45,
        purity: 750,
        convertedWeight: 125.45,
        stampNumber: '12345',
        labName: 'عیارسنجی تهران',
        totalAmount: 500_000_000,
        is_opening_balance: true,
      },
      {
        id: 'metal_gold_misc',
        metal: 'gold',
        inventoryType: 'miscellaneous_melted',
        rawWeight: 50.12,
        purity: 735,
        convertedWeight: 49.12,
        totalAmount: 200_000_000,
        is_opening_balance: true,
      },
      {
        id: 'metal_silver_1',
        metal: 'silver',
        inventoryType: 'general_metal',
        rawWeight: 500,
        purity: 999,
        convertedWeight: 500,
        totalAmount: 50_000_000,
        is_opening_balance: true,
      },
      {
        id: 'metal_platinum_1',
        metal: 'platinum',
        inventoryType: 'general_metal',
        rawWeight: 30,
        purity: 950,
        convertedWeight: 28.5,
        totalAmount: 90_000_000,
        is_opening_balance: true,
      },
    ];

    it('enriches 1130 with coin group (Level 4) and coin items (Level 5)', () => {
      const enriched = enrichAccountsWithCoinsAndMetals(baseAccounts, mockCoins, []);

      // Coin Group (Tafsil 1)
      const coinGroup = enriched.find((a) => a.id === 'coa_group_coins_1130');
      expect(coinGroup).toBeDefined();
      expect(coinGroup?.code).toBe('113001');
      expect(coinGroup?.level).toBe(4);
      expect(coinGroup?.parentId).toBe('sys_1130');

      // Coin items (Tafsil 2)
      const coin1 = enriched.find((a) => a.id === 'coa_coin_coin_bahar');
      expect(coin1).toBeDefined();
      expect(coin1?.code).toBe('11300101');
      expect(coin1?.level).toBe(5);
      expect(coin1?.parentId).toBe('coa_group_coins_1130');
      expect(coin1?.name).toContain('سکه');

      const coin2 = enriched.find((a) => a.id === 'coa_coin_bullion_100g');
      expect(coin2).toBeDefined();
      expect(coin2?.code).toBe('11300102');
      expect(coin2?.level).toBe(5);
      expect(coin2?.parentId).toBe('coa_group_coins_1130');
      expect(coin2?.name).toContain('شمش');
    });

    it('enriches 1130 with Gold, Silver, Platinum groups (Level 4) and metal items (Level 5)', () => {
      const enriched = enrichAccountsWithCoinsAndMetals(baseAccounts, [], mockMetals);

      // Gold Group (113010)
      const goldGroup = enriched.find((a) => a.id === 'coa_group_gold_1130');
      expect(goldGroup).toBeDefined();
      expect(goldGroup?.code).toBe('113010');
      expect(goldGroup?.level).toBe(4);
      expect(goldGroup?.parentId).toBe('sys_1130');

      // Silver Group (113020)
      const silverGroup = enriched.find((a) => a.id === 'coa_group_silver_1130');
      expect(silverGroup).toBeDefined();
      expect(silverGroup?.code).toBe('113020');
      expect(silverGroup?.level).toBe(4);

      // Platinum Group (113030)
      const platinumGroup = enriched.find((a) => a.id === 'coa_group_platinum_1130');
      expect(platinumGroup).toBeDefined();
      expect(platinumGroup?.code).toBe('113030');
      expect(platinumGroup?.level).toBe(4);

      // Gold items (Level 5)
      const goldItem1 = enriched.find((a) => a.id === 'coa_metal_metal_gold_cond');
      expect(goldItem1).toBeDefined();
      expect(goldItem1?.code).toBe('11301001');
      expect(goldItem1?.level).toBe(5);
      expect(goldItem1?.parentId).toBe('coa_group_gold_1130');
      expect(goldItem1?.name).toContain('آبشده شرطی');
      expect(goldItem1?.name).toContain('12345'); // Stamp number

      const goldItem2 = enriched.find((a) => a.id === 'coa_metal_metal_gold_misc');
      expect(goldItem2).toBeDefined();
      expect(goldItem2?.code).toBe('11301002');
      expect(goldItem2?.level).toBe(5);
      expect(goldItem2?.parentId).toBe('coa_group_gold_1130');

      // Silver item (Level 5)
      const silverItem = enriched.find((a) => a.id === 'coa_metal_metal_silver_1');
      expect(silverItem).toBeDefined();
      expect(silverItem?.code).toBe('11302001');
      expect(silverItem?.level).toBe(5);
      expect(silverItem?.parentId).toBe('coa_group_silver_1130');

      // Platinum item (Level 5)
      const platItem = enriched.find((a) => a.id === 'coa_metal_metal_platinum_1');
      expect(platItem).toBeDefined();
      expect(platItem?.code).toBe('11303001');
      expect(platItem?.level).toBe(5);
      expect(platItem?.parentId).toBe('coa_group_platinum_1130');
    });

    it('buildAccountTree properly renders the 5-level hierarchy under 1130', () => {
      const enriched = enrichAccountsWithCoinsAndMetals(baseAccounts, mockCoins, mockMetals);
      const tree = buildAccountTree(enriched);

      const node1000 = tree.find((n) => n.code === '1000');
      const node1100 = node1000?.children.find((n) => n.code === '1100');
      const node1130 = node1100?.children.find((n) => n.code === '1130');
      expect(node1130).toBeDefined();

      // Under 1130: Coins (113001), Gold (113010), Silver (113020), Platinum (113030)
      expect(node1130?.childrenCount).toBe(4);

      const coinGroupNode = node1130?.children.find((n) => n.code === '113001');
      expect(coinGroupNode?.childrenCount).toBe(2); // 2 coin items

      const goldGroupNode = node1130?.children.find((n) => n.code === '113010');
      expect(goldGroupNode?.childrenCount).toBe(2); // 2 gold items

      const silverGroupNode = node1130?.children.find((n) => n.code === '113020');
      expect(silverGroupNode?.childrenCount).toBe(1); // 1 silver item

      const platGroupNode = node1130?.children.find((n) => n.code === '113030');
      expect(platGroupNode?.childrenCount).toBe(1); // 1 platinum item
    });
  });

  describe('Comprehensive Integration of All Opening Inventories in Chart of Accounts', () => {
    it('simultaneously enriches 1110, 1130, and 2110 without collisions or data loss', () => {
      const mockBanks = [
        { id: 'b1', bankName: 'سامان', accountNumber: '111', accountCodeZero: '01' },
      ];
      const mockFunds = [
        { id: 'f1', name: 'صندوق گاوصندوق', currencyName: 'ریال' },
      ];
      const mockCoins = [
        { id: 'c1', nature: 'coin', itemName: 'نیم سکه', quantity: 5, weight: 20 },
      ];
      const mockMetals = [
        { id: 'm1', metal: 'gold', inventoryType: 'conditional_melted', rawWeight: 100, stampNumber: '777' },
      ];
      const mockChecks = [
        { id: 'chk1', checkNumber: '999888', bankAccount: 'b1', amount: 50_000_000, type: 'issued' },
      ];

      // Chain all enrichments
      let accounts = enrichAccountsWithOpeningChecks(baseAccounts, mockChecks, mockBanks);
      accounts = enrichAccountsWithBankAndCash(accounts, mockBanks, mockFunds);
      accounts = enrichAccountsWithCoinsAndMetals(accounts, mockCoins, mockMetals);

      const tree = buildAccountTree(accounts);

      // Verify 1110 branch
      const node1110 = tree.find((n) => n.code === '1000')
        ?.children.find((n) => n.code === '1100')
        ?.children.find((n) => n.code === '1110');
      expect(node1110?.childrenCount).toBe(2); // Bank + Fund

      // Verify 1130 branch
      const node1130 = tree.find((n) => n.code === '1000')
        ?.children.find((n) => n.code === '1100')
        ?.children.find((n) => n.code === '1130');
      expect(node1130?.childrenCount).toBe(2); // Coins group + Gold group

      // Verify 2110 branch
      const node2110 = tree.find((n) => n.code === '2000')
        ?.children.find((n) => n.code === '2100')
        ?.children.find((n) => n.code === '2110');
      expect(node2110?.childrenCount).toBe(1); // Bank b1
      expect(node2110?.children[0]?.childrenCount).toBe(1); // Check chk1
    });
  });
});
