/**
 * Zarfolio — Realistic 5,000+ Initial Inventory Dataset Generator
 * 
 * Generates and persists >= 5,000 realistic, heterogeneous, fully-audited initial inventory
 * records directly into the development SQLite database (backend/pb_data/data.db),
 * complete with double-entry general ledger journal entries and lines.
 * 
 * Usage:
 *   cd frontend
 *   bun run seed:initial-inventory
 * 
 * Cleanup:
 *   bun run seed:initial-inventory:clean
 */

import { Database } from 'bun:sqlite';
import * as path from 'path';

// 1. Environment Safety Check (Rule 28)
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ABORTED: Seeder cannot be run in production environment!');
  process.exit(1);
}

const SEED_BATCH_ID = '__zar_seed_initial_inv_5000__';
const dbPath = path.resolve(process.cwd(), '../backend/pb_data/data.db');

console.log('================================================================================');
console.log('💎 ZARFOLIO — 5,000+ REALISTIC INITIAL INVENTORY PERSISTED SEEDER');
console.log(`📁 Target SQLite Database: ${dbPath}`);
console.log(`🏷️  Seed Batch Identifier:  ${SEED_BATCH_ID}`);
console.log('================================================================================\n');

const db = new Database(dbPath);
db.run('PRAGMA foreign_keys = OFF;'); // Speed up bulk inserts while maintaining relational IDs
db.run('PRAGMA journal_mode = WAL;');

// Helper to generate 15-char alphanumeric PocketBase IDs
function generateId(prefix = 'r'): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = prefix;
  while (result.length < 15) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Check existing user
const userRow = db.query("SELECT id FROM users ORDER BY created ASC LIMIT 1").get() as { id: string } | null;
const USER_ID = userRow?.id || 'j01hxkh9oy8lntu';

// Check existing currencies
const currencyRows = db.query("SELECT id, code FROM currencies").all() as { id: string; code: string }[];
const currencyMap: Record<string, string> = {};
for (const c of currencyRows) {
  currencyMap[c.code] = c.id;
}

// Chart of Accounts IDs
const coa1110 = (db.query("SELECT id FROM chart_of_accounts WHERE code = '1110'").get() as any)?.id || 'yidoxfgzbxpxwo7';
const coa1120 = (db.query("SELECT id FROM chart_of_accounts WHERE code = '1120'").get() as any)?.id || '6gbhqi1v7p4rsnk';
const coa1130 = (db.query("SELECT id FROM chart_of_accounts WHERE code = '1130'").get() as any)?.id || '028hgurtf0v6vzb';
const coa3100 = (db.query("SELECT id FROM chart_of_accounts WHERE code = '3100'").get() as any)?.id || 'ifi57f907hjxlv4';

// Check if seed batch already exists
const existingSeed = db.query(`
  SELECT count(*) as c FROM metal_inventory WHERE description LIKE ?
`).get(`%${SEED_BATCH_ID}%`) as { c: number };

if (existingSeed.c > 0) {
  console.log(`⚠️  Dataset with identifier ${SEED_BATCH_ID} is already present (${existingSeed.c} metal records detected).`);
  console.log('   To clean and re-run, execute: bun run seed:initial-inventory:clean\n');
  process.exit(0);
}

const startTime = performance.now();
const NOW_ISO = new Date().toISOString();
const JALALI_OPENING_DATE = '1404/01/01';

// Statements prepared for maximum execution speed
const insertCashFund = db.prepare(`
  INSERT INTO cash_funds (id, name, accountId, isActive, currency, initial_balance, balance, currency_name, code, opening_balance, current_balance, is_active, description, created_by, updated_by, created, updated)
  VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
`);

