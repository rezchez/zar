'use client';

import {
  AlertCircle,
  Award,
  Check,
  ChevronDown,
  Gem,
  Info,
  Layers,
  Plus,
  Scale,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ShapeSettingsModal, {
  loadShapePreferences,
  buildHierarchicalShapeOrder,
  type ShapePreferences,
} from './ShapeSettingsModal';
import GemstoneShapeIcon from './GemstoneShapeIcon';

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
  type GemstoneShapeItem,
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
  POST_GROWTH_TREATMENTS,
  isLondonBlueTopaz,
  validateColorRange,
  validateClarityRange,
  generatePoolIdentityKey,
  areParcelsHomogeneous,
  DIAMOND_SIEVE_CHART,
  findSieveBySize,
  estimatePiecesFromCarats,
  estimateCaratsFromPieces,
  type GemstoneCategory,
  type GemstoneOpeningRecord,
  type GemstoneTypeRecord,
  type RootCategory,
  type LabGrowthMethod,
  type PostGrowthTreatment,
  type GemstoneSpeciesItem,
  getSpeciesForRootCategory,
  findSpeciesItem,
} from '@/lib/gemstone';
import {
  calculateValuationTotalCost,
  caratsToGrams,
  gramsToCarats,
  parseWeight,
} from '@/lib/gemstone-weight';
import type { Currency } from '@/lib/currencies';
import type { StorageLocationItem } from '@/app/api/storage-locations/route';
import { dateToJalaliString } from '@/lib/jalali';
import { convertRialToToman, formatNumberWithCommas } from '@/lib/money';

export type InitialGemstoneInventoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingItem?: GemstoneOpeningRecord | null;
  existingParcels?: GemstoneOpeningRecord[];
};

