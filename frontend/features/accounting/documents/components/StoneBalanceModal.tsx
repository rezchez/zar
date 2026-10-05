'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Gem,
  Scale,
  X,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Clock,
  CheckCircle2,
  Info,
  Layers,
} from 'lucide-react';
import type { Customer, CustomerStoneItemDetail } from '@/lib/customer';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { CustomerTransaction } from '@/lib/transaction';
import { caratsToGrams, gramsToCarats, formatExactGemWeight } from '@/lib/gemstone-weight';
import { getShapeNameFa, getCutGradeNameFa } from '@/lib/gemstone';
import { toPersianDigits } from '@/lib/jalali';
import { faNumber } from '../utils/document-helpers';

export interface StoneBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  committedLines?: DocumentLine[];
}

export default function StoneBalanceModal({
  isOpen,
  onClose,
  customer,
  committedLines = [],
}: StoneBalanceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [historyTransactions, setHistoryTransactions] = useState<CustomerTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'summary' | 'history'>('details');
  const [showInfoBanner, setShowInfoBanner] = useState(false);
  const [serverStoneBalances, setServerStoneBalances] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch transactions history for this customer when modal opens
  useEffect(() => {
    if (!isOpen || !customer?.id) return;

    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError('');

    fetch(`/api/customers/${encodeURIComponent(customer.id)}/transactions`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('خطا در دریافت سوابق تراکنش‌های طرف‌حساب');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.transactions)) {
          setHistoryTransactions(data.transactions);
        }
        if (data?.stoneBalances) {
          setServerStoneBalances(data.stoneBalances);
        }
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err.message || 'خطا در بارگذاری');
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, customer?.id]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate live committed draft lines overall effect
  const draftEffect = useMemo(() => {
    let deltaCarats = 0;
    let deltaGrams = 0;
    let deltaPieces = 0;

    const stoneLines = committedLines.filter(
      (line) => line.documentTab === 'stone' || line.sourceTab === 'stone',
    );

    for (const line of stoneLines) {
      const details = line.details || {};
      const opKind = String(details.stoneOperationKind || '');
      const subType = String(line.documentSubType || '');
      const isTradeSettled = (opKind === 'purchase' || opKind === 'sale') && line.settlementMethod === 'cash';

      const rawCarats = Number(String(details.stoneCarats || '0').replace(/,/g, '')) || 0;
      const rawGrams = Number(String(details.stoneGrams || '0').replace(/,/g, '')) || 0;
      const rawPieces = Math.round(Number(String(details.stonePieces || '0').replace(/,/g, '')) || 0);

      const hasWeight = rawCarats > 0 || rawGrams > 0 || rawPieces > 0;
      const isWeightOp =
        opKind === 'entry' ||
        opKind === 'exit' ||
        opKind === 'purchase' ||
        opKind === 'sale' ||
        opKind === 'unsettled_purchase' ||
        opKind === 'unsettled_sale' ||
        subType === 'stone-entry' ||
        subType === 'stone-exit' ||
        subType === 'stone-purchase' ||
        subType === 'stone-sale' ||
        subType === 'stone-unsettled-purchase' ||
        subType === 'stone-unsettled-sale' ||
        line.settlementMethod === 'weight' ||
        line.settlementMethod === 'unsettled' ||
        (!isTradeSettled && hasWeight);

      if (!isWeightOp) continue;

      // قاعده بازار سنگ: خرید از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود (-1: بدهکار به ما)، فروش به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود (+1: بستانکار از ما)
      const isPurchase =
        line.documentNature === 'received' ||
        opKind === 'purchase' ||
        opKind === 'unsettled_purchase' ||
        opKind === 'entry' ||
        line.documentSubType === 'stone-purchase' ||
        line.documentSubType === 'stone-unsettled-purchase' ||
        line.documentSubType === 'stone-entry';
      const direction = isPurchase ? -1 : 1;

      const carats = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);
      const grams = rawGrams || (rawCarats > 0 ? caratsToGrams(rawCarats) : 0);
      const pieces = rawPieces;

      deltaCarats += carats * direction;
      deltaGrams += grams * direction;
      deltaPieces += pieces * direction;
    }

    return {
      hasDraft: stoneLines.length > 0,
      linesCount: stoneLines.length,
      deltaCarats: Math.round(deltaCarats * 1000) / 1000,
      deltaGrams: Math.round(deltaGrams * 10000) / 10000,
      deltaPieces,
    };
  }, [committedLines]);

  // Aggregate Detailed Stone Items (ریز طلب و بدهی سنگ با مشخصات، کیفیت، رنگ و شناسنامه)
  const detailedItems = useMemo(() => {
    const itemsMap: Record<
      string,
      CustomerStoneItemDetail & {
        draftCarats?: number;
        draftGrams?: number;
        draftPieces?: number;
        hasDraftEffect?: boolean;
      }
    > = {};

    // 1. From historyTransactions if loaded
    if (historyTransactions.length > 0) {
      for (const t of historyTransactions) {
        if (t.status !== 'final' && t.status !== 'posted') continue;
        const isStoneTx =
          t.documentTab === 'stone' ||
          t.documentSubType === 'stone-entry' ||
          t.documentSubType === 'stone-exit' ||
          t.documentSubType === 'stone-purchase' ||
          t.documentSubType === 'stone-sale' ||
          t.documentSubType === 'stone-unsettled-purchase' ||
          t.documentSubType === 'stone-unsettled-sale' ||
          (typeof t.documentSubType === 'string' && t.documentSubType.startsWith('stone-'));

        if (!isStoneTx) continue;

        let details: Record<string, unknown> = {};
        if (t.documentDetails) {
          if (typeof t.documentDetails === 'object' && t.documentDetails !== null) {
            details = t.documentDetails as Record<string, unknown>;
          } else if (typeof t.documentDetails === 'string') {
            try {
              details = JSON.parse(t.documentDetails);
            } catch {}
          }
        }

        const opKind = String(details.stoneOperationKind || '');
        const subType = String(t.documentSubType || '');
        const isTradeSettled = (opKind === 'purchase' || opKind === 'sale') && t.settlementMethod === 'cash';

        const rawCarats = Number(String(details.stoneCarats || '0').replace(/,/g, '')) || 0;
        const rawGrams = Number(String(details.stoneGrams || '0').replace(/,/g, '')) || 0;
        const rawPieces = Math.round(Number(String(details.stonePieces || '0').replace(/,/g, '')) || 0);

        const hasWeight = rawCarats > 0 || rawGrams > 0 || rawPieces > 0;
        const isWeightOp =
          opKind === 'entry' ||
          opKind === 'exit' ||
          opKind === 'purchase' ||
          opKind === 'sale' ||
          opKind === 'unsettled_purchase' ||
          opKind === 'unsettled_sale' ||
          subType === 'stone-entry' ||
          subType === 'stone-exit' ||
          subType === 'stone-purchase' ||
          subType === 'stone-sale' ||
          subType === 'stone-unsettled-purchase' ||
          subType === 'stone-unsettled-sale' ||
          t.settlementMethod === 'weight' ||
          t.settlementMethod === 'unsettled' ||
          (!isTradeSettled && hasWeight);

        if (!isWeightOp) continue;

        // قاعده بازار سنگ: خرید از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود (-1: بدهکار به ما)، فروش به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود (+1: بستانکار از ما)
        const isPurchase =
          t.documentNature === 'received' ||
          opKind === 'purchase' ||
          opKind === 'unsettled_purchase' ||
          opKind === 'entry' ||
          subType === 'stone-purchase' ||
          subType === 'stone-unsettled-purchase' ||
          subType === 'stone-entry';
        const direction = isPurchase ? -1 : 1;

        const carats = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);
        const grams = rawGrams || (rawCarats > 0 ? caratsToGrams(rawCarats) : 0);
        const pieces = rawPieces;

        const speciesId = String(details.stoneSpecies || details.stoneCategory || 'other_gemstone');
        const speciesName = String(details.stoneSpeciesName || details.stoneItemName || details.stoneCategory || 'سنگ');
        const category = String(details.stoneCategory || 'colored_gemstone');

        const shape = String(details.stoneShape || '');
        const shapeName = String(details.stoneShapeName || (shape ? getShapeNameFa(shape) : ''));

        let color = '';
        if (details.stoneColorMode === 'fancy') {
          color = [details.stoneFancyIntensity, details.stoneFancyHue].filter(Boolean).join(' ') || String(details.stoneColor || '');
        } else if (details.stoneColorRange) {
          color = String(details.stoneColorRange);
        } else if (details.stoneColor) {
          color = String(details.stoneColor);
        } else if (details.stoneColorHue) {
          color = String(details.stoneColorHue);
        }

        let clarity = '';
        if (details.stoneClarityRange) {
          clarity = String(details.stoneClarityRange);
        } else if (details.stoneClarity) {
          clarity = String(details.stoneClarity);
        }

        const rawCut = String(details.stoneCut || '');
        const cut = rawCut ? getCutGradeNameFa(rawCut) : '';
        const certLab = details.stoneCertificateLab && details.stoneCertificateLab !== 'none' ? String(details.stoneCertificateLab) : '';
        const certNumber = String(details.stoneCertificateNumber || details.stoneCertificateReportNumber || '');
        const laser = String(details.stoneLaserInscription || '');
        const lotNumber = String(details.stoneLotNumber || '');
        const sieveSize = String(details.stoneSieveSize || '');
        const measurements =
          details.stoneMeasurementsLength || details.stoneMeasurementsWidth
            ? `${details.stoneMeasurementsLength || '—'} × ${details.stoneMeasurementsWidth || '—'}${details.stoneMeasurementsDepth ? ` × ${details.stoneMeasurementsDepth}` : ''} mm`
            : '';
        const description = t.description || String(details.claimPurpose || '');

        const isParcel = details.stoneMode === 'parcel' || (!details.stoneMode && rawPieces > 1);
        const mode = isParcel ? ('parcel' as const) : ('single_stone' as const);
        const isReferenceSettlement = Boolean(details.unsettledReferenceId && itemsMap[String(details.unsettledReferenceId)]);
        const detailKey = isParcel
          ? `parcel__${speciesId}__${shape}__${color}__${clarity}__${rawCut}__${certLab}_${certNumber}__${mode}__${lotNumber}`
          : (details.unsettledReferenceId
              ? String(details.unsettledReferenceId)
              : `single__${t.id || (t as any).key || details.inventorySourceId || details.stoneInternalCode || `${speciesId}_${t.documentNumber || 'doc'}_${carats}_${shape}`}`);

        const effectiveDirection = isReferenceSettlement
          ? (itemsMap[String(details.unsettledReferenceId)].carats > 0 ? -1 : 1)
          : direction;
        const effectivePieceDir = isReferenceSettlement
          ? (itemsMap[String(details.unsettledReferenceId)].pieces > 0 ? -1 : 1)
          : direction;

        if (!itemsMap[detailKey]) {
          itemsMap[detailKey] = {
            key: detailKey,
            speciesId,
            speciesName,
            category,
            shape,
            shapeName,
            mode,
            color,
            clarity,
            cut,
            certificateLab: certLab,
            certificateNumber: certNumber,
            laserInscription: laser,
            lotNumber,
            sieveSize,
            measurements,
            description,
            carats: 0,
            grams: 0,
            pieces: 0,
            transactionsCount: 0,
            lastDate: t.documentDateJalali || t.transactionDate?.slice(0, 10),
            lastDocumentNumber: t.documentNumber,
            draftCarats: 0,
            draftGrams: 0,
            draftPieces: 0,
          };
        }
        itemsMap[detailKey].carats = Math.round((itemsMap[detailKey].carats + carats * effectiveDirection) * 1000) / 1000;
        itemsMap[detailKey].grams = Math.round((itemsMap[detailKey].grams + grams * effectiveDirection) * 10000) / 10000;
        itemsMap[detailKey].pieces += isReferenceSettlement ? Math.abs(pieces) * effectivePieceDir : (isParcel ? pieces * direction : (isPurchase ? -1 : 1));
        itemsMap[detailKey].transactionsCount = (itemsMap[detailKey].transactionsCount || 0) + 1;
        if (t.documentDateJalali) itemsMap[detailKey].lastDate = t.documentDateJalali;
        if (t.documentNumber) itemsMap[detailKey].lastDocumentNumber = t.documentNumber;
      }
    } else if (serverStoneBalances?.items && Array.isArray(serverStoneBalances.items) && serverStoneBalances.items.length > 0) {
      // 2. From serverStoneBalances
      for (const it of serverStoneBalances.items) {
        itemsMap[it.key] = { ...it, draftCarats: 0, draftGrams: 0, draftPieces: 0 };
      }
    } else if (Array.isArray(customer.stoneItemBalances) && customer.stoneItemBalances.length > 0) {
      // 3. From customer.stoneItemBalances
      for (const it of customer.stoneItemBalances) {
        itemsMap[it.key] = { ...it, draftCarats: 0, draftGrams: 0, draftPieces: 0 };
      }
    } else if (customer.stoneBalancesBySpecies) {
      // 4. Fallback from customer.stoneBalancesBySpecies
      for (const sp of Object.values(customer.stoneBalancesBySpecies)) {
        if (sp.items && sp.items.length > 0) {
          for (const it of sp.items) {
            itemsMap[it.key] = { ...it, draftCarats: 0, draftGrams: 0, draftPieces: 0 };
          }
        } else {
          itemsMap[sp.speciesId] = {
            key: sp.speciesId,
            speciesId: sp.speciesId,
            speciesName: sp.speciesName,
            category: sp.category,
            shape: sp.shape,
            shapeName: sp.shapeName,
            color: sp.color,
            clarity: sp.clarity,
            cut: sp.cut,
            certificateLab: sp.certificateLab,
            certificateNumber: sp.certificateNumber,
            carats: sp.carats,
            grams: sp.grams,
            pieces: sp.pieces,
            draftCarats: 0,
            draftGrams: 0,
            draftPieces: 0,
          };
        }
      }
    }

    // 5. Merge live draft lines from committedLines
    for (const line of committedLines) {
      if (line.documentTab !== 'stone' && line.sourceTab !== 'stone') continue;
      const details = (line.details || {}) as any;
      const opKind = String(details.stoneOperationKind || '');
      const subType = String(line.documentSubType || '');
      const isTradeSettled = (opKind === 'purchase' || opKind === 'sale') && line.settlementMethod === 'cash';

      const rawCarats = Number(String(details.stoneCarats || '0').replace(/,/g, '')) || 0;
      const rawGrams = Number(String(details.stoneGrams || '0').replace(/,/g, '')) || 0;
      const rawPieces = Math.round(Number(String(details.stonePieces || '0').replace(/,/g, '')) || 0);

      const hasWeight = rawCarats > 0 || rawGrams > 0 || rawPieces > 0;
      const isWeightOp =
        opKind === 'entry' ||
        opKind === 'exit' ||
        opKind === 'purchase' ||
        opKind === 'sale' ||
        opKind === 'unsettled_purchase' ||
        opKind === 'unsettled_sale' ||
        subType === 'stone-entry' ||
        subType === 'stone-exit' ||
        subType === 'stone-purchase' ||
        subType === 'stone-sale' ||
        subType === 'stone-unsettled-purchase' ||
        subType === 'stone-unsettled-sale' ||
        line.settlementMethod === 'weight' ||
        line.settlementMethod === 'unsettled' ||
        (!isTradeSettled && hasWeight);

      if (!isWeightOp) continue;

      // قاعده بازار سنگ: خرید از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود (-1: بدهکار به ما)، فروش به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود (+1: بستانکار از ما)
      const isPurchase =
        line.documentNature === 'received' ||
        opKind === 'purchase' ||
        opKind === 'unsettled_purchase' ||
        opKind === 'entry' ||
        line.documentSubType === 'stone-purchase' ||
        line.documentSubType === 'stone-unsettled-purchase' ||
        line.documentSubType === 'stone-entry';
      const direction = isPurchase ? -1 : 1;

      const carats = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);
      const grams = rawGrams || (rawCarats > 0 ? caratsToGrams(rawCarats) : 0);
      const pieces = rawPieces;

      const speciesId = String(details.stoneSpecies || details.stoneCategory || 'other_gemstone');
      const speciesName = String(details.stoneSpeciesName || details.stoneItemName || details.stoneCategory || 'سنگ');
      const category = String(details.stoneCategory || 'colored_gemstone');

      const shape = String(details.stoneShape || '');
      const shapeName = String(details.stoneShapeName || (shape ? getShapeNameFa(shape) : ''));

      let color = '';
      if (details.stoneColorMode === 'fancy') {
        color = [details.stoneFancyIntensity, details.stoneFancyHue].filter(Boolean).join(' ') || String(details.stoneColor || '');
      } else if (details.stoneColorRange) {
        color = String(details.stoneColorRange);
      } else if (details.stoneColor) {
        color = String(details.stoneColor);
      } else if (details.stoneColorHue) {
        color = String(details.stoneColorHue);
      }

      let clarity = '';
      if (details.stoneClarityRange) {
        clarity = String(details.stoneClarityRange);
      } else if (details.stoneClarity) {
        clarity = String(details.stoneClarity);
      }

      const rawCut = String(details.stoneCut || '');
      const cut = rawCut ? getCutGradeNameFa(rawCut) : '';
      const certLab = details.stoneCertificateLab && details.stoneCertificateLab !== 'none' ? String(details.stoneCertificateLab) : '';
      const certNumber = String(details.stoneCertificateNumber || '');
      const laser = String(details.stoneLaserInscription || '');

      const lotNumber = String(details.stoneLotNumber || '');
      const sieveSize = String(details.stoneSieveSize || '');
      const measurements =
        details.stoneMeasurementsLength || details.stoneMeasurementsWidth
          ? `${details.stoneMeasurementsLength || '—'} × ${details.stoneMeasurementsWidth || '—'}${details.stoneMeasurementsDepth ? ` × ${details.stoneMeasurementsDepth}` : ''} mm`
          : '';

      const isParcel = details.stoneMode === 'parcel' || (!details.stoneMode && rawPieces > 1);
      const mode = isParcel ? ('parcel' as const) : ('single_stone' as const);
      const isReferenceSettlement = Boolean(details.unsettledReferenceId && itemsMap[String(details.unsettledReferenceId)]);
      const detailKey = isParcel
        ? `parcel__${speciesId}__${shape}__${color}__${clarity}__${rawCut}__${certLab}_${certNumber}__${mode}__${lotNumber}`
        : (isReferenceSettlement
            ? String(details.unsettledReferenceId)
            : `single__draft_${line.id || (line as any).key || Math.random().toString(36).slice(2)}`);

      const effectiveDirection = isReferenceSettlement
        ? (itemsMap[String(details.unsettledReferenceId)].carats > 0 ? -1 : 1)
        : direction;
      const effectivePieceDir = isReferenceSettlement
        ? (itemsMap[String(details.unsettledReferenceId)].pieces > 0 ? -1 : 1)
        : direction;

      if (!itemsMap[detailKey]) {
        itemsMap[detailKey] = {
          key: detailKey,
          speciesId,
          speciesName,
          category,
          shape,
          shapeName,
          mode,
          color,
          clarity,
          cut,
          certificateLab: certLab,
          certificateNumber: certNumber,
          laserInscription: laser,
          lotNumber,
          sieveSize,
          measurements,
          carats: 0,
          grams: 0,
          pieces: 0,
          draftCarats: 0,
          draftGrams: 0,
          draftPieces: 0,
        };
      }
      itemsMap[detailKey].draftCarats = Math.round(((itemsMap[detailKey].draftCarats || 0) + carats * effectiveDirection) * 1000) / 1000;
      itemsMap[detailKey].draftGrams = Math.round(((itemsMap[detailKey].draftGrams || 0) + grams * effectiveDirection) * 10000) / 10000;
      itemsMap[detailKey].draftPieces = (itemsMap[detailKey].draftPieces || 0) + (isReferenceSettlement ? Math.abs(pieces) * effectivePieceDir : (isParcel ? pieces * direction : (isPurchase ? -1 : 1)));
      itemsMap[detailKey].hasDraftEffect = true;
    }

    return Object.values(itemsMap).filter(
      (it) => it.carats !== 0 || (it.draftCarats && it.draftCarats !== 0) || it.pieces !== 0,
    );
  }, [customer, historyTransactions, committedLines]);

  // Historical stone transactions table list
  const stoneHistory = useMemo(() => {
    return historyTransactions
      .filter((t) => t.documentTab === 'stone' || t.documentSubType?.startsWith('stone-'))
      .map((t) => {
        let details: Record<string, unknown> = {};
        if (t.documentDetails) {
          if (typeof t.documentDetails === 'object' && t.documentDetails !== null) {
            details = t.documentDetails as Record<string, unknown>;
          } else if (typeof t.documentDetails === 'string') {
            try {
              details = JSON.parse(t.documentDetails);
            } catch {}
          }
        }

        const rawCarats = Number(String(details.stoneCarats || '0').replace(/,/g, '')) || 0;
        const rawGrams = Number(String(details.stoneGrams || '0').replace(/,/g, '')) || 0;
        const rawPieces = Math.round(Number(String(details.stonePieces || '0').replace(/,/g, '')) || 0);

        const carats = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);
        const grams = rawGrams || (rawCarats > 0 ? caratsToGrams(rawCarats) : 0);

        const speciesName = String(details.stoneSpeciesName || details.stoneItemName || details.stoneSpecies || 'سنگ');
        const shape = String(details.stoneShape || '');
        const shapeName = String(details.stoneShapeName || (shape ? getShapeNameFa(shape) : ''));
        const opKind = String(details.stoneOperationKind || '');

        let color = '';
        if (details.stoneColorMode === 'fancy') {
          color = [details.stoneFancyIntensity, details.stoneFancyHue].filter(Boolean).join(' ') || String(details.stoneColor || '');
        } else if (details.stoneColorRange) {
          color = String(details.stoneColorRange);
        } else if (details.stoneColor) {
          color = String(details.stoneColor);
        } else if (details.stoneColorHue) {
          color = String(details.stoneColorHue);
        }

        let clarity = '';
        if (details.stoneClarityRange) {
          clarity = String(details.stoneClarityRange);
        } else if (details.stoneClarity) {
          clarity = String(details.stoneClarity);
        }

        const certLab = details.stoneCertificateLab && details.stoneCertificateLab !== 'none' ? String(details.stoneCertificateLab) : '';
        const certNumber = String(details.stoneCertificateNumber || details.stoneCertificateReportNumber || '');

        let opLabel = 'عملیات سنگ';
        if (opKind === 'entry' || t.documentSubType === 'stone-entry') opLabel = 'ورود سنگ';
        else if (opKind === 'exit' || t.documentSubType === 'stone-exit') opLabel = 'خروج سنگ';
        else if (opKind === 'unsettled_purchase' || t.documentSubType === 'stone-unsettled-purchase') opLabel = 'خرید سنگ (بدون تسویه)';
        else if (opKind === 'unsettled_sale' || t.documentSubType === 'stone-unsettled-sale') opLabel = 'فروش سنگ (بدون تسویه)';
        else if (opKind === 'purchase' || t.documentSubType === 'stone-purchase') opLabel = 'خرید نقدی سنگ';
        else if (opKind === 'sale' || t.documentSubType === 'stone-sale') opLabel = 'فروش نقدی سنگ';
        else if (t.documentNature === 'received') opLabel = 'ورود سنگ';
        else if (t.documentNature === 'paid') opLabel = 'خروج سنگ';

        return {
          id: t.id,
          documentNumber: t.documentNumber || '—',
          date: t.documentDateJalali || t.transactionDate?.slice(0, 10) || '—',
          nature: t.documentNature,
          opLabel,
          speciesName,
          shapeName,
          color,
          clarity,
          certLab,
          certNumber,
          carats,
          grams,
          pieces: rawPieces,
          description: t.description || String(details.claimPurpose || ''),
        };
      });
  }, [historyTransactions]);

  // Base customer balances
  const baseCarats = customer.stoneCaratBalance ?? 0;
  const baseGrams = customer.stoneGramBalance ?? caratsToGrams(baseCarats);
  const basePieces = customer.stonePiecesBalance ?? 0;

  // Segregated credit and debit items across non-fungible types
  const creditItems = useMemo(() => detailedItems.filter((it) => it.carats > 0), [detailedItems]);
  const debitItems = useMemo(() => detailedItems.filter((it) => it.carats < 0), [detailedItems]);
  const settledItems = useMemo(() => detailedItems.filter((it) => it.carats === 0), [detailedItems]);

  const totalCreditCarats = useMemo(
    () => Math.round(creditItems.reduce((acc, it) => acc + it.carats, 0) * 1e8) / 1e8,
    [creditItems],
  );
  const totalCreditGrams = useMemo(
    () => Math.round(creditItems.reduce((acc, it) => acc + (it.grams || (it.carats ? it.carats * 0.2 : 0)), 0) * 1e8) / 1e8,
    [creditItems],
  );
  const totalCreditPieces = useMemo(
    () => creditItems.reduce((acc, it) => acc + (it.pieces || 0), 0),
    [creditItems],
  );

  const totalDebitCarats = useMemo(
    () => Math.round(debitItems.reduce((acc, it) => acc + Math.abs(it.carats), 0) * 1e8) / 1e8,
    [debitItems],
  );
  const totalDebitGrams = useMemo(
    () => Math.round(debitItems.reduce((acc, it) => acc + Math.abs(it.grams || (it.carats ? it.carats * 0.2 : 0)), 0) * 1e8) / 1e8,
    [debitItems],
  );
  const totalDebitPieces = useMemo(
    () => debitItems.reduce((acc, it) => acc + Math.abs(it.pieces || 0), 0),
    [debitItems],
  );

  const hasOpposing = creditItems.length > 0 && debitItems.length > 0;

  // Projected balances including current draft lines
  const projectedCarats = Math.round((baseCarats + draftEffect.deltaCarats) * 1000) / 1000;
  const projectedGrams = Math.round((baseGrams + draftEffect.deltaGrams) * 10000) / 10000;
  const projectedPieces = basePieces + draftEffect.deltaPieces;

  if (!isOpen || !mounted) return null;

  // Status text helpers
  const getStatusText = (val: number) =>
    val > 0 ? 'بستانکار از ما (طلب سنگ مشتری)' : val < 0 ? 'بدهکار به ما (بدهی سنگ مشتری)' : 'تسویه حساب سنگ';

  const getStatusBadgeClass = (val: number) =>
    val > 0
      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/60 font-black'
      : val < 0
      ? 'bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/60 font-black'
      : 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 font-bold';

  const renderStoneItemCard = (item: (typeof detailedItems)[0]) => {
    const isCredit = item.carats > 0;
    const isDebit = item.carats < 0;
    const netCarats = item.carats + (item.draftCarats || 0);

    return (
      <div
        key={item.key}
        className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-all space-y-3.5 ${
          isCredit
            ? 'border-emerald-300 dark:border-emerald-500/50 bg-white dark:bg-slate-800/95 hover:border-emerald-500 dark:hover:border-emerald-400'
            : isDebit
            ? 'border-rose-300 dark:border-rose-500/50 bg-white dark:bg-slate-800/95 hover:border-rose-500 dark:hover:border-rose-400'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90'
        }`}
      >
        {/* 1. Header: Title, Shape, Mode & Status */}
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isCredit
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-500/60'
                  : isDebit
                  ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-300/60 dark:border-rose-500/60'
                  : 'bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
              }`}
            >
              <Gem className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {item.speciesName}
                </h4>
                {item.shapeName ? (
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600">
                    تراش {item.shapeName}
                  </span>
                ) : null}
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {item.mode === 'parcel' ? '(بارخانه / ملّه)' : '(تک‌سنگ)'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                {item.lastDocumentNumber ? `آخرین سند ثبت‌شده: ${item.lastDocumentNumber}` : ''}
                {item.lastDate ? ` · تاریخ: ${item.lastDate}` : ''}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border shadow-2xs ${
              isCredit
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/60'
                : isDebit
                ? 'bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/60'
                : 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
            }`}
          >
            {isCredit ? (
              <ArrowDownLeft size={13} className="text-emerald-700 dark:text-emerald-300" />
            ) : isDebit ? (
              <ArrowUpRight size={13} className="text-rose-700 dark:text-rose-300" />
            ) : null}
            <span>{getStatusText(item.carats)}</span>
          </span>
        </div>

        {/* 2. 4Cs & Specifications Badges Row (رنگ، پاکی / کیفیت، کیفیت تراش، شناسنامه، ابعاد) */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {/* Color Badge */}
          {item.color ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/70 text-amber-950 dark:text-amber-100 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0"></span>
              <span className="text-amber-800 dark:text-amber-300 font-bold">رنگ:</span>
              <span className="font-black font-mono text-xs sm:text-sm text-amber-950 dark:text-white">{item.color}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              <span>رنگ: مشخص‌نشده</span>
            </div>
          )}

          {/* Clarity & Quality Badge */}
          {item.clarity ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/20 border border-sky-300 dark:border-sky-400/70 text-sky-950 dark:text-sky-100 text-xs font-bold shadow-2xs">
              <Sparkles size={12} className="text-sky-600 dark:text-sky-300 shrink-0" />
              <span className="text-sky-800 dark:text-sky-300 font-bold">پاکی / کیفیت:</span>
              <span className="font-black font-mono text-xs sm:text-sm text-sky-950 dark:text-white">{item.clarity}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              <span>پاکی: مشخص‌نشده</span>
            </div>
          )}

          {/* Cut Grade Badge */}
          {item.cut ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/20 border border-purple-300 dark:border-purple-400/70 text-purple-950 dark:text-purple-100 text-xs font-bold shadow-2xs">
              <span className="text-purple-800 dark:text-purple-300 font-bold">کیفیت تراش:</span>
              <span className="font-black text-purple-950 dark:text-white">{item.cut}</span>
            </div>
          ) : null}

          {/* Certificate Badge */}
          {item.certificateLab ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-500/20 border border-teal-300 dark:border-teal-400/70 text-teal-950 dark:text-teal-100 text-xs font-bold shadow-2xs">
              <CheckCircle2 size={12} className="text-teal-600 dark:text-teal-300 shrink-0" />
              <span className="text-teal-800 dark:text-teal-300 font-bold">شناسنامه:</span>
              <span className="font-black font-mono text-teal-950 dark:text-white">
                {item.certificateLab}
                {item.certificateNumber ? ` · ${toPersianDigits(item.certificateNumber)}` : ''}
              </span>
            </div>
          ) : null}

          {/* Laser Inscription */}
          {item.laserInscription ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-300 font-bold">کد لیزر:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{toPersianDigits(item.laserInscription)}</span>
            </div>
          ) : null}

          {/* Sieve Size */}
          {item.sieveSize ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-400/70 text-indigo-950 dark:text-indigo-100 text-xs font-bold">
              <span className="text-indigo-800 dark:text-indigo-300 font-bold">الک:</span>
              <span className="font-mono font-black text-indigo-950 dark:text-white">{item.sieveSize}</span>
            </div>
          ) : null}

          {/* Measurements */}
          {item.measurements ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-300 font-bold">ابعاد:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{toPersianDigits(item.measurements)}</span>
            </div>
          ) : null}
        </div>

        {/* 3. Numerical Weights & Piece Count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/80">
          {/* Carats */}
          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">مجموع وزن به قیراط:</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {formatExactGemWeight(Math.abs(item.carats))}
              </strong>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">قیراط (ct)</span>
            </div>
          </div>

          {/* Grams */}
          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">معادل دقیق به گرم:</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {formatExactGemWeight(Math.abs(item.grams || (item.carats ? item.carats * 0.2 : 0)))}
              </strong>
              <span className="text-xs font-black text-teal-600 dark:text-teal-400">گرم (g)</span>
            </div>
          </div>

          {/* Pieces */}
          <div className="flex items-center justify-between sm:flex-col sm:items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">تعداد کل نگین:</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {item.pieces !== 0 ? faNumber(Math.abs(Math.round(item.pieces)), 0) : '—'}
              </strong>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                {item.pieces !== 0 ? 'عدد' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Live Draft Impact */}
        {item.hasDraftEffect && item.draftCarats !== 0 && (
          <div className="rounded-xl bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-600/70 p-2.5 text-xs flex items-center justify-between text-amber-950 dark:text-amber-100 font-bold">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-600 dark:text-amber-300" />
              <span className="text-amber-900 dark:text-amber-200">گردش این قلم در سند جاری:</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-slate-300">اثر: </span>
              <span className={(item.draftCarats ?? 0) > 0 ? 'text-emerald-700 dark:text-emerald-300 font-black' : 'text-rose-700 dark:text-rose-300 font-black'}>
                {(item.draftCarats ?? 0) > 0 ? '+' : ''}
                {formatExactGemWeight(item.draftCarats ?? 0)} ct
              </span>
              <span className="mx-1.5 text-slate-400 dark:text-slate-500">←</span>
              <span className="text-slate-700 dark:text-slate-200">
                مانده پس از ثبت سند:{' '}
                <strong className="font-mono text-slate-950 dark:text-white font-black">
                  {formatExactGemWeight(Math.abs(netCarats))} ct
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="stone-modal-title"
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-all text-right"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500/20 to-amber-600/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40">
              <Gem className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="stone-modal-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  وضعیت و تراز وزنی سنگ
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInfoBanner((prev) => !prev)}
                  title="قاعده ماهیت معامله سنگ و عدم تهاتر: خرید سنگ از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود · فروش سنگ به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-all cursor-pointer ${
                    showInfoBanner
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-400/40'
                      : 'bg-amber-100/90 hover:bg-amber-200 text-amber-900 border-amber-300/80 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/90'
                  }`}
                  aria-label="راهنمای قاعده ماهیت معامله سنگ و عدم تهاتر"
                >
                  <Info size={13} />
                </button>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 border border-amber-300/60 dark:border-amber-500/60">
                  {customer.name}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                کد طرف‌حساب: {toPersianDigits(customer.customerCode || 0)} · مشاهده تفکیکی و دقیق تمامی اوزان سنگ، قیراط، گرم و سوابق
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            aria-label="بستن پنجره"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Expandable Info Banner Toggled by (i) */}
        {showInfoBanner && (
          <div className="border-b border-amber-300/80 bg-amber-50/95 dark:border-amber-700/80 dark:bg-amber-950/90 px-4 py-3 sm:px-6 transition-all text-xs text-amber-950 dark:text-amber-100 shadow-2xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-black text-amber-950 dark:text-amber-100 text-xs">
                    قاعده ماهیت معامله سنگ و عدم تهاتر:
                  </p>
                  <p className="text-[11px] sm:text-xs leading-relaxed text-amber-900 dark:text-amber-200 font-medium">
                    خرید سنگ از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود · فروش سنگ به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود. سنگ‌های تکی کاملاً یونیک و یکتا هستند و حتی در صورت خرید و فروش با مشخصات یکسان هرگز با یکدیگر تهاتر یا کسر نمی‌شوند و هر کدام قلمی خاص و مجزا هستند؛ فقط در سنگ‌های بارخانه‌ای (بسته‌ای) امکان کسر و ادغام موجودی وجود دارد.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoBanner(false)}
                className="text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                title="بستن راهنما"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/90 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-black transition-all ${
              activeTab === 'details'
                ? 'border-amber-500 text-amber-700 dark:text-amber-300 bg-white dark:bg-slate-800/90 rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>ریز طلب و بدهی سنگ</span>
            {detailedItems.length > 0 ? (
              <span className="rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 px-2 py-0.2 text-[11px] font-black">
                {toPersianDigits(detailedItems.length)}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-black transition-all ${
              activeTab === 'summary'
                ? 'border-amber-500 text-amber-700 dark:text-amber-300 bg-white dark:bg-slate-800/90 rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Scale className="h-4 w-4 text-teal-500" />
            <span>خلاصه و تراز کلی</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-black transition-all ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-700 dark:text-amber-300 bg-white dark:bg-slate-800/90 rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Clock className="h-4 w-4 text-indigo-500" />
            <span>ریز سوابق و گردش اسناد</span>
            {stoneHistory.length > 0 ? (
              <span className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-2 py-0.2 text-[11px] font-black">
                {toPersianDigits(stoneHistory.length)}
              </span>
            ) : null}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: Detailed Items with Color, Clarity, Cut, Cert & Weights */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {detailedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
                  <Gem className="h-10 w-10 mx-auto text-amber-500/40" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    هیچ سابقه طلب یا بدهی وزنی سنگ برای این طرف‌حساب ثبت نشده است.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    با ثبت ردیف‌های ورود سنگ یا خروج سنگ در اسناد، ریز طلب با مشخصات کامل در این بخش درج می‌گردد.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header info bar */}
                  <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 font-bold px-1">
                    <span>فهرست تفکیکی اقلام سنگ طلبکار / بدهکار با جزئیات کامل:</span>
                    <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-md border border-amber-300/60 dark:border-amber-700/60 font-black">
                      {toPersianDigits(detailedItems.length)} قلم مجزا
                    </span>
                  </div>

                  {/* Educational Non-Fungibility Guidance Alert */}
                  <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-950/40 p-3 sm:p-3.5 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2.5 shadow-2xs">
                    <Sparkles size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-black text-amber-950 dark:text-amber-200">
                        قاعده اساسی معامله و تفکیک گوهرها:
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90 font-medium">
                        خرید سنگ از مشتری یعنی مشتری سنگ را به ما بدهکار می‌شود، و فروش سنگ به مشتری یعنی مشتری سنگ را از ما طلبکار می‌شود. همچنین بر خلاف طلا، سنگ‌ها غیرهمگن هستند و ارزش هر گوهر کاملاً وابسته به مشخصات ۴Cs (رنگ، پاکی، تراش و وزن)، گونه و شناسنامه آن است؛ بنابراین اقلام طلب و بدهی هرگز با یکدیگر جمع یا تهاتر کور نمی‌شوند و به تفکیک نگهداری می‌گردند.
                      </p>
                    </div>
                  </div>

                  {/* SECTION 1: اقلام طلب سنگ مشتری از ما (بستانکار از ما) */}
                  {creditItems.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 px-3.5 rounded-xl border border-emerald-200 dark:border-emerald-700/60 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100">
                            اقلام طلب سنگ مشتری از ما (بستانکار از ما)
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            ({toPersianDigits(creditItems.length)} قلم مجزا)
                          </span>
                        </div>
                        <div className="text-xs font-mono font-black text-emerald-900 dark:text-emerald-200">
                          مجموع طلب: {formatExactGemWeight(totalCreditCarats)} ct · {formatExactGemWeight(totalCreditGrams)} g {totalCreditPieces > 0 ? `· ${toPersianDigits(String(totalCreditPieces))} عدد` : ''}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {creditItems.map(renderStoneItemCard)}
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: اقلام بدهی سنگ مشتری به ما (بدهکار به ما) */}
                  {debitItems.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/60 p-2.5 px-3.5 rounded-xl border border-rose-200 dark:border-rose-700/60 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
                          <span className="text-xs sm:text-sm font-black text-rose-950 dark:text-rose-100">
                            اقلام بدهی سنگ مشتری به ما (بدهکار به ما)
                          </span>
                          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                            ({toPersianDigits(debitItems.length)} قلم مجزا)
                          </span>
                        </div>
                        <div className="text-xs font-mono font-black text-rose-900 dark:text-rose-200">
                          مجموع بدهی: {formatExactGemWeight(totalDebitCarats)} ct · {formatExactGemWeight(totalDebitGrams)} g {totalDebitPieces > 0 ? `· ${toPersianDigits(String(totalDebitPieces))} عدد` : ''}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {debitItems.map(renderStoneItemCard)}
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: اقلام تسویه‌شده وزنی سنگ */}
                  {settledItems.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          اقلام تسویه‌شده وزنی سنگ (مانده صفر - {toPersianDigits(settledItems.length)} قلم)
                        </span>
                      </div>
                      <div className="space-y-3">
                        {settledItems.map(renderStoneItemCard)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Summary KPIs & Overall Balance */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {hasOpposing && (
                <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-950/40 p-3 sm:p-3.5 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2.5 shadow-2xs">
                  <Sparkles size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-black text-amber-950 dark:text-amber-200">
                      تفکیک وضعیت‌های ناهمگن (طلب و بدهی همزمان):
                    </p>
                    <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90 font-medium">
                      این طرف‌حساب به طور همزمان دارای اقلام طلب سنگ و اقلام بدهی سنگ با مشخصات کیفی متفاوت است. به دلیل غیرهمگن بودن گوهرها، این دو مانده با یکدیگر تهاتر کور نمی‌شوند و هر یک به صورت مستقل پیگیری و تسویه می‌گردد.
                    </p>
                  </div>
                </div>
              )}

              {/* Segregated Opposing KPI Cards */}
              {hasOpposing ? (
                <div className="space-y-4">
                  {/* Credit Stones KPI Group */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200 px-1">
                      <span>مجموع طلب‌های سنگ مشتری از ما (بستانکار از ما - {toPersianDigits(creditItems.length)} قلم مجزا):</span>
                      <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-600 font-black">
                        بستانکار از ما
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-700/60 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">مجموع وزن به قیراط</span>
                          <Gem size={15} className="text-amber-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                            {formatExactGemWeight(totalCreditCarats)}
                          </strong>
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400">قیراط (ct)</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-700/60 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">معادل دقیق به گرم</span>
                          <Scale size={15} className="text-teal-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                            {formatExactGemWeight(totalCreditGrams)}
                          </strong>
                          <span className="text-xs font-black text-teal-600 dark:text-teal-400">گرم (g)</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-700/60 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">تعداد کل نگین</span>
                          <Package size={15} className="text-indigo-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                            {totalCreditPieces !== 0 ? toPersianDigits(String(totalCreditPieces)) : '—'}
                          </strong>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">عدد</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Debit Stones KPI Group */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-200 px-1">
                      <span>مجموع بدهی‌های سنگ مشتری به ما (بدهکار به ما - {toPersianDigits(debitItems.length)} قلم مجزا):</span>
                      <span className="bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 px-2 py-0.5 rounded-md border border-rose-300 dark:border-rose-600 font-black">
                        بدهکار به ما
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-rose-200 dark:border-rose-700/60 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">مجموع وزن به قیراط</span>
                          <Gem size={15} className="text-amber-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                            {formatExactGemWeight(totalDebitCarats)}
                          </strong>
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400">قیراط (ct)</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 dark:border-rose-700/60 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">معادل دقیق به گرم</span>
                          <Scale size={15} className="text-teal-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                            {formatExactGemWeight(totalDebitGrams)}
                          </strong>
                          <span className="text-xs font-black text-teal-600 dark:text-teal-400">گرم (g)</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 dark:border-rose-700/60 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">تعداد کل نگین</span>
                          <Package size={15} className="text-indigo-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                            {totalDebitPieces !== 0 ? toPersianDigits(String(totalDebitPieces)) : '—'}
                          </strong>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">عدد</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Primary KPI Cards Grid */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Carats Total */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        مجموع وزن به قیراط
                      </span>
                      <span className="text-amber-500">
                        <Gem size={15} />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                        {formatExactGemWeight(Math.abs(baseCarats))}
                      </strong>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">قیراط (ct)</span>
                    </div>
                    <div className="mt-2">
                      <span className={`inline-block border px-2 py-0.5 rounded-md text-[11px] font-black ${getStatusBadgeClass(baseCarats)}`}>
                        {getStatusText(baseCarats)}
                      </span>
                    </div>
                  </div>

                  {/* 2. Grams Equivalent */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        معادل دقیق به گرم
                      </span>
                      <span className="text-teal-500">
                        <Scale size={15} />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                        {formatExactGemWeight(Math.abs(baseGrams))}
                      </strong>
                      <span className="text-xs font-black text-teal-600 dark:text-teal-400">گرم (g)</span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      مبنا: ۱ قیراط = ۰.۲ گرم استاندارد
                    </div>
                  </div>

                  {/* 3. Pieces Total - Integer! */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        تعداد کل نگین
                      </span>
                      <span className="text-indigo-500">
                        <Package size={15} />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <strong className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {basePieces !== 0 ? faNumber(Math.abs(Math.round(basePieces)), 0) : '—'}
                      </strong>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">عدد</span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      {basePieces !== 0 ? 'مجموع تعداد ثبت‌شده در دفاتر' : 'بدون ثبت تعداد'}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Document Live Effect Box (if document lines exist) */}
              {draftEffect.hasDraft ? (
                <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 dark:border-amber-700/80 dark:bg-amber-950/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    <h4 className="text-xs font-black text-amber-950 dark:text-amber-100">
                      گردش و اثر ردیف‌های سنگ پین‌شده در این سند ({toPersianDigits(draftEffect.linesCount)} ردیف)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-amber-200/80 dark:border-amber-800/60">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">مانده قبل:</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5 block font-mono">
                        {formatExactGemWeight(Math.abs(baseCarats))} ct ({getStatusText(baseCarats)})
                      </strong>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-amber-200/80 dark:border-amber-800/60">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">اثر این سند:</span>
                      <strong
                        className={`text-sm font-black mt-0.5 block font-mono ${
                          draftEffect.deltaCarats >= 0
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {draftEffect.deltaCarats > 0 ? '+' : ''}
                        {formatExactGemWeight(draftEffect.deltaCarats)} ct ({formatExactGemWeight(draftEffect.deltaGrams)} g)
                      </strong>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-amber-200/80 dark:border-amber-800/60">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">مانده پس از ثبت سند:</span>
                      <strong className="text-sm font-black text-slate-950 dark:text-white mt-0.5 block font-mono">
                        {formatExactGemWeight(Math.abs(projectedCarats))} ct ({getStatusText(projectedCarats)})
                      </strong>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Status Explanation Card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-4 text-xs text-slate-700 dark:text-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                  <Info className="h-4 w-4 text-amber-500" />
                  <span>راهنمای تراز و اصطلاحات بدهی سنگ:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  • <strong className="text-slate-900 dark:text-white">بستانکار از ما (طلب سنگ):</strong> طرف‌حساب به کارگاه یا بنکداری ما سنگ تحویل داده است (ورود سنگ یا امانی) و ما این مقدار سنگ را با مشخصات کیفی ذکرشده به او بدهکاریم.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  • <strong className="text-slate-900 dark:text-white">بدهکار به ما (بدهی سنگ):</strong> طرف‌حساب از ما سنگ تحویل گرفته است (خروج سنگ) و این مقدار سنگ را به ما بدهکار است.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  • <strong className="text-slate-900 dark:text-white">تسویه حساب:</strong> مجموع ورود و خروج‌های وزنی سنگ برابر و بدون مانده بدهی است.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: History & Ledger Table */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-amber-600 dark:text-amber-400 font-bold">
                  در حال بارگذاری ریز اسناد سنگ...
                </div>
              ) : stoneHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-40 text-amber-500" />
                  <p>هیچ سابقه گردش سندی برای سنگ این طرف‌حساب یافت نشد.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-800 dark:text-slate-200">
                      <tr>
                        <th className="p-2.5">تاریخ</th>
                        <th className="p-2.5">شماره سند</th>
                        <th className="p-2.5">نوع عملیات</th>
                        <th className="p-2.5">گونه و شکل</th>
                        <th className="p-2.5">رنگ و پاکی</th>
                        <th className="p-2.5">شناسنامه</th>
                        <th className="p-2.5 text-center">وزن (قیراط)</th>
                        <th className="p-2.5 text-center">وزن (گرم)</th>
                        <th className="p-2.5 text-center">تعداد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                      {stoneHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                          <td className="p-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{item.date}</td>
                          <td className="p-2.5 whitespace-nowrap font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">{item.documentNumber}</td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                item.nature === 'received'
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60'
                                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-300 dark:border-rose-700/60'
                              }`}
                            >
                              {item.nature === 'received' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                              {item.opLabel}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                            {item.speciesName} {item.shapeName ? `· ${item.shapeName}` : ''}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-slate-700 dark:text-slate-200">
                            {item.color || item.clarity ? `${item.color || '—'} / ${item.clarity || '—'}` : '—'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-slate-700 dark:text-slate-200 font-mono text-[11px]">
                            {item.certLab ? `${item.certLab} ${item.certNumber ? `(${item.certNumber})` : ''}` : '—'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-center font-mono font-bold text-amber-700 dark:text-amber-300">
                            {formatExactGemWeight(item.carats)}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-center font-mono font-bold text-teal-700 dark:text-teal-300">
                            {formatExactGemWeight(item.grams)}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-center font-bold text-slate-900 dark:text-white">
                            {item.pieces !== 0 ? `${faNumber(Math.abs(Math.round(item.pieces)), 0)} عدد` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {hasOpposing ? (
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>طلب سنگ:</span>
                <strong className="font-mono text-emerald-700 dark:text-emerald-300 font-black">
                  {formatExactGemWeight(totalCreditCarats)} ct
                </strong>
                <span className="mx-1 text-slate-400 dark:text-slate-500">|</span>
                <span>بدهی سنگ:</span>
                <strong className="font-mono text-rose-700 dark:text-rose-300 font-black">
                  {formatExactGemWeight(totalDebitCarats)} ct
                </strong>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300/60 dark:border-amber-700/60 font-medium">
                  (اقلام تفکیکی - عدم تهاتر کور)
                </span>
              </span>
            ) : (
              <>
                <span>تراز نهایی: </span>
                <span className="font-mono text-slate-900 dark:text-white font-black">
                  {formatExactGemWeight(Math.abs(baseCarats))} ct
                </span>
                <span className="mx-1 text-slate-400 dark:text-slate-500">|</span>
                <span className="font-mono text-slate-900 dark:text-white font-black">
                  {formatExactGemWeight(Math.abs(baseGrams))} g
                </span>
                <span className="mx-1 text-slate-400 dark:text-slate-500">|</span>
                <span className="font-mono text-slate-900 dark:text-white font-black">
                  {faNumber(Math.abs(Math.round(basePieces)), 0)} عدد
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
