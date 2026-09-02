import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function extractPbErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'object') {
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
  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات حساب‌های بانکی.' }, { status: 403 });
  }

  try {
    const currenciesList = await context.pb.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, any>(currenciesList.map((c: any) => [c.id, c]));

    const accounts = await context.pb.collection('bank_accounts').getFullList({
      sort: 'bankName,accountNumber',
      expand: 'bank,accountId',
    }).catch(() => []);

    const txs = await context.pb.collection('bank_transactions').getFullList({
      filter: 'is_opening_balance = true || transaction_type = "opening_balance"',
    }).catch(() => []);

    const txMap = new Map<string, any>();
    for (const tx of txs) {
      if (tx.bank_account) {
        txMap.set(String(tx.bank_account), tx);
      }
    }

    const todayJalali = dateToJalaliString(new Date());

    const result = accounts.map((acc: any) => {
      const currencyCode = String(acc.currency || 'IRR').toUpperCase();
      const currencyObj = Array.from(currencyMap.values()).find(
        (c: any) => String(c.code).toUpperCase() === currencyCode || String(c.id) === String(acc.currency),
      );
      const currencyId = String(currencyObj?.id || '');
      const currencyName = String(currencyObj?.name || (currencyCode === 'IRT' ? 'تومان' : currencyCode === 'IRR' ? 'ریال' : currencyCode));
      const currencySymbol = String(currencyObj?.symbol || (currencyCode === 'IRT' ? 'تومان' : currencyCode === 'IRR' ? 'ریال' : currencyCode));

      const tx = txMap.get(acc.id);
      const openingDate = String(tx?.date || (acc.created ? dateToJalaliString(new Date(acc.created)) : todayJalali));
      const description = String(tx?.description || '');

      return {
        id: acc.id,
        bankName: String(acc.bankName || ''),
        branchName: String(acc.branchName || ''),
        accountNumber: String(acc.accountNumber || ''),
        accountCodeZero: String(acc.accountCodeZero || '0'),
        currency: currencyCode,
        currencyId,
        currencyName,
        currencySymbol,
        openingBalance: Math.abs(Number(acc.opening_balance ?? tx?.amount ?? 0)),
        balance: Number(acc.currentBalance ?? acc.balance ?? 0),
        openingBalanceDate: openingDate,
        description,
        created: acc.created,
        updated: acc.updated,
      };
    });

    return NextResponse.json({ accounts: result });
  } catch {
    return NextResponse.json({ message: 'دریافت حساب‌های بانکی انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'bank.create') && !hasPermission(context.user, 'bank.manage') && !hasPermission(context.user, 'bank.edit')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت/ویرایش موجودی حساب بانکی.' }, { status: 403 });
  }

  const pbWriter = await getPocketBaseServiceClient().catch(() => context.pb);

  try {
    const body = await request.json().catch(() => ({}));
    const accountId = String(body?.accountId || body?.id || '').trim();
    const bankName = String(body?.bankName || '').trim();
    const branchName = String(body?.branchName || '').trim();
    const accountNumber = String(body?.accountNumber || '').trim();
    const rawCurrency = String(body?.currency || 'IRR').trim().toUpperCase();
    const requestedCurrencyId = String(body?.currencyId ?? '').trim();
    const rawAmount = parseLocalizedAmount(String(body?.amount ?? body?.openingBalance ?? '0'));
    const description = String(body?.description ?? '').trim();
    const dateInput = String(body?.date ?? '').trim();

    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return NextResponse.json({ message: 'لطفاً مبلغ معتبری (غیرمنفی) برای موجودی اولیه وارد کنید.' }, { status: 400 });
    }
    const amount = Math.abs(Math.round(rawAmount));

    // Resolve Currency details
    let currencyRecord: Record<string, any> | null = null;
    if (requestedCurrencyId) {
      currencyRecord = await pbWriter.collection('currencies').getOne(requestedCurrencyId).catch(() => null);
    }
    if (!currencyRecord && rawCurrency) {
      currencyRecord = await pbWriter.collection('currencies').getFirstListItem(
        pbWriter.filter('code = {:code}', { code: rawCurrency }),
      ).catch(() => null);
    }

    const currencyCode = String(currencyRecord?.code || rawCurrency || 'IRR').toUpperCase();
    const currencyName = String(currencyRecord?.name || (currencyCode === 'IRT' ? 'تومان' : currencyCode === 'IRR' ? 'ریال' : currencyCode));
    const currencySymbol = String(currencyRecord?.symbol || (currencyCode === 'IRT' ? 'تومان' : currencyCode === 'IRR' ? 'ریال' : currencyCode));

    // MODE 1: EDIT EXISTING BANK ACCOUNT OPENING BALANCE
    if (accountId) {
      let existingAccount: any = null;
      try {
        existingAccount = await pbWriter.collection('bank_accounts').getOne(accountId);
      } catch {
        return NextResponse.json({ message: 'حساب بانکی مورد نظر یافت نشد.' }, { status: 404 });
      }

      const previousOpening = Number(existingAccount.opening_balance ?? 0);
      const previousBalance = Number(existingAccount.currentBalance ?? existingAccount.balance ?? 0);
      const nextBalance = previousBalance - previousOpening + amount;

      if (nextBalance < 0) {
        return NextResponse.json({ message: 'موجودی حساب بانکی نمی‌تواند منفی شود.' }, { status: 400 });
      }

      const updatePayload: Record<string, any> = {
        opening_balance: amount,
        balance: nextBalance,
        currentBalance: nextBalance,
        updatedBy: context.user.id,
      };
      if (bankName) updatePayload.bankName = bankName;
      if (branchName !== undefined) updatePayload.branchName = branchName;
      if (accountNumber) updatePayload.accountNumber = accountNumber;
      if (currencyCode) updatePayload.currency = currencyCode;

      let updatedAccount: any;
      try {
        updatedAccount = await pbWriter.collection('bank_accounts').update(existingAccount.id, updatePayload);
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ویرایش موجودی اولیه انجام نشد.') }, { status: 400 });
      }

      const existingTx = await pbWriter.collection('bank_transactions').getFirstListItem(
        pbWriter.filter('bank_account = {:accountId} && (is_opening_balance = true || transaction_type = "opening_balance")', {
          accountId: existingAccount.id,
        }),
      ).catch(() => null);

      const dateValue = dateInput || (existingTx?.date ? String(existingTx.date) : dateToJalaliString(new Date()));

      try {
        if (existingTx) {
          await pbWriter.collection('bank_transactions').update(existingTx.id, {
            amount,
            direction: 'in',
            date: dateValue,
            currency: currencyCode,
            currency_symbol: currencySymbol,
            currency_ref: currencyRecord?.id || existingTx.currency_ref || null,
            description: description || `موجودی اول دوره حساب بانکی - ${bankName || existingAccount.bankName}`,
          });
        } else {
          await pbWriter.collection('bank_transactions').create({
            bank_account: existingAccount.id,
            currency_ref: currencyRecord?.id || null,
            currency: currencyCode,
            currency_symbol: currencySymbol,
            amount,
            direction: 'in',
            source_key: `opening:bank:${existingAccount.id}`,
            transaction_type: 'opening_balance',
            is_opening_balance: true,
            date: dateValue,
            description: description || `موجودی اول دوره حساب بانکی - ${bankName || existingAccount.bankName}`,
            created_by: context.user.id,
          });
        }
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ثبت تراکنش موجودی اولیه بانکی با خطا مواجه شد.') }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        account: {
          id: updatedAccount.id,
          bankName: updatedAccount.bankName,
          branchName: updatedAccount.branchName,
          accountNumber: updatedAccount.accountNumber,
          currency: currencyCode,
          currencyId: currencyRecord?.id || '',
          currencyName,
          currencySymbol,
          openingBalance: amount,
          balance: nextBalance,
          openingBalanceDate: dateValue,
        },
      });
    }

    // MODE 2: CREATE NEW BANK ACCOUNT WITH OPENING BALANCE
    if (!bankName || !accountNumber) {
      return NextResponse.json({ message: 'نام بانک و شماره حساب الزامی است.' }, { status: 400 });
    }

    // Duplicate Check by Account Number
    const duplicate = await pbWriter.collection('bank_accounts').getFirstListItem(
      pbWriter.filter('accountNumber = {:accountNumber}', { accountNumber }),
    ).catch(() => null);

    if (duplicate) {
      return NextResponse.json({ message: 'این شماره حساب قبلاً ثبت شده است.' }, { status: 409 });
    }

    const dateValue = dateInput || dateToJalaliString(new Date());

    let bankAccount: any;
    try {
      bankAccount = await pbWriter.collection('bank_accounts').create({
        bankName,
        branchName,
        accountNumber,
        opening_balance: amount,
        balance: amount,
        currentBalance: amount,
        currency: currencyCode,
        accountCodeZero: String(body?.accountCodeZero || '0'),
        isActive: true,
        owner: context.user.id,
        createdBy: context.user.id,
        updatedBy: context.user.id,
      });
    } catch (err) {
      return NextResponse.json({
        message: extractPbErrorMessage(err, 'ایجاد حساب بانکی با خطا مواجه شد.'),
      }, { status: 400 });
    }

    try {
      await pbWriter.collection('bank_transactions').create({
        bank_account: bankAccount.id,
        currency_ref: currencyRecord?.id || null,
        currency: currencyCode,
        currency_symbol: currencySymbol,
        amount,
        direction: 'in',
        source_key: `opening:bank:${bankAccount.id}`,
        transaction_type: 'opening_balance',
        is_opening_balance: true,
        date: dateValue,
        description: description || `موجودی اول دوره حساب بانکی - ${bankName}`,
        created_by: context.user.id,
      });
    } catch (transactionError) {
      await pbWriter.collection('bank_accounts').delete(bankAccount.id).catch(() => undefined);
      return NextResponse.json({
        message: extractPbErrorMessage(transactionError, 'ثبت تراکنش موجودی اولیه بانکی با خطا مواجه شد.'),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      account: {
        id: bankAccount.id,
        bankName,
        branchName,
        accountNumber,
        currency: currencyCode,
        currencyId: currencyRecord?.id || '',
        currencyName,
        currencySymbol,
        openingBalance: amount,
        balance: amount,
        openingBalanceDate: dateValue,
      },
    }, { status: 201 });
  } catch (error) {
    const msg = extractPbErrorMessage(error, 'ثبت موجودی اولیه حساب بانکی انجام نشد.');
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function PATCH(request: Request) {
  return POST(request);
}