export default function InitialGemstoneInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  editingItem,
  existingParcels = [],
}: InitialGemstoneInventoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [mode, setMode] = useState<'single_stone' | 'parcel'>('single_stone');
  const [category, setCategory] = useState<GemstoneCategory>('diamond');
  const [species, setSpecies] = useState<string>('diamond');
  const [variety, setVariety] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');

  // Diamond specific
  const [diamondType, setDiamondType] = useState<'natural' | 'lab_grown'>('natural');
  const [colorMode, setColorMode] = useState<'d_z' | 'fancy'>('d_z');
  const [colorGrade, setColorGrade] = useState<string>('G');
  const [fancyIntensity, setFancyIntensity] = useState<string>('Fancy');
  const [fancyHue, setFancyHue] = useState<string>('Yellow');
  const [fancyOvertone, setFancyOvertone] = useState<string>('');
  const [fancyOrigin, setFancyOrigin] = useState<string>('natural');
  const [clarityGrade, setClarityGrade] = useState<string>('VS1');
  const [cutGrade, setCutGrade] = useState<string>('excellent');
  const [polish, setPolish] = useState<string>('excellent');
  const [symmetry, setSymmetry] = useState<string>('excellent');
  const [fluorescence, setFluorescence] = useState<string>('none');
  const [fluorescenceColor, setFluorescenceColor] = useState<string>('');

  // Colored stone specific
  const [colorHue, setColorHue] = useState<string>('');
  const [tone, setTone] = useState<string>('medium');
  const [saturation, setSaturation] = useState<string>('strong');
  const [transparency, setTransparency] = useState<string>('transparent');
  const [clarityDescription, setClarityDescription] = useState<string>('eye_clean');
  const [treatments, setTreatments] = useState<string>('none_detected');
  const [treatmentDetails, setTreatmentDetails] = useState<string>('');
  const [origin, setOrigin] = useState<string>('unknown');
  const [originSource, setOriginSource] = useState<string>('unknown');

  // Common geometry & certificate
  const [shape, setShape] = useState<string>('round');
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
  const [measurementsLength, setMeasurementsLength] = useState<string>('');
  const [measurementsWidth, setMeasurementsWidth] = useState<string>('');
  const [measurementsDepth, setMeasurementsDepth] = useState<string>('');
  const [tablePercentage, setTablePercentage] = useState<string>('');
  const [depthPercentage, setDepthPercentage] = useState<string>('');
  const [certificateLab, setCertificateLab] = useState<string>('none');
  const [certificateReportNumber, setCertificateReportNumber] = useState<string>('');
  const [certificateDate, setCertificateDate] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<string>('not_checked');

  // Weights & counts
  const [weightCt, setWeightCt] = useState<string>('');
  const [weightG, setWeightG] = useState<string>('');
  const [pieces, setPieces] = useState<string>('1');

  // Financials & valuation
  const [valuationMethod, setValuationMethod] = useState<'per_carat' | 'per_gram' | 'total_amount' | 'total_value'>('per_carat');
  // We accept unit cost in Toman for user convenience and convert to Rial on submit
  const [unitCostToman, setUnitCostToman] = useState<string>('');
  const [totalCostTomanManual, setTotalCostTomanManual] = useState<string>('');

  // Classification states
  const [rootCategory, setRootCategory] = useState<RootCategory>('natural');
  const [growthMethod, setGrowthMethod] = useState<LabGrowthMethod>('CVD');
  const [postGrowthTreatment, setPostGrowthTreatment] = useState<PostGrowthTreatment>('none_detected');
  const [laserInscription, setLaserInscription] = useState<string>('');
  const [chemicalBasis, setChemicalBasis] = useState<string>('');
  const [syntheticMethod, setSyntheticMethod] = useState<string>('');
  const [commercialName, setCommercialName] = useState<string>('');
  const [originCountry, setOriginCountry] = useState<string>('');
  const [locality, setLocality] = useState<string>('');
  const [treatmentMethod, setTreatmentMethod] = useState<string>('');

  // Bar-Khaneh / Parcel Pool states
  const [sizeMin, setSizeMin] = useState<string>('');
  const [sizeMax, setSizeMax] = useState<string>('');
  const [sizeUnit, setSizeUnit] = useState<'ct' | 'mm' | 'sieve'>('ct');
  const [sieveSize, setSieveSize] = useState<string>('+1.5-2');
  const [mergeWithExistingId, setMergeWithExistingId] = useState<string | null>(null);
  const [colorMin, setColorMin] = useState<string>('G');
  const [colorMax, setColorMax] = useState<string>('H');
  const [clarityMin, setClarityMin] = useState<string>('VS1');
  const [clarityMax, setClarityMax] = useState<string>('VS2');
  const [lotNumber, setLotNumber] = useState<string>('');

  // Auto-detect homogeneous existing parcel
  const matchingParcel = useMemo(() => {
    if (mode !== 'parcel' || editingItem || !existingParcels || existingParcels.length === 0) return null;
    const currentForm: Partial<GemstoneOpeningRecord> = {
      mode: 'parcel',
      rootCategory,
      category,
      species,
      shape,
      sizeUnit,
      sizeMin: sizeMin ? Number(sizeMin) : undefined,
      sizeMax: sizeMax ? Number(sizeMax) : undefined,
      sieveSize: sizeUnit === 'sieve' ? sieveSize : undefined,
      colorRangeLabel: validateColorRange(colorMin, colorMax).label,
      clarityRangeLabel: validateClarityRange(clarityMin, clarityMax).label,
    };
    return existingParcels.find((p) => p.id && areParcelsHomogeneous(currentForm, p)) || null;
  }, [
    mode,
    editingItem,
    existingParcels,
    rootCategory,
    category,
    species,
    shape,
    sizeUnit,
    sizeMin,
    sizeMax,
    sieveSize,
    colorMin,
    colorMax,
    clarityMin,
    clarityMax,
  ]);

  // Storage & notes
  const [storageLocation, setStorageLocation] = useState<string>('گاوصندوق دفتر');
  const [storageLocations, setStorageLocations] = useState<StorageLocationItem[]>([]);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
  const [internalCode, setInternalCode] = useState<string>('');
  const [acquisitionDate, setAcquisitionDate] = useState<string>(dateToJalaliString(new Date()));
  const [description, setDescription] = useState<string>('');

  // Currencies state
  const [currenciesList, setCurrenciesList] = useState<Currency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('IRT');

  // Master data from backend collections
  const [gemstoneTypes, setGemstoneTypes] = useState<GemstoneTypeRecord[]>([]);
  const [shapesList, setShapesList] = useState<any[]>([]);
  const [sievesList, setSievesList] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    async function loadAuxData() {
      try {
        const [typesRes, locsRes, currRes, shapesRes, sievesRes] = await Promise.allSettled([
          fetch('/api/gemstone-types', { cache: 'no-store' }),
          fetch('/api/storage-locations', { cache: 'no-store' }),
          fetch('/api/currencies', { cache: 'no-store' }),
          fetch('/api/gemstone-shapes', { cache: 'no-store' }),
          fetch('/api/gemstone-sieves', { cache: 'no-store' }),
        ]);

        if (typesRes.status === 'fulfilled' && typesRes.value.ok) {
          const data = await typesRes.value.json();
          if (Array.isArray(data.items)) setGemstoneTypes(data.items);
        }
        if (locsRes.status === 'fulfilled' && locsRes.value.ok) {
          const data = await locsRes.value.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            setStorageLocations(data.items);
            if (!editingItem && !storageLocation) {
              setStorageLocation(data.items[0].name);
            }
          }
        }
        if (currRes.status === 'fulfilled' && currRes.value.ok) {
          const data = await currRes.value.json();
          if (Array.isArray(data.currencies)) {
            setCurrenciesList(data.currencies);
          }
        }
        if (shapesRes.status === 'fulfilled' && shapesRes.value.ok) {
          const data = await shapesRes.value.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            setShapesList(data.items);
            const backendOrder = data.items.map((it: any) => it.code);
            const backendParents: Record<string, string | null> = {};
            const backendCustomNames: Record<string, { nameFa?: string; nameEn?: string }> = {};
            for (const it of data.items) {
              if (it.parentCode) backendParents[it.code] = it.parentCode;
              if (it.customNameFa || it.customNameEn) {
                backendCustomNames[it.code] = {
                  nameFa: it.customNameFa,
                  nameEn: it.customNameEn,
                };
              }
            }
            setShapePrefs((prev) => ({
              ...prev,
              order: backendOrder,
              parentMap: { ...prev.parentMap, ...backendParents },
              customNames: { ...prev.customNames, ...backendCustomNames },
            }));
          }
        }
        if (sievesRes.status === 'fulfilled' && sievesRes.value.ok) {
          const data = await sievesRes.value.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            setSievesList(data.items);
          }
        }
      } catch {
        // non-blocking
      }
    }
    void loadAuxData();
  }, [isOpen, editingItem]);

  const availableCurrencies = React.useMemo(() => {
    const base = [
      { code: 'IRT', name: 'تومان', symbol: 'تومان' },
      { code: 'IRR', name: 'ریال', symbol: 'ریال' },
    ];
    const foreign = (currenciesList || []).filter(
      (c) => c.code !== 'IRT' && c.code !== 'IRR' && c.code !== 'TOMAN' && c.code !== 'RIAL'
    );
    return [...base, ...foreign];
  }, [currenciesList]);

  const activeCurrencyObj = React.useMemo(() => {
    return availableCurrencies.find((c) => c.code === selectedCurrency) || availableCurrencies[0];
  }, [availableCurrencies, selectedCurrency]);

  const currLabel = activeCurrencyObj?.symbol || activeCurrencyObj?.name || selectedCurrency;

  // Sync editing item or reset
  useEffect(() => {
    if (editingItem) {
      const isParcel = editingItem.mode === 'parcel' || editingItem.inventoryMode === 'parcel';
      setMode(isParcel ? 'parcel' : 'single_stone');
      setCategory(editingItem.category || 'diamond');
      setSpecies(editingItem.species || 'diamond');
      setVariety(editingItem.variety || '');
      setItemName(editingItem.itemName || editingItem.tradeName || '');
      setDiamondType(
        editingItem.diamondType ||
          (editingItem.diamondOriginType === 'laboratory_grown' || editingItem.rootCategory === 'laboratory_grown'
            ? 'lab_grown'
            : 'natural')
      );
      setColorMode(
        editingItem.colorMode || (editingItem.diamondColorSystem === 'fancy_color' ? 'fancy' : 'd_z')
      );
      setColorGrade(editingItem.colorGrade || editingItem.diamondColorGrade || 'G');
      setFancyIntensity(editingItem.fancyColorIntensity || 'Fancy');
      setFancyHue(editingItem.fancyColorHue || 'Yellow');
      setFancyOvertone(editingItem.fancyColorOvertone || '');
      setFancyOrigin(editingItem.fancyColorOrigin || 'natural');
      setClarityGrade(editingItem.clarityGrade || editingItem.diamondClarityGrade || 'VS1');
      setCutGrade(editingItem.cutGrade || 'excellent');
      setPolish(editingItem.polish || 'excellent');
      setSymmetry(editingItem.symmetry || 'excellent');
      setFluorescence(editingItem.fluorescence || 'none');
      setFluorescenceColor(editingItem.fluorescenceColor || '');
      setColorHue(editingItem.colorHue || '');
      setTone(editingItem.tone || 'medium');
      setSaturation(editingItem.saturation || 'strong');
      setTransparency(editingItem.transparency || 'transparent');
      setClarityDescription(editingItem.clarityDescription || 'eye_clean');
      setTreatments(
        Array.isArray(editingItem.treatments)
          ? (editingItem.treatments[0] || 'none_detected')
          : (editingItem.treatments || 'none_detected')
      );
      setTreatmentDetails(editingItem.treatmentDetails || '');
      setOrigin(editingItem.origin || editingItem.originCountry || 'unknown');
      setOriginSource(editingItem.originSource || 'unknown');
      setShape(editingItem.shape || 'round');
      setMeasurementsLength(
        editingItem.measurementsLength
          ? String(editingItem.measurementsLength)
          : editingItem.lengthMm
          ? String(editingItem.lengthMm)
          : ''
      );
      setMeasurementsWidth(
        editingItem.measurementsWidth
          ? String(editingItem.measurementsWidth)
          : editingItem.widthMm
          ? String(editingItem.widthMm)
          : ''
      );
      setMeasurementsDepth(
        editingItem.measurementsDepth
          ? String(editingItem.measurementsDepth)
          : editingItem.depthMm
          ? String(editingItem.depthMm)
          : ''
      );
      setTablePercentage(
        editingItem.tablePercentage
          ? String(editingItem.tablePercentage)
          : editingItem.tablePercent
          ? String(editingItem.tablePercent)
          : ''
      );
      setDepthPercentage(
        editingItem.depthPercentage
          ? String(editingItem.depthPercentage)
          : editingItem.depthPercent
          ? String(editingItem.depthPercent)
          : ''
      );
      setCertificateLab(editingItem.certificateLab || (editingItem.hasCertificate ? 'gia' : 'none'));
      setCertificateReportNumber(editingItem.certificateReportNumber || editingItem.reportNumber || '');
      setCertificateDate(editingItem.certificateDate || editingItem.reportDate || '');
      setVerificationStatus(
        editingItem.verificationStatus || editingItem.certificateVerificationStatus || 'not_checked'
      );
      setWeightCt(String(editingItem.weightCt || ''));
      setWeightG(String(editingItem.weightG || ''));
      setPieces(String(editingItem.pieces ?? editingItem.quantity ?? 1));

      const vm =
        (editingItem.valuationMethod as string) === 'per_piece'
          ? 'total_amount'
          : editingItem.valuationMethod || 'per_carat';
      setValuationMethod(vm as any);

      const resolvedUnitPrice =
        editingItem.unitPrice || editingItem.costPerCarat || editingItem.costPerGram || 0;
      if (resolvedUnitPrice > 0) {
        setUnitCostToman(formatNumberWithCommas(convertRialToToman(resolvedUnitPrice)));
      } else {
        setUnitCostToman('');
      }

      const resolvedTotalCost = editingItem.totalAmount || editingItem.totalCost || 0;
      if (resolvedTotalCost > 0) {
        setTotalCostTomanManual(formatNumberWithCommas(convertRialToToman(resolvedTotalCost)));
      } else {
        setTotalCostTomanManual('');
      }

      setStorageLocation(editingItem.storageLocation || 'گاوصندوق اصلی');
      setInternalCode(editingItem.internalCode || editingItem.inventoryCode || '');
      setAcquisitionDate(
        editingItem.acquisitionDate || editingItem.openingBalanceDate || dateToJalaliString(new Date())
      );
      setDescription(editingItem.description || '');

      // Classification sync
      setRootCategory(
        editingItem.rootCategory ||
          (editingItem.diamondType === 'lab_grown' ? 'laboratory_grown' : 'natural')
      );
      setGrowthMethod(editingItem.growthMethod || 'CVD');
      setPostGrowthTreatment(editingItem.postGrowthTreatment || 'none_detected');
      setLaserInscription(editingItem.laserInscription || '');
      setChemicalBasis(editingItem.chemicalBasis || '');
      setSyntheticMethod(editingItem.syntheticMethod || '');
      setCommercialName(editingItem.commercialName || '');
      setOriginCountry(editingItem.originCountry || '');
      setLocality(editingItem.locality || '');
      setTreatmentMethod(editingItem.treatmentMethod || '');

      // Parcel pool sync
      setSizeMin(editingItem.sizeMin !== undefined ? String(editingItem.sizeMin) : '');
      setSizeMax(editingItem.sizeMax !== undefined ? String(editingItem.sizeMax) : '');
      setSizeUnit(editingItem.sizeUnit || 'ct');
      setSieveSize(editingItem.sieveSize || editingItem.parcelReportNumber || '+1.5-2');
      setMergeWithExistingId(null);
      setColorMin(editingItem.colorMin || 'G');
      setColorMax(editingItem.colorMax || 'H');
      setClarityMin(editingItem.clarityMin || 'VS1');
      setClarityMax(editingItem.clarityMax || 'VS2');
      setLotNumber(editingItem.lotNumber || editingItem.inventoryCode || '');
    } else {
      // Defaults
      setMode('single_stone');
      setCategory('diamond');
      setSpecies('diamond');
      setVariety('');
      setItemName('');
      setRootCategory('natural');
      setGrowthMethod('CVD');
      setPostGrowthTreatment('none_detected');
      setLaserInscription('');
      setChemicalBasis('');
      setSyntheticMethod('');
      setCommercialName('');
      setOriginCountry('');
      setLocality('');
      setTreatmentMethod('');
      setSizeMin('');
      setSizeMax('');
      setSizeUnit('ct');
      setSieveSize('+1.5-2');
      setMergeWithExistingId(null);
      setColorMin('G');
      setColorMax('H');
      setClarityMin('VS1');
      setClarityMax('VS2');
      setLotNumber('');
      setDiamondType('natural');
      setColorMode('d_z');
      setColorGrade('G');
      setFancyIntensity('Fancy');
      setFancyHue('Yellow');
      setFancyOvertone('');
      setFancyOrigin('natural');
      setClarityGrade('VS1');
      setCutGrade('excellent');
      setPolish('excellent');
      setSymmetry('excellent');
      setFluorescence('none');
      setFluorescenceColor('');
      setColorHue('');
      setTone('medium');
      setSaturation('strong');
      setTransparency('transparent');
      setClarityDescription('eye_clean');
      setTreatments('none_detected');
      setTreatmentDetails('');
      setOrigin('unknown');
      setOriginSource('unknown');
      setShape('round');
      setMeasurementsLength('');
      setMeasurementsWidth('');
      setMeasurementsDepth('');
      setTablePercentage('');
      setDepthPercentage('');
      setCertificateLab('none');
      setCertificateReportNumber('');
      setCertificateDate('');
      setVerificationStatus('not_checked');
      setWeightCt('');
      setWeightG('');
      setPieces('1');
      setValuationMethod('per_carat');
      setUnitCostToman('');
      setTotalCostTomanManual('');
      setStorageLocation('گاوصندوق اصلی');
      setInternalCode('');
      setAcquisitionDate(dateToJalaliString(new Date()));
      setDescription('');
    }
    setError(null);
  }, [editingItem, isOpen]);

  // Carat / Gram conversion handlers
  const handleCaratChange = (val: string) => {
    setWeightCt(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setWeightG(String(caratsToGrams(parsed, 4)));
    } else {
      setWeightG('');
    }
  };

  const handleGramChange = (val: string) => {
    setWeightG(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setWeightCt(String(gramsToCarats(parsed, 3)));
    } else {
      setWeightCt('');
    }
  };

  // Apply species selection and preset attributes
  const applySpeciesSelection = (item: GemstoneSpeciesItem) => {
    setSpecies(item.id);
    setCategory(item.category);

    if (item.diamondType) {
      setDiamondType(item.diamondType);
    } else if (item.category === 'diamond') {
      setDiamondType(rootCategory === 'laboratory_grown' ? 'lab_grown' : 'natural');
    }

    if (item.growthMethod) {
      setGrowthMethod(item.growthMethod);
    }
    if (item.syntheticMethod !== undefined) {
      setSyntheticMethod(item.syntheticMethod);
    }
    if (item.chemicalBasis !== undefined) {
      setChemicalBasis(item.chemicalBasis);
    }
    if (item.treatments !== undefined) {
      setTreatments(item.treatments);
    }
    if (item.treatmentMethod !== undefined) {
      setTreatmentMethod(item.treatmentMethod);
    }
    if (item.locality !== undefined) {
      setLocality(item.locality);
    }
    if (item.originCountry !== undefined) {
      setOriginCountry(item.originCountry);
    }
    if (item.origin !== undefined) {
      setOrigin(item.origin);
    }
    if (item.defaultVariety) {
      setVariety(item.defaultVariety);
    }
    if (item.defaultItemName) {
      setItemName(item.defaultItemName);
    }
  };

  // Species selection change
  const handleSpeciesChange = (newSpeciesId: string) => {
    const item = findSpeciesItem(newSpeciesId);
    if (item) {
      applySpeciesSelection(item);
    } else {
      setSpecies(newSpeciesId);
      if (newSpeciesId === 'diamond' || newSpeciesId.includes('diamond')) {
        setCategory('diamond');
      } else {
        setCategory('colored_gemstone');
      }
    }
  };

  // Dynamic species list filtered by rootCategory from backend collection with fallback
  const availableSpeciesForRoot = useMemo(() => {
    if (gemstoneTypes.length > 0) {
      const fromBackend = gemstoneTypes.filter((t) => (t as any).rootCategory === rootCategory);
      if (fromBackend.length > 0) {
        return fromBackend.map((t) => ({
          id: (t as any).code || t.species || t.id,
          nameFa: t.nameFa,
          nameEn: t.nameEn,
          category: t.category,
          rootCategory: (t as any).rootCategory || rootCategory,
          diamondType: (t as any).diamondType,
          growthMethod: (t as any).growthMethod,
          syntheticMethod: (t as any).syntheticMethod,
          chemicalBasis: (t as any).chemicalBasis,
          treatments: (t as any).treatments,
          treatmentMethod: (t as any).treatmentMethod,
        }));
      }
    }
    return getSpeciesForRootCategory(rootCategory);
  }, [gemstoneTypes, rootCategory]);

  // Root Category selection change with dynamic cascading stone update
  const handleRootCategoryChange = (newRoot: RootCategory) => {
    setRootCategory(newRoot);
    const available = gemstoneTypes.length > 0
      ? gemstoneTypes.filter((t) => (t as any).rootCategory === newRoot)
      : getSpeciesForRootCategory(newRoot);
    const currentBelongs = available.some((s) => (s as any).id === species || (s as any).species === species);

    if (!currentBelongs && available.length > 0) {
      applySpeciesSelection(available[0] as any);
    } else {
      if (newRoot === 'laboratory_grown' && (category === 'diamond' || species.includes('diamond'))) {
        setDiamondType('lab_grown');
      } else if (newRoot === 'natural' && (category === 'diamond' || species.includes('diamond'))) {
        setDiamondType('natural');
      }
    }
  };

  // Compute total cost dynamically
  // Compute total cost dynamically based on selected currency
  const calculatedTotalInCurrency = React.useMemo(() => {
    const numWeightCt = parseWeight(weightCt);
    const numWeightG = parseWeight(weightG);
    const unitVal = parseFloat(String(unitCostToman).replace(/,/g, '')) || 0;
    const manualVal = parseFloat(String(totalCostTomanManual).replace(/,/g, '')) || 0;

    if (valuationMethod === 'total_amount') return Math.round(manualVal);
    if (valuationMethod === 'per_carat') return Math.round(unitVal * numWeightCt);
    if (valuationMethod === 'per_gram') return Math.round(unitVal * numWeightG);
    return 0;
  }, [valuationMethod, weightCt, weightG, unitCostToman, totalCostTomanManual]);

  const calculatedTotalCostRial = React.useMemo(() => {
    if (selectedCurrency === 'IRT') return Math.round(calculatedTotalInCurrency * 10);
    if (selectedCurrency === 'IRR') return calculatedTotalInCurrency;
    return calculatedTotalInCurrency;
  }, [selectedCurrency, calculatedTotalInCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numWeightCt = parseWeight(weightCt);
    if (numWeightCt <= 0) {
      setError('لطفاً وزن سنگ را به قیراط یا گرم وارد فرمایید.');
      return;
    }

    if (certificateLab !== 'none' && !certificateReportNumber.trim()) {
      setError('با انتخاب آزمایشگاه شناسنامه، وارد کردن شماره گزارش شناسنامه الزامی است.');
      return;
    }

    const calculatedTotal = calculatedTotalCostRial;
    if (calculatedTotal < 0) {
      setError('مبلغ ارزش‌گذاری نمی‌تواند منفی باشد.');
      return;
    }

    const unitVal = parseFloat(String(unitCostToman).replace(/,/g, '')) || 0;
    const unitPriceRial = selectedCurrency === 'IRT' ? Math.round(unitVal * 10) : Math.round(unitVal);

    const costPerCarat = valuationMethod === 'per_carat' ? unitPriceRial : numWeightCt > 0 ? Math.round(calculatedTotal / numWeightCt) : 0;
    const numWeightG = parseWeight(weightG);
    const costPerGram = valuationMethod === 'per_gram' ? unitPriceRial : numWeightG > 0 ? Math.round(calculatedTotal / numWeightG) : 0;

    const numPieces = Math.max(1, parseInt(pieces, 10) || 1);
    const unitPrice =
      valuationMethod === 'per_carat' ? costPerCarat : valuationMethod === 'per_gram' ? costPerGram : 0;

    const payload = {
      id: editingItem?.id || undefined,
      mode,
      inventoryMode: mode === 'single_stone' ? 'single' : 'parcel',
      category,
      species,
      variety: variety.trim() || undefined,
      itemName: itemName.trim() || undefined,
      tradeName: itemName.trim() || undefined,
      diamondType: category === 'diamond' ? diamondType : undefined,
      diamondOriginType:
        category === 'diamond'
          ? rootCategory === 'laboratory_grown' || diamondType === 'lab_grown'
            ? 'laboratory_grown'
            : 'natural'
          : undefined,
      colorMode: category === 'diamond' && mode !== 'parcel' ? colorMode : undefined,
      diamondColorSystem:
        category === 'diamond' && mode !== 'parcel' ? (colorMode === 'fancy' ? 'fancy_color' : 'd_to_z') : undefined,
      colorGrade: category === 'diamond' && mode !== 'parcel' && colorMode === 'd_z' ? colorGrade : undefined,
      diamondColorGrade: category === 'diamond' && mode !== 'parcel' && colorMode === 'd_z' ? colorGrade : undefined,
      fancyColorIntensity: category === 'diamond' && mode !== 'parcel' && colorMode === 'fancy' ? fancyIntensity : undefined,
      fancyColorHue: category === 'diamond' && mode !== 'parcel' && colorMode === 'fancy' ? fancyHue : undefined,
      fancyColorOvertone: category === 'diamond' && mode !== 'parcel' && colorMode === 'fancy' ? fancyOvertone.trim() || undefined : undefined,
      fancyColorOrigin: category === 'diamond' && mode !== 'parcel' && colorMode === 'fancy' ? fancyOrigin : undefined,
      clarityGrade: category === 'diamond' && mode !== 'parcel' ? clarityGrade : undefined,
      diamondClarityGrade: category === 'diamond' && mode !== 'parcel' ? clarityGrade : undefined,
      cutGrade: category === 'diamond' && mode !== 'parcel' ? cutGrade : undefined,
      polish: category === 'diamond' && mode !== 'parcel' ? polish : undefined,
      symmetry: category === 'diamond' && mode !== 'parcel' ? symmetry : undefined,
      fluorescence: category === 'diamond' && mode !== 'parcel' ? fluorescence : undefined,
      fluorescenceColor: category === 'diamond' && mode !== 'parcel' ? fluorescenceColor.trim() || undefined : undefined,

      colorHue: category === 'colored_gemstone' ? colorHue.trim() || undefined : undefined,
      tone: category === 'colored_gemstone' ? tone : undefined,
      saturation: category === 'colored_gemstone' ? saturation : undefined,
      transparency: category === 'colored_gemstone' ? transparency : undefined,
      clarityDescription: category === 'colored_gemstone' ? clarityDescription : undefined,
      treatments: category === 'colored_gemstone' ? treatments : undefined,
      treatmentDetails: category === 'colored_gemstone' ? treatmentDetails.trim() || undefined : undefined,
      origin: category === 'colored_gemstone' ? origin : undefined,
      originSource: category === 'colored_gemstone' ? originSource : undefined,

      shape,
      rootCategory,
      growthMethod: rootCategory === 'laboratory_grown' ? growthMethod : undefined,
      postGrowthTreatment: rootCategory === 'laboratory_grown' ? postGrowthTreatment : undefined,
      laserInscription: laserInscription.trim() || undefined,
      chemicalBasis: chemicalBasis.trim() || undefined,
      syntheticMethod: syntheticMethod.trim() || undefined,
      commercialName: commercialName.trim() || undefined,
      originCountry: originCountry.trim() || undefined,
      locality: locality.trim() || undefined,
      treatmentMethod: treatmentMethod.trim() || undefined,

      sizeMin: mode === 'parcel' && sizeMin ? parseFloat(sizeMin) : undefined,
      sizeMax: mode === 'parcel' && sizeMax ? parseFloat(sizeMax) : undefined,
      sizeUnit: mode === 'parcel' ? sizeUnit : undefined,
      sieveSize: mode === 'parcel' && sizeUnit === 'sieve' ? sieveSize : undefined,
      mergeWithId: mode === 'parcel' && mergeWithExistingId ? mergeWithExistingId : undefined,
      colorMin: mode === 'parcel' ? colorMin : undefined,
      colorMax: mode === 'parcel' ? colorMax : undefined,
      clarityMin: mode === 'parcel' ? clarityMin : undefined,
      clarityMax: mode === 'parcel' ? clarityMax : undefined,
      lotNumber: mode === 'parcel' && lotNumber.trim() ? lotNumber.trim() : undefined,

      measurementsLength: mode !== 'parcel' && measurementsLength ? parseFloat(measurementsLength) : undefined,
      measurementsWidth: mode !== 'parcel' && measurementsWidth ? parseFloat(measurementsWidth) : undefined,
      measurementsDepth: mode !== 'parcel' && measurementsDepth ? parseFloat(measurementsDepth) : undefined,
      tablePercentage: mode !== 'parcel' && tablePercentage ? parseFloat(tablePercentage) : undefined,
      depthPercentage: mode !== 'parcel' && depthPercentage ? parseFloat(depthPercentage) : undefined,

      hasCertificate: certificateLab !== 'none',
      certificateLab: certificateLab !== 'none' ? certificateLab : undefined,
      certificateReportNumber: certificateLab !== 'none' ? certificateReportNumber.trim() : undefined,
      reportNumber: certificateLab !== 'none' ? certificateReportNumber.trim() : undefined,
      certificateDate: certificateLab !== 'none' && certificateDate ? certificateDate : undefined,
      reportDate: certificateLab !== 'none' && certificateDate ? certificateDate : undefined,
      verificationStatus: certificateLab !== 'none' ? verificationStatus : 'not_checked',

      weightCt: numWeightCt,
      weightG: numWeightG,
      pieces: numPieces,
      quantity: numPieces,

      currency: selectedCurrency,
      valuationMethod,
      unitPrice,
      totalAmount: calculatedTotal,
      costPerCarat: costPerCarat || undefined,
      costPerGram: costPerGram || undefined,
      totalCost: calculatedTotalInCurrency,

      storageLocation: storageLocation.trim() || undefined,
      inventoryCode: internalCode.trim() || editingItem?.inventoryCode || editingItem?.internalCode || undefined,
      internalCode: internalCode.trim() || undefined,
      acquisitionDate: acquisitionDate || undefined,
      description: description.trim() || undefined,
    };

    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/gemstones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'خطا در ثبت موجودی اول دوره سنگ');
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای نامشخص در ثبت اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Gem size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingItem ? 'ویرایش موجودی اول دوره سنگ' : 'ثبت موجودی اول دوره سنگ‌های قیمتی و الماس'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                ثبت مشخصات گوهرشناسی، شناسنامه معتبر، وزن قیراط/گرم و بهای تمام‌شده دفتری (حساب ۱۱۳۰۵۰)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto p-6 text-xs">
            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Root Classification Selector (GIA & CIBJO Standards) */}
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-3.5 dark:border-cyan-900/40 dark:bg-cyan-950/20">
              <div className="mb-2 flex items-center justify-between">
                <label className="font-bold text-slate-800 dark:text-slate-200">
                  منشأ و خاستگاه گوهرشناسی (GIA Root Category) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                  فهرست سنگ‌ها مستقیماً بر اساس این گزینه تغییر می‌کند
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {ROOT_CATEGORIES.map((rc) => (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => handleRootCategoryChange(rc.id as RootCategory)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition ${
                      rootCategory === rc.id
                        ? 'border-2 border-cyan-500 bg-white font-black text-cyan-950 shadow-md dark:border-cyan-400 dark:bg-slate-800 dark:text-cyan-100'
                        : 'border border-slate-200/80 bg-white/70 text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs">{rc.labelFa}</span>
                    <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-400 dark:text-slate-400">
                      {rc.id === 'natural' ? 'معدنی دست‌نخورده' : rc.id === 'laboratory_grown' ? 'CVD / HPHT' : rc.id === 'synthetic' ? 'بلور سنتتیک' : rc.id === 'simulant' ? 'نگین اتمی و CZ' : 'پرتودیده و بهسازی'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode & Dynamic Cascading Species Controls */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Mode Toggle */}
              <div>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  نوع عرضه و نگهداری
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={() => setMode('single_stone')}
                    className={`rounded-xl py-2 text-xs font-bold transition-all ${
                      mode === 'single_stone'
                        ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-700 dark:text-cyan-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    تک سنگ (Single Stone)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('parcel')}
                    className={`rounded-xl py-2 text-xs font-bold transition-all ${
                      mode === 'parcel'
                        ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-700 dark:text-cyan-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    بسته‌ای / بار سنگ (Parcel)
                  </button>
                </div>
              </div>

              {/* Dynamic Cascading Species Selector (Strictly filtered by Root Category) */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    گونه / سنگ ({ROOT_CATEGORIES.find((r) => r.id === rootCategory)?.labelFa.split(' ')[0] || 'سنگ'})
                  </label>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {availableSpeciesForRoot.length} گونه معتبر
                  </span>
                </div>
                <select
                  value={species}
                  onChange={(e) => handleSpeciesChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {availableSpeciesForRoot.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameFa} ({s.nameEn})
                    </option>
                  ))}
                  {/* Keep legacy/custom species visible if editing an item not currently in active list */}
                  {!availableSpeciesForRoot.some((s) => s.id === species) && species && (
                    <option value={species}>
                      {species} (ثبت‌شده پیشین)
                    </option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className={mode === 'parcel' ? 'sm:col-span-2' : ''}>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  عنوان نمایشی سنگ
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="مثال: برلیان ۱ قیراطی تراش عالی"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              {mode === 'single_stone' && (
                <div>
                  <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                    تعداد سنگ (عدد)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={pieces}
                    onChange={(e) => setPieces(e.target.value)}
                    placeholder="۱"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              )}

              <div className={mode === 'parcel' ? 'sm:col-span-1' : ''}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    تراش و شکل هندسی
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsShapeSettingsOpen(true)}
                    title="سفارشی‌سازی و اولویت‌بندی تراش‌ها"
                    className="flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-600 hover:bg-cyan-100 transition-colors dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-900/60"
                  >
                    <Settings size={13} />
                    <span>شخصی‌سازی</span>
                  </button>
                </div>
                {(() => {
                  const { order, hidden, customNames = {}, parentMap = {} } = shapePrefs;
                  const hierarchicalOrder = buildHierarchicalShapeOrder(order, parentMap);
                  const shapesPool = shapesList.length > 0
                    ? shapesList.map((s: any) => ({
                        id: s.code || s.id,
                        nameFa: s.nameFa,
                        nameEn: s.nameEn,
                        svgIcon: s.svgIcon,
                      }))
                    : GEMSTONE_SHAPES;

                  const activeShapes = hierarchicalOrder
                    .filter((id) => !hidden.includes(id) || id === shape)
                    .map((id) => shapesPool.find((s) => s.id === id))
                    .filter((s): s is { id: string; nameFa: string; nameEn: string; svgIcon?: string } => Boolean(s));

                  const currentShapeItem = activeShapes.find((s) => s.id === shape);
                  const currentDisplayNameFa = customNames[shape]?.nameFa || currentShapeItem?.nameFa || '';
                  const currentDisplayNameEn = customNames[shape]?.nameEn || currentShapeItem?.nameEn || '';
                  const isCurrentChild = Boolean(parentMap[shape]);

                  return (
                    <div className="relative" ref={shapeDropdownRef}>
                      {/* Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setIsShapeDropdownOpen((prev) => !prev)}
                        className={`flex w-full items-center justify-between gap-2.5 rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-slate-800 transition-all focus:outline-hidden dark:bg-slate-800 dark:text-slate-200 ${
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
                                  className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-right text-xs transition-colors ${
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
                  );
                })()}
              </div>
            </div>

            {/* SPECIALIZED CONDITIONAL SECTION: DIAMOND 4CS VS COLORED GEMSTONES */}
            {category === 'diamond' ? (
              <div className="rounded-3xl border border-cyan-100 bg-cyan-50/30 p-4 space-y-4 dark:border-cyan-900/50 dark:bg-cyan-950/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-black text-cyan-950 dark:text-cyan-200">
                    <Sparkles size={16} className="text-cyan-600 dark:text-cyan-400" />
                    مشخصات تخصصی الماس (4Cs & Grading)
                  </span>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold">
                      <input
                        type="radio"
                        name="diamondType"
                        checked={diamondType === 'natural'}
                        onChange={() => {
                          setDiamondType('natural');
                          if (rootCategory === 'laboratory_grown') setRootCategory('natural');
                        }}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      طبیعی (Natural)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold">
                      <input
                        type="radio"
                        name="diamondType"
                        checked={diamondType === 'lab_grown'}
                        onChange={() => {
                          setDiamondType('lab_grown');
                          setRootCategory('laboratory_grown');
                        }}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      آزمایشگاهی (Lab-Grown)
                    </label>
                  </div>
                </div>

                {/* Lab-Grown Diamond Specific Details (CVD / HPHT / Post-Growth / Laser Inscription) */}
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
                              className={`flex-1 rounded-xl py-1.5 text-center text-xs font-black transition ${
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
                {mode === 'parcel' && (
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

                    {/* Auto-detected homogeneous parcel banner */}
                    {matchingParcel && !editingItem && (
                      <div className="rounded-2xl border border-cyan-300 bg-cyan-50/90 p-3.5 text-xs text-cyan-900 shadow-xs dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-black text-cyan-950 dark:text-cyan-100">
                              <Sparkles size={16} className="text-cyan-600 dark:text-cyan-400" />
                              <span>بارخانه همگن در انبار موجود است!</span>
                            </div>
                            <p className="text-[11px] text-cyan-800 dark:text-cyan-300">
                              بسته مشابه با کد <strong className="font-mono font-black">{matchingParcel.inventoryCode}</strong> و موجودی{' '}
                              <strong className="font-mono">{matchingParcel.weightCt} ct</strong> ({matchingParcel.pieces || matchingParcel.quantity} عدد) در گاوصندوق موجود است.
                            </p>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-1.5 font-bold shadow-xs transition-colors hover:bg-cyan-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                            <input
                              type="checkbox"
                              checked={mergeWithExistingId === matchingParcel.id}
                              onChange={(e) => setMergeWithExistingId(e.target.checked ? matchingParcel.id : null)}
                              className="size-4 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-xs">ترکیب با این بسته (WAC)</span>
                          </label>
                        </div>
                        {mergeWithExistingId === matchingParcel.id && (
                          <div className="mt-2 border-t border-cyan-200 pt-1.5 text-[11px] font-medium text-emerald-800 dark:border-cyan-800/60 dark:text-emerald-300">
                            ✓ این موجودی مستقیماً به بسته {matchingParcel.inventoryCode} افزوده شده و بهای تمام‌شده با میانگین موزون به‌روزرسانی می‌شود.
                          </div>
                        )}
                      </div>
                    )}

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
                                const effectiveSieves = sievesList.length > 0 ? sievesList : DIAMOND_SIEVE_CHART;
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
                            {(() => {
                              const effectiveSieves = sievesList.length > 0 ? sievesList : DIAMOND_SIEVE_CHART;
                              const currentSieveRec = findSieveBySize(sieveSize, effectiveSieves);

                              return (
                                <>
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
                                </>
                              );
                            })()}
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
                            {validateColorRange(colorMin, colorMax).label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={colorMin}
                            onChange={(e) => setColorMin(e.target.value)}
                            className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {D_Z_COLORS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <span className="text-slate-400">تا</span>
                          <select
                            value={colorMax}
                            onChange={(e) => setColorMax(e.target.value)}
                            className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {D_Z_COLORS.map((c) => (
                              <option key={c} value={c}>{c}</option>
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
                            {validateClarityRange(clarityMin, clarityMax).label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={clarityMin}
                            onChange={(e) => setClarityMin(e.target.value)}
                            className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {CLARITY_GRADES.map((cl) => (
                              <option key={cl} value={cl}>{cl}</option>
                            ))}
                          </select>
                          <span className="text-slate-400">تا</span>
                          <select
                            value={clarityMax}
                            onChange={(e) => setClarityMax(e.target.value)}
                            className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {CLARITY_GRADES.map((cl) => (
                              <option key={cl} value={cl}>{cl}</option>
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
                            species: 'diamond',
                            shape,
                            sizeMin: sizeMin ? parseFloat(sizeMin) : undefined,
                            sizeMax: sizeMax ? parseFloat(sizeMax) : undefined,
                            sizeUnit,
                            colorRangeLabel: validateColorRange(colorMin, colorMax).label,
                            clarityRangeLabel: validateClarityRange(clarityMin, clarityMax).label,
                            cutGrade,
                            fluorescence,
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Single Stone 4C Quality Controls (Only for single stone, hidden in parcel mode) */}
                {mode !== 'parcel' && (
                  <>
                    {/* Color Mode Selector */}
                    <div className="flex items-center gap-4 border-t border-cyan-100/60 pt-3 dark:border-cyan-900/40">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">سیستم رنگ:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="colorMode"
                          checked={colorMode === 'd_z'}
                          onChange={() => setColorMode('d_z')}
                          className="text-cyan-600 focus:ring-cyan-500"
                        />
                        طیف بی‌رنگ (D to Z)
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
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

                    {/* Color & Clarity Controls */}
                    {colorMode === 'd_z' ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                          <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                        <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                        <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                        <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                        <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      مبدا جغرافیایی (Origin)
                    </label>
                    <select
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {ORIGIN_COUNTRIES.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-3 ${mode !== 'parcel' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} border-t border-purple-100/60 pt-3 dark:border-purple-900/40`}>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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

                  {mode !== 'parcel' && (
                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                    {/* Treatment Method or Commercial Name */}
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

                    {/* Chemical Basis for Simulants */}
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

            {/* Weights & Pieces Section */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <Scale size={16} className="text-cyan-600 dark:text-cyan-400" />
                <span>سنجش وزن و همگام‌سازی قیراط و گرم</span>
                <span
                  title="1ct = 0.2g / 1g = 5ct"
                  className="group relative cursor-help inline-flex items-center justify-center rounded-full bg-slate-200/80 p-0.5 text-slate-500 hover:bg-cyan-100 hover:text-cyan-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-cyan-900/50 dark:hover:text-cyan-300 transition-colors"
                >
                  <Info size={13} />
                  <span className="pointer-events-none absolute bottom-full mb-1.5 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono font-medium text-white shadow-lg group-hover:block dark:bg-slate-800 z-30">
                    1ct = 0.2g | 1g = 5ct
                  </span>
                </span>
              </div>

              <div className={`grid grid-cols-1 gap-3 ${mode === 'parcel' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    وزن {mode === 'parcel' ? 'کل ' : ''}به قیراط (Carat - ct) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={weightCt}
                    onChange={(e) => handleCaratChange(e.target.value)}
                    placeholder="مثال: 1.25"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-black text-cyan-600 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    وزن معادل به گرم (Gram - g)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={weightG}
                    onChange={(e) => handleGramChange(e.target.value)}
                    placeholder="مثال: 0.2500"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>

                {mode === 'parcel' && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        تعداد قطعات موجود در بسته (عدد)
                      </label>
                      {sizeUnit === 'sieve' && sieveSize && Number(weightCt) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const est = estimatePiecesFromCarats(sieveSize, Number(weightCt));
                            if (est > 0) setPieces(String(est));
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
                          title="محاسبه تخمینی تعداد بر اساس الک انتخابی"
                        >
                          <Sparkles size={13} />
                          <span>تخمین با الک ({estimatePiecesFromCarats(sieveSize, Number(weightCt))} عدد)</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={pieces}
                      onChange={(e) => setPieces(e.target.value)}
                      placeholder="۱"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Certificate & Laboratory Dossier */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
              <span className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <Award size={16} className="text-amber-600 dark:text-amber-400" />
                مشخصات شناسنامه بین‌المللی و آزمایشگاه گوهرشناسی
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
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

            {/* Valuation & Financials Section */}
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-4 dark:border-emerald-900/50 dark:bg-emerald-950/10">
              <span className="flex items-center gap-1.5 text-xs font-black text-emerald-950 dark:text-emerald-200">
                <Layers size={16} className="text-emerald-600 dark:text-emerald-400" />
                ارزش‌گذاری پایه و حسابداری (ثبت بدهکار سرفصل ۱۱۳۰۵۰ - سرمایه ۳۱۰۰)
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                {/* Currency selector */}
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    واحد ارزی (Currency)
                  </label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {availableCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.symbol || c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valuation method */}
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    مبنای محاسبه نرخ
                  </label>
                  <select
                    value={valuationMethod}
                    onChange={(e) => setValuationMethod(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="per_carat">نرخ هر قیراط ({currLabel})</option>
                    <option value="per_gram">نرخ هر گرم ({currLabel})</option>
                    <option value="total_amount">مبلغ کل مقطوع ({currLabel})</option>
                  </select>
                </div>

                {valuationMethod !== 'total_amount' ? (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      {valuationMethod === 'per_carat' ? `نرخ هر قیراط (${currLabel})` : `نرخ هر گرم (${currLabel})`}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={unitCostToman ? formatNumberWithCommas(unitCostToman) : ''}
                      onChange={(e) => setUnitCostToman(e.target.value.replace(/,/g, ''))}
                      placeholder={selectedCurrency === 'USD' ? 'مثال: 450' : 'مثال: ۴۵,۰۰۰,۰۰۰'}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      مبلغ کل دفتری ({currLabel})
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={totalCostTomanManual ? formatNumberWithCommas(totalCostTomanManual) : ''}
                      onChange={(e) => setTotalCostTomanManual(e.target.value.replace(/,/g, ''))}
                      placeholder={selectedCurrency === 'USD' ? 'مثال: 1,200' : 'مثال: ۱۲۰,۰۰۰,۰۰۰'}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    بهای تمام‌شده کل محاسبه‌شده
                  </label>
                  <div className="flex h-9 items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-100/50 px-3 font-mono text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <span>{formatNumberWithCommas(calculatedTotalInCurrency)}</span>
                    <span className="text-[10px] font-normal">{currLabel}</span>
                  </div>
                </div>

                {mode === 'parcel' && (
                  <div className="sm:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-xs">
                      <span className="font-bold text-emerald-900 dark:text-emerald-300">
                        میانگین موزون بهای هر قیراط (WAC / ct):
                      </span>
                      <span className="font-mono font-black text-emerald-800 dark:text-emerald-200">
                        {parseFloat(weightCt) > 0
                          ? `${formatNumberWithCommas(Math.round(calculatedTotalInCurrency / parseFloat(weightCt)))} ${currLabel}`
                          : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-xs">
                      <span className="font-bold text-emerald-900 dark:text-emerald-300">
                        میانگین موزون بهای هر عدد (WAC / pc):
                      </span>
                      <span className="font-mono font-black text-emerald-800 dark:text-emerald-200">
                        {parseInt(pieces || '1', 10) > 0
                          ? `${formatNumberWithCommas(Math.round(calculatedTotalInCurrency / parseInt(pieces || '1', 10)))} ${currLabel}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Storage, Code & Notes */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    محل فیزیکی نگهداری
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddLocationModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
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
                    {storageLocations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} {loc.code ? `(${loc.code})` : ''}
                      </option>
                    ))}
                    {storageLocation && !storageLocations.some((l) => l.name === storageLocation) && (
                      <option value={storageLocation}>{storageLocation}</option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddLocationModal(true)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-slate-800 dark:text-cyan-400 dark:hover:bg-slate-700"
                    title="افزودن محل نگهداری جدید"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                  کد شناسایی داخلی (SKU / Code)
                </label>
                <input
                  type="text"
                  value={internalCode}
                  onChange={(e) => setInternalCode(e.target.value)}
                  placeholder="مثال: DIA-104"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                  تاریخ تملک / ورود به دوره
                </label>
                <input
                  type="text"
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                  توضیحات تکمیلی و یادداشت کارشناسی
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="هرگونه اطلاعات تکمیلی گوهرشناسی یا توافقات..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-6 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 disabled:opacity-50"
            >
              {loading ? (
                <span>در حال ثبت...</span>
              ) : (
                <>
                  <Check size={16} />
                  <span>{editingItem ? 'ذخیره تغییرات' : 'ثبت موجودی اولیه سنگ'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal for adding new storage location */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            dir="rtl"
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="font-black text-sm text-slate-900 dark:text-white">
                افزودن محل نگهداری جدید
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAddLocationModal(false);
                  setNewLocationName('');
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  نام محل نگهداری <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="مثال: گاوصندوق دفتر، گاوصندوق کارگاه..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddLocationModal(false);
                  setNewLocationName('');
                }}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!newLocationName.trim() || isSubmittingLocation}
                onClick={async () => {
                  if (!newLocationName.trim()) return;
                  setIsSubmittingLocation(true);
                  try {
                    const res = await fetch('/api/storage-locations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: newLocationName.trim() }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data?.item) {
                        setStorageLocations((prev) => [...prev, data.item]);
                        setStorageLocation(data.item.name);
                      }
                    } else {
                      const fallbackItem = { id: `loc_${Date.now()}`, name: newLocationName.trim() };
                      setStorageLocations((prev) => [...prev, fallbackItem]);
                      setStorageLocation(fallbackItem.name);
                    }
                    setShowAddLocationModal(false);
                    setNewLocationName('');
                  } catch {
                    const fallbackItem = { id: `loc_${Date.now()}`, name: newLocationName.trim() };
                    setStorageLocations((prev) => [...prev, fallbackItem]);
                    setStorageLocation(fallbackItem.name);
                    setShowAddLocationModal(false);
                    setNewLocationName('');
                  } finally {
                    setIsSubmittingLocation(false);
                  }
                }}
                className="rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-500 dark:hover:bg-cyan-600"
              >
                ذخیره و انتخاب
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
