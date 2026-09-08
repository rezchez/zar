import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { postCashOpeningBalance } from '@/lib/accounting-posting-engine';
import { ensureCashFundDetailInChart } from '@/lib/chart-of-accounts';
import { dateToJalaliString } from '@/lib/jalali';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

type PbRecord = Record<string, unknown>;

interface CashFundRecord extends PbRecord {
  id: string;
  name?: string;
  currency?: string;
  currency_name?: string;
  opening_balance?: number;
  balance?: number;
  accountId?: string;
  created?: string;
  expand?: {
    currency?: {
      id?: string;
      name?: string;
      code?: string;
      symbol?: string;
    };
    accountId?: {
      id?: string;
    };
  };
}

interface CashTxRecord extends PbRecord {
  id: string;
  vault?: string;
  source_key?: string;
  currency_ref?: string;
  currency?: string;
  currency_name?: string;
  currency_symbol?: string;
  amount?: number;
  date?: string;
  description?: string;
  created?: string;
}

interface CurrencyRecord extends PbRecord {
  id: string;
  name?: string;
  code?: string;
  symbol?: string;
}

function extractPbErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const response = errObj.response as Record<string, unknown> | undefined;
    const responseData = (response?.data || errObj.data) as Record<string, unknown> | undefined;
    if (responseData && typeof responseData === 'object') {
      const fieldErrors: string[] = [];
      for (const [key, val] of Object.entries(responseData)) {
        if (val && typeof val === 'object' && 'message' in val) {
          fieldErrors.push(`${key}: ${String((val as { message?: unknown }).message ?? '')}`);
        } else if (typeof val === 'string') {
          fieldErrors.push(`${key}: ${val}`);
        }
      }
      if (fieldErrors.length > 0) {
        return `خطا در ثبت اطلاعات (${fieldErrors.join(' - ')})`;
      }
    }
    if (errObj.message && typeof errObj.message === 'string') {
      return errObj.message;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

async function writerFor(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  if (!context) return null;
  try {
    return await getPocketBaseServiceClient();
  } catch {
    return context.pb;
  }
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات صندوق.' }, { status: 403 });
  }

  const client = (await writerFor(context)) || context.pb;

  try {
    const currenciesList = await client.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, PbRecord>(currenciesList.map((c: PbRecord) => [String(c.id), c]));

    const funds = await client.collection('cash_funds').getFullList({
      expand: 'currency,accountId',
    }).catch(() => []);

    const txs = await client.collection('cash_transactions').getFullList({
      filter: 'is_opening_balance = true || transaction_type = "opening_balance" || source_key ~ "opening:cash:"',
    }).catch(async () => {
      return client.collection('cash_transactions').getFullList({
        filter: 'is_opening_balance = true || transaction_type = "opening_balance"',
      }).catch(() => []);
    });

    const todayJalali = dateToJalaliString(new Date());

    const result = funds.map((f: PbRecord) => {
      const expand = f.expand as Record<string, PbRecord> | undefined;
      const currency = expand?.currency || (f.currency ? currencyMap.get(String(f.currency)) : null);
      const currencyId = String(f.currency || currency?.id || '');
      const currencyName = String(currency?.name || f.currency_name || 'ارز نامشخص');
      const currencyCode = String(currency?.code || '');
      const currencySymbol = String(currency?.symbol || '');
      const fundName = String(f.name || `صندوق ${currencyName}`).trim();
      const accountId = String(f.accountId || expand?.accountId?.id || '');

      // Group transactions belonging to this fund by vault, source_key, or currency_ref
      const fundTxs = txs.filter((tx: PbRecord) => {
        const v = tx.vault ? String(tx.vault) : '';
        const sk = tx.source_key ? String(tx.source_key) : '';
        const cr = tx.currency_ref ? String(tx.currency_ref) : '';
        return (
          v === String(f.id) ||
          sk === `opening:cash:${String(f.id)}` ||
          (currencyId && (v === currencyId || sk === `opening:cash:${currencyId}` || cr === currencyId)) ||
          (f.currency && cr === String(f.currency))
        );
      });

      // Canonical Record Selection Rule:
      // 1. Primary match: record with exact primary source_key
      // 2. Secondary match: record with exact vault relation
      // 3. Fallback: earliest created transaction (deterministic tie-breaker)
      const canonicalTx = fundTxs.find((t: PbRecord) => t.source_key === `opening:cash:${String(f.id)}`)
        || fundTxs.find((t: PbRecord) => t.vault === String(f.id))
        || fundTxs[0]
        || null;

      const openingDate = String(canonicalTx?.date || todayJalali);
      const description = String(canonicalTx?.description || '');

      return {
        id: f.id,
        name: fundName,
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: Math.abs(Number(f.opening_balance ?? canonicalTx?.amount ?? 0)),
        balance: Number(f.balance ?? 0),
        openingBalanceDate: openingDate,
        description,
        accountId: accountId || undefined,
        canonicalTxId: canonicalTx?.id || undefined,
        hasDuplicates: fundTxs.length > 1,
        duplicateCount: fundTxs.length,
        duplicateTxIds: fundTxs.map((t) => t.id),
        created: f.created,
        updated: f.updated,
      };
    });

    return NextResponse.json({ funds: result });
  } catch {
    return NextResponse.json({ message: 'دریافت موجودی‌ها انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'cash.create') && !hasPermission(context.user, 'cash.manage') && !hasPermission(context.user, 'cash.edit')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت/ویرایش موجودی صندوق.' }, { status: 403 });
  }

  const writer = (await writerFor(context)) || context.pb;

  try {
    const body = await request.json().catch(() => ({}));
    const fundId = String(body?.fundId || body?.id || '').trim();
    const requestedCurrencyId = String(body?.currencyId ?? '').trim();
    const customFundName = String(body?.name ?? '').trim();
    const rawAmount = Number(String(body?.amount ?? '').replace(/,/g, ''));
    const description = String(body?.description ?? '').trim();
    const dateInput = String(body?.date ?? '').trim();

    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return NextResponse.json({ message: 'لطفاً مبلغ معتبری برای موجودی اولیه وارد کنید.' }, { status: 400 });
    }
    const amount = Math.abs(Math.round(rawAmount));

    // MODE 1: EDIT EXISTING FUND OPENING BALANCE (Idempotent Update)
    if (fundId) {
      let existingFund: CashFundRecord | null = null;
      try {
        existingFund = await writer.collection('cash_funds').getOne(fundId, { expand: 'currency,accountId' });
      } catch {
        return NextResponse.json({ message: 'صندوق مورد نظر یافت نشد.' }, { status: 404 });
      }

      if (!existingFund) {
        return NextResponse.json({ message: 'صندوق مورد نظر یافت نشد.' }, { status: 404 });
      }

      const currency = existingFund.expand?.currency;
      const currencyId = String(existingFund.currency || currency?.id || '');
      const currencyName = String(currency?.name || existingFund.currency_name || 'ارز نامشخص');
      const currencyCode = String(currency?.code || '');
      const currencySymbol = String(currency?.symbol || '');
      const fundName = customFundName || String(existingFund.name || `صندوق ${currencyName}`);

      const previousOpening = Number(existingFund.opening_balance ?? 0);
      const previousBalance = Number(existingFund.balance ?? 0);
      const nextBalance = previousBalance - previousOpening + amount;

      if (nextBalance < 0) {
        return NextResponse.json({ message: 'موجودی صندوق نمی‌تواند منفی شود.' }, { status: 400 });
      }

      let linkedAccountId: string | null = existingFund.accountId || null;
      try {
        const detailAccount = await ensureCashFundDetailInChart(writer, {
          fundName,
          currencyName,
          existingAccountId: linkedAccountId,
          userId: context.user.id,
        });
        if (detailAccount?.id) {
          linkedAccountId = detailAccount.id;
        }
      } catch (err) {
        console.warn('ensureCashFundDetailInChart failed for edit:', err);
      }

      let updatedFund: CashFundRecord;
      try {
        updatedFund = await writer.collection('cash_funds').update(existingFund.id, {
          name: fundName,
          opening_balance: amount,
          balance: nextBalance,
          accountId: linkedAccountId || undefined,
          updated_by: context.user.id,
        });
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ویرایش موجودی اولیه انجام نشد.') }, { status: 400 });
      }

      // Fetch all existing opening transactions for this specific vault/source_key to handle duplicates safely
      const primarySourceKey = `opening:cash:${existingFund.id}`;
      const altSourceKey = currencyId ? `opening:cash:${currencyId}` : '';

      // Step 1: Query by vault and sourceKey
      let vaultOpeningTxs: CashTxRecord[] = [];
      try {
        const filterConditions = ['vault = {:vaultId}', 'source_key = {:primarySk}'];
        const filterParams: Record<string, string> = {
          vaultId: existingFund.id,
          primarySk: primarySourceKey,
        };
        if (altSourceKey) {
          filterConditions.push('source_key = {:altSk}');
          filterParams.altSk = altSourceKey;
        }

        vaultOpeningTxs = await writer.collection('cash_transactions').getFullList({
          filter: writer.filter(filterConditions.join(' || '), filterParams),
        });
      } catch {
        vaultOpeningTxs = [];
      }

      // Step 2: Fallback to currency_ref lookup for legacy unmigrated rows if none found by vault/source_key
      if (vaultOpeningTxs.length === 0 && currencyId) {
        try {
          vaultOpeningTxs = await writer.collection('cash_transactions').getFullList({
            filter: writer.filter(
              'currency_ref = {:currencyId} && (is_opening_balance = true || transaction_type = "opening_balance")',
              { currencyId },
            ),
          });
        } catch {
          vaultOpeningTxs = [];
        }
      }

      // Deterministic Canonical Record Selection Rule:
      // 1. Transaction with exact primary source_key
      // 2. Transaction with exact vault relation
      // 3. Fallback: Earliest transaction (deterministic tie-breaker)
      const canonicalTx = vaultOpeningTxs.find((t: CashTxRecord) => t.source_key === primarySourceKey)
        || vaultOpeningTxs.find((t: CashTxRecord) => t.vault === existingFund.id)
        || vaultOpeningTxs[0]
        || null;

      const dateValue = dateInput || (canonicalTx?.date ? String(canonicalTx.date) : dateToJalaliString(new Date()));

      let persistedTxId = '';
      try {
        if (canonicalTx) {
          persistedTxId = canonicalTx.id;
          await writer.collection('cash_transactions').update(canonicalTx.id, {
            vault: existingFund.id,
            currency_ref: currencyId || undefined,
            currency: currencyCode.slice(0, 16) || 'IRT',
            currency_name: currencyName.slice(0, 32),
            currency_symbol: currencySymbol,
            amount,
            direction: 'in',
            source_key: primarySourceKey,
            transaction_type: 'opening_balance',
            is_opening_balance: true,
            date: dateValue,
            description: description || `موجودی اول دوره صندوق - ${currencySymbol}`,
          });

          // Enforce strictly ONE row in cash_transactions: delete any historical duplicates
          const duplicates = vaultOpeningTxs.filter((t: CashTxRecord) => t.id !== canonicalTx.id);
          for (const dup of duplicates) {
            try {
              await writer.collection('cash_transactions').delete(dup.id);
            } catch (delErr) {
              console.warn(`Failed to remove duplicate cash_transactions record ${dup.id}:`, delErr);
            }
          }
        } else {
          const created = await writer.collection('cash_transactions').create({
            vault: existingFund.id,
            currency_ref: currencyId,
            currency: currencyCode.slice(0, 16) || 'IRT',
            currency_name: currencyName.slice(0, 32),
            currency_symbol: currencySymbol,
            amount,
            direction: 'in',
            source_key: primarySourceKey,
            transaction_type: 'opening_balance',
            is_opening_balance: true,
            date: dateValue,
            description: description || `موجودی اول دوره صندوق - ${currencySymbol}`,
            created_by: context.user.id,
          });
          persistedTxId = created.id;
        }

        // Post or update double-entry journal entry and child lines in place (Model A)
        await postCashOpeningBalance(
          {
            id: updatedFund.id,
            name: fundName,
            currencyId,
            currencyName,
            accountId: linkedAccountId || updatedFund.accountId,
          },
          amount,
          dateValue,
          context.user.id,
          writer,
          description || `موجودی اول دوره صندوق - ${currencySymbol}`,
        );
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ثبت تراکنش و سند موجودی اولیه با خطا مواجه شد.') }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        transaction: {
          id: persistedTxId,
          vault: existingFund.id,
          date: dateValue,
          amount,
        },
        fund: {
          id: updatedFund.id,
          name: fundName,
          currencyId,
          currencyName,
          currencyCode,
          currencySymbol,
          openingBalance: amount,
          balance: nextBalance,
          openingBalanceDate: dateValue,
          accountId: linkedAccountId || undefined,
        },
      });
    }

    // MODE 2: CREATE NEW CASH FUND WITH OPENING BALANCE
    if (!requestedCurrencyId) {
      return NextResponse.json({ message: 'انتخاب ارز الزامی است.' }, { status: 400 });
    }

    let currencyRecord: CurrencyRecord;
    try {
      currencyRecord = await writer.collection('currencies').getOne(requestedCurrencyId);
    } catch {
      return NextResponse.json({ message: 'ارز انتخاب‌شده در کالکشن ارزها یافت نشد.' }, { status: 400 });
    }

    const currencyName = String(currencyRecord.name || currencyRecord.code).trim();
    const currencyCode = String(currencyRecord.code || currencyName).trim().toUpperCase();
    const currencySymbol = String(currencyRecord.symbol || currencyCode).trim();
    const fundName = customFundName || `صندوق ${currencyName}`;

    // Clamp currency_name to 32 chars to satisfy strict legacy PocketBase column limits
    const safeCurrencyName = currencyName.slice(0, 32);

    // Duplicate Check: Enforce strictly one cash fund per currency (Source of truth: cash_funds collection)
    const existingFundForCurrency = await writer.collection('cash_funds').getFirstListItem(
      writer.filter('currency = {:currencyId}', { currencyId: currencyRecord.id }),
    ).catch(async () => {
      return writer.collection('cash_funds').getFirstListItem(
        writer.filter('(currency = "" || currency = null) && currency_name = {:currency}', { currency: currencyName }),
      ).catch(() => null);
    });

    if (existingFundForCurrency) {
      return NextResponse.json({
        message: 'برای این واحد پولی قبلا صندوق ایجاد شده است.',
      }, { status: 400 });
    }

    const dateValue = dateInput || dateToJalaliString(new Date());

    let linkedAccountId: string | null = null;
    try {
      const detailAccount = await ensureCashFundDetailInChart(writer, {
        fundName,
        currencyName,
        existingAccountId: null,
        userId: context.user.id,
      });
      if (detailAccount?.id && detailAccount.id.trim().length > 0) {
        linkedAccountId = detailAccount.id;
      }
    } catch (err) {
      return NextResponse.json({
        message: extractPbErrorMessage(err, 'ایجاد سرفصل حسابداری مربوط به صندوق در کدینگ با خطا مواجه شد.'),
      }, { status: 400 });
    }

    if (!linkedAccountId) {
      return NextResponse.json({
        message: 'تعیین سرفصل حسابداری برای صندوق امکان‌پذیر نشد.',
      }, { status: 400 });
    }

    let fund: CashFundRecord;
    try {
      fund = await writer.collection('cash_funds').create({
        name: fundName,
        currency: currencyRecord.id,
        currency_name: safeCurrencyName,
        opening_balance: amount,
        balance: amount,
        accountId: linkedAccountId,
        created_by: context.user.id,
        updated_by: context.user.id,
      });
    } catch (err) {
      return NextResponse.json({
        message: extractPbErrorMessage(err, 'ایجاد صندوق وجه نقد با خطا مواجه شد.'),
      }, { status: 400 });
    }

    const sourceKey = `opening:cash:${fund.id}`;
    let createdTx: CashTxRecord | null = null;
    try {
      createdTx = await writer.collection('cash_transactions').create({
        vault: fund.id,
        currency_ref: currencyRecord.id,
        currency: currencyCode.slice(0, 16) || 'IRT',
        currency_name: safeCurrencyName,
        currency_symbol: currencySymbol,
        amount,
        direction: 'in',
        source_key: sourceKey,
        transaction_type: 'opening_balance',
        is_opening_balance: true,
        date: dateValue,
        description: description || `موجودی اول دوره صندوق - ${currencySymbol}`,
        created_by: context.user.id,
      });

      // Generate double-entry journal entry & lines
      await postCashOpeningBalance(
        {
          id: fund.id,
          name: fundName,
          currencyId: currencyRecord.id,
          currencyName,
          accountId: linkedAccountId,
        },
        amount,
        dateValue,
        context.user.id,
        writer,
        description || `موجودی اول دوره صندوق - ${currencySymbol}`,
      );
    } catch (transactionError) {
      // Full Atomic Rollback: delete created cash_transaction & cash_fund on failure
      if (createdTx?.id) {
        await writer.collection('cash_transactions').delete(createdTx.id).catch(() => undefined);
      }
      if (fund?.id) {
        await writer.collection('cash_funds').delete(fund.id).catch(() => undefined);
      }
      return NextResponse.json({
        message: extractPbErrorMessage(transactionError, 'ثبت تراکنش و سند موجودی اولیه با خطا مواجه شد.'),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      fund: {
        id: fund.id,
        name: fundName,
        currencyId: currencyRecord.id,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: amount,
        balance: amount,
        openingBalanceDate: dateValue,
        accountId: linkedAccountId || undefined,
      },
    }, { status: 201 });
  } catch (error) {
    const msg = extractPbErrorMessage(error, 'ثبت موجودی اولیه انجام نشد.');
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function PATCH(request: Request) {
  return POST(request);
}
