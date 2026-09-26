'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Calculator,
  Check,
  ChevronDown,
  DollarSign,
  Gem,
  Info,
  Layers,
  ListPlus,
  Package,
  Plus,
  RotateCcw,
  Scale,
  Settings,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';

import AmountRoundingModal from '@/features/accounting/documents/components/AmountRoundingModal';
import ShapeSettingsModal, {
  loadShapePreferences,
  buildHierarchicalShapeOrder,
  type ShapePreferences,
} from '@/features/gemstones/components/ShapeSettingsModal';
import GemstoneShapeIcon from '@/features/gemstones/components/GemstoneShapeIcon';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import { PriceInput } from '@/components/ui/price-input';
import { NumberField } from '@/components/ui/number-field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import {
  caratsToGrams,
  formatCarat,
  formatGemGram,
  gramsToCarats,
  parseWeight,
} from '@/lib/gemstone-weight';
import {
  CLARITY_GRADES,
  COLORED_HUES,
  COLOR_ORIGINS,
  CUT_GRADES,
  D_Z_COLORS,
  FANCY_INTENSITIES,
  FLUORESCENCE_GRADES,
  GEMSTONE_LABS,
  GEMSTONE_SHAPES,
  GEMSTONE_SPECIES,
  GEMSTONE_TREATMENTS,
  ORIGIN_COUNTRIES,
  ORIGIN_SOURCES,
  POLISH_SYMMETRY_GRADES,
  SATURATIONS,
  TONES,
  TRANSPARENCIES,
  ROOT_CATEGORIES,
  LAB_GROWTH_METHODS,
  SYNTHETIC_METHODS,
  CUBIC_ZIRCONIA_ADVISORY,
  cleanSpeciesNameFa,
  formatSpeciesOptionLabel,
  formatRootCategoryShortFa,
  buildSpeciesListForRoot,
  resolveSpeciesForRootChange,
  POST_GROWTH_TREATMENTS,
  isLondonBlueTopaz,
  validateColorRange,
  validateClarityRange,
  getAllowedColorEndGrades,
  getAllowedClarityEndGrades,
  generatePoolIdentityKey,
  type GemstoneCategory,
  type GemstoneTypeRecord,
  type RootCategory,
  type LabGrowthMethod,
  type PostGrowthTreatment,
  type GemstoneSpeciesItem,
  getSpeciesForRootCategory,
  findSpeciesItem,
  normalizeSpeciesId,
  parseColorRangeString,
  parseClarityRangeString,
  getColorTier,
  getClarityTier,
} from '@/lib/gemstone';
import {
  DIAMOND_SIEVE_CHART,
  findSieveBySize,
  estimatePiecesFromCarats,
  estimateCaratsFromPieces,
  type DiamondSieveRecord,
} from '@/lib/gemstone-sieve';
import type { StorageLocationItem } from '@/app/api/storage-locations/route';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { formatNumberWithCommas, parseLocalizedAmount } from '@/lib/money';

export type StoneOperationKind =
  | 'entry' // ورود سنگ (تحویل فیزیکی)
  | 'purchase' // خرید سنگ (معامله با تسویه)
  | 'unsettled_purchase' // خرید سنگ بدون تسویه
  | 'exit' // خروج سنگ (تحویل فیزیکی)
  | 'sale' // فروش سنگ (معامله با تسویه)
  | 'unsettled_sale'; // فروش سنگ بدون تسویه

type StoneTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCurrency?: string;
};

