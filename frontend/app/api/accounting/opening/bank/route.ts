import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { postBankOpeningBalance } from '@/lib/accounting-posting-engine';
import { ensureBankAccountDetailInChart } from '@/lib/chart-of-accounts';
import { dateToJalaliString } from '@/lib/jalali';
import { convertTomanToRial, parseLocalizedAmount } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { validateIranianSheba } from '@/lib/sheba';

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
    const currencyMap = new Map<string, any>();
    for (const c of currenciesList) {
      if (c.id) currencyMap.set(String(c.id).toLowerCase(), c);
      if (c.code) currencyMap.set(String(c.code).toUpperCase(), c);
      if (c.name) currencyMap.set(String(c.name).trim(), c);
    }

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
      const tx = txMap.get(acc.id);
      const rawCurr = String(acc.currency || '').trim();
      let currency = acc.expand?.currency
        || (rawCurr ? currencyMap.get(rawCurr.toLowerCase()) || currencyMap.get(rawCurr.toUpperCase()) || currencyMap.get(rawCurr) : null);

      if (!currency && tx) {
        const txRef = String(tx.currency_ref || '').trim();
        const txCode = String(tx.currency || '').trim();
        currency = (txRef ? currencyMap.get(txRef.toLowerCase()) : null)
          || (txCode ? currencyMap.get(txCode.toUpperCase()) || currencyMap.get(txCode) : null);
      }

      if (!currency) {
        currency = currencyMap.get('IRR') || currencyMap.get('IRT') || null;
      }

      const currencyId = String(currency?.id || acc.currency || '');
      const currencyCode = String(currency?.code || acc.currency || 'IRR').toUpperCase();
      const currencyName = String(currency?.name || (currencyCode === 'IRT' ? 'تومان' : 'ریال ایران'));
      const currencySymbol = String(currency?.symbol || (currencyCode === 'IRT' ? 'تومان' : 'ریال'));

      const openingDate = String(tx?.date || (acc.created ? dateToJalaliString(new Date(acc.created)) : todayJalali));
      const description = String(tx?.description || '');

      const openingBalance = Math.abs(Number(tx?.amount ?? acc.opening_balance ?? 0));
      const balance = Number(acc.currentBalance ?? acc.balance ?? 0);

      return {
        id: acc.id,
        bankName: String(acc.bankName || ''),
        branchName: String(acc.branchName || ''),
        accountNumber: String(acc.accountNumber || ''),
        shebaNumber: String(acc.shebaNumber || ''),
        hasCheckbook: Boolean(acc.hasCheckbook),
        hasVirtualCheck: Boolean(acc.hasVirtualCheck),
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance,
        balance,
        openingBalanceDate: openingDate,
        description,
        accountType: String(acc.accountType || 'current'),
        isActive: acc.isActive ?? true,
        isBlocked: acc.isBlocked === true,
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
    const accountType = text(body?.accountType, 50) || 'current';
    const rawSheba = text(body?.shebaNumber || body?.iban, 34);
    const hasCheckbook = typeof body?.hasCheckbook === 'boolean' ? body.hasCheckbook : false;
    const hasVirtualCheck = typeof body?.hasVirtualCheck === 'boolean' ? body.hasVirtualCheck : false;
    const requestedCurrencyId = text(body?.currencyId);
    const currencyCodeInput = text(body?.currency, 16).toUpperCase();
    const rawAmount = parseLocalizedAmount(String(body?.amount ?? body?.openingBalance ?? 0));
    const description = text(body?.description, 1000);
    const dateInput = text(body?.date, 20);

    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return NextResponse.json({ message: 'لطفاً مبلغ معتبری (غیرمنفی) برای موجودی اولیه وارد کنید.' }, { status: 400 });
    }
    const amount = Math.abs(Math.round(rawAmount));

    if (rawSheba) {
      const shebaValidation = validateIranianSheba(rawSheba);
      if (!shebaValidation.valid) {
        return NextResponse.json({ message: shebaValidation.error }, { status: 400 });
      }
    }
    const normSheba = rawSheba ? (rawSheba.toUpperCase().startsWith('IR') ? rawSheba.toUpperCase() : `IR${rawSheba.toUpperCase()}`) : '';

    // Resolve currency from collection
    let currencyRecord: any = null;
    if (requestedCurrencyId) {
      currencyRecord = await writer.collection('currencies').getOne(requestedCurrencyId).catch(() => null);
    }
    if (!currencyRecord && currencyCodeInput) {
      currencyRecord = await writer.collection('currencies').getFirstListItem(
        writer.filter('code = {:code} || name = {:name}', { code: currencyCodeInput, name: currencyCodeInput }),
      ).catch(() => null);
    }

    const currencyCode = currencyRecord ? String(currencyRecord.code).toUpperCase() : (currencyCodeInput || 'IRR');
    const currencyRefId = currencyRecord ? currencyRecord.id : (requestedCurrencyId || null);
    const currencyName = currencyRecord ? String(currencyRecord.name) : (currencyCode === 'IRT' ? 'تومان' : 'ریال ایران');
    const currencySymbol = currencyRecord ? String(currencyRecord.symbol) : (currencyCode === 'IRT' ? 'تومان' : 'ریال');

    const isToman = currencyCode === 'IRT' || currencyName.includes('تومان');
    const accountingAmount = isToman ? convertTomanToRial(amount) : amount;

    // MODE 1: EDIT EXISTING BANK ACCOUNT OPENING BALANCE & METADATA
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

      // Handle currency unit change between IRR and IRT if needed
      const prevIsToman = existingAccount.currency === 'IRT';
      let prevOpeningAdjusted = previousOpening;
      let prevBalanceAdjusted = previousBalance;

      if (prevIsToman && !isToman) {
        // Was Toman, now Rial (* 10)
        prevOpeningAdjusted = Math.round(previousOpening * 10);
        prevBalanceAdjusted = Math.round(previousBalance * 10);
      } else if (!prevIsToman && isToman) {
        // Was Rial, now Toman (/ 10)
        prevOpeningAdjusted = Math.floor(previousOpening / 10);
        prevBalanceAdjusted = Math.floor(previousBalance / 10);
      }

      const nextBalance = prevBalanceAdjusted - prevOpeningAdjusted + amount;

      if (nextBalance < 0) {
        return NextResponse.json({ message: 'موجودی حساب بانکی نمی‌تواند منفی شود.' }, { status: 400 });
      }

      const updatePayload: Record<string, any> = {
        balance: nextBalance,
        currency: currencyCode,
        updatedBy: context.user.id,
      };

      if (bankName) updatePayload.bankName = bankName;
      if (branchName !== undefined) updatePayload.branchName = branchName;
      if (accountNumber) updatePayload.accountNumber = accountNumber;
      if (body?.accountType !== undefined) updatePayload.accountType = text(body.accountType, 50);
      updatePayload.shebaNumber = normSheba;
      updatePayload.hasCheckbook = hasCheckbook;
      updatePayload.hasVirtualCheck = hasVirtualCheck;

      // Update Chart of Accounts detail account if needed
      let linkedAccountId = existingAccount.accountId;
      try {
        const detailAccount = await ensureBankAccountDetailInChart(writer, {
          bankName: bankName || existingAccount.bankName,
          branchName: branchName ?? existingAccount.branchName,
          accountNumber: accountNumber || existingAccount.accountNumber,
          currency: currencyCode,
          existingAccountId: existingAccount.accountId || null,
          userId: context.user.id,
        });
        if (detailAccount?.id) {
          linkedAccountId = detailAccount.id;
          updatePayload.accountId = detailAccount.id;
        }
      } catch {
        //
      }

      let updatedAccount: any;
      try {
        updatedAccount = await writer.collection('bank_accounts').update(existingAccount.id, updatePayload);
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ویرایش حساب بانکی انجام نشد.') }, { status: 400 });
      }

      const dateValue = dateInput || (existingTx?.date ? String(existingTx.date) : dateToJalaliString(new Date()));

      try {
        if (amount > 0) {
          if (existingTx) {
            await writer.collection('bank_transactions').update(existingTx.id, {
              amount,
              currency: currencyCode,
              currency_ref: currencyRefId || null,
              direction: 'in',
              date: dateValue,
              description: description || `موجودی اول دوره حساب بانکی - ${updatedAccount.bankName}`,
            });
          } else {
            await writer.collection('bank_transactions').create({
              bank_account: existingAccount.id,
              currency_ref: currencyRefId || null,
              currency: currencyCode,
              amount,
              direction: 'in',
              source_key: `opening:bank:${existingAccount.id}`,
              transaction_type: 'opening_balance',
              is_opening_balance: true,
              date: dateValue,
              description: description || `موجودی اول دوره حساب بانکی - ${updatedAccount.bankName}`,
              created_by: context.user.id,
            });
          }

          // Generate or update double-entry journal entry (always in IRR for general ledger)
          await postBankOpeningBalance(
            {
              id: updatedAccount.id,
              bankName: updatedAccount.bankName,
              accountNumber: updatedAccount.accountNumber,
              accountId: linkedAccountId || updatedAccount.accountId,
            },
            accountingAmount,
            dateValue,
            context.user.id,
            writer,
            description || `موجودی اول دوره حساب بانکی - ${updatedAccount.bankName}`,
          );
        } else if (existingTx) {
          await writer.collection('bank_transactions').delete(existingTx.id).catch(() => null);
        }
      } catch (err) {
        return NextResponse.json({ message: extractPbErrorMessage(err, 'ثبت تراکنش و سند موجودی اولیه با خطا مواجه شد.') }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        bankAccount: {
          id: updatedAccount.id,
          bankName: updatedAccount.bankName,
          branchName: updatedAccount.branchName,
          accountNumber: updatedAccount.accountNumber,
          shebaNumber: updatedAccount.shebaNumber,
          hasCheckbook: Boolean(updatedAccount.hasCheckbook),
          hasVirtualCheck: Boolean(updatedAccount.hasVirtualCheck),
          currencyId: currencyRefId || '',
          currencyCode,
          currency: currencyCode,
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

    // Duplicate Check
    const duplicate = await writer.collection('bank_accounts').getFirstListItem(
      writer.filter('accountNumber = {:accountNumber}', { accountNumber }),
    ).catch(() => null);

    if (duplicate) {
      return NextResponse.json({ message: 'این شماره حساب قبلاً ثبت شده است.' }, { status: 409 });
    }

    let linkedAccountId: string | null = null;
    try {
      const detailAccount = await ensureBankAccountDetailInChart(writer, {
        bankName,
        branchName,
        accountNumber,
        currency: currencyCode,
        userId: context.user.id,
      });
      if (detailAccount?.id && detailAccount.id.trim().length > 0) {
        linkedAccountId = detailAccount.id;
      }
    } catch {
      //
    }

    const dateValue = dateInput || dateToJalaliString(new Date());

    let bankAccountRecord: any;
    try {
      const createPayload: Record<string, unknown> = {
        bankName,
        branchName: branchName || '',
        accountNumber,
        accountType,
        shebaNumber: normSheba || '',
        hasCheckbook,
        hasVirtualCheck,
        balance: amount,
        currency: currencyCode,
        accountCodeZero: '0',
        isBlocked: false,
      };
      if (linkedAccountId) {
        createPayload.accountId = linkedAccountId;
      }
      if (context.user?.id) {
        createPayload.createdBy = context.user.id;
        createPayload.updatedBy = context.user.id;
      }

      bankAccountRecord = await writer.collection('bank_accounts').create(createPayload);
    } catch (err) {
      return NextResponse.json({
        message: extractPbErrorMessage(err, 'ایجاد حساب بانکی با خطا مواجه شد.'),
      }, { status: 400 });
    }

    try {
      if (amount > 0) {
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

        // Generate double-entry journal entry (always in IRR for general ledger)
        await postBankOpeningBalance(
          {
            id: bankAccountRecord.id,
            bankName,
            accountNumber,
            accountId: linkedAccountId || bankAccountRecord.accountId,
          },
          accountingAmount,
          dateValue,
          context.user.id,
          writer,
          description || `موجودی اول دوره حساب بانکی - ${bankName}`,
        );
      }
    } catch (transactionError) {
      await writer.collection('bank_accounts').delete(bankAccountRecord.id).catch(() => undefined);
      return NextResponse.json({
        message: extractPbErrorMessage(transactionError, 'ثبت تراکنش و سند موجودی اولیه حساب بانکی با خطا مواجه شد.'),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      bankAccount: {
        id: bankAccountRecord.id,
        bankName,
        branchName,
        accountNumber,
        shebaNumber: normSheba,
        hasCheckbook,
        hasVirtualCheck,
        currencyId: currencyRefId || '',
        currencyCode,
        currency: currencyCode,
        currencyName,
        currencySymbol,
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
