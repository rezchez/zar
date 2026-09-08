import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { postCashOpeningBalance } from '@/lib/accounting-posting-engine';
import { ensureCashFundDetailInChart } from '@/lib/chart-of-accounts';
import { dateToJalaliString } from '@/lib/jalali';

function extractPbErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    const responseData = errObj?.response?.data || errObj?.data;
    if (responseData && typeof responseData === 'object') {
      const fieldErrors: string[] = [];
      for (const [key, val] of Object.entries(responseData)) {
        if (val && typeof val === 'object' && 'message' in val) {
          fieldErrors.push(`${key}: ${(val as any).message}`);
        } else if (typeof val === 'string') {
          fieldErrors.push(`${key}: ${val}`);
        }
      }
      if (fieldErrors.length > 0) {
        return `خطا در ثبت اطلاعات (${fieldErrors.join(' - ')})`;
      }
    }
    if (errObj?.message && typeof errObj.message === 'string') {
      return errObj.message;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات صندوق.' }, { status: 403 });
  }

  try {
    const currenciesList = await context.pb.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, any>(currenciesList.map((c: any) => [c.id, c]));

    const funds = await context.pb.collection('cash_funds').getFullList({
      expand: 'currency,accountId',
    }).catch(() => []);

    const txs = await context.pb.collection('cash_transactions').getFullList({
      filter: 'is_opening_balance = true || transaction_type = "opening_balance" || source_key ~ "opening:cash:"',
      sort: '-updated,-created',
    }).catch(() => []);

    // Group opening transactions by vault ID or source_key for canonical mapping and duplicate detection
    const txMap = new Map<string, any[]>();
    for (const tx of txs) {
      let vaultId = tx.vault ? String(tx.vault) : '';
      if (!vaultId && tx.source_key && String(tx.source_key).startsWith('opening:cash:')) {
        vaultId = String(tx.source_key).replace('opening:cash:', '');
      }
      if (vaultId) {
        const list = txMap.get(vaultId) || [];
        list.push(tx);
        txMap.set(vaultId, list);
      }
    }

    const todayJalali = dateToJalaliString(new Date());

    const result = funds.map((f: any) => {
      const currency = f.expand?.currency || (f.currency ? currencyMap.get(f.currency) : null);
      const currencyId = String(f.currency || currency?.id || '');
      const currencyName = String(currency?.name || f.currency_name || 'ارز نامشخص');
      const currencyCode = String(currency?.code || '');
      const currencySymbol = String(currency?.symbol || '');
      const fundName = String(f.name || `صندوق ${currencyName}`).trim();
      const accountId = String(f.accountId || f.expand?.accountId?.id || '');

      const vaultTxs = txMap.get(f.id) || (currencyId ? txMap.get(currencyId) : []) || [];
      const tx = vaultTxs[0] || null;
      const openingDate = String(tx?.date || (f.created ? dateToJalaliString(new Date(f.created)) : todayJalali));
      const description = String(tx?.description || '');

      return {
        id: f.id,
        name: fundName,
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: Math.abs(Number(f.opening_balance ?? tx?.amount ?? 0)),
        balance: Number(f.balance ?? 0),
        openingBalanceDate: openingDate,
        description,
        accountId: accountId || undefined,
        hasDuplicates: vaultTxs.length > 1,
        duplicateCount: vaultTxs.length,
        duplicateTxIds: vaultTxs.map((t) => t.id),
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
      let existingFund: any = null;
      try {
        existingFund = await context.pb.collection('cash_funds').getOne(fundId, { expand: 'currency,accountId' });
      } catch {
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
        const detailAccount = await ensureCashFundDetailInChart(context.pb, {
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

      let updatedFund: any;
      try {
        updatedFund = await context.pb.collection('cash_funds').update(existingFund.id, {
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

      const filterConditions = ['vault = {:vaultId}', 'source_key = {:primarySk}'];
      const filterParams: Record<string, string> = {
        vaultId: existingFund.id,
        primarySk: primarySourceKey,
      };
      if (altSourceKey) {
        filterConditions.push('source_key = {:altSk}');
        filterParams.altSk = altSourceKey;
      }

      const vaultOpeningTxs = await context.pb.collection('cash_transactions').getFullList({
        filter: context.pb.filter(filterConditions.join(' || '), filterParams),
        sort: '-updated,-created',
      }).catch(() => []);

      const canonicalTx = vaultOpeningTxs[0] || null;
      const dateValue = dateInput || (canonicalTx?.date ? String(canonicalTx.date) : dateToJalaliString(new Date()));

      try {
        if (canonicalTx) {
          await context.pb.collection('cash_transactions').update(canonicalTx.id, {
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

        } else {
          await context.pb.collection('cash_transactions').create({
            vault: existingFund.id,
            currency_ref: currencyId,
            currency: currencyCode.slice(0, 16) || 'IRT',
            currency_name: currencyName.slice(0, 32),
            currency_symbol: currencySymbol,
            amount,
            direction: 'in',
            source_key: `opening:cash:${existingFund.id}`,
            transaction_type: 'opening_balance',
            is_opening_balance: true,
            date: dateValue,
            description: description || `موجودی اول دوره صندوق - ${currencySymbol}`,
            created_by: context.user.id,
          });
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
          context.pb,
          description || `موجودی اول دوره صندوق - ${currencySymbol}`,
        );
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ثبت تراکنش و سند موجودی اولیه با خطا مواجه شد.') }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
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

    let currencyRecord: Record<string, any>;
    try {
      currencyRecord = await context.pb.collection('currencies').getOne(requestedCurrencyId);
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
    const existingFundForCurrency = await context.pb.collection('cash_funds').getFirstListItem(
      context.pb.filter('currency = {:currencyId}', { currencyId: currencyRecord.id }),
    ).catch(async () => {
      return context.pb.collection('cash_funds').getFirstListItem(
        context.pb.filter('(currency = "" || currency = null) && currency_name = {:currency}', { currency: currencyName }),
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
      const detailAccount = await ensureCashFundDetailInChart(context.pb, {
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

    let fund: any;
    try {
      fund = await context.pb.collection('cash_funds').create({
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
    let createdTx: any = null;
    try {
      createdTx = await context.pb.collection('cash_transactions').create({
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
        context.pb,
        description || `موجودی اول دوره صندوق - ${currencySymbol}`,
      );
    } catch (transactionError) {
      // Full Atomic Rollback: delete created cash_transaction & cash_fund on failure
      if (createdTx?.id) {
        await context.pb.collection('cash_transactions').delete(createdTx.id).catch(() => undefined);
      }
      if (fund?.id) {
        await context.pb.collection('cash_funds').delete(fund.id).catch(() => undefined);
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