export default function StoneTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
  baseCurrency = 'IRR',
  selectedCurrency,
}: StoneTabProps) {
  const isReceived = nature === 'received';

  // Available operations based on document nature
  const availableOperations: { id: StoneOperationKind; label: string; desc: string }[] = useMemo(() => {
    if (isReceived) {
      return [
        { id: 'entry', label: 'ورود سنگ', desc: 'تحویل فیزیکی سنگ بدون اثر مالی بر حساب طرف‌حساب' },
        { id: 'purchase', label: 'خرید سنگ', desc: 'خرید قطعی سنگ با تسویه آنی (نقد یا بانک متناظر)' },
        { id: 'unsettled_purchase', label: 'خرید سنگ (بدون تسویه)', desc: 'خرید اعتباری/دفتری بدون تسویه آنی (افزایش طلب مشتری)' },
      ];
    }
    return [
      { id: 'exit', label: 'خروج سنگ', desc: 'تحویل فیزیکی سنگ بدون اثر مالی بر حساب طرف‌حساب' },
      { id: 'sale', label: 'فروش سنگ', desc: 'فروش قطعی سنگ با تسویه آنی (نقد یا بانک متناظر)' },
      { id: 'unsettled_sale', label: 'فروش سنگ (بدون تسویه)', desc: 'فروش اعتباری/دفتری بدون تسویه آنی (افزایش بدهی مشتری)' },
    ];
  }, [isReceived]);

  // Current active operation
  const [currentOp, setCurrentOp] = useState<StoneOperationKind>(() => {
    const rawKind = draftLine.details.stoneOperationKind;
    if (rawKind && availableOperations.some((op) => op.id === rawKind)) {
      return rawKind;
    }
    return isReceived ? 'purchase' : 'sale';
  });

  // Keep operation in sync if nature changes
  useEffect(() => {
    if (isReceived) {
      if (currentOp === 'exit' || currentOp === 'sale' || currentOp === 'unsettled_sale') {
        setCurrentOp('purchase');
      }
    } else {
      if (currentOp === 'entry' || currentOp === 'purchase' || currentOp === 'unsettled_purchase') {
        setCurrentOp('sale');
      }
    }
  }, [isReceived, currentOp]);

  const isTrade =
    currentOp === 'purchase' ||
    currentOp === 'sale' ||
    currentOp === 'unsettled_purchase' ||
    currentOp === 'unsettled_sale';
  const isUnsettled = currentOp === 'unsettled_purchase' || currentOp === 'unsettled_sale';

  // 1. Root Classification (GIA & CIBJO standard)
  const [rootCategory, setRootCategory] = useState<RootCategory>(
    (draftLine.details.stoneRootCategory as RootCategory) || 'natural',
  );

  // 2. Mode (Single Stone vs Parcel)
  const [stoneMode, setStoneMode] = useState<'single_stone' | 'parcel'>(
    draftLine.details.stoneMode || 'single_stone',
  );

  // 3. Category & Species
  const [category, setCategory] = useState<GemstoneCategory>(
    (draftLine.details.stoneCategory as GemstoneCategory) || 'diamond',
  );
  const [species, setSpecies] = useState<string>(() =>
    normalizeSpeciesId(
      draftLine.details.stoneSpecies,
      (draftLine.details.stoneRootCategory as RootCategory) || 'natural',
    ) || (category === 'diamond' ? 'diamond' : 'corundum_ruby'),
  );
  const [variety, setVariety] = useState<string>(draftLine.details.stoneVariety || '');
  const [itemName, setItemName] = useState<string>(draftLine.details.stoneItemName || '');

  // Diamond specific
  const [diamondType, setDiamondType] = useState<'natural' | 'lab_grown'>(
    draftLine.details.stoneDiamondType || (rootCategory === 'laboratory_grown' ? 'lab_grown' : 'natural'),
  );
  const [growthMethod, setGrowthMethod] = useState<LabGrowthMethod>(
    (draftLine.details.stoneGrowthMethod as LabGrowthMethod) || 'CVD',
  );
  const [postGrowthTreatment, setPostGrowthTreatment] = useState<PostGrowthTreatment>(
    (draftLine.details.stonePostGrowthTreatment as PostGrowthTreatment) || 'none_detected',
  );
  const [laserInscription, setLaserInscription] = useState<string>(
    draftLine.details.stoneLaserInscription || '',
  );

  // Single stone 4Cs
  const [colorMode, setColorMode] = useState<'d_z' | 'fancy'>(
    (draftLine.details.stoneColorMode as 'd_z' | 'fancy') || 'd_z',
  );
  const [colorGrade, setColorGrade] = useState<string>(draftLine.details.stoneColor || 'G');
  const [fancyIntensity, setFancyIntensity] = useState<string>(draftLine.details.stoneFancyIntensity || 'Fancy');
  const [fancyHue, setFancyHue] = useState<string>(draftLine.details.stoneFancyHue || 'Yellow');
  const [fancyOrigin, setFancyOrigin] = useState<string>(draftLine.details.stoneFancyOrigin || 'natural');
  const [clarityGrade, setClarityGrade] = useState<string>(draftLine.details.stoneClarity || 'VS1');
  const [cutGrade, setCutGrade] = useState<string>(draftLine.details.stoneCut || 'excellent');
  const [polish, setPolish] = useState<string>(draftLine.details.stonePolish || 'excellent');
  const [symmetry, setSymmetry] = useState<string>(draftLine.details.stoneSymmetry || 'excellent');
  const [fluorescence, setFluorescence] = useState<string>(draftLine.details.stoneFluorescence || 'none');
  const [measurementsLength, setMeasurementsLength] = useState<string>(draftLine.details.stoneMeasurementsLength || '');
  const [measurementsWidth, setMeasurementsWidth] = useState<string>(draftLine.details.stoneMeasurementsWidth || '');
  const [measurementsDepth, setMeasurementsDepth] = useState<string>(draftLine.details.stoneMeasurementsDepth || '');

  // Parcel / Bar-Khaneh Pool states
  const [sizeUnit, setSizeUnit] = useState<'ct' | 'mm' | 'sieve'>(
    (draftLine.details.stoneSizeUnit as 'ct' | 'mm' | 'sieve') || 'sieve',
  );
  const [sieveSize, setSieveSize] = useState<string>(draftLine.details.stoneSieveSize || '+1.5-2');
  const [sizeMin, setSizeMin] = useState<string>(draftLine.details.stoneSizeMin || '');
  const [sizeMax, setSizeMax] = useState<string>(draftLine.details.stoneSizeMax || '');
  const initialColor = useMemo(
    () => parseColorRangeString(draftLine.details.stoneColorRange || 'G-H'),
    [draftLine.id],
  );
  const [colorMin, setColorMin] = useState<string>(initialColor.min);
  const [colorMax, setColorMax] = useState<string>(initialColor.max);

  const initialClarity = useMemo(
    () => parseClarityRangeString(draftLine.details.stoneClarityRange || 'VS1-VS2'),
    [draftLine.id],
  );
  const [clarityMin, setClarityMin] = useState<string>(initialClarity.min);
  const [clarityMax, setClarityMax] = useState<string>(initialClarity.max);
  const [lotNumber, setLotNumber] = useState<string>(draftLine.details.stoneLotNumber || '');

  // Colored stone specific
  const [colorHue, setColorHue] = useState<string>(draftLine.details.stoneColorHue || '');
  const [tone, setTone] = useState<string>(draftLine.details.stoneTone || 'medium');
  const [saturation, setSaturation] = useState<string>(draftLine.details.stoneSaturation || 'strong');
  const [transparency, setTransparency] = useState<string>(draftLine.details.stoneTransparency || 'transparent');
  const [treatments, setTreatments] = useState<string>(draftLine.details.stoneTreatment || 'none_detected');
  const [originCountry, setOriginCountry] = useState<string>(draftLine.details.stoneOrigin || 'Iran');
  const [originSource, setOriginSource] = useState<string>(draftLine.details.stoneOriginSource || 'unknown');
  const [treatmentMethod, setTreatmentMethod] = useState<string>(draftLine.details.stoneTreatmentMethod || '');
  const [chemicalBasis, setChemicalBasis] = useState<string>(draftLine.details.stoneChemicalBasis || '');
  const [syntheticMethod, setSyntheticMethod] = useState<string>(
    (draftLine.details as any).stoneSyntheticMethod || 'Verneuil',
  );

  // Common geometry & visual shape selector
  const [shape, setShape] = useState<string>(draftLine.details.stoneShape || 'round');
  const [isShapeDropdownOpen, setIsShapeDropdownOpen] = useState(false);
  const shapeDropdownRef = useRef<HTMLDivElement>(null);
  const [isShapeSettingsOpen, setIsShapeSettingsOpen] = useState(false);
  const [shapePrefs, setShapePrefs] = useState<ShapePreferences>({
    order: GEMSTONE_SHAPES.map((s) => s.id),
    hidden: [],
    customNames: {},
    parentMap: {},
  });

  useEffect(() => {
    setShapePrefs(loadShapePreferences());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shapeDropdownRef.current && !shapeDropdownRef.current.contains(event.target as Node)) {
        setIsShapeDropdownOpen(false);
      }
    }
    if (isShapeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isShapeDropdownOpen]);

  // Weights & counts
  const [weightCt, setWeightCt] = useState<string>(draftLine.details.stoneCarats || '');
  const [weightG, setWeightG] = useState<string>(draftLine.details.stoneGrams || '');
  const [pieces, setPieces] = useState<string>(
    draftLine.details.stonePieces || (stoneMode === 'single_stone' ? '1' : '10'),
  );

  // Certificate
  const [certificateLab, setCertificateLab] = useState<string>(draftLine.details.stoneCertificateLab || 'none');
  const [certificateReportNumber, setCertificateReportNumber] = useState<string>(
    draftLine.details.stoneCertificateNumber || '',
  );
  const [verificationStatus, setVerificationStatus] = useState<string>(
    draftLine.details.stoneVerificationStatus || 'not_checked',
  );

  // Storage & SKU
  const [storageLocation, setStorageLocation] = useState<string>(
    draftLine.details.stoneStorageLocation || 'گاوصندوق اصلی',
  );
  const [storageLocations, setStorageLocations] = useState<StorageLocationItem[]>([]);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
  const [internalCode, setInternalCode] = useState<string>(draftLine.details.stoneInternalCode || '');

  // Financials & Valuation
  const [valuationMethod, setValuationMethod] = useState<'per_carat' | 'per_gram' | 'per_piece' | 'total_sum'>(() => {
    const vm = draftLine.details.stoneValuationMethod || 'per_carat';
    return stoneMode === 'parcel' && vm === 'per_piece' ? 'per_carat' : vm;
  });
  const [unitPrice, setUnitPrice] = useState<string>(draftLine.details.stoneUnitPrice || '');
  const [totalAmount, setTotalAmount] = useState<string>(
    draftLine.details.stoneTotalAmount || draftLine.details.totalAmount || '',
  );

  // Description
  const [description, setDescription] = useState<string>(draftLine.description || '');

  // Rounding modal state
  const [roundingModalOpen, setRoundingModalOpen] = useState(false);
  const [roundingDigits, setRoundingDigits] = useState<number>(draftLine.details.roundingDigits ?? 3);
  const [roundingMode, setRoundingMode] = useState<'round' | 'ceil' | 'floor'>(
    draftLine.details.roundingMode ?? 'round',
  );
  const [roundingEnabled, setRoundingEnabled] = useState<boolean>(Boolean(draftLine.details.isAmountRounded));
  const [autoApplyRounding, setAutoApplyRounding] = useState<boolean>(false);

  // Auxiliary data from backend
  const [gemstoneTypes, setGemstoneTypes] = useState<GemstoneTypeRecord[]>([]);
  const [shapesList, setShapesList] = useState<any[]>([]);
  const [sievesList, setSievesList] = useState<DiamondSieveRecord[]>([]);

  useEffect(() => {
    async function loadAux() {
      try {
        const [typesRes, shapesRes, sievesRes, locsRes] = await Promise.allSettled([
          fetch('/api/gemstone-types', { cache: 'no-store' }),
          fetch('/api/gemstone-shapes', { cache: 'no-store' }),
          fetch('/api/gemstone-sieves', { cache: 'no-store' }),
          fetch('/api/storage-locations', { cache: 'no-store' }),
        ]);
        if (typesRes.status === 'fulfilled' && typesRes.value.ok) {
          const data = await typesRes.value.json();
          if (data && Array.isArray(data.items)) setGemstoneTypes(data.items);
        }
        if (shapesRes.status === 'fulfilled' && shapesRes.value.ok) {
          const data = await shapesRes.value.json();
          if (data && Array.isArray(data.items)) setShapesList(data.items);
        }
        if (sievesRes.status === 'fulfilled' && sievesRes.value.ok) {
          const data = await sievesRes.value.json();
          if (data && Array.isArray(data.items)) setSievesList(data.items);
        }
        if (locsRes.status === 'fulfilled' && locsRes.value.ok) {
          const data = await locsRes.value.json();
          if (data && Array.isArray(data.items)) setStorageLocations(data.items);
        }
      } catch {
        // non-blocking
      }
    }
    void loadAux();
  }, []);

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return;
    setIsSubmittingLocation(true);
    try {
      const res = await fetch('/api/storage-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLocationName.trim() }),
      });
      if (res.ok) {
        const item = await res.json();
        setStorageLocations((prev) => [...prev, item]);
        setStorageLocation(item.name);
        setNewLocationName('');
        setShowAddLocationModal(false);
      }
    } catch {
      // non-blocking
    } finally {
      setIsSubmittingLocation(false);
    }
  };

  // Synchronize state when draftLine changes (e.g. user selects a different line to edit)
  useEffect(() => {
    if (!draftLine.id) return;
    const rawKind = draftLine.details.stoneOperationKind;
    if (rawKind && availableOperations.some((op) => op.id === rawKind)) {
      setCurrentOp(rawKind);
    }
    const lineRoot = (draftLine.details.stoneRootCategory as RootCategory) || rootCategory;
    if (draftLine.details.stoneRootCategory) {
      setRootCategory(lineRoot);
    }
    if (draftLine.details.stoneMode) {
      setStoneMode(draftLine.details.stoneMode);
    }
    if (draftLine.details.stoneCategory) {
      setCategory(draftLine.details.stoneCategory as GemstoneCategory);
    }
    if (draftLine.details.stoneSpecies) {
      setSpecies(normalizeSpeciesId(draftLine.details.stoneSpecies, lineRoot, availableSpeciesForRoot));
    }
    if (draftLine.details.stoneVariety !== undefined) {
      setVariety(draftLine.details.stoneVariety);
    }
    if (draftLine.details.stoneItemName !== undefined) {
      setItemName(draftLine.details.stoneItemName);
    }
    if (draftLine.details.stoneShape) {
      setShape(draftLine.details.stoneShape);
    }
    if (draftLine.details.stoneDiamondType) {
      setDiamondType(draftLine.details.stoneDiamondType);
    }
    if (draftLine.details.stoneGrowthMethod) {
      setGrowthMethod(draftLine.details.stoneGrowthMethod as LabGrowthMethod);
    }
    if (draftLine.details.stonePostGrowthTreatment) {
      setPostGrowthTreatment(draftLine.details.stonePostGrowthTreatment as PostGrowthTreatment);
    }
    if (draftLine.details.stoneLaserInscription !== undefined) {
      setLaserInscription(draftLine.details.stoneLaserInscription);
    }
    if (draftLine.details.stoneColorMode) {
      setColorMode(draftLine.details.stoneColorMode as 'd_z' | 'fancy');
    }
    if (draftLine.details.stoneColor) {
      setColorGrade(draftLine.details.stoneColor);
    }
    if (draftLine.details.stoneFancyIntensity) {
      setFancyIntensity(draftLine.details.stoneFancyIntensity);
    }
    if (draftLine.details.stoneFancyHue) {
      setFancyHue(draftLine.details.stoneFancyHue);
    }
    if (draftLine.details.stoneFancyOrigin) {
      setFancyOrigin(draftLine.details.stoneFancyOrigin);
    }
    if (draftLine.details.stoneClarity) {
      setClarityGrade(draftLine.details.stoneClarity);
    }
    if (draftLine.details.stoneCut) {
      setCutGrade(draftLine.details.stoneCut);
    }
    if (draftLine.details.stonePolish) {
      setPolish(draftLine.details.stonePolish);
    }
    if (draftLine.details.stoneSymmetry) {
      setSymmetry(draftLine.details.stoneSymmetry);
    }
    if (draftLine.details.stoneFluorescence) {
      setFluorescence(draftLine.details.stoneFluorescence);
    }
    if (draftLine.details.stoneMeasurementsLength !== undefined) {
      setMeasurementsLength(draftLine.details.stoneMeasurementsLength);
    }
    if (draftLine.details.stoneMeasurementsWidth !== undefined) {
      setMeasurementsWidth(draftLine.details.stoneMeasurementsWidth);
    }
    if (draftLine.details.stoneMeasurementsDepth !== undefined) {
      setMeasurementsDepth(draftLine.details.stoneMeasurementsDepth);
    }
    if (draftLine.details.stoneSizeUnit) {
      setSizeUnit(draftLine.details.stoneSizeUnit as 'ct' | 'mm' | 'sieve');
    }
    if (draftLine.details.stoneSieveSize) {
      setSieveSize(draftLine.details.stoneSieveSize);
    }
    if (draftLine.details.stoneSizeMin !== undefined) {
      setSizeMin(draftLine.details.stoneSizeMin);
    }
    if (draftLine.details.stoneSizeMax !== undefined) {
      setSizeMax(draftLine.details.stoneSizeMax);
    }
    if (draftLine.details.stoneColorRange) {
      const parsedC = parseColorRangeString(draftLine.details.stoneColorRange);
      setColorMin(parsedC.min);
      setColorMax(parsedC.max);
    }
    if (draftLine.details.stoneClarityRange) {
      const parsedCl = parseClarityRangeString(draftLine.details.stoneClarityRange);
      setClarityMin(parsedCl.min);
      setClarityMax(parsedCl.max);
    }
    if (draftLine.details.stoneLotNumber !== undefined) {
      setLotNumber(draftLine.details.stoneLotNumber);
    }
    if (draftLine.details.stoneColorHue !== undefined) {
      setColorHue(draftLine.details.stoneColorHue);
    }
    if (draftLine.details.stoneTone) {
      setTone(draftLine.details.stoneTone);
    }
    if (draftLine.details.stoneSaturation) {
      setSaturation(draftLine.details.stoneSaturation);
    }
    if (draftLine.details.stoneTransparency) {
      setTransparency(draftLine.details.stoneTransparency);
    }
    if (draftLine.details.stoneTreatment) {
      setTreatments(draftLine.details.stoneTreatment);
    }
    if (draftLine.details.stoneOrigin) {
      setOriginCountry(draftLine.details.stoneOrigin);
    }
    if (draftLine.details.stoneOriginSource) {
      setOriginSource(draftLine.details.stoneOriginSource);
    }
    if (draftLine.details.stoneTreatmentMethod !== undefined) {
      setTreatmentMethod(draftLine.details.stoneTreatmentMethod);
    }
    if (draftLine.details.stoneChemicalBasis !== undefined) {
      setChemicalBasis(draftLine.details.stoneChemicalBasis);
    }
    if (draftLine.details.stoneCertificateLab) {
      setCertificateLab(draftLine.details.stoneCertificateLab);
    }
    if (draftLine.details.stoneCertificateNumber !== undefined) {
      setCertificateReportNumber(draftLine.details.stoneCertificateNumber);
    }
    if (draftLine.details.stoneVerificationStatus) {
      setVerificationStatus(draftLine.details.stoneVerificationStatus);
    }
    if (draftLine.details.stoneStorageLocation) {
      setStorageLocation(draftLine.details.stoneStorageLocation);
    }
    if (draftLine.details.stoneInternalCode !== undefined) {
      setInternalCode(draftLine.details.stoneInternalCode);
    }
    if (draftLine.details.stoneCarats !== undefined) {
      setWeightCt(draftLine.details.stoneCarats);
    }
    if (draftLine.details.stoneGrams !== undefined) {
      setWeightG(draftLine.details.stoneGrams);
    }
    if (draftLine.details.stonePieces !== undefined) {
      setPieces(draftLine.details.stonePieces);
    }
    if (draftLine.details.stoneValuationMethod) {
      setValuationMethod(draftLine.details.stoneValuationMethod);
    }
    if (draftLine.details.stoneUnitPrice !== undefined) {
      setUnitPrice(draftLine.details.stoneUnitPrice);
    }
    if (draftLine.details.stoneTotalAmount !== undefined || draftLine.details.totalAmount !== undefined) {
      setTotalAmount(draftLine.details.stoneTotalAmount || draftLine.details.totalAmount || '');
    }
    if (draftLine.description !== undefined) {
      setDescription(draftLine.description);
    }
  }, [draftLine.id]);

  // Apply species selection and preset attributes
  const applySpeciesSelection = useCallback(
    (item: GemstoneSpeciesItem | any, targetRoot?: RootCategory) => {
      const effectiveRoot = targetRoot || item.rootCategory || rootCategory;
      setSpecies(item.id);
      setCategory(item.category);

      if (item.diamondType) {
        setDiamondType(item.diamondType);
      } else if (item.category === 'diamond') {
        setDiamondType(effectiveRoot === 'laboratory_grown' ? 'lab_grown' : 'natural');
      }

      if (item.growthMethod) {
        setGrowthMethod(item.growthMethod);
      }
      if (item.syntheticMethod) {
        setSyntheticMethod(item.syntheticMethod);
      }
      if (item.chemicalBasis !== undefined) {
        setChemicalBasis(item.chemicalBasis);
      } else {
        setChemicalBasis('');
      }
      if (item.treatments !== undefined) {
        setTreatments(item.treatments);
      } else if (effectiveRoot === 'natural' || effectiveRoot === 'laboratory_grown') {
        setTreatments('none_detected');
      }
      if (item.treatmentMethod !== undefined) {
        setTreatmentMethod(item.treatmentMethod);
      } else if (effectiveRoot !== 'treated_natural') {
        setTreatmentMethod('');
      }
      if (item.originCountry !== undefined) {
        setOriginCountry(item.originCountry);
      }
      if (item.defaultVariety) {
        setVariety(item.defaultVariety);
      } else if (item.nameFa) {
        setVariety(cleanSpeciesNameFa(item.nameFa, item.nameEn));
      }
      if (item.defaultItemName) {
        setItemName(item.defaultItemName);
      }
      if (item.defaultShape) {
        setShape(item.defaultShape);
      }
    },
    [rootCategory],
  );

  // Dynamic species list filtered by rootCategory merging authoritative GIA species and backend records
  const availableSpeciesForRoot = useMemo(() => {
    return buildSpeciesListForRoot(rootCategory, gemstoneTypes);
  }, [gemstoneTypes, rootCategory]);

  // Keep species synchronized with rootCategory and availableSpeciesForRoot
  useEffect(() => {
    if (species && availableSpeciesForRoot.length > 0) {
      const existsInCurrent = availableSpeciesForRoot.some((s) => s.id === species);
      if (!existsInCurrent) {
        const knownItem = findSpeciesItem(species);
        if (knownItem && knownItem.rootCategory !== rootCategory) {
          const nextItem = resolveSpeciesForRootChange(species, rootCategory, availableSpeciesForRoot);
          if (nextItem) {
            applySpeciesSelection(nextItem, rootCategory);
          }
        }
      }
    }
  }, [rootCategory, availableSpeciesForRoot, species, applySpeciesSelection]);

  // Root Category selection change with cascading species update
  const handleRootCategoryChange = (newRoot: RootCategory) => {
    if (newRoot === rootCategory) return;
    setRootCategory(newRoot);
    const nextList = buildSpeciesListForRoot(newRoot, gemstoneTypes);
    const nextSpeciesItem = resolveSpeciesForRootChange(species, newRoot, nextList);
    if (nextSpeciesItem) {
      applySpeciesSelection(nextSpeciesItem, newRoot);
    }
  };

  // Species selection change handler
  const handleSpeciesChange = (newSpeciesId: string) => {
    const item = findSpeciesItem(newSpeciesId);
    if (item) {
      applySpeciesSelection(item);
    } else {
      const fromList = availableSpeciesForRoot.find((s) => s.id === newSpeciesId);
      if (fromList) {
        applySpeciesSelection(fromList);
      } else {
        const norm = normalizeSpeciesId(newSpeciesId, rootCategory, availableSpeciesForRoot);
        setSpecies(norm);
        if (norm === 'diamond' || norm.includes('diamond')) {
          setCategory('diamond');
        } else {
          setCategory('colored_gemstone');
        }
      }
    }
  };

  // Sieve calculations
  const effectiveSieves = useMemo(() => {
    return sievesList.length > 0 ? sievesList : DIAMOND_SIEVE_CHART;
  }, [sievesList]);

  const currentSieveRec = useMemo(() => {
    return findSieveBySize(sieveSize, effectiveSieves);
  }, [sieveSize, effectiveSieves]);

  // Color & Clarity range controls for parcels
  const handleColorMinChange = (newMin: string) => {
    setColorMin(newMin);
    const allowed = getAllowedColorEndGrades(newMin);
    if (!allowed.includes(colorMax)) {
      setColorMax(allowed[0] || newMin);
    }
  };

  const handleClarityMinChange = (newMin: string) => {
    setClarityMin(newMin);
    const allowed = getAllowedClarityEndGrades(newMin);
    if (!allowed.includes(clarityMax)) {
      setClarityMax(allowed[0] || newMin);
    }
  };

  const colorRange = useMemo(() => {
    return validateColorRange(colorMin, colorMax).label || (colorMin === colorMax ? colorMin : `${colorMin}–${colorMax}`);
  }, [colorMin, colorMax]);

  const clarityRange = useMemo(() => {
    return validateClarityRange(clarityMin, clarityMax).label || (clarityMin === clarityMax ? clarityMin : `${clarityMin}–${clarityMax}`);
  }, [clarityMin, clarityMax]);

  // Weight conversions
  const handleCaratsChange = (val: string) => {
    const rawVal = normalizeDigits(val);
    setWeightCt(rawVal);
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      const g = String(caratsToGrams(num, 4));
      setWeightG(g);
      if (valuationMethod === 'per_carat') {
        const up = parseLocalizedAmount(unitPrice);
        if (up > 0) {
          setTotalAmount(String(Math.round(num * up)));
        }
      }
    } else {
      setWeightG('');
      if (valuationMethod === 'per_carat') setTotalAmount('');
    }
  };

  const handleGramsChange = (val: string) => {
    const rawVal = normalizeDigits(val);
    setWeightG(rawVal);
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      const ct = String(gramsToCarats(num, 3));
      setWeightCt(ct);
      if (valuationMethod === 'per_gram') {
        const up = parseLocalizedAmount(unitPrice);
        if (up > 0) {
          setTotalAmount(String(Math.round(num * up)));
        }
      } else if (valuationMethod === 'per_carat') {
        const up = parseLocalizedAmount(unitPrice);
        if (up > 0) {
          setTotalAmount(String(Math.round(parseFloat(ct) * up)));
        }
      }
    } else {
      setWeightCt('');
      if (valuationMethod === 'per_gram' || valuationMethod === 'per_carat') {
        setTotalAmount('');
      }
    }
  };

  const handlePiecesChange = (val: string) => {
    const rawVal = normalizeDigits(val);
    setPieces(rawVal);
    const pNum = parseInt(rawVal, 10);
    if (valuationMethod === 'per_piece' && !isNaN(pNum) && pNum > 0) {
      const up = parseLocalizedAmount(unitPrice);
      if (up > 0) {
        setTotalAmount(String(pNum * up));
      }
    }
  };

  const handleUnitPriceChange = (rawVal: string) => {
    setUnitPrice(rawVal);
    const up = parseLocalizedAmount(rawVal);
    if (valuationMethod === 'per_carat') {
      const ct = parseFloat(normalizeDigits(weightCt));
      if (!isNaN(ct) && ct > 0 && up > 0) {
        setTotalAmount(String(Math.round(ct * up)));
      }
    } else if (valuationMethod === 'per_gram') {
      const g = parseFloat(normalizeDigits(weightG));
      if (!isNaN(g) && g > 0 && up > 0) {
        setTotalAmount(String(Math.round(g * up)));
      }
    } else if (valuationMethod === 'per_piece') {
      const p = parseInt(normalizeDigits(pieces), 10);
      if (!isNaN(p) && p > 0 && up > 0) {
        setTotalAmount(String(p * up));
      }
    }
  };

  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    const tot = parseLocalizedAmount(val);
    if (valuationMethod === 'per_carat') {
      const ct = parseFloat(normalizeDigits(weightCt));
      if (!isNaN(ct) && ct > 0 && tot > 0) {
        setUnitPrice(String(Math.round(tot / ct)));
      }
    } else if (valuationMethod === 'per_gram') {
      const g = parseFloat(normalizeDigits(weightG));
      if (!isNaN(g) && g > 0 && tot > 0) {
        setUnitPrice(String(Math.round(tot / g)));
      }
    } else if (valuationMethod === 'per_piece') {
      const p = parseInt(normalizeDigits(pieces), 10);
      if (!isNaN(p) && p > 0 && tot > 0) {
        setUnitPrice(String(Math.round(tot / p)));
      }
    }
  };

  const handleValuationMethodChange = (method: 'per_carat' | 'per_gram' | 'per_piece' | 'total_sum') => {
    if (stoneMode === 'parcel' && method === 'per_piece') {
      return;
    }
    setValuationMethod(method);
    const up = parseLocalizedAmount(unitPrice);
    if (method === 'per_carat') {
      const ct = parseFloat(normalizeDigits(weightCt));
      if (!isNaN(ct) && ct > 0 && up > 0) {
        setTotalAmount(String(Math.round(ct * up)));
      }
    } else if (method === 'per_gram') {
      const g = parseFloat(normalizeDigits(weightG));
      if (!isNaN(g) && g > 0 && up > 0) {
        setTotalAmount(String(Math.round(g * up)));
      }
    } else if (method === 'per_piece') {
      const p = parseInt(normalizeDigits(pieces), 10) || 1;
      if (p > 0 && up > 0) {
        setTotalAmount(String(p * up));
      }
    }
  };

  // Build document type label
  const opLabel = useMemo(() => {
    const match = availableOperations.find((o) => o.id === currentOp);
    return match ? match.label : isReceived ? 'ورود سنگ' : 'خروج سنگ';
  }, [availableOperations, currentOp, isReceived]);

  const currencySuffix = selectedCurrency || (baseCurrency === 'IRT' ? 'تومان' : 'ریال');

  // Species active item & display names
  const activeSpeciesItem = useMemo(() => {
    return availableSpeciesForRoot.find((s) => s.id === species) || findSpeciesItem(species);
  }, [availableSpeciesForRoot, species]);

  const speciesDisplayName = itemName || activeSpeciesItem?.nameFa || species;

  // Hierarchical visual shape computations
  const { order, hidden, customNames = {}, parentMap = {} } = shapePrefs;
  const hierarchicalOrder = buildHierarchicalShapeOrder(order, parentMap);
  const shapesPool = useMemo(() => {
    return shapesList.length > 0
      ? shapesList.map((s: any) => ({
          id: s.code || s.id,
          nameFa: cleanSpeciesNameFa(s.nameFa || '', s.nameEn || ''),
          nameEn: s.nameEn,
          svgIcon: s.svgIcon,
        }))
      : GEMSTONE_SHAPES;
  }, [shapesList]);

  const activeShapes = useMemo(() => {
    return hierarchicalOrder
      .filter((id) => !hidden.includes(id) || id === shape)
      .map((id) => shapesPool.find((s) => s.id === id))
      .filter((s): s is { id: string; nameFa: string; nameEn: string; svgIcon?: string } => Boolean(s));
  }, [hierarchicalOrder, hidden, shape, shapesPool]);

  const currentShapeItem = useMemo(() => {
    return activeShapes.find((s) => s.id === shape);
  }, [activeShapes, shape]);

  const currentDisplayNameFa = customNames[shape]?.nameFa || currentShapeItem?.nameFa || shape;
  const currentDisplayNameEn = customNames[shape]?.nameEn || currentShapeItem?.nameEn || '';
  const isCurrentChild = Boolean(parentMap[shape]);

  // Synchronize draft line with parent
  useEffect(() => {
    const subType =
      currentOp === 'entry'
        ? 'stone-entry'
        : currentOp === 'exit'
        ? 'stone-exit'
        : currentOp === 'unsettled_purchase'
        ? 'stone-unsettled-purchase'
        : currentOp === 'unsettled_sale'
        ? 'stone-unsettled-sale'
        : currentOp === 'purchase'
        ? 'stone-purchase'
        : 'stone-sale';

    setDraftLine((curr) => ({
      ...curr,
      documentTab: 'stone',
      sourceTab: 'stone',
      documentNature: nature,
      documentSubType: subType,
      documentTypeLabel: opLabel,
      settlementMethod: isUnsettled ? 'unsettled' : isTrade ? 'cash' : 'weight',
      description: description || curr.description,
      details: {
        ...curr.details,
        stoneOperationKind: currentOp,
        stoneRootCategory: rootCategory,
        stoneCategory: category,
        stoneSpecies: species,
        stoneSpeciesName: speciesDisplayName,
        stoneVariety: variety,
        stoneItemName: itemName,
        stoneShape: shape,
        stoneShapeName: currentDisplayNameFa,
        stoneMode: stoneMode,
        stonePieces: stoneMode === 'single_stone' ? '1' : pieces,
        stoneCarats: weightCt,
        stoneGrams: weightG,
        stoneValuationMethod: valuationMethod,
        stoneUnitPrice: isTrade ? unitPrice : '0',
        stoneTotalAmount: isTrade ? totalAmount : '0',
        totalAmount: isTrade ? totalAmount : '0',
        stoneDiamondType: diamondType,
        stoneGrowthMethod: growthMethod,
        stonePostGrowthTreatment: postGrowthTreatment,
        stoneLaserInscription: laserInscription,
        stoneColorMode: colorMode,
        stoneColor: category === 'diamond' ? colorGrade : '',
        stoneFancyIntensity: fancyIntensity,
        stoneFancyHue: fancyHue,
        stoneFancyOrigin: fancyOrigin,
        stoneClarity: category === 'diamond' ? clarityGrade : '',
        stoneCut: category === 'diamond' ? cutGrade : '',
        stonePolish: polish,
        stoneSymmetry: symmetry,
        stoneFluorescence: fluorescence,
        stoneMeasurementsLength: measurementsLength,
        stoneMeasurementsWidth: measurementsWidth,
        stoneMeasurementsDepth: measurementsDepth,
        stoneSizeUnit: sizeUnit,
        stoneSizeMin: sizeMin,
        stoneSizeMax: sizeMax,
        stoneSieveSize: stoneMode === 'parcel' ? sieveSize : '',
        stoneColorRange: stoneMode === 'parcel' ? colorRange : '',
        stoneClarityRange: stoneMode === 'parcel' ? clarityRange : '',
        stoneLotNumber: stoneMode === 'parcel' ? lotNumber : '',
        stoneColorHue: colorHue,
        stoneTone: tone,
        stoneSaturation: saturation,
        stoneTransparency: transparency,
        stoneTreatment: category !== 'diamond' ? treatments : '',
        stoneOrigin: category !== 'diamond' ? originCountry : '',
        stoneOriginSource: originSource,
        stoneTreatmentMethod: treatmentMethod,
        stoneChemicalBasis: chemicalBasis,
        stoneCertificateLab: certificateLab !== 'none' ? certificateLab : '',
        stoneCertificateNumber: certificateLab !== 'none' ? certificateReportNumber : '',
        stoneVerificationStatus: verificationStatus,
        stoneStorageLocation: storageLocation,
        stoneInternalCode: internalCode,
        unsettledTrade: isUnsettled,
        isAmountRounded: roundingEnabled,
        roundingDigits,
        roundingMode,
      },
    }));
  }, [
    nature,
    currentOp,
    opLabel,
    isTrade,
    isUnsettled,
    rootCategory,
    category,
    species,
    speciesDisplayName,
    variety,
    itemName,
    shape,
    currentDisplayNameFa,
    stoneMode,
    pieces,
    weightCt,
    weightG,
    valuationMethod,
    unitPrice,
    totalAmount,
    diamondType,
    growthMethod,
    postGrowthTreatment,
    laserInscription,
    colorMode,
    colorGrade,
    fancyIntensity,
    fancyHue,
    fancyOrigin,
    clarityGrade,
    cutGrade,
    polish,
    symmetry,
    fluorescence,
    measurementsLength,
    measurementsWidth,
    measurementsDepth,
    sizeUnit,
    sizeMin,
    sizeMax,
    sieveSize,
    colorRange,
    clarityRange,
    lotNumber,
    colorHue,
    tone,
    saturation,
    transparency,
    treatments,
    originCountry,
    originSource,
    treatmentMethod,
    chemicalBasis,
    certificateLab,
    certificateReportNumber,
    verificationStatus,
    storageLocation,
    internalCode,
    description,
    roundingEnabled,
    roundingDigits,
    roundingMode,
    setDraftLine,
  ]);

  const handleCommit = () => {
    if (!commitDraftLine) return;
    commitDraftLine();

    // Reset weights & pricing for convenient next row entry while preserving category & species
    setWeightCt('');
    setWeightG('');
    if (stoneMode === 'single_stone') {
      setPieces('1');
    }
    setTotalAmount('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (handleKeyDownEnter) {
        handleKeyDownEnter(e);
      }
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* 1. Operation Kind Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="document-operation-title m-0">
          <div className="flex items-center gap-2">
            <Sparkles className={isReceived ? 'text-emerald-600' : 'text-rose-600'} size={20} />
            <h3 className="text-xs font-black">{opLabel}</h3>
          </div>
          <span className={`document-nature-badge ${nature}`}>
            {isReceived ? 'سند دریافتی (ورود / خرید)' : 'سند پرداختی (خروج / فروش)'}
          </span>
        </div>

        {/* Operation Mode Buttons */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
          {availableOperations.map((op) => {
            const isSelected = currentOp === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setCurrentOp(op.id)}
                title={op.desc}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? isReceived
                      ? 'bg-emerald-500 text-white shadow-sm font-black'
                      : 'bg-rose-500 text-white shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {op.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Parameters Card (Strictly Mirrored from InitialGemstoneInventoryModal) */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50 space-y-4 shadow-xs">
        {/* Section A: Root Classification Selector (GIA & CIBJO Standards) */}
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-3.5 transition-all duration-300 dark:border-cyan-900/40 dark:bg-cyan-950/20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
              <Sparkles size={14} className="text-cyan-600 dark:text-cyan-400" />
              <span>منشأ و خاستگاه گوهرشناسی (GIA Root Category)</span>
              <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
              فهرست گونه‌ها و پارامترهای تخصصی به صورت هوشمند با تغییر تب به‌روز می‌شوند
            </span>
          </div>

          <div role="tablist" aria-label="منشأ و خاستگاه گوهرشناسی" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ROOT_CATEGORIES.map((rc) => {
              const isActive = rootCategory === rc.id;
              const tabSpeciesCount = buildSpeciesListForRoot(rc.id as RootCategory, gemstoneTypes).length;
              const activeStyles =
                rc.id === 'natural'
                  ? 'border-2 border-emerald-500 bg-white text-emerald-950 shadow-md ring-2 ring-emerald-500/15 dark:border-emerald-400 dark:bg-slate-800 dark:text-emerald-100'
                  : rc.id === 'laboratory_grown'
                  ? 'border-2 border-purple-500 bg-white text-purple-950 shadow-md ring-2 ring-purple-500/15 dark:border-purple-400 dark:bg-slate-800 dark:text-purple-100'
                  : rc.id === 'synthetic'
                  ? 'border-2 border-indigo-500 bg-white text-indigo-950 shadow-md ring-2 ring-indigo-500/15 dark:border-indigo-400 dark:bg-slate-800 dark:text-indigo-100'
                  : rc.id === 'simulant'
                  ? 'border-2 border-amber-500 bg-white text-amber-950 shadow-md ring-2 ring-amber-500/15 dark:border-amber-400 dark:bg-slate-800 dark:text-amber-100'
                  : 'border-2 border-teal-500 bg-white text-teal-950 shadow-md ring-2 ring-teal-500/15 dark:border-teal-400 dark:bg-slate-800 dark:text-teal-100';

              return (
                <button
                  key={rc.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleRootCategoryChange(rc.id as RootCategory)}
                  className={`group relative flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all duration-300 ease-out cursor-pointer ${
                    isActive
                      ? `${activeStyles} -translate-y-0.5 font-black`
                      : 'border border-slate-200/80 bg-white/75 text-slate-600 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-white hover:shadow-xs dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{rc.labelFa}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold transition-colors ${
                        isActive
                          ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {toPersianDigits(String(tabSpeciesCount))}
                    </span>
                  </div>
                  <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-400 dark:text-slate-400">
                    {rc.id === 'natural'
                      ? 'معدنی دست‌نخورده'
                      : rc.id === 'laboratory_grown'
                      ? 'CVD / HPHT'
                      : rc.id === 'synthetic'
                      ? 'بلور سنتتیک'
                      : rc.id === 'simulant'
                      ? 'نگین اتمی و CZ'
                      : 'پرتودیده و بهسازی'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Smooth Contextual GIA Root Category Dossier Strip (for non-natural categories) */}
          {rootCategory !== 'natural' && (
            <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs transition-all duration-300 ease-out dark:border-slate-800 dark:bg-slate-900/80">
              {rootCategory === 'laboratory_grown' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-purple-900 dark:text-purple-300">
                      متد رشد آزمایشگاهی (Lab Growth Method) *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {LAB_GROWTH_METHODS.map((gm) => (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => setGrowthMethod(gm.id as LabGrowthMethod)}
                          className={`rounded-lg py-1.5 text-center text-[11px] font-black transition-all cursor-pointer ${
                            growthMethod === gm.id
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'border border-purple-200 bg-purple-50/50 text-purple-900 hover:bg-purple-100 dark:border-purple-800 dark:bg-slate-800 dark:text-purple-200'
                          }`}
                        >
                          {gm.id}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      بهسازی پس از رشد (Post-Growth)
                    </label>
                    <select
                      value={postGrowthTreatment}
                      onChange={(e) => setPostGrowthTreatment(e.target.value as PostGrowthTreatment)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {POST_GROWTH_TREATMENTS.map((pgt) => (
                        <option key={pgt.id} value={pgt.id}>
                          {pgt.labelFa}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      حکاکی لیزری کمربند (Laser Inscription)
                    </label>
                    <input
                      type="text"
                      value={laserInscription}
                      onChange={(e) => setLaserInscription(e.target.value)}
                      placeholder="مثال: LG12345678"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              )}

              {rootCategory === 'synthetic' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                      فرآیند تبلور سنتتیک (Synthesis Method) *
                    </label>
                    <select
                      value={syntheticMethod}
                      onChange={(e) => setSyntheticMethod(e.target.value)}
                      className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-indigo-800 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {SYNTHETIC_METHODS.map((sm) => (
                        <option key={sm.id} value={sm.id}>
                          {sm.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      پایه و ساختار شیمیایی بلور (Chemical Basis)
                    </label>
                    <input
                      type="text"
                      value={chemicalBasis}
                      onChange={(e) => setChemicalBasis(e.target.value)}
                      placeholder="مثال: Al2O3:Cr یا SiC (Silicon Carbide)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              )}

              {rootCategory === 'simulant' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-amber-900 dark:text-amber-300">
                        فرمول و ترکیب شیمیایی بدل (Simulant Chemical Basis) *
                      </label>
                      <input
                        type="text"
                        value={chemicalBasis}
                        onChange={(e) => setChemicalBasis(e.target.value)}
                        placeholder="مثال: ZrO2 (Cubic Zirconia) یا SiO2 Lead Glass"
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-800 dark:border-amber-800 dark:bg-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div className="flex items-center rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11px] font-medium leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                      <Info size={15} className="ml-2 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        {species === 'cubic_zirconia'
                          ? CUBIC_ZIRCONIA_ADVISORY
                          : 'سنگ‌های مشابه (Simulants) از نظر ظاهری شبیه سنگ اصلی هستند اما ساختار شیمیایی و بلوری متفاوتی دارند.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {rootCategory === 'treated_natural' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-teal-900 dark:text-teal-300">
                      نوع فرآیند بهسازی (GIA Treatment Type) *
                    </label>
                    <select
                      value={treatments}
                      onChange={(e) => setTreatments(e.target.value)}
                      className="w-full rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-teal-800 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {GEMSTONE_TREATMENTS.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      متد و شرح دقیق بهسازی (Treatment Method Details)
                    </label>
                    <input
                      type="text"
                      value={treatmentMethod}
                      onChange={(e) => setTreatmentMethod(e.target.value)}
                      placeholder="مثال: پرتودهی الکترونی + حرارت یا پرشدگی شکاف با شیشه سرب"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section B: Mode & Dynamic Cascading Species Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Mode Toggle */}
          <div>
            <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300 text-xs">
              نوع عرضه و نگهداری *
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => {
                  setStoneMode('single_stone');
                  setPieces('1');
                }}
                className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  stoneMode === 'single_stone'
                    ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-700 dark:text-cyan-300 font-black'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Gem size={14} />
                <span>تک سنگ (Single Stone)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStoneMode('parcel');
                  if (!pieces || pieces === '1') setPieces('10');
                  if (valuationMethod === 'per_piece') {
                    setValuationMethod('per_carat');
                    const up = parseLocalizedAmount(unitPrice);
                    const ct = parseFloat(normalizeDigits(weightCt));
                    if (!isNaN(ct) && ct > 0 && up > 0) {
                      setTotalAmount(String(Math.round(ct * up)));
                    } else {
                      setTotalAmount('');
                    }
                  }
                }}
                className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  stoneMode === 'parcel'
                    ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-700 dark:text-cyan-300 font-black'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Layers size={14} />
                <span>بسته‌ای / بار سنگ (Parcel)</span>
              </button>
            </div>
          </div>

          {/* Dynamic Cascading Species Selector */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                گونه / سنگ ({formatRootCategoryShortFa(rootCategory)}) *
              </label>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {availableSpeciesForRoot.length} گونه معتبر
              </span>
            </div>
            <select
              value={species}
              onChange={(e) => handleSpeciesChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {availableSpeciesForRoot.map((s, idx) => (
                <option key={s.id || `species-${idx}`} value={s.id}>
                  {formatSpeciesOptionLabel(s.nameFa, s.nameEn)}
                </option>
              ))}
              {!availableSpeciesForRoot.some((s) => s.id === species) && species && (
                <option key={`custom-species-${species}`} value={species}>
                  {findSpeciesItem(species)?.nameFa
                    ? formatSpeciesOptionLabel(
                        findSpeciesItem(species)?.nameFa,
                        findSpeciesItem(species)?.nameEn,
                      )
                    : species}
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Section C: Item Title, Pieces & Visual Shape Selector */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={stoneMode === 'parcel' ? 'sm:col-span-2' : ''}>
            <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300 text-xs">
              عنوان نمایشی سنگ
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="مثال: برلیان ۱ قیراطی تراش عالی یا یاقوت سرخ برمه"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {stoneMode === 'single_stone' && (
            <div>
              <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                تعداد سنگ (عدد)
              </label>
              <input
                type="number"
                min="1"
                value={pieces}
                onChange={(e) => handlePiecesChange(e.target.value)}
                placeholder="۱"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          )}

          {/* Visual Shape Selector with Hierarchy and Preferences Modal */}
          <div className={stoneMode === 'parcel' ? 'sm:col-span-1' : ''}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                تراش و شکل هندسی *
              </label>
              <button
                type="button"
                onClick={() => setIsShapeSettingsOpen(true)}
                title="سفارشی‌سازی و اولویت‌بندی تراش‌ها"
                className="flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-600 hover:bg-cyan-100 transition-colors dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-900/60 cursor-pointer"
              >
                <Settings size={13} />
                <span>شخصی‌سازی</span>
              </button>
            </div>

            <div className="relative" ref={shapeDropdownRef}>
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsShapeDropdownOpen((prev) => !prev)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-slate-800 transition-all focus:outline-hidden dark:bg-slate-800 dark:text-slate-200 cursor-pointer ${
                  isShapeDropdownOpen
                    ? 'border-cyan-500 ring-2 ring-cyan-500/20 dark:border-cyan-500'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-cyan-100 bg-cyan-50/70 p-1 text-cyan-600 shadow-2xs dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-400">
                    <GemstoneShapeIcon shapeCode={shape} svgIcon={currentShapeItem?.svgIcon} className="size-full" />
                  </div>
                  <div className="flex items-baseline gap-1.5 truncate">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {isCurrentChild ? `↳ ${currentDisplayNameFa}` : currentDisplayNameFa}
                    </span>
                    {currentDisplayNameEn && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        ({currentDisplayNameEn})
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                    isShapeDropdownOpen ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''
                  }`}
                />
              </button>

              {/* Dropdown Popover */}
              {isShapeDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all dark:border-slate-700 dark:bg-slate-800">
                  <div className="space-y-1">
                    {activeShapes.map((sh) => {
                      const isSelected = shape === sh.id;
                      const isChild = Boolean(parentMap[sh.id]);
                      const displayNameFa = customNames[sh.id]?.nameFa || sh.nameFa;
                      const displayNameEn = customNames[sh.id]?.nameEn || sh.nameEn;

                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => {
                            setShape(sh.id);
                            setIsShapeDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-right text-xs transition-colors cursor-pointer ${
                            isChild ? 'mr-3 w-[calc(100%-0.75rem)] border-r-2 border-r-indigo-400' : ''
                          } ${
                            isSelected
                              ? 'bg-cyan-50 font-bold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200'
                              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`flex size-7 shrink-0 items-center justify-center rounded-lg border p-1 shadow-2xs ${
                                isSelected
                                  ? 'border-cyan-300 bg-white text-cyan-600 dark:border-cyan-700 dark:bg-slate-900 dark:text-cyan-300'
                                  : 'border-slate-200/80 bg-slate-50/80 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400'
                              }`}
                            >
                              <GemstoneShapeIcon shapeCode={sh.id} svgIcon={sh.svgIcon} className="size-full" />
                            </div>
                            <div className="flex items-baseline gap-1.5 truncate">
                              {isChild && <span className="font-bold text-indigo-500 text-xs shrink-0">↳</span>}
                              <span className={isSelected ? 'font-black' : 'font-semibold'}>{displayNameFa}</span>
                              {displayNameEn && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                  ({displayNameEn})
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="shrink-0 text-cyan-600 dark:text-cyan-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section D: Specialized Conditional Section (Diamond 4Cs vs Colored Gemstones) */}
        {category === 'diamond' ? (
          <div className="rounded-3xl border border-cyan-100 bg-cyan-50/30 p-4 space-y-4 dark:border-cyan-900/50 dark:bg-cyan-950/10">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-black text-cyan-950 dark:text-cyan-200">
                <Sparkles size={16} className="text-cyan-600 dark:text-cyan-400" />
                مشخصات تخصصی الماس (4Cs & Grading)
              </span>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold text-xs">
                  <input
                    type="radio"
                    name="diamondType"
                    checked={diamondType === 'natural'}
                    onChange={() => {
                      setDiamondType('natural');
                      if (rootCategory === 'laboratory_grown') {
                        handleRootCategoryChange('natural');
                      }
                    }}
                    className="text-cyan-600 focus:ring-cyan-500"
                  />
                  طبیعی (Natural)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold text-xs">
                  <input
                    type="radio"
                    name="diamondType"
                    checked={diamondType === 'lab_grown'}
                    onChange={() => {
                      setDiamondType('lab_grown');
                      handleRootCategoryChange('laboratory_grown');
                    }}
                    className="text-cyan-600 focus:ring-cyan-500"
                  />
                  آزمایشگاهی (Lab-Grown)
                </label>
              </div>
            </div>

            {/* Lab-Grown Diamond Dossier (CVD / HPHT / Post-Growth / Laser Inscription) */}
            {(diamondType === 'lab_grown' || rootCategory === 'laboratory_grown') && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5 space-y-3 dark:border-purple-900/60 dark:bg-purple-950/20">
                <span className="flex items-center gap-1.5 text-xs font-black text-purple-900 dark:text-purple-300">
                  <Sparkles size={14} className="text-purple-600" />
                  شناسنامه و متد رشد الماس آزمایشگاهی (Lab-Grown Diamond Dossier)
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      روش رشد سنتز (Growth Method) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {LAB_GROWTH_METHODS.map((gm) => (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => setGrowthMethod(gm.id as LabGrowthMethod)}
                          className={`flex-1 rounded-xl py-1.5 text-center text-xs font-black transition cursor-pointer ${
                            growthMethod === gm.id
                              ? 'border-2 border-purple-600 bg-purple-600 text-white shadow-xs'
                              : 'border border-purple-200 bg-white text-purple-900 hover:bg-purple-100 dark:border-purple-800 dark:bg-slate-800 dark:text-purple-200'
                          }`}
                        >
                          {gm.labelFa} ({gm.id})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      بهسازی پس از رشد (Post-Growth Treatment)
                    </label>
                    <select
                      value={postGrowthTreatment}
                      onChange={(e) => setPostGrowthTreatment(e.target.value as PostGrowthTreatment)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {POST_GROWTH_TREATMENTS.map((pgt) => (
                        <option key={pgt.id} value={pgt.id}>
                          {pgt.labelFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      حکاکی لیزری شناسه (Laser Inscription)
                    </label>
                    <input
                      type="text"
                      value={laserInscription}
                      onChange={(e) => setLaserInscription(e.target.value)}
                      placeholder="مثال: LG12345678 یا GIA LG"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-purple-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Melee Diamond Bar-Khaneh Parcel Pool Configuration */}
            {stoneMode === 'parcel' && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-black text-indigo-950 dark:text-indigo-200">
                    <Layers size={15} className="text-indigo-600 dark:text-indigo-400" />
                    مشخصات فنی بارخانه الماس‌های ریز (Melee Diamond Parcel Pool)
                  </span>
                  <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    الگوی تلفیق همگن (Homogeneous Pool)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Sieve / Size Range */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        محدوده اندازه / الک (Size / Sieve)
                      </label>
                      <select
                        value={sizeUnit}
                        onChange={(e) => {
                          const newUnit = e.target.value as 'ct' | 'mm' | 'sieve';
                          setSizeUnit(newUnit);
                          if (newUnit === 'sieve' && !sieveSize) {
                            setSieveSize('+1.5-2');
                            const sRec = findSieveBySize('+1.5-2', effectiveSieves);
                            if (sRec) {
                              setSizeMin(String(sRec.mmSize));
                              setSizeMax(String(sRec.mmSize));
                            }
                          }
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="sieve">شماره الک (Sieve)</option>
                        <option value="ct">قیراط (ct)</option>
                        <option value="mm">میلی‌متر (mm)</option>
                      </select>
                    </div>

                    {sizeUnit === 'sieve' ? (
                      <div>
                        <select
                          value={sieveSize}
                          onChange={(e) => {
                            const selected = e.target.value;
                            setSieveSize(selected);
                            const sRec = findSieveBySize(selected, effectiveSieves);
                            if (sRec) {
                              setSizeMin(String(sRec.mmSize));
                              setSizeMax(String(sRec.mmSize));
                            }
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {effectiveSieves.map((s) => (
                            <option key={s.sieveSize} value={s.sieveSize}>
                              الک {s.sieveSize} ({s.mmSize} mm — {s.piecesPerCarat} pc/ct{s.princessMmLabel ? ` | پرنسس: ${s.princessMmLabel}` : ''})
                            </option>
                          ))}
                        </select>
                        {currentSieveRec && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono font-bold text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                              قطر: {currentSieveRec.mmSize} mm
                            </span>
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {currentSieveRec.piecesPerCarat} عدد/قیراط
                            </span>
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              هر عدد: {currentSieveRec.caratsWeightPerPiece} ct
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.001"
                          value={sizeMin}
                          onChange={(e) => setSizeMin(e.target.value)}
                          placeholder="از"
                          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                        />
                        <span className="text-slate-400">تا</span>
                        <input
                          type="number"
                          step="0.001"
                          value={sizeMax}
                          onChange={(e) => setSizeMax(e.target.value)}
                          placeholder="تا"
                          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    )}
                  </div>

                  {/* Color Range Min/Max with Live Range Display */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        محدوده رنگ (Color Range)
                      </label>
                      <span className="rounded bg-cyan-100 px-1.5 py-0.2 font-mono text-[11px] font-black text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200">
                        {colorRange}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5" dir="rtl" style={{ direction: 'rtl' }}>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">از:</span>
                      <select
                        value={colorMin}
                        onChange={(e) => handleColorMinChange(e.target.value)}
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title="شروع بازه رنگ (از)"
                      >
                        {D_Z_COLORS.map((c) => (
                          <option key={c} value={c}>
                            {c} ({getColorTier(c)?.nameFa || 'رنگ'})
                          </option>
                        ))}
                      </select>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">تا:</span>
                      <select
                        value={colorMax}
                        onChange={(e) => setColorMax(e.target.value)}
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title="پایان بازه رنگ (تا)"
                      >
                        {getAllowedColorEndGrades(colorMin).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Clarity Range Min/Max with Live Range Display */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        محدوده پاکی (Clarity Range)
                      </label>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.2 font-mono text-[11px] font-black text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                        {clarityRange}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5" dir="rtl" style={{ direction: 'rtl' }}>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">از:</span>
                      <select
                        value={clarityMin}
                        onChange={(e) => handleClarityMinChange(e.target.value)}
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title="شروع بازه پاکی (از)"
                      >
                        {CLARITY_GRADES.map((cl) => (
                          <option key={cl} value={cl}>
                            {cl} ({getClarityTier(cl)?.nameFa || 'پاکی'})
                          </option>
                        ))}
                      </select>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">تا:</span>
                      <select
                        value={clarityMax}
                        onChange={(e) => setClarityMax(e.target.value)}
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title="پایان بازه پاکی (تا)"
                      >
                        {getAllowedClarityEndGrades(clarityMin).map((cl) => (
                          <option key={cl} value={cl}>
                            {cl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Lot / Batch Code & Pool Identity Key Preview */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      شماره بچ / پارت بارخانه (Lot / Batch Number)
                    </label>
                    <input
                      type="text"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="مثال: LOT-2026-MELEE-01"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      شناسه هویتی یکپارچه حوضچه (Pool Identity Key)
                    </label>
                    <div className="flex h-8 items-center rounded-xl bg-slate-100 px-3 font-mono text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
                      {generatePoolIdentityKey({
                        rootCategory,
                        species: species || 'diamond',
                        shape,
                        sizeMin: sizeMin ? parseFloat(sizeMin) : undefined,
                        sizeMax: sizeMax ? parseFloat(sizeMax) : undefined,
                        sizeUnit,
                        colorRangeLabel: colorRange,
                        clarityRangeLabel: clarityRange,
                        cutGrade,
                        fluorescence,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Single Stone 4C Quality Controls */}
            {stoneMode !== 'parcel' && (
              <>
                {/* Color Mode Selector */}
                <div className="flex items-center gap-4 border-t border-cyan-100/60 pt-3 dark:border-cyan-900/40">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">سیستم رنگ:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="colorMode"
                      checked={colorMode === 'd_z'}
                      onChange={() => setColorMode('d_z')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    طیف بی‌رنگ (D to Z)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="colorMode"
                      checked={colorMode === 'fancy'}
                      onChange={() => setColorMode('fancy')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    الماس رنگی خاص (Fancy Color Diamond)
                  </label>
                </div>

                {colorMode === 'd_z' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        درجه رنگ (Color)
                      </label>
                      <select
                        value={colorGrade}
                        onChange={(e) => setColorGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {D_Z_COLORS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        درجه پاکی (Clarity)
                      </label>
                      <select
                        value={clarityGrade}
                        onChange={(e) => setClarityGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {CLARITY_GRADES.map((cl) => (
                          <option key={cl} value={cl}>
                            {cl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        کیفیت تراش (Cut Grade)
                      </label>
                      <select
                        value={cutGrade}
                        onChange={(e) => setCutGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {CUT_GRADES.map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.nameFa}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        فلورسانس (Fluorescence)
                      </label>
                      <select
                        value={fluorescence}
                        onChange={(e) => setFluorescence(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {FLUORESCENCE_GRADES.map((fl) => (
                          <option key={fl.id} value={fl.id}>
                            {fl.nameFa}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        شدت رنگ (Intensity)
                      </label>
                      <select
                        value={fancyIntensity}
                        onChange={(e) => setFancyIntensity(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {FANCY_INTENSITIES.map((fi) => (
                          <option key={fi.id} value={fi.id}>
                            {fi.nameFa} ({fi.nameEn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        فام رنگی (Hue)
                      </label>
                      <select
                        value={fancyHue}
                        onChange={(e) => setFancyHue(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {COLORED_HUES.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nameFa} ({h.nameEn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        منشا رنگ (Color Origin)
                      </label>
                      <select
                        value={fancyOrigin}
                        onChange={(e) => setFancyOrigin(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {COLOR_ORIGINS.map((co) => (
                          <option key={co.id} value={co.id}>
                            {co.nameFa}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        درجه پاکی (Clarity)
                      </label>
                      <select
                        value={clarityGrade}
                        onChange={(e) => setClarityGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {CLARITY_GRADES.map((cl) => (
                          <option key={cl} value={cl}>
                            {cl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Polish, Symmetry, Measurements */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-cyan-100/60 pt-3 dark:border-cyan-900/40">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                      پولیش (Polish)
                    </label>
                    <select
                      value={polish}
                      onChange={(e) => setPolish(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {POLISH_SYMMETRY_GRADES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                      تقارن (Symmetry)
                    </label>
                    <select
                      value={symmetry}
                      onChange={(e) => setSymmetry(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {POLISH_SYMMETRY_GRADES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                      ابعاد (طول × عرض mm)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={measurementsLength}
                        onChange={(e) => setMeasurementsLength(e.target.value)}
                        placeholder="طول"
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                      <span>×</span>
                      <input
                        type="number"
                        step="0.01"
                        value={measurementsWidth}
                        onChange={(e) => setMeasurementsWidth(e.target.value)}
                        placeholder="عرض"
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                      عمق (Depth mm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={measurementsDepth}
                      onChange={(e) => setMeasurementsDepth(e.target.value)}
                      placeholder="عمق"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-purple-100 bg-purple-50/30 p-4 space-y-4 dark:border-purple-900/50 dark:bg-purple-950/10">
            <span className="flex items-center gap-1.5 text-xs font-black text-purple-950 dark:text-purple-200">
              <Info size={16} className="text-purple-600 dark:text-purple-400" />
              مشخصات تخصصی گوهرسنگ رنگی (Colored Gemstone Quality)
            </span>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  رنگ و فام (Hue)
                </label>
                <input
                  type="text"
                  value={colorHue}
                  onChange={(e) => setColorHue(e.target.value)}
                  placeholder="مثال: قرمز اناری، آبی مایل به سبز"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  شفافیت (Transparency)
                </label>
                <select
                  value={transparency}
                  onChange={(e) => setTransparency(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {TRANSPARENCIES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  بهسازی (Treatments)
                </label>
                <select
                  value={treatments}
                  onChange={(e) => setTreatments(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {GEMSTONE_TREATMENTS.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  مبدا جغرافیایی (Origin)
                </label>
                <select
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="Iran">ایران (نیشابور / قم / خراسان)</option>
                  {ORIGIN_COUNTRIES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nameFa}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-3 ${stoneMode !== 'parcel' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} border-t border-purple-100/60 pt-3 dark:border-purple-900/40`}>
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  تن تیرگی/روشنی (Tone)
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {TONES.map((tn) => (
                    <option key={tn.id} value={tn.id}>
                      {tn.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  اشباع رنگ (Saturation)
                </label>
                <select
                  value={saturation}
                  onChange={(e) => setSaturation(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {SATURATIONS.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  مستند منشا مبدا (Origin Source)
                </label>
                <select
                  value={originSource}
                  onChange={(e) => setOriginSource(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {ORIGIN_SOURCES.map((os) => (
                    <option key={os.id} value={os.id}>
                      {os.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              {stoneMode !== 'parcel' && (
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                    ابعاد گوهر (L × W mm)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      value={measurementsLength}
                      onChange={(e) => setMeasurementsLength(e.target.value)}
                      placeholder="طول"
                      className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span>×</span>
                    <input
                      type="number"
                      step="0.01"
                      value={measurementsWidth}
                      onChange={(e) => setMeasurementsWidth(e.target.value)}
                      placeholder="عرض"
                      className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Specific Gemological Context Attributes */}
            {(species === 'topaz' || isLondonBlueTopaz(species, variety, itemName) || rootCategory === 'simulant') && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-purple-100/60 pt-3 dark:border-purple-900/40">
                {(species === 'topaz' || isLondonBlueTopaz(species, variety, itemName)) && (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      متد بهسازی و نام تجاری توپاز
                    </label>
                    <input
                      type="text"
                      value={treatmentMethod || 'irradiation'}
                      onChange={(e) => setTreatmentMethod(e.target.value)}
                      placeholder="پرتودیده (irradiation)"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <span className="mt-1 block text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                      توپاز لندن بلو سنگ طبیعی پرتودیده (Irradiated) است، نه گونه یا سنگ آزمایشگاهی مستقل.
                    </span>
                  </div>
                )}

                {rootCategory === 'simulant' && (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      پایه شیمیایی بدل (Chemical Basis)
                    </label>
                    <input
                      type="text"
                      value={chemicalBasis || 'zirconium_dioxide'}
                      onChange={(e) => setChemicalBasis(e.target.value)}
                      placeholder="zirconium_dioxide (دی‌اکسید زیرکونیوم)"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section E: Weights & Sensing Section */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
            <Scale size={16} className="text-cyan-600 dark:text-cyan-400" />
            <span>سنجش وزن و همگام‌سازی قیراط و گرم</span>
            <span
              title="1ct = 0.2g | 1g = 5ct"
              className="inline-flex items-center justify-center rounded-full bg-slate-200/80 p-0.5 text-slate-500 hover:bg-cyan-100 hover:text-cyan-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-cyan-900/50 dark:hover:text-cyan-300 transition-colors cursor-help"
            >
              <Info size={13} />
            </span>
          </div>

          <div className={`grid grid-cols-1 gap-3 ${stoneMode === 'parcel' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div>
              <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                وزن {stoneMode === 'parcel' ? 'کل ' : ''}به قیراط (Carat - ct) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                value={weightCt}
                onChange={(e) => handleCaratsChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="مثال: 1.25"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-black text-cyan-600 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                وزن معادل به گرم (Gram - g)
              </label>
              <input
                type="number"
                step="0.0001"
                value={weightG}
                onChange={(e) => handleGramsChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="مثال: 0.2500"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {stoneMode === 'parcel' && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                    تعداد قطعات موجود در بسته (عدد)
                  </label>
                  {sizeUnit === 'sieve' && sieveSize && Number(weightCt) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const est = estimatePiecesFromCarats(sieveSize, Number(weightCt), effectiveSieves);
                        if (est > 0) setPieces(String(est));
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 cursor-pointer"
                      title="محاسبه تخمینی تعداد بر اساس الک انتخابی"
                    >
                      <Sparkles size={13} />
                      <span>تخمین با الک ({estimatePiecesFromCarats(sieveSize, Number(weightCt), effectiveSieves)} عدد)</span>
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  value={pieces}
                  onChange={(e) => handlePiecesChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="۱۰"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section F: Certificate & Laboratory Dossier */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
          <span className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
            <Award size={16} className="text-amber-600 dark:text-amber-400" />
            مشخصات شناسنامه بین‌المللی و آزمایشگاه گوهرشناسی
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                آزمایشگاه صادرکننده
              </label>
              <select
                value={certificateLab}
                onChange={(e) => setCertificateLab(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="none">بدون شناسنامه / شناسنامه متفرقه</option>
                {GEMSTONE_LABS.map((lb) => (
                  <option key={lb.id} value={lb.id}>
                    {lb.nameFa}
                  </option>
                ))}
              </select>
            </div>

            {certificateLab !== 'none' && (
              <>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                    شماره گزارش / Certificate No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={certificateReportNumber}
                    onChange={(e) => setCertificateReportNumber(e.target.value)}
                    placeholder="مثال: 2476123456"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    required={certificateLab !== 'none'}
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
                    وضعیت استعلام اصالت
                  </label>
                  <select
                    value={verificationStatus}
                    onChange={(e) => setVerificationStatus(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="not_checked">استعلام نشده (Not Checked)</option>
                    <option value="verified">تایید شده توسط کارشناس / استعلام معتبر</option>
                    <option value="manual">تطبیق دستی فیزیکی</option>
                    <option value="unavailable">سامانه استعلام در دسترس نیست</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section G: Valuation & Pricing (Only if trade operation: purchase, sale, unsettled) */}
        {isTrade && (
          <div className="p-4 rounded-3xl border border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-black text-emerald-950 dark:text-emerald-200">
                <Calculator size={16} className="text-emerald-600 dark:text-emerald-400" />
                ارزش‌گذاری و مبنای محاسبه نرخ معامله سنگ
              </span>

              {/* Valuation Method Switcher */}
              <div className="inline-flex rounded-xl bg-emerald-100/70 p-1 dark:bg-emerald-900/40 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleValuationMethodChange('per_carat')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    valuationMethod === 'per_carat'
                      ? 'bg-emerald-600 text-white font-black shadow-xs dark:bg-emerald-500'
                      : 'text-emerald-900 dark:text-emerald-200 hover:text-emerald-950'
                  }`}
                >
                  فی هر قیراط
                </button>
                <button
                  type="button"
                  onClick={() => handleValuationMethodChange('per_gram')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    valuationMethod === 'per_gram'
                      ? 'bg-emerald-600 text-white font-black shadow-xs dark:bg-emerald-500'
                      : 'text-emerald-900 dark:text-emerald-200 hover:text-emerald-950'
                  }`}
                >
                  فی هر گرم
                </button>
                {stoneMode !== 'parcel' && (
                  <button
                    type="button"
                    onClick={() => handleValuationMethodChange('per_piece')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      valuationMethod === 'per_piece'
                        ? 'bg-emerald-600 text-white font-black shadow-xs dark:bg-emerald-500'
                        : 'text-emerald-900 dark:text-emerald-200 hover:text-emerald-950'
                    }`}
                  >
                    فی هر دانه
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleValuationMethodChange('total_sum')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    valuationMethod === 'total_sum'
                      ? 'bg-emerald-600 text-white font-black shadow-xs dark:bg-emerald-500'
                      : 'text-emerald-900 dark:text-emerald-200 hover:text-emerald-950'
                  }`}
                >
                  مبلغ کل مقطوع
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Unit Price */}
              {valuationMethod !== 'total_sum' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {valuationMethod === 'per_carat'
                      ? `قیمت هر قیراط (${currencySuffix}) *`
                      : valuationMethod === 'per_gram'
                      ? `قیمت هر گرم (${currencySuffix}) *`
                      : `قیمت هر دانه (${currencySuffix}) *`}
                  </label>
                  <PriceInput
                    value={unitPrice}
                    onValueChange={(_parsed, rawVal) => handleUnitPriceChange(rawVal)}
                    baseCurrency={baseCurrency}
                    currencySuffix={currencySuffix}
                    placeholder="۰"
                    showWords
                  />
                </div>
              )}

              {/* Total Amount */}
              <div className={valuationMethod === 'total_sum' ? 'sm:col-span-2' : ''}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    مبلغ کل معامله ({currencySuffix}) *
                  </label>

                  {/* Rounding button */}
                  <button
                    type="button"
                    onClick={() => setRoundingModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span>گرد کردن مبلغ</span>
                  </button>
                </div>
                <MoneyInputField
                  label=""
                  value={totalAmount}
                  onChange={handleTotalAmountChange}
                  baseCurrency={baseCurrency}
                  currencySuffix={currencySuffix}
                  onKeyDown={onKeyDown}
                  showWords
                />
              </div>
            </div>

            {/* Weighted Average Cost (WAC) display for parcels */}
            {stoneMode === 'parcel' && Number(totalAmount) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-xs">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300">
                    میانگین موزون بهای هر قیراط (WAC / ct):
                  </span>
                  <span className="font-mono font-black text-emerald-800 dark:text-emerald-200">
                    {parseFloat(weightCt) > 0
                      ? `${formatNumberWithCommas(Math.round(parseLocalizedAmount(totalAmount) / parseFloat(weightCt)))} ${currencySuffix}`
                      : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-xs">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300">
                    میانگین موزون بهای هر عدد (WAC / pc):
                  </span>
                  <span className="font-mono font-black text-emerald-800 dark:text-emerald-200">
                    {parseInt(pieces || '1', 10) > 0
                      ? `${formatNumberWithCommas(Math.round(parseLocalizedAmount(totalAmount) / parseInt(pieces || '1', 10)))} ${currencySuffix}`
                      : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Unsettled Notice Badge */}
            {isUnsettled && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold">
                <Info size={16} className="shrink-0 text-amber-600" />
                <span>
                  {isReceived
                    ? 'این معامله به صورت خرید بدون تسویه ثبت می‌شود و مبلغ آن به عنوان طلب مشتری (بدهی ما) در حساب منظور خواهد شد.'
                    : 'این معامله به صورت فروش بدون تسویه ثبت می‌شود و مبلغ آن به عنوان بدهی مشتری (طلب ما) در حساب منظور خواهد شد.'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Section H: Storage Location & SKU */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                محل فیزیکی نگهداری
              </label>
              <button
                type="button"
                onClick={() => setShowAddLocationModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 cursor-pointer"
              >
                <Plus size={13} />
                <span>محل جدید</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="گاوصندوق اصلی">گاوصندوق اصلی</option>
                <option value="گاوصندوق دفتر">گاوصندوق دفتر</option>
                <option value="ویترین">ویترین</option>
                {storageLocations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name} {loc.code ? `(${loc.code})` : ''}
                  </option>
                ))}
                {storageLocation &&
                  storageLocation !== 'گاوصندوق اصلی' &&
                  storageLocation !== 'گاوصندوق دفتر' &&
                  storageLocation !== 'ویترین' &&
                  !storageLocations.some((l) => l.name === storageLocation) && (
                    <option value={storageLocation}>{storageLocation}</option>
                  )}
              </select>
              <button
                type="button"
                onClick={() => setShowAddLocationModal(true)}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-slate-800 dark:text-cyan-400 dark:hover:bg-slate-700 cursor-pointer"
                title="افزودن محل نگهداری جدید"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300 text-xs">
              کد شناسایی داخلی (SKU / Code)
            </label>
            <input
              type="text"
              value={internalCode}
              onChange={(e) => setInternalCode(e.target.value)}
              placeholder="مثال: DIA-104 یا GEM-1405"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Section I: Description Field */}
        <Field label="شرح / بابت ردیف سنگ" wide>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="توضیحات تکمیلی بابت گوهر، سفارش، سایز یا مشخصات..."
            rows={2}
          />
        </Field>
      </div>

      {/* 3. Sticky Commit Line Button */}
      {commitDraftLine && draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm cursor-pointer"
            onClick={handleCommit}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف سنگ' : 'ثبت ردیف سنگ'}
          </button>
        </div>
      ) : null}

      {/* Modal for Shape Settings & Priorities */}
      <ShapeSettingsModal
        isOpen={isShapeSettingsOpen}
        onClose={() => setIsShapeSettingsOpen(false)}
        onPreferencesChange={(order, hidden, customNames, parentMap) => {
          setShapePrefs({
            order,
            hidden,
            customNames: customNames || {},
            parentMap: parentMap || {},
          });
        }}
      />

      {/* Modal for adding new storage location */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            dir="rtl"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h4 className="mb-3 text-sm font-black text-slate-900 dark:text-white">
              افزودن محل نگهداری جدید
            </h4>
            <input
              type="text"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="نام محل (مثال: گاوصندوق کارگاه ۳)"
              className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddLocationModal(false);
                  setNewLocationName('');
                }}
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleCreateLocation}
                disabled={isSubmittingLocation || !newLocationName.trim()}
                className="rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingLocation ? 'در حال ثبت...' : 'افزودن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Rounding */}
      <AmountRoundingModal
        isOpen={roundingModalOpen}
        onClose={() => setRoundingModalOpen(false)}
        currentAmount={parseLocalizedAmount(totalAmount)}
        baseCurrency={currencySuffix === 'تومان' ? 'IRT' : 'IRR'}
        initialDigits={roundingDigits}
        initialMode={roundingMode}
        initialEnabled={roundingEnabled}
        initialAutoApply={autoApplyRounding}
        onApply={(roundedAmount, digits, rMode, autoApply, enabled) => {
          setRoundingDigits(digits);
          setRoundingMode(rMode);
          setRoundingEnabled(enabled ?? true);
          setAutoApplyRounding(autoApply);
          if (enabled) {
            setTotalAmount(String(roundedAmount));
          }
        }}
      />
    </div>
  );
}