const insertBankAcc = db.prepare(`
  INSERT INTO bank_accounts (id, bankName, branchName, accountNumber, shebaNumber, balance, currency, accountId, createdBy, updatedBy, created, updated)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertCashTx = db.prepare(`
  INSERT INTO cash_transactions (id, currency_ref, currency_symbol, currency_name, transaction_type, is_opening_balance, created_by, date, direction, vault, amount, currency, source_key, description, created, updated)
  VALUES (?, ?, ?, ?, 'opening_balance', 1, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?)
`);

const insertBankTx = db.prepare(`
  INSERT INTO bank_transactions (id, bank_account, amount, currency, direction, transaction_type, is_opening_balance, source_key, date, description, created_by, created, updated)
  VALUES (?, ?, ?, ?, 'in', 'opening_balance', 1, ?, ?, ?, ?, ?, ?)
`);

const insertMetal = db.prepare(`
  INSERT INTO metal_inventory (id, metal, inventory_type, metal_type, purity, base_karat, raw_weight, converted_weight, unit_price, total_amount, lab_name, stamp_number, direction, transaction_type, is_opening_balance, date, description, created_by, updated_by, created, updated)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in', 'opening_balance', 1, ?, ?, ?, ?, ?, ?)
`);

const insertCoin = db.prepare(`
  INSERT INTO coin_inventory (id, item_name, item_type, metal, nature, quantity, unit_weight, total_weight, purity, converted_weight, unit_price, total_amount, direction, transaction_type, date, description, created, updated)
  VALUES (?, ?, 'coin', 'gold', 'minted', ?, ?, ?, ?, ?, ?, ?, 'in', 'opening_balance', ?, ?, ?, ?)
`);

const insertWorkmanship = db.prepare(`
  INSERT INTO workmanship_inventory (id, code, name, metal, purity, base_karat, raw_weight, converted_weight, quantity, wage_mode, wage, total_wage, metal_price, total_amount, is_opening_balance, transaction_type, date, description, created_by, updated_by, created, updated)
  VALUES (?, ?, ?, 'gold', ?, 750, ?, ?, 1, ?, ?, ?, ?, ?, 1, 'opening_balance', ?, ?, ?, ?, ?, ?)
`);

const insertGemstone = db.prepare(`
  INSERT INTO gemstone_inventory (
    id, inventory_code, inventory_mode, root_category, gemstone_type, shape, cut_grade,
    diamond_color_grade, diamond_clarity_grade, growth_method, origin_country, size_unit,
    color_range_label, clarity_range_label, pool_identity_key, quantity, weight_ct, weight_g,
    unit_price, total_amount, currency, certificate_lab, report_number, has_certificate,
    is_opening_balance, description, created_by, updated_by, created, updated
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
`);

const insertGemTx = db.prepare(`
  INSERT INTO gemstone_inventory_transactions (
    id, gemstone, transaction_type, direction, quantity, weight_ct, weight_g, unit_price, total_amount,
    weighted_avg_cost_at_tx, source_key, date, notes, created_by, created
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertGoods = db.prepare(`
  INSERT INTO goods_inventory (
    id, sku, item_name, goods_type, category, unit, quantity, unit_price, total_amount,
    is_opening_balance, date, description, created_by, updated_by, created, updated
  )
  VALUES (?, ?, ?, 'resin_casting', 'resin_casting', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
`);

const insertCheck = db.prepare(`
  INSERT INTO checks (
    id, chequeType, check_number, sayadId, amount, currency, issueDate, issueDateJalali,
    dueDate, dueDateJalali, bankAccount, status, is_opening_balance, description,
    created_by, updated_by
  )
  VALUES (?, 'receivable', ?, ?, ?, 'IRR', '2026-03-21', ?, '2026-06-21', '1404/04/01', ?, 'in_hand', 1, ?, ?, ?)
`);

const insertJournalEntry = db.prepare(`
  INSERT INTO journal_entries (
    id, entryNumber, entryDate, entryDateJalali, description, sourceType, sourceId,
    sourceKey, status, totalDebit, totalCredit, createdBy, updatedBy, created, updated
  )
  VALUES (?, ?, '2026-03-21', ?, ?, ?, ?, ?, 'posted', ?, ?, ?, ?, ?, ?)
`);

const insertJournalLine = db.prepare(`
  INSERT INTO journal_lines (
    id, journal_entry_id, account_id, debit, credit, description, created, updated
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

function postJournal(
  id: string,
  entryNumber: string,
  desc: string,
  sourceType: string,
  sourceId: string,
  sourceKey: string,
  debitAccount: string,
  creditAccount: string,
  amount: number
) {
  const rounded = Math.round(Math.abs(amount));
  if (rounded <= 0) return;

  const jId = generateId();
  insertJournalEntry.run(
    jId,
    entryNumber,
    JALALI_OPENING_DATE,
    `${desc} [${SEED_BATCH_ID}]`,
    sourceType,
    sourceId,
    sourceKey,
    rounded,
    rounded,
    USER_ID,
    USER_ID,
    NOW_ISO,
    NOW_ISO
  );

  insertJournalLine.run(generateId(), jId, debitAccount, rounded, 0, desc, NOW_ISO, NOW_ISO);
  insertJournalLine.run(generateId(), jId, creditAccount, 0, rounded, 'سرمایه اولیه', NOW_ISO, NOW_ISO);
}

// ==============================================================================
// 2. BULK SEED EXECUTION
// ==============================================================================

db.transaction(() => {
  console.log('⏳ 1/11 Seeding Cash Funds & Bank Accounts (300 records)...');
  // 4 Cash Funds (USD, AED, IRT, IRR - EUR and GBP already exist in database)
  const remainingCurrencies = [
    { code: 'USD', name: 'صندوق دلار آمریکا', bal: 25000 },
    { code: 'AED', name: 'صندوق درهم امارات', bal: 85000 },
    { code: 'IRT', name: 'صندوق تومان', bal: 1500000000 },
    { code: 'IRR', name: 'صندوق ریال ایران', bal: 18000000000 },
  ];

  for (const c of remainingCurrencies) {
    const currId = currencyMap[c.code];
    if (currId) {
      const fundId = `cf_${generateId().slice(3)}`;
      insertCashFund.run(
        fundId,
        `${c.name} [${SEED_BATCH_ID}]`,
        coa1110,
        currId,
        c.bal,
        c.bal,
        c.code,
        `CASH-${c.code}`,
        c.bal,
        c.bal,
        `موجودی اولیه صندوق ${c.code} [${SEED_BATCH_ID}]`,
        USER_ID,
        USER_ID,
        NOW_ISO,
        NOW_ISO
      );

      insertCashTx.run(
        generateId(),
        c.code,
        c.code,
        c.code,
        USER_ID,
        JALALI_OPENING_DATE,
        fundId,
        c.bal,
        c.code,
        `opening:cash:${fundId}`,
        `تراکنش موجودی اول دوره صندوق ${c.code} [${SEED_BATCH_ID}]`,
        NOW_ISO,
        NOW_ISO
      );
    }
  }

  // 296 Bank Accounts
  const banks = [
    'ملت', 'ملی', 'صادرات', 'تجارت', 'سامان', 'پاسارگاد', 'پارسیان', 'سپه',
    'رفاه کارگران', 'کشاورزی', 'آینده', 'شهر', 'سینا', 'دی', 'کارآفرین', 'پست بانک'
  ];
  const branches = ['بازار بزرگ', 'کریمخان', 'تجریش', 'فردوسی', 'سعدی', 'انقلاب', 'ونک', 'جردن', 'لاله‌زار', 'میرداماد'];
  const currs = ['IRR', 'IRT', 'USD', 'EUR', 'AED'];

  for (let i = 1; i <= 296; i++) {
    const bank = banks[i % banks.length];
    const branch = branches[i % branches.length];
    const curr = currs[i % currs.length];
    const accId = `bnk_${generateId().slice(4)}`;
    const accNumber = `603799${String(2000000000 + i)}`;
    const sheba = `IR${String(100000000000000000000000 + i)}`;
    const balance = (i * 25000000) + 100000000;

    insertBankAcc.run(
      accId,
      `بانک ${bank} [${SEED_BATCH_ID}]`,
      branch,
      accNumber,
      sheba,
      balance,
      curr,
      coa1110,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    insertBankTx.run(
      generateId(),
      accId,
      balance,
      curr,
      `opening:bank:${accId}`,
      JALALI_OPENING_DATE,
      `افتتاحیه حساب بانک ${bank} شعبه ${branch} [${SEED_BATCH_ID}]`,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      accId,
      `JRN-BNK-${i}`,
      `سند افتتاحیه بانک ${bank} شعبه ${branch}`,
      'opening_bank',
      accId,
      `opening:bank:${accId}`,
      coa1110,
      coa3100,
      balance
    );
  }

  console.log('⏳ 2/11 Seeding Metal Inventory (500 records)...');
  // 500 Metal records (Gold, Silver, Platinum scrap & grain)
  const metals = ['gold', 'silver', 'platinum'];
  for (let i = 1; i <= 500; i++) {
    const metal = metals[i % metals.length];
    const purity = metal === 'gold' ? (740 + (i % 25)) : metal === 'silver' ? (925 + (i % 74)) : (800 + (i % 199));
    const baseKarat = metal === 'gold' ? 750 : metal === 'silver' ? 999 : 950;
    const rawWeight = Math.round((5 + (i * 1.35)) * 1000) / 1000;
    const convertedWeight = Math.round(((rawWeight * purity) / baseKarat) * 1000) / 1000;
    const unitPrice = metal === 'gold' ? 45500000 : metal === 'silver' ? 950000 : 38000000;
    const totalAmount = Math.round(convertedWeight * unitPrice);
    const id = `met_${generateId().slice(4)}`;

    insertMetal.run(
      id,
      metal,
      'raw',
      'scrap',
      purity,
      baseKarat,
      rawWeight,
      convertedWeight,
      unitPrice,
      totalAmount,
      '',
      '',
      JALALI_OPENING_DATE,
      `موجودی اولیه فلز ${metal} عیار ${purity} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-MET-${i}`,
      `سند افتتاحیه موجودی فلزات ${metal}`,
      'opening_metal',
      id,
      `opening:metal:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  console.log('⏳ 3/11 Seeding Melted Gold (500 records)...');
  // 500 Melted gold records
  const labs = [
    'ری‌گیری زرین', 'عیارسنجی طهران', 'آزمایشگاه عیار دقیق', 'ری‌گیری اعتماد', 'ری‌گیری فردوسی',
    'ری‌گیری تابش', 'ری‌گیری شمس', 'ری‌گیری پارس', 'عیارسنجی مرکزی', 'ری‌گیری کیمیا'
  ];
  for (let i = 1; i <= 500; i++) {
    const lab = labs[i % labs.length];
    const stamp = `ENG-${30000 + i}`;
    const purity = 735 + (i % 31); // 735 to 765
    const rawWeight = Math.round((15 + (i * 1.85)) * 1000) / 1000;
    const convertedWeight = Math.round(((rawWeight * purity) / 750) * 1000) / 1000;
    const unitPrice = 46200000;
    const totalAmount = Math.round(convertedWeight * unitPrice);
    const id = `mlt_${generateId().slice(4)}`;

    insertMetal.run(
      id,
      'gold',
      'conditional_melted',
      'melted_bar',
      purity,
      750,
      rawWeight,
      convertedWeight,
      unitPrice,
      totalAmount,
      lab,
      stamp,
      JALALI_OPENING_DATE,
      `طلای آبشده انگ ${stamp} آزمایشگاه ${lab} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-MLT-${i}`,
      `سند افتتاحیه طلای آبشده انگ ${stamp}`,
      'opening_metal',
      id,
      `opening:metal:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  console.log('⏳ 4/11 Seeding Coins (400 records)...');
  // 400 Coins
  const coinTemplates = [
    { name: 'تمام بهار آزادی طرح جدید (امامی)', weight: 8.133, purity: 900 },
    { name: 'تمام بهار آزادی طرح قدیم', weight: 8.133, purity: 900 },
    { name: 'نیم بهار آزادی', weight: 4.066, purity: 900 },
    { name: 'ربع بهار آزادی', weight: 2.033, purity: 900 },
    { name: 'سکه یک گرمی بانک مرکزی', weight: 1.018, purity: 900 },
    { name: 'سکه پارسیان ۱ گرمی', weight: 1.000, purity: 750 },
    { name: 'سکه پارسیان ۲ گرمی', weight: 2.000, purity: 750 },
  ];
  for (let i = 1; i <= 400; i++) {
    const tmpl = coinTemplates[i % coinTemplates.length];
    const qty = (i % 15) + 1;
    const mintYear = 1386 + (i % 18);
    const totalWeight = Math.round(qty * tmpl.weight * 1000) / 1000;
    const convertedWeight = Math.round(((totalWeight * tmpl.purity) / 750) * 1000) / 1000;
    const unitPrice = tmpl.weight >= 8 ? 535000000 : tmpl.weight >= 4 ? 285000000 : 175000000;
    const totalAmount = qty * unitPrice;
    const id = `cin_${generateId().slice(4)}`;

    insertCoin.run(
      id,
      `${tmpl.name} ضرب ${mintYear}`,
      qty,
      tmpl.weight,
      totalWeight,
      tmpl.purity,
      convertedWeight,
      unitPrice,
      totalAmount,
      JALALI_OPENING_DATE,
      `موجودی اول دوره ${tmpl.name} تعداد ${qty} [${SEED_BATCH_ID}]`,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-CIN-${i}`,
      `سند افتتاحیه مسکوکات ${tmpl.name}`,
      'opening_coin',
      id,
      `opening:coin:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  console.log('⏳ 5/11 Seeding Standard Bars (300 records)...');
  // 300 Standard Minted Bars
  const barBrands = ['PAMP Suisse', 'Valcambi', 'Argor-Heraeus', 'Emirates Gold', 'شمش پارسیان', 'شمش کارگشایی', 'Heraeus', 'Umicore'];
  const barWeights = [1, 2.5, 5, 10, 20, 31.103, 50, 100, 250, 500, 1000];
  for (let i = 1; i <= 300; i++) {
    const brand = barBrands[i % barBrands.length];
    const size = barWeights[i % barWeights.length];
    const purity = i % 3 === 0 ? 995 : i % 3 === 1 ? 999 : 999.9;
    const rawWeight = size;
    const convertedWeight = Math.round(((rawWeight * purity) / 750) * 1000) / 1000;
    const unitPrice = Math.round(convertedWeight * 47500000);
    const id = `bar_${generateId().slice(4)}`;
    const serial = `TEST-${brand.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '')}-${50000 + i}`;

    insertMetal.run(
      id,
      'gold',
      'bar',
      'minted_bar',
      purity,
      750,
      rawWeight,
      convertedWeight,
      unitPrice,
      unitPrice,
      brand,
      serial,
      JALALI_OPENING_DATE,
      `شمش ${size} گرمی ${brand} سریال ${serial} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-BAR-${i}`,
      `سند افتتاحیه شمش طلا ${brand}`,
      'opening_metal',
      id,
      `opening:metal:${id}`,
      coa1130,
      coa3100,
      unitPrice
    );
  }

  console.log('⏳ 6/11 Seeding Workmanship / Jewelry (500 records)...');
  // 500 Workmanship records
  const jewelryTypes = [
    'سرویس کامل برلیان', 'نیم‌ست گل رز', 'انگشتر تک‌نگین سالیتر', 'دستبند النگویی کارتیه',
    'النگو دامله سایز ۲', 'گردنبند تنیسی', 'گوشواره آویز فانتزی', 'پلاک و زنجیر ونکلیف',
    'دستبند زنجیری فیگارو', 'انگشتر فیوژن تراش‌خورده', 'زنجیر کارتیه سنگین'
  ];
  for (let i = 1; i <= 500; i++) {
    const jType = jewelryTypes[i % jewelryTypes.length];
    const rawWeight = Math.round((3.5 + (i * 0.45)) * 1000) / 1000;
    const convertedWeight = rawWeight;
    const wageMode = i % 3 === 0 ? 'percentage' : i % 3 === 1 ? 'per_gram' : 'fixed_rial';
    const wage = wageMode === 'percentage' ? (10 + (i % 18)) : wageMode === 'per_gram' ? (250000 + (i * 5000)) : (1500000 + (i * 50000));
    const metalPrice = 46000000;
    let totalWage = 0;
    if (wageMode === 'percentage') {
      totalWage = Math.round((rawWeight * metalPrice * wage) / 100);
    } else if (wageMode === 'per_gram') {
      totalWage = Math.round(rawWeight * wage);
    } else {
      totalWage = Math.round(wage);
    }
    const totalAmount = Math.round(rawWeight * metalPrice) + totalWage;
    const id = `wrk_${generateId().slice(4)}`;

    insertWorkmanship.run(
      id,
      `JWL-${String(i).padStart(4, '0')}`,
      `${jType} کد ${i}`,
      750,
      rawWeight,
      convertedWeight,
      wageMode,
      wage,
      totalWage,
      metalPrice,
      totalAmount,
      JALALI_OPENING_DATE,
      `موجودی اول دوره مصنوعات ساخته‌شده ${jType} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-WRK-${i}`,
      `سند افتتاحیه مصنوعات ${jType}`,
      'opening_workmanship',
      id,
      `opening:workmanship:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  console.log('⏳ 7/11 Seeding Natural Diamonds & Colored Stones (1,200 records)...');
  // 1,200 Natural Stones: 700 Diamonds + 500 Colored
  const shapes = ['round', 'princess', 'emerald', 'oval', 'marquise', 'cushion', 'pear', 'radiant', 'heart', 'baguette'];
  const diaColors = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  const diaClarities = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'];

  // 700 Natural Diamonds
  for (let i = 1; i <= 700; i++) {
    const shape = shapes[i % shapes.length];
    const color = diaColors[i % diaColors.length];
    const clarity = diaClarities[i % diaClarities.length];
    const weightCt = Math.round((0.20 + (i * 0.007)) * 100) / 100;
    const weightG = Math.round((weightCt * 0.2) * 1000) / 1000;
    const unitPrice = (1200 + (i * 20)) * 1000000;
    const totalAmount = Math.round(weightCt * unitPrice);
    const certLab = i % 3 === 0 ? 'GIA' : i % 3 === 1 ? 'HRD' : 'IGI';
    const reportNum = `TEST-${certLab}-${100000 + i}`;
    const id = `gem_nat_${generateId().slice(8)}`;

    insertGemstone.run(
      id,
      `DIA-NAT-${String(i).padStart(4, '0')}`,
      'single',
      'natural',
      'diamond',
      shape,
      'excellent',
      color,
      clarity,
      '',
      'South Africa',
      'ct',
      '',
      '',
      '',
      1,
      weightCt,
      weightG,
      unitPrice,
      totalAmount,
      'IRR',
      certLab,
      reportNum,
      1,
      `الماس طبیعی شناسنامه‌دار ${certLab} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-GEM-${i}`,
      `سند افتتاحیه الماس طبیعی ${reportNum}`,
      'opening_gemstone',
      id,
      `opening:gemstone:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  // 500 Colored Natural Stones
  const coloredList = [
    { type: 'ruby', name: 'یاقوت سرخ برمه', origin: 'Burma' },
    { type: 'ruby', name: 'یاقوت سرخ موزامبیک', origin: 'Mozambique' },
    { type: 'sapphire', name: 'یاقوت کبود سیلان', origin: 'Ceylon' },
    { type: 'sapphire', name: 'یاقوت کبود ماداگاسکار', origin: 'Madagascar' },
    { type: 'emerald', name: 'زمرد کلمبیا اصل', origin: 'Colombia' },
    { type: 'emerald', name: 'زمرد پنجشیر افغانستان', origin: 'Panjshir' },
    { type: 'spinel', name: 'لعل بدخشان', origin: 'Tajikistan' },
    { type: 'turquoise', name: 'فیروزه شجری نیشابور', origin: 'Iran' },
    { type: 'turquoise', name: 'فیروزه عجمی نیشابور', origin: 'Iran' },
    { type: 'tanzanite', name: 'تانزانیت آفریقا', origin: 'Tanzania' },
    { type: 'tourmaline', name: 'تورمالین هندوانه‌ای', origin: 'Brazil' },
    { type: 'topaz', name: 'توپاز لندن بلو اصل', origin: 'Brazil' },
  ];
  for (let i = 1; i <= 500; i++) {
    const cStone = coloredList[i % coloredList.length];
    const weightCt = Math.round((1.20 + (i * 0.04)) * 100) / 100;
    const weightG = Math.round((weightCt * 0.2) * 1000) / 1000;
    const unitPrice = (800 + (i * 15)) * 1000000;
    const totalAmount = Math.round(weightCt * unitPrice);
    const id = `gem_col_${generateId().slice(8)}`;

    insertGemstone.run(
      id,
      `COL-${String(i).padStart(4, '0')}`,
      'single',
      'natural',
      cStone.type,
      'oval',
      'very_good',
      '',
      '',
      '',
      cStone.origin,
      'ct',
      '',
      '',
      '',
      1,
      weightCt,
      weightG,
      unitPrice,
      totalAmount,
      'IRR',
      'شناسنامه داخلی',
      `CERT-COL-${50000 + i}`,
      1,
      `سنگ رنگی طبیعی ${cStone.name} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-COL-${i}`,
      `سند افتتاحیه گوهر ${cStone.name}`,
      'opening_gemstone',
      id,
      `opening:gemstone:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  console.log('⏳ 8/11 Seeding Laboratory, Synthetic & Simulant Stones (400 records)...');
  // 400 Laboratory Stones: 250 Lab Diamonds (125 CVD + 125 HPHT) + 100 Synthetics + 50 Simulants
  for (let i = 1; i <= 250; i++) {
    const method = i % 2 === 0 ? 'CVD' : 'HPHT';
    const weightCt = Math.round((0.50 + (i * 0.015)) * 100) / 100;
    const weightG = Math.round((weightCt * 0.2) * 1000) / 1000;
    const unitPrice = 450000000;
    const totalAmount = Math.round(weightCt * unitPrice);
    const id = `gem_lab_${generateId().slice(8)}`;
    const reportNum = `TEST-IGI-LG-${70000 + i}`;

    insertGemstone.run(
      id,
      `DIA-LAB-${String(i).padStart(4, '0')}`,
      'single',
      'laboratory_grown',
      'diamond',
      'round',
      'ideal',
      'E',
      'VS1',
      method,
      'Laboratory Grown',
      'ct',
      '',
      '',
      '',
      1,
      weightCt,
      weightG,
      unitPrice,
      totalAmount,
      'IRR',
      'IGI',
      reportNum,
      1,
      `الماس آزمایشگاهی سنتتیک ${method} شناسنامه ${reportNum} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-LAB-${i}`,
      `سند افتتاحیه الماس آزمایشگاهی ${method}`,
      'opening_gemstone',
      id,
      `opening:gemstone:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  // 100 Synthetics (Hydrothermal Ruby, Emerald, etc.)
  for (let i = 1; i <= 100; i++) {
    const weightCt = Math.round((2.0 + (i * 0.05)) * 100) / 100;
    const weightG = Math.round((weightCt * 0.2) * 1000) / 1000;
    const unitPrice = 15000000;
    const totalAmount = Math.round(weightCt * unitPrice);
    const id = `gem_syn_${generateId().slice(8)}`;

    insertGemstone.run(
      id,
      `SYN-${String(i).padStart(4, '0')}`,
      'single',
      'synthetic',
      'ruby',
      'cushion',
      'good',
      '',
      '',
      'Hydrothermal',
      'Synthetic Lab',
      'ct',
      '',
      '',
      '',
      1,
      weightCt,
      weightG,
      unitPrice,
      totalAmount,
      'IRR',
      '',
      '',
      0,
      `یاقوت هیدروترمال سنتتیک آزمایشگاهی [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );
  }

  // 50 Simulants (Cubic Zirconia CZ)
  for (let i = 1; i <= 50; i++) {
    const weightCt = Math.round((2.5 + (i * 0.1)) * 100) / 100;
    const weightG = Math.round((weightCt * 0.2) * 1000) / 1000;
    const unitPrice = 5000000;
    const totalAmount = Math.round(weightCt * unitPrice);
    const id = `gem_cz_${generateId().slice(8)}`;

    insertGemstone.run(
      id,
      `SIM-CZ-${String(i).padStart(4, '0')}`,
      'single',
      'simulant',
      'cubic_zirconia',
      'round',
      'good',
      '',
      '',
      '',
      'Factory Produced',
      'ct',
      '',
      '',
      '',
      1,
      weightCt,
      weightG,
      unitPrice,
      totalAmount,
      'IRR',
      '',
      '',
      0,
      `نگین اتمی زیرکونیا مکعبی CZ - بدل غیرالماس [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );
  }

  console.log('⏳ 9/11 Seeding Melee Parcels & Inbound Lots (300 records)...');
  // 300 Melee Parcels
  const sieves = ['+000-00', '+00-0', '+0-1', '+1-2', '+2-3', '+3-4', '+4-5', '+5-6', '+6.5-7'];
  const pColors = ['D-F', 'G-H', 'I-J'];
  const pClarities = ['VVS-VS', 'VS-SI', 'SI-I'];
  for (let i = 1; i <= 300; i++) {
    const sieve = sieves[i % sieves.length];
    const cRange = pColors[i % pColors.length];
    const clRange = pClarities[i % pClarities.length];
    const pieces = 30 + (i * 4);
    const weightCt = Math.round((pieces * 0.02) * 100) / 100;
    const weightG = Math.round((weightCt * 0.2) * 1000) / 1000;
    const unitPrice = (750 + (i * 10)) * 1000000;
    const totalAmount = Math.round(weightCt * unitPrice);
    const poolKey = `POOL:MELEE:round:${cRange}:${clRange}:${sieve}`;
    const id = `gem_prc_${generateId().slice(8)}`;

    insertGemstone.run(
      id,
      `MELEE-${String(i).padStart(4, '0')}`,
      'parcel',
      'natural',
      'diamond',
      'round',
      '',
      '',
      '',
      '',
      'India Cutting',
      sieve,
      cRange,
      clRange,
      poolKey,
      pieces,
      weightCt,
      weightG,
      unitPrice,
      totalAmount,
      'IRR',
      '',
      '',
      0,
      `بارخانه برلیان ریز غربال ${sieve} رنگ ${cRange} پاکی ${clRange} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    // Initial lot transaction
    insertGemTx.run(
      generateId(),
      id,
      'opening_balance',
      'in',
      pieces,
      weightCt,
      weightG,
      unitPrice,
      totalAmount,
      unitPrice,
      `opening:gemstone:${id}`,
      JALALI_OPENING_DATE,
      `ورود اولیه بارخانه برلیان [${SEED_BATCH_ID}]`,
      USER_ID,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-PRC-${i}`,
      `سند افتتاحیه بارخانه برلیان ${poolKey}`,
      'opening_gemstone',
      id,
      `opening:gemstone:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  console.log('⏳ 10/11 Seeding Goods - Resin (300 records)...');
  // 300 Resin Goods records (Strictly resin_casting)
  const resinTypes = [
    'رزین قالب‌گیری مستقیم مومی Castable Wax Pro',
    'رزین ریخته‌گری دقیق فوتوپلیمر UltraCast Jewelry',
    'رزین طلای زرد با خاکستر صفر ZeroAsh Gold Polymer',
    'رزین ریخته‌گری موم بنفش پرینتر ۳ بعدی Violet 3D Cast',
    'رزین مومی سخت‌شونده با دقت میکرونی Hi-Detail Wax'
  ];
  for (let i = 1; i <= 300; i++) {
    const rName = resinTypes[i % resinTypes.length];
    const unit = i % 2 === 0 ? 'g' : 'kg';
    const qty = unit === 'g' ? (250 + (i * 25)) : (1 + (i * 0.05));
    const unitPrice = unit === 'g' ? 14000 : 14000000;
    const totalAmount = Math.round(qty * unitPrice);
    const sku = `RSN-CAST-${String(i).padStart(4, '0')}`;
    const id = `rsn_${generateId().slice(4)}`;

    insertGoods.run(
      id,
      sku,
      `${rName} (بچ ${i})`,
      unit,
      qty,
      unitPrice,
      totalAmount,
      JALALI_OPENING_DATE,
      `موجودی اول دوره رزین ریخته‌گری کارگاه طلاسازی [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID,
      NOW_ISO,
      NOW_ISO
    );

    postJournal(
      id,
      `JRN-RSN-${i}`,
      `سند افتتاحیه رزین ریخته‌گری SKU ${sku}`,
      'opening_goods',
      id,
      `opening:goods:${id}`,
      coa1130,
      coa3100,
      totalAmount
    );
  }

  console.log('⏳ 11/11 Seeding Additional Dependent Records (300 records)...');
  // 150 Additional receipt lot transactions for Melee Parcels
  const sampleParcels = db.query(`
    SELECT id, quantity, weight_ct, unit_price FROM gemstone_inventory
    WHERE inventory_mode = 'parcel' AND description LIKE ? LIMIT 150
  `).all(`%${SEED_BATCH_ID}%`) as any[];

  for (let i = 0; i < sampleParcels.length; i++) {
    const p = sampleParcels[i];
    const addPcs = 10 + (i * 2);
    const addCt = Math.round((addPcs * 0.02) * 100) / 100;
    const addG = Math.round((addCt * 0.2) * 1000) / 1000;
    const addUnitPrice = p.unit_price * 1.05;
    const addTotal = Math.round(addCt * addUnitPrice);

    insertGemTx.run(
      generateId(),
      p.id,
      'lot_receipt',
      'in',
      addPcs,
      addCt,
      addG,
      addUnitPrice,
      addTotal,
      addUnitPrice,
      `lot_receipt:gemstone:${p.id}:${i + 1}`,
      JALALI_OPENING_DATE,
      `رسید پارت تکمیلی بارخانه برلیان [${SEED_BATCH_ID}]`,
      USER_ID,
      NOW_ISO
    );
  }

  // 150 Opening Checks in `checks`
  const checkBanks = ['ملت', 'ملی', 'صادرات', 'تجارت', 'سامان', 'پاسارگاد'];
  for (let i = 1; i <= 150; i++) {
    const b = checkBanks[i % checkBanks.length];
    const chkNum = `CHK-1404-${String(i).padStart(3, '0')}`;
    const sayad = `1200${String(100000000000 + i)}`;
    const amount = (i * 15000000) + 50000000;
    const id = `chk_${generateId().slice(4)}`;

    insertCheck.run(
      id,
      chkNum,
      sayad,
      amount,
      JALALI_OPENING_DATE,
      `بانک ${b}`,
      `چک دریافتنی اول دوره شماره ${chkNum} [${SEED_BATCH_ID}]`,
      USER_ID,
      USER_ID
    );

    postJournal(
      id,
      `JRN-CHK-${i}`,
      `سند افتتاحیه چک دریافتنی صیاد ${sayad}`,
      'opening_check',
      id,
      `opening:check:${id}`,
      coa1120,
      coa3100,
      amount
    );
  }
})();

const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
console.log(`\n✨ Seeding transaction successfully committed to data.db in ${elapsedSec}s!`);

// ==============================================================================
// 3. VERIFICATION & FINAL REPORT
// ==============================================================================

const qCount = (tbl: string, condition = `description LIKE '%${SEED_BATCH_ID}%'`) => {
  const row = db.query(`SELECT count(*) as c FROM ${tbl} WHERE ${condition}`).get() as any;
  return row?.c || 0;
};

const cashFundCount = qCount('cash_funds');
const bankAccCount = qCount('bank_accounts', `bankName LIKE '%${SEED_BATCH_ID}%'`);
const rawMetalsCount = qCount('metal_inventory', `inventory_type = 'raw' AND description LIKE '%${SEED_BATCH_ID}%'`);
const meltedCount = qCount('metal_inventory', `inventory_type = 'conditional_melted' AND description LIKE '%${SEED_BATCH_ID}%'`);
const barsCount = qCount('metal_inventory', `inventory_type = 'bar' AND description LIKE '%${SEED_BATCH_ID}%'`);
const coinsCount = qCount('coin_inventory');
const workmanshipCount = qCount('workmanship_inventory');
const naturalGemsCount = qCount('gemstone_inventory', `root_category = 'natural' AND inventory_mode = 'single' AND description LIKE '%${SEED_BATCH_ID}%'`);
const labGemsCount = qCount('gemstone_inventory', `root_category IN ('laboratory_grown', 'synthetic', 'simulant') AND description LIKE '%${SEED_BATCH_ID}%'`);
const parcelsCount = qCount('gemstone_inventory', `inventory_mode = 'parcel' AND description LIKE '%${SEED_BATCH_ID}%'`);
const resinCount = qCount('goods_inventory');
const gemTxCount = qCount('gemstone_inventory_transactions', `notes LIKE '%${SEED_BATCH_ID}%'`);
const checksCount = qCount('checks');

const totalInventoryRecords =
  cashFundCount + bankAccCount + rawMetalsCount + meltedCount + barsCount +
  coinsCount + workmanshipCount + naturalGemsCount + labGemsCount +
  parcelsCount + resinCount + gemTxCount + checksCount;

// Accounting verification
const journalEntryCount = qCount('journal_entries');
const journalLineCount = db.query(`
  SELECT count(*) as c FROM journal_lines
  WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE description LIKE ?)
`).get(`%${SEED_BATCH_ID}%`) as any;

// Integrity checks
const duplicateKeys = db.query(`
  SELECT sourceKey, count(*) as c FROM journal_entries
  WHERE description LIKE ?
  GROUP BY sourceKey HAVING c > 1
`).all(`%${SEED_BATCH_ID}%`);

const orphanLines = db.query(`
  SELECT count(*) as c FROM journal_lines
  WHERE journal_entry_id NOT IN (SELECT id FROM journal_entries)
`).get() as any;

const unbalancedEntries = db.query(`
  SELECT count(*) as c FROM journal_entries
  WHERE description LIKE ? AND totalDebit != totalCredit
`).get(`%${SEED_BATCH_ID}%`) as any;

console.log('================================================================================');
console.log('📊 ZARFOLIO INITIAL INVENTORY SEED REPORT (PERSISTED DATA)');
console.log('================================================================================');
console.log(`Cash Funds & Bank Accounts:     ${cashFundCount + bankAccCount} (${cashFundCount} funds + ${bankAccCount} bank accounts)`);
console.log(`Raw Metals & Scrap:             ${rawMetalsCount}`);
console.log(`Melted Gold (آبشده):            ${meltedCount}`);
console.log(`Coins (مسکوکات):                ${coinsCount}`);
console.log(`Standard Minted Bars (شمش):     ${barsCount}`);
console.log(`Workmanship (مصنوعات):          ${workmanshipCount}`);
console.log(`Natural Diamonds & Colored:     ${naturalGemsCount}`);
console.log(`Laboratory & Synthetic Stones:  ${labGemsCount}`);
console.log(`Melee Diamond Parcels:          ${parcelsCount}`);
console.log(`Resin Goods (رزین ریخته‌گری):   ${resinCount}`);
console.log(`Dependent Lots & Checks:        ${gemTxCount + checksCount} (${gemTxCount} lot txs + ${checksCount} opening checks)`);
console.log('--------------------------------------------------------------------------------');
console.log(`TOTAL SEEDED OPENING RECORDS:   ${totalInventoryRecords}`);
console.log('--------------------------------------------------------------------------------');
console.log(`General Ledger Journal Entries: ${journalEntryCount}`);
console.log(`General Ledger Journal Lines:   ${journalLineCount.c}`);
console.log('--------------------------------------------------------------------------------');
console.log(`Duplicate sourceKey:            ${duplicateKeys.length}`);
console.log(`Orphan Journal Lines:           ${orphanLines.c}`);
console.log(`Debit/Credit Mismatches:        ${unbalancedEntries.c}`);
console.log('================================================================================\n');

db.close();
