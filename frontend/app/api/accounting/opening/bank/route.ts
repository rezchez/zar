import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function text(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

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
  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات حساب‌های بانکی.' }, { status: 403 });
  }

  try {
    const currenciesList = await context.pb.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, any>(currenciesList.map((c: any) => [c.id, c]));

    const accounts = await context.pb.collection('bank_accounts').getFullList().catch(() => []);

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
      const currency = acc.expand?.currency || (acc.currency ? currencyMap.get(acc.currency) : null);
      const currencyId = String(acc.currency || currency?.id || '');
      const currencyName = String(currency?.name || acc.currency || 'ریال');
      const currencyCode = String(currency?.code || acc.currency || 'IRR');
      const currencySymbol = String(currency?.symbol || currencyCode);

      const tx = txMap.get(acc.id);
      const openingDate = String(tx?.date || (acc.created ? dateToJalaliString(new Date(acc.created)) : todayJalali));
      const description = String(tx?.description || '');

      const openingBalance = Math.abs(Number(tx?.amount ?? acc.opening_balance ?? 0));
      const balance = Number(acc.currentBalance ?? acc.balance ?? 0);

      return {
        id: acc.id,
        bankName: String(acc.bankName || ''),
        branchName: String(acc.branchName || ''),
        accountNumber: String(acc.accountNumber || ''),
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance,
        balance,
        openingBalanceDate: openingDate,
        description,
        isActive: acc.isActive ?? true,
        created: acc.created,
        updated: acc.updated,
      };
    });

    return NextResponse.json({ bankAccounts: result });
  } catch (err) {
    console.error('get_opening_bank_failed', err);
    return NextResponse.json({ message: 'دریافت موجودی‌های حساب بانکی انجام نشد.' }, { status: 500 });
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

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const bankAccountId = text(body?.bankAccountId || body?.id);
    const bankName = text(body?.bankName);
    const branchName = text(body?.branchName);
    const accountNumber = text(body?.accountNumber, 80);
    const requestedCurrencyId = text(body?.currencyId);
    const currencyCodeInput = text(body?.currency, 16).toUpperCase();
    const rawAmount = parseLocalizedAmount(String(body?.amount ?? body?.openingBalance ?? 0));
    const description = text(body?.description, 1000);
    const dateInput = text(body?.date, 20);

    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return NextResponse.json({ message: 'لطفاً مبلغ معتبری (غیرمنفی) برای موجودی اولیه وارد کنید.' }, { status: 400 });
    }
    const amount = Math.abs(Math.round(rawAmount));

    // MODE 1: EDIT EXISTING BANK ACCOUNT OPENING BALANCE
    if (bankAccountId) {
      let existingAccount: any = null;
      try {
        existingAccount = await writer.collection('bank_accounts').getOne(bankAccountId);
      } catch {
        return NextResponse.json({ message: 'حساب بانکی مورد نظر یافت نشد.' }, { status: 404 });
      }

      const existingTx = await writer.collection('bank_transactions').getFirstListItem(
        writer.filter('bank_account = {:bankAccountId} && (is_opening_balance = true || transaction_type = "opening_balance")', {
          bankAccountId: existingAccount.id,
        }),
      ).catch(() => null);

      const previousOpening = Number(existingTx?.amount ?? existingAccount.opening_balance ?? 0);
      const previousBalance = Number(existingAccount.balance ?? existingAccount.currentBalance ?? 0);
      const nextBalance = previousBalance - previousOpening + amount;

      if (nextBalance < 0) {
        return NextResponse.json({ message: 'موجودی حساب بانکی نمی‌تواند منفی شود.' }, { status: 400 });
      }

      let updatedAccount: any;
      try {
        updatedAccount = await writer.collection('bank_accounts').update(existingAccount.id, {
          balance: nextBalance,
          currentBalance: nextBalance,
          updatedBy: context.user.id,
        });
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ویرایش حساب بانکی انجام نشد.') }, { status: 400 });
      }

      const dateValue = dateInput || (existingTx?.date ? String(existingTx.date) : dateToJalaliString(new Date()));

      try {
        if (existingTx) {
          await writer.collection('bank_transactions').update(existingTx.id, {
            amount,
            direction: 'in',
            date: dateValue,
            description: description || `موجودی اول دوره حساب بانکی - ${existingAccount.bankName}`,
          });
        } else {
          await writer.collection('bank_transactions').create({
            bank_account: existingAccount.id,
            currency_ref: requestedCurrencyId || null,
            currency: currencyCodeInput || existingAccount.currency || 'IRT',
            amount,
            direction: 'in',
            source_key: `opening:bank:${existingAccount.id}`,
            transaction_type: 'opening_balance',
            is_opening_balance: true,
            date: dateValue,
            description: description || `موجودی اول دوره حساب بانکی - ${existingAccount.bankName}`,
            created_by: context.user.id,
          });
        }
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ثبت تراکنش موجودی اولیه با خطا مواجه شد.') }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        bankAccount: {
          id: updatedAccount.id,
          bankName: updatedAccount.bankName,
          branchName: updatedAccount.branchName,
          accountNumber: updatedAccount.accountNumber,
          currency: updatedAccount.currency,
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

    // Duplicate Check
    const duplicate = await writer.collection('bank_accounts').getFirstListItem(
      writer.filter('accountNumber = {:accountNumber}', { accountNumber }),
    ).catch(() => null);

    if (duplicate) {
      return NextResponse.json({ message: 'این شماره حساب قبلاً ثبت شده است.' }, { status: 409 });
    }

    let currencyCode = currencyCodeInput || 'IRT';
    let currencyRefId = requestedCurrencyId || null;

    if (requestedCurrencyId) {
      try {
        const currencyRecord = await writer.collection('currencies').getOne(requestedCurrencyId);
        currencyCode = String(currencyRecord.code || currencyCode).toUpperCase();
        currencyRefId = currencyRecord.id;
      } catch {
        // Fallback to currencyCode
      }
    }

    const dateValue = dateInput || dateToJalaliString(new Date());

    let bankAccountRecord: any;
    try {
      bankAccountRecord = await writer.collection('bank_accounts').create({
        bankName,
        branchName,
        accountNumber,
        balance: amount,
        currentBalance: amount,
        currency: currencyCode,
        accountCodeZero: '0',
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
      await writer.collection('bank_transactions').create({
        bank_account: bankAccountRecord.id,
        currency_ref: currencyRefId,
        currency: currencyCode,
        amount,
        direction: 'in',
        source_key: `opening:bank:${bankAccountRecord.id}`,
        transaction_type: 'opening_balance',
        is_opening_balance: true,
        date: dateValue,
        description: description || `موجودی اول دوره حساب بانکی - ${bankName}`,
        created_by: context.user.id,
      });
    } catch (transactionError) {
      // Atomic rollback: Delete bank_account if transaction fails
      await writer.collection('bank_accounts').delete(bankAccountRecord.id).catch(() => undefined);
      return NextResponse.json({
        message: extractPbErrorMessage(transactionError, 'ثبت تراکنش موجودی اولیه حساب بانکی با خطا مواجه شد.'),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      bankAccount: {
        id: bankAccountRecord.id,
        bankName,
        branchName,
        accountNumber,
        currency: currencyCode,
        openingBalance: amount,
        balance: amount,
        openingBalanceDate: dateValue,
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
