'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  Check,
  ChevronDown,
  Database,
  Diamond,
  Eye,
  EyeOff,
  Gem,
  Image as ImageIcon,
  ImagePlus,
  Percent,
  Plus,
  RefreshCw,
  Scale,
  Tag,
  Trash2,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react';
import LabelPreviewCard from './LabelPreviewCard';
import MountedStonesModal from './MountedStonesModal';
import { convertImageToWebP } from '@/features/checks/services/check-image';
import {
  calcNetWeight,
  calculateMountedStonesSummary,
  generateEtiquetteBarcode,
  generateNextBarcode,
  hasNaturalPreciousStone,
  getEtiquettePrefix,
  POPULAR_JEWELRY_ITEMS,
  STANDARD_PURITIES,
  DEFAULT_BASE_KARAT,
  ETIQUETTE_TYPE_LABELS,
  PRODUCT_COLOR_LABELS,
  type EtiquetteMountedStone,
  type EtiquetteRecord,
  type EtiquetteType,
  type ProductColor,
  type MetalType,
  type WageType,
  type EtiquetteStatus,
} from '@/lib/etiquette';
import { useAppSettings } from '@/src/components/SettingsProvider';

export interface EtiquetteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedItem: EtiquetteRecord) => void;
  editingItem?: EtiquetteRecord | null;
  suggestedBarcode?: string;
  nextBarcodes?: Record<string, string>;
  existingBarcodes?: string[];
  initialType?: EtiquetteType;
}

export default function EtiquetteModal({
  isOpen,
  onClose,
  onSuccess,
  editingItem = null,
  suggestedBarcode = '',
  nextBarcodes,
  existingBarcodes = [],
  initialType,
}: EtiquetteModalProps) {
  const { settings, formatMoney } = useAppSettings();

  // Helper to resolve barcode strictly based on etiquette type
  const getBarcodeForType = useCallback(
    (type: EtiquetteType) => {
      // If editing an existing item and returning to its original type, preserve its original barcode
      if (editingItem && editingItem.etiquetteType === type && editingItem.barcode) {
        return editingItem.barcode;
      }
      return generateEtiquetteBarcode(type, existingBarcodes || [], settings);
    },
    [editingItem, existingBarcodes, settings],
  );

  // Form State
  const [barcode, setBarcode] = useState('');
  const [title, setTitle] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [etiquetteType, setEtiquetteType] = useState<EtiquetteType>('plain');
  const [productColor, setProductColor] = useState<ProductColor>('yellow');
  const [metal, setMetal] = useState<MetalType>('gold');
  const [purity, setPurity] = useState<number>(750);
  const [totalWeight, setTotalWeight] = useState<string>('');
  const [stoneWeight, setStoneWeight] = useState<string>('0');
  const [stoneCount, setStoneCount] = useState<string>('0');
  const [stonePrice, setStonePrice] = useState<string>('0');
  const [wage, setWage] = useState<string>('0');
  const [wageType, setWageType] = useState<WageType>('percentage');
  const [profitPercentage, setProfitPercentage] = useState<string>('7');
  const [otherCosts, setOtherCosts] = useState<string>('0');
  const [totalPrice, setTotalPrice] = useState<string>('0');
  const [storageLocation, setStorageLocation] = useState<string>('ویترین');
  const [quantity, setQuantity] = useState<number>(1);
  const [status, setStatus] = useState<EtiquetteStatus>('available');
  const [description, setDescription] = useState<string>('');
  const [mountedStones, setMountedStones] = useState<EtiquetteMountedStone[]>([]);

  // Product Photo State
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Array<{ url: string; file?: File; name?: string }>>([]);
  const [removedImageNames, setRemovedImageNames] = useState<string[]>([]);
  const [isConvertingImage, setIsConvertingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sub-modals
  const [isStoneModalOpen, setIsStoneModalOpen] = useState(false);
  const [showJewelryWarningModal, setShowJewelryWarningModal] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form when opening or changing editingItem
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (editingItem) {
      setBarcode(editingItem.barcode);
      setTitle(editingItem.title);
      setItemCode(editingItem.itemCode || '');
      setEtiquetteType(editingItem.etiquetteType || 'plain');
      setProductColor(
        editingItem.productColor ||
          (editingItem.metal === 'silver' || editingItem.metal === 'platinum' ? 'white' : 'yellow'),
      );
      setMetal(editingItem.metal);
      setPurity(editingItem.purity);
      setTotalWeight(String(editingItem.totalWeight));
      setStoneWeight(String(editingItem.stoneWeight));
      setStoneCount(String(editingItem.stoneCount));
      setStonePrice(String(editingItem.stonePrice));
      setWage(String(editingItem.wage));
      setWageType(editingItem.wageType);
      setProfitPercentage(String(editingItem.profitPercentage));
      setOtherCosts(String(editingItem.otherCosts));
      setTotalPrice(String(editingItem.totalPrice));
      setStorageLocation(editingItem.storageLocation || 'ویترین');
      setQuantity(editingItem.quantity || 1);
      setStatus(editingItem.status);
      setDescription(editingItem.description || '');
      setMountedStones(editingItem.mountedStones || []);
      setImageFiles([]);
      const names = editingItem.images || (editingItem.image ? [editingItem.image] : []);
      const urls = editingItem.imageUrls || (editingItem.imageUrl ? [editingItem.imageUrl] : []);
      setImagePreviews(names.map((name, index) => ({ name, url: urls[index] || `/api/etiquettes/${editingItem.id}/image?name=${encodeURIComponent(name)}` })));
      setRemovedImageNames([]);
    } else {
      // New item: automatically resolve barcode according to chosen/initial etiquette type
      const type = initialType || 'plain';
      setBarcode(getBarcodeForType(type));
      setTitle('');
      setItemCode('');
      setEtiquetteType(type);
      setProductColor('yellow');
      setMetal('gold');
      setPurity(750);
      setTotalWeight('');
      setStoneWeight('0');
      setStoneCount('0');
      setStonePrice('0');
      setWage('0');
      setWageType('percentage');
      setProfitPercentage('7');
      setOtherCosts('0');
      setTotalPrice('0');
      setStorageLocation('ویترین');
      setQuantity(1);
      setStatus('available');
      setDescription('');
      setMountedStones([]);
      setImageFiles([]);
      setImagePreviews([]);
      setRemovedImageNames([]);
    }
  }, [isOpen, editingItem, initialType, getBarcodeForType]);

  // Handle image selection with WebP optimization
  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const available = 5 - imagePreviews.length;
    if (files.length > available) {
      setError(`برای هر اتیکت حداکثر ۵ عکس می‌توانید ثبت کنید؛ اکنون ${available} جای خالی باقی مانده است.`);
    }
    const selected = files.slice(0, Math.max(0, available));
    if (!selected.length) { e.target.value = ''; return; }
    setIsConvertingImage(true);
    try {
      const processed = await Promise.all(selected.map((file) => convertImageToWebP(file)));
      setImageFiles((current) => [...current, ...processed.map((item) => item.file)]);
      setImagePreviews((current) => [...current, ...processed.map((item) => ({ url: item.previewUrl, file: item.file }))]);
    } catch {
      setError('خطا در تبدیل و پردازش تصویر محصول.');
    } finally {
      setIsConvertingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const image = imagePreviews[index];
    if (image?.name) setRemovedImageNames((current) => [...current, image.name!]);
    if (image?.file) setImageFiles((current) => current.filter((file) => file !== image.file));
    setImagePreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle etiquette type change - code is immediately regenerated strictly based on the new type
  const handleEtiquetteTypeChange = (newType: EtiquetteType) => {
    setEtiquetteType(newType);
    if (newType === 'plain' || newType === 'base') {
      setMountedStones([]);
      setStoneWeight('0');
      setStoneCount('0');
      setStonePrice('0');
    }
    // Immediately change barcode to the newly selected etiquette type's unique barcode
    setBarcode(getBarcodeForType(newType));
  };

  // Handle mounted stones update from MountedStonesModal
  const handleSaveStones = (newStones: EtiquetteMountedStone[]) => {
    setMountedStones(newStones);
    if (newStones.length > 0) {
      const summary = calculateMountedStonesSummary(newStones);
      setStoneWeight(String(summary.deductedStoneWeight));
      setStoneCount(String(summary.totalCount));
      setStonePrice(String(summary.totalPrice));
      if (etiquetteType === 'plain' || etiquetteType === 'base') {
        const hasDiamond = newStones.some((s) => /برلیان|الماس/i.test(s.name));
        const newType: EtiquetteType = hasDiamond ? 'jewelry' : 'gemstone';
        setEtiquetteType(newType);
        setBarcode(getBarcodeForType(newType));
      }
    } else {
      setStoneWeight('0');
      setStoneCount('0');
      setStonePrice('0');
    }
  };

  // Handle metal change -> update default purity and suggest default color
  const handleMetalChange = (newMetal: MetalType) => {
    setMetal(newMetal);
    setPurity(DEFAULT_BASE_KARAT[newMetal]);
    if (newMetal === 'silver' || newMetal === 'platinum') {
      if (productColor === 'yellow') setProductColor('white');
    }
  };

  // Live computed net weight
  const numTotalWeight = Number(totalWeight) || 0;
  const numStoneWeight = Number(stoneWeight) || 0;
  const computedNetWeight = calcNetWeight(numTotalWeight, numStoneWeight);

  // Real-time duplicate barcode detection
  const trimmedBarcode = barcode.trim().toUpperCase();
  const isDuplicateBarcode = Boolean(
    trimmedBarcode &&
      existingBarcodes.some(
        (b) =>
          b.trim().toUpperCase() === trimmedBarcode &&
          (!editingItem || editingItem.barcode.trim().toUpperCase() !== trimmedBarcode),
      ),
  );

  // Live preview item object
  const previewItem: Partial<EtiquetteRecord> = {
    barcode: barcode.trim() || suggestedBarcode || 'ETK-000001',
    title: title.trim() || 'نام مصنوع طلا',
    etiquetteType,
    productColor,
    metal,
    purity,
    totalWeight: numTotalWeight,
    stoneWeight: numStoneWeight,
    netWeight: computedNetWeight,
    wage: Number(wage) || 0,
    wageType,
    storageLocation,
    status,
    mountedStones,
    imageUrl: imagePreviews[0]?.url || undefined,
  };

  const stonesSummary = calculateMountedStonesSummary(mountedStones);

  const executeSave = async () => {
    setLoading(true);

    try {
      const url = editingItem ? `/api/etiquettes/${editingItem.id}` : '/api/etiquettes';
      const method = editingItem ? 'PUT' : 'POST';

      const payload = {
        barcode: barcode.trim() || undefined,
        title: title.trim(),
        itemCode: itemCode.trim() || undefined,
        etiquetteType,
        productColor,
        metal,
        purity: Number(purity),
        totalWeight: numTotalWeight,
        stoneWeight: (etiquetteType === 'plain' || etiquetteType === 'base') ? 0 : numStoneWeight,
        netWeight: computedNetWeight,
        stoneCount: (etiquetteType === 'plain' || etiquetteType === 'base') ? 0 : Number(stoneCount) || 0,
        stonePrice: (etiquetteType === 'plain' || etiquetteType === 'base') ? 0 : Number(stonePrice) || 0,
        wage: Number(wage) || 0,
        wageType,
        profitPercentage: Number(profitPercentage) || 0,
        otherCosts: Number(otherCosts) || 0,
        totalPrice: Number(totalPrice) || 0,
        storageLocation: storageLocation.trim() || undefined,
        quantity: Math.max(1, Number(quantity) || 1),
        status,
        description: description.trim() || undefined,
        mountedStones: (etiquetteType === 'plain' || etiquetteType === 'base') ? [] : mountedStones,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'خطا در ذخیره اطلاعات اتیکت');
      }

      let savedRecord = data.item;

      // If an image was selected/changed, upload it now
      if (savedRecord?.id) {
        for (const imageName of removedImageNames) {
          const removeRes = await fetch(`/api/etiquettes/${savedRecord.id}/image?name=${encodeURIComponent(imageName)}`, { method: 'DELETE' });
          if (!removeRes.ok) throw new Error('حذف یکی از عکس‌های اتیکت انجام نشد. دوباره تلاش کنید.');
          const removeData = await removeRes.json();
          if (removeData.item) savedRecord = removeData.item;
        }
        for (const imageFile of imageFiles) {
          const imgFormData = new FormData();
          imgFormData.append('image', imageFile);
          const imgRes = await fetch(`/api/etiquettes/${savedRecord.id}/image`, { method: 'POST', body: imgFormData });
          if (!imgRes.ok) {
            const imgData = await imgRes.json().catch(() => null);
            throw new Error(imgData?.message || 'افزودن یکی از عکس‌های اتیکت انجام نشد.');
          }
          const imgData = await imgRes.json();
          if (imgData.item) savedRecord = imgData.item;
        }
      }

      onSuccess(savedRecord);
      onClose();
    } catch (err: any) {
      setError(err.message || 'خطای غیرمنتظره رخ داده است.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('لطفاً عنوان یا نام مصنوع را وارد کنید.');
      return;
    }

    if (numTotalWeight <= 0) {
      setError('وزن کل (ناخالص) باید بزرگتر از صفر باشد.');
      return;
    }

    if (etiquetteType !== 'plain' && etiquetteType !== 'base' && numStoneWeight >= numTotalWeight) {
      setError('کسر نگین نمی‌تواند بیشتر یا برابر با وزن کل کالا باشد.');
      return;
    }

    if (isDuplicateBarcode) {
      setError(`بارکد «${barcode.trim()}» تکراری است و قبلاً برای محصول دیگری ثبت شده است. هر بارکد باید کاملاً یکتا باشد.`);
      return;
    }

    // Check jewelry category warning:
    // If user selected 'jewelry', but no natural diamond or natural precious gemstone is mounted:
    if (etiquetteType === 'jewelry' && !hasNaturalPreciousStone(mountedStones)) {
      setShowJewelryWarningModal(true);
      return;
    }

    await executeSave();
  };

  const handleConfirmJewelrySave = async () => {
    setShowJewelryWarningModal(false);
    await executeSave();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        dir="rtl"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
          {/* Keep the live label preview inline with the modal title, using the same header background. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-800/60 shrink-0">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                <Tag size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {editingItem ? 'ویرایش اتیکت طلا و جواهر' : 'تعریف اتیکت جدید طلا و جواهر'}
                </h2>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              {isPreviewVisible && (
                <div className="shrink-0">
                  <LabelPreviewCard
                    item={previewItem}
                    template={settings.etiquettePrintTemplate || 'slim_tail'}
                    size={settings.etiquettePrintSize || '60x10'}
                    orientation={settings.etiquettePrintOrientation || 'right_to_left'}
                    storeName={settings.organizationName || 'گالری طلا'}
                    showWage={true}
                  />
                </div>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={isPreviewVisible}
                aria-label={isPreviewVisible ? 'خاموش کردن پیش‌نمایش اتیکت' : 'روشن کردن پیش‌نمایش اتیکت'}
                title={isPreviewVisible ? 'خاموش کردن پیش‌نمایش اتیکت' : 'روشن کردن پیش‌نمایش اتیکت'}
                onClick={() => setIsPreviewVisible((visible) => !visible)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition-colors hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                {isPreviewVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="بستن"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Item Info & Category Dropdown */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-4">
              {/* Row 1: Dropdown for Etiquette Type & Item Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Etiquette Type Dropdown */}
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    نوع اتیکت <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={etiquetteType}
                      onChange={(e) => handleEtiquetteTypeChange(e.target.value as EtiquetteType)}
                      className="w-full appearance-none rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-black text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden cursor-pointer"
                    >
                      <option value="plain" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        🟡 اتیکت بدون سنگ (ساده)
                      </option>
                      <option value="gemstone" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        🟣 سنگ دار (به جز الماس)
                      </option>
                      <option value="jewelry" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        💎 جواهر (برلیان / الماس / سنگ‌های قیمتی)
                      </option>
                      <option value="base" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        ⚪ پایه
                      </option>
                    </select>
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                {/* Title Input */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    نام یا عنوان مصنوع طلا و جواهر <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: انگشتر سولیتر برلیان، دستبند کارتیر، النگو لوکس..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* Quick Chips for popular jewelry titles */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                  انتخاب سریع نام‌های رایج:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_JEWELRY_ITEMS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setTitle(chip)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                        title === chip
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metal, Karat & Product Color */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                {/* Metal Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    نوع فلز پایه
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['gold', 'silver', 'platinum'] as MetalType[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMetalChange(m)}
                        className={`flex items-center justify-center py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          metal === m
                            ? 'border-2 border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {m === 'gold' && 'طلا'}
                        {m === 'silver' && 'نقره'}
                        {m === 'platinum' && 'پلاتین'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Purity & Common Chips */}
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    عیار کالا
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={purity}
                      onChange={(e) => setPurity(Number(e.target.value))}
                      className="w-20 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs font-mono font-black text-slate-900 dark:text-slate-100 text-center focus:border-amber-500 focus:outline-hidden"
                    />
                    <div className="flex flex-wrap gap-1">
                      {STANDARD_PURITIES[metal].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPurity(p)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-mono font-black transition-all cursor-pointer ${
                            purity === p
                              ? 'bg-amber-500 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Product Color Dropdown */}
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    رنگ محصول <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={productColor}
                      onChange={(e) => setProductColor(e.target.value as ProductColor)}
                      className="w-full appearance-none rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-black text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden cursor-pointer"
                    >
                      <option value="white" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        ⚪ سفید
                      </option>
                      <option value="yellow" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        🟡 زرد
                      </option>
                      <option value="rose_gold" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        🌸 رزگلد
                      </option>
                      <option value="two_tone" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                        ✨ دو رنگ
                      </option>
                    </select>
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Product Image Upload */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ImageIcon size={15} className="text-amber-500" />
                  <span>عکس محصول طلا و جواهر (اختیاری)</span>
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  {imagePreviews.map((image, index) => (
                    <div key={image.name || image.url} className="relative size-24 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-sm bg-slate-100 dark:bg-slate-800">
                      <img src={image.url} alt={`تصویر ${index + 1} محصول`} className="size-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
                      <button type="button" onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 p-1 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white transition cursor-pointer shadow-xs" title="حذف تصویر">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {imagePreviews.length === 0 && (
                    <div className="size-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 bg-white/50 dark:bg-slate-900/50">
                      <ImagePlus size={26} className="opacity-60" />
                      <span className="text-[10px] font-bold mt-1">بدون تصویر</span>
                    </div>
                  )}
                </div>

                <div className="w-full space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSelectImage}
                    className="hidden"
                    id="etiquette-product-image-input"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="etiquette-product-image-input"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-2xs"
                    >
                      <UploadCloud size={15} className="text-amber-500" />
                      <span>انتخاب عکس</span>
                    </label>

                    {isConvertingImage && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <RefreshCw size={13} className="animate-spin" />
                        در حال بهینه‌سازی WebP...
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {imagePreviews.length} از ۵ عکس. چند عکس را هم‌زمان انتخاب کنید؛ فرمت JPG, PNG و WebP به‌طور خودکار فشرده می‌شود.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Gemstone Mounting (Only shown for 'gemstone' and 'jewelry') */}
            {etiquetteType !== 'plain' && etiquetteType !== 'base' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {etiquetteType === 'jewelry' ? (
                      <Diamond size={16} className="text-purple-500" />
                    ) : (
                      <Gem size={16} className="text-indigo-500" />
                    )}
                    <span>سنگ‌ها و مخراج‌کاری ({ETIQUETTE_TYPE_LABELS[etiquetteType]})</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsStoneModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{mountedStones.length > 0 ? 'مدیریت سنگ‌ها' : 'افزودن سنگ'}</span>
                  </button>
                </div>

                {mountedStones.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2 bg-white/40 dark:bg-slate-900/40">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      هنوز سنگی روی این کار ثبت نشده است.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsStoneModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs hover:from-amber-600 hover:to-amber-700 transition cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>باز کردن فرم افزودن سنگ و نگین</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                        <span className="text-amber-600 dark:text-amber-400 font-black">
                          {mountedStones.length} نوع سنگ ({stonesSummary.totalCount} نگین)
                        </span>
                        <span>وزن کل سنگ: {stonesSummary.totalCarat.toFixed(2)} ct</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          کسر از طلا: {stonesSummary.deductedStoneWeight.toFixed(3)} گرم
                        </span>
                        {stonesSummary.totalPrice > 0 && (
                          <span>ارزش سنگ: {formatMoney(stonesSummary.totalPrice)}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsStoneModalOpen(true)}
                          className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          ویرایش لیست سنگ‌ها
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveStones([])}
                          className="text-xs font-bold text-rose-500 hover:underline cursor-pointer mr-2"
                        >
                          حذف همه
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 4: Weights & Stone Deduction */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Scale size={16} className="text-amber-500" />
                <span>
                  {etiquetteType === 'base'
                    ? 'وزن پایه طلا'
                    : etiquetteType === 'plain'
                    ? 'وزن مصنوع طلا'
                    : 'اوزان، کسر سنگ و وزن خالص فلز'}
                </span>
              </span>

              <div
                className={`grid grid-cols-1 ${
                  etiquetteType === 'plain' || etiquetteType === 'base' ? 'sm:grid-cols-2' : 'sm:grid-cols-4'
                } gap-3`}
              >
                <div>
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                    {etiquetteType === 'base'
                      ? 'وزن پایه (گرم) *'
                      : etiquetteType === 'plain'
                      ? 'وزن طلا (گرم) *'
                      : 'وزن کل (ناخالص) به گرم *'}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="مثال: 5.420"
                    value={totalWeight}
                    onChange={(e) => setTotalWeight(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono font-black text-slate-900 dark:text-slate-100 text-left focus:border-amber-500 focus:outline-hidden"
                    required
                  />
                </div>

                {etiquetteType !== 'plain' && etiquetteType !== 'base' && (
                  <>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                        کسر نگین (گرم)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0"
                        value={stoneWeight}
                        onChange={(e) => setStoneWeight(e.target.value)}
                        readOnly={mountedStones.length > 0}
                        className={`w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono font-black text-slate-900 dark:text-slate-100 text-left focus:border-amber-500 focus:outline-hidden ${
                          mountedStones.length > 0 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                        تعداد نگین
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={stoneCount}
                        onChange={(e) => setStoneCount(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono font-black text-slate-900 dark:text-slate-100 text-left focus:border-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </>
                )}

                {/* Computed Net Gold Weight */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 flex flex-col justify-between">
                  <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                    وزن خالص طلا:
                  </span>
                  <span className="text-base font-mono font-black text-emerald-900 dark:text-emerald-200 text-left">
                    {computedNetWeight.toFixed(3)} گرم
                  </span>
                </div>
              </div>
            </div>

            {/* Section 5: Wage & Profit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  روش محاسبه اجرت
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setWageType('percentage')}
                    className={`rounded-lg py-1.5 text-[10px] font-black transition-all cursor-pointer ${
                      wageType === 'percentage'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    درصدی (٪)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWageType('per_gram')}
                    className={`rounded-lg py-1.5 text-[10px] font-black transition-all cursor-pointer ${
                      wageType === 'per_gram'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    به هر گرم
                  </button>
                  <button
                    type="button"
                    onClick={() => setWageType('fixed')}
                    className={`rounded-lg py-1.5 text-[10px] font-black transition-all cursor-pointer ${
                      wageType === 'fixed'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    مبلغ کل
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  مقدار اجرت {wageType === 'percentage' ? '(درصد)' : '(ریال)'}
                </label>
                <input
                  type="number"
                  value={wage}
                  onChange={(e) => setWage(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono font-black text-slate-900 dark:text-slate-100 text-left focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  سود گالری (درصد)
                </label>
                <input
                  type="number"
                  value={profitPercentage}
                  onChange={(e) => setProfitPercentage(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono font-black text-slate-900 dark:text-slate-100 text-left focus:border-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Section 6: Barcode, Showcase & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                    کد بارکد اتیکت
                  </label>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                    نوع: {ETIQUETTE_TYPE_LABELS[etiquetteType]}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`مثال: ${getEtiquettePrefix(etiquetteType, settings)}000001`}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className={`w-full rounded-xl border bg-white dark:bg-slate-950 px-3 py-2 pl-24 text-xs font-mono font-black text-left focus:outline-hidden ${
                      isDuplicateBarcode
                        ? 'border-rose-500 text-rose-900 dark:text-rose-200 bg-rose-50/40 focus:border-rose-600 focus:ring-1 focus:ring-rose-500/30'
                        : 'border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setBarcode(getBarcodeForType(etiquetteType))}
                    className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 transition cursor-pointer"
                    title={`تولید خودکار کد بر اساس نوع ${ETIQUETTE_TYPE_LABELS[etiquetteType]}`}
                  >
                    <RefreshCw size={10} />
                    <span>کد نوع ({getEtiquettePrefix(etiquetteType, settings)})</span>
                  </button>
                </div>
                <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>
                      پیشوند: <strong className="font-mono text-slate-800 dark:text-slate-200">{getEtiquettePrefix(etiquetteType, settings)}</strong>
                    </span>
                    {barcode && !barcode.startsWith(getEtiquettePrefix(etiquetteType, settings)) && !isDuplicateBarcode && (
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                        <AlertCircle size={10} />
                        کد با پیشوند نوع همخوانی ندارد
                      </span>
                    )}
                  </div>
                  {isDuplicateBarcode && (
                    <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                      <AlertCircle size={11} />
                      این بارکد تکراری است! هر بارکد باید کاملاً یکتا باشد.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  محل نگهداری / ویترین
                </label>
                <input
                  type="text"
                  placeholder="مثال: ویترین ۱، سینی انگشتر، گاوصندوق..."
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  وضعیت موجودی
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EtiquetteStatus)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-black text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="available" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                    موجود در ویترین
                  </option>
                  <option value="reserved" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                    امانی / رزرو
                  </option>
                  <option value="sold" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                    فروخته‌شده
                  </option>
                  <option value="melted" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                    اسقاط / آب‌شده
                  </option>
                </select>
              </div>
            </div>

            {/* Section 7: Description */}
            <div>
              <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                توضیحات تکمیلی (سایز، برند، رنگ، ویژگی‌های سنگ)
              </label>
              <input
                type="text"
                placeholder="مثال: سایز ۵۴، طلای رزگلد، برلیان اصل با شناسنامه..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                انصراف
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-6 py-2.5 text-xs font-black text-white transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>در حال ذخیره...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{editingItem ? 'به‌روزرسانی اتیکت' : 'ذخیره اتیکت'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sub-Modal: Add/Manage Stones */}
      <MountedStonesModal
        isOpen={isStoneModalOpen}
        onClose={() => setIsStoneModalOpen(false)}
        stones={mountedStones}
        onSave={handleSaveStones}
        etiquetteType={etiquetteType}
      />

      {/* Jewelry Natural Stone Warning Modal */}
      {showJewelryWarningModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                <AlertCircle size={26} className="stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  هشدار دسته‌بندی جواهر
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                  عدم ثبت الماس یا سنگ قیمتی طبیعی
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
              <p>
                شما نوع اتیکت را <strong className="text-purple-600 dark:text-purple-400">«جواهر»</strong> انتخاب کرده‌اید، اما هیچ الماس، برلیان یا سنگ قیمتی اصل و طبیعی روی این کار ثبت نشده است (یا فقط سنگ اتمی/زیرکونیا ثبت شده است).
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                در اصطلاح صنف طلا و جواهر، عنوان «جواهر» به کارهای سوارشده با برلیان، الماس، یاقوت و سنگ‌های قیمتی طبیعی اطلاق می‌شود.
              </p>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                آیا مطمئن هستید که می‌خواهید این اتیکت به عنوان «جواهر» ذخیره شود؟
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowJewelryWarningModal(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                انصراف و اصلاح مشخصات
              </button>

              <button
                type="button"
                onClick={handleConfirmJewelrySave}
                disabled={loading}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-black text-white transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>در حال ذخیره...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>تأیید و ذخیره به عنوان جواهر</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
