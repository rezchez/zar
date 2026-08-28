'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderTree,
  Plus,
  Edit3,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  Lock,
  Scale,
  Coins,
  FileCheck2,
  RotateCcw,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  EyeOff,
  Filter,
  Check,
  X,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';
import {
  ACCOUNT_TYPE_LABELS,
  NORMAL_BALANCE_LABELS,
  LEVEL_LABELS,
  LEVEL_SHORT_LABELS,
  buildAccountTree,
  validateAccountCode,
  canDeleteAccount,
  canEditAccount,
  suggestNextChildCode,
  normalizeAccountCode,
  type ChartOfAccountRecord,
  type AccountTreeNode,
  type AccountType,
  type NormalBalance,
  type AccountLevel,
} from '@/lib/chart-of-accounts';

export default function ChartOfAccounts() {
  const [isMounted, setIsMounted] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccountRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Tree Expansion State: Set of expanded account IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Selected accounts for actions
  const [selectedParent, setSelectedParent] = useState<ChartOfAccountRecord | null>(null);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccountRecord | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountTreeNode | null>(null);

  // Form states for Add/Edit
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLevel, setFormLevel] = useState<AccountLevel>(2);
  const [formAccountType, setFormAccountType] = useState<AccountType>('asset');
  const [formNormalBalance, setFormNormalBalance] = useState<NormalBalance>('debit');
  const [formRequiresWeight, setFormRequiresWeight] = useState(false);
  const [formIsMultiCurrency, setFormIsMultiCurrency] = useState(false);
  const [formIsPostable, setFormIsPostable] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formParentId, setFormParentId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chart-of-accounts', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('خطا در دریافت لیست سرفصل‌ها.');
      }
      const data = await res.json();
      const list: ChartOfAccountRecord[] = data.accounts || [];
      setAccounts(list);

      // Expand level 1 and 2 by default
      const initialExpanded = new Set<string>();
      for (const a of list) {
        if (a.level === 1 || a.level === 2) {
          initialExpanded.add(a.id);
        }
      }
      setExpandedIds(initialExpanded);
    } catch (err: any) {
      setError(err?.message || 'خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Build the hierarchical tree
  const fullTree = useMemo(() => buildAccountTree(accounts), [accounts]);

  // Expand / Collapse all
  const handleExpandAll = () => {
    const allIds = new Set(accounts.map((a) => a.id));
    setExpandedIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filtered tree logic
  const filteredTree = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const isFilterActive =
      query.length > 0 ||
      selectedType !== 'all' ||
      selectedLevel !== 'all' ||
      selectedStatus !== 'all';

    if (!isFilterActive) {
      return fullTree;
    }

    // Matching predicate
    function matchesAccount(node: ChartOfAccountRecord): boolean {
      if (selectedType !== 'all' && node.accountType !== selectedType) {
        return false;
      }
      if (selectedLevel !== 'all' && node.level !== Number(selectedLevel)) {
        return false;
      }
      if (selectedStatus !== 'all') {
        const activeBool = selectedStatus === 'active';
        if (Boolean(node.isActive !== false) !== activeBool) {
          return false;
        }
      }
      if (query) {
        const codeMatch = node.code.includes(query);
        const nameMatch = node.name.toLowerCase().includes(query);
        const descMatch = node.description ? node.description.toLowerCase().includes(query) : false;
        return codeMatch || nameMatch || descMatch;
      }
      return true;
    }

    // Filter tree recursively while keeping matching ancestor paths
    function filterNodes(nodes: AccountTreeNode[]): AccountTreeNode[] {
      const result: AccountTreeNode[] = [];

      for (const node of nodes) {
        const filteredChildren = filterNodes(node.children);
        const isSelfMatch = matchesAccount(node);

        if (isSelfMatch || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
            childrenCount: filteredChildren.length,
          });
        }
      }

      return result;
    }

    const filtered = filterNodes(fullTree);

    // Auto-expand all matching parent branches when searching
    if (query.length > 0) {
      const matchedParents = new Set<string>();
      function collectParentIds(nodes: AccountTreeNode[]) {
        for (const n of nodes) {
          if (n.children.length > 0) {
            matchedParents.add(n.id);
            collectParentIds(n.children);
          }
        }
      }
      collectParentIds(filtered);
      setExpandedIds((prev) => new Set([...prev, ...matchedParents]));
    }

    return filtered;
  }, [fullTree, searchQuery, selectedType, selectedLevel, selectedStatus]);

  // Open Add Modal
  const openAddChildModal = (parent?: ChartOfAccountRecord) => {
    setFormError(null);
    setSelectedParent(parent || null);

    const targetLevel = parent ? ((Math.min(parent.level + 1, 4)) as AccountLevel) : 1;
    const parentId = parent ? parent.id : '';
    setFormParentId(parentId);
    setFormLevel(targetLevel);
    setFormAccountType(parent ? parent.accountType : 'asset');
    setFormNormalBalance(parent ? parent.normalBalance : 'debit');
    setFormRequiresWeight(parent ? Boolean(parent.requiresWeight) : false);
    setFormIsMultiCurrency(parent ? Boolean(parent.isMultiCurrency) : false);
    setFormIsPostable(targetLevel >= 3);
    setFormIsActive(true);
    setFormName('');
    setFormDescription('');

    // Suggest next code
    if (parent) {
      const siblings = accounts.filter((a) => a.parentId === parent.id);
      const allCodes = new Set(accounts.map((a) => a.code));
      const code = suggestNextChildCode(parent, siblings, allCodes);
      setFormCode(code);
    } else {
      setFormCode('');
    }

    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (account: ChartOfAccountRecord) => {
    setFormError(null);
    setEditingAccount(account);
    setFormCode(account.code);
    setFormName(account.name);
    setFormDescription(account.description || '');
    setFormLevel(account.level);
    setFormAccountType(account.accountType);
    setFormNormalBalance(account.normalBalance);
    setFormRequiresWeight(Boolean(account.requiresWeight));
    setFormIsMultiCurrency(Boolean(account.isMultiCurrency));
    setFormIsPostable(Boolean(account.isPostable));
    setFormIsActive(account.isActive !== false);
    setFormParentId(account.parentId || '');
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (account: AccountTreeNode) => {
    setDeletingAccount(account);
    setIsDeleteModalOpen(true);
  };

  // Handle Save New Account
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const normCode = normalizeAccountCode(formCode);
    const trimmedName = formName.trim();

    if (!normCode) {
      setFormError('کد حساب الزامی است.');
      return;
    }
    if (!trimmedName || trimmedName.length < 2) {
      setFormError('نام حساب باید حداقل ۲ کاراکتر باشد.');
      return;
    }

    const parent = selectedParent || (formParentId ? accounts.find((a) => a.id === formParentId) : undefined);
    const val = validateAccountCode(normCode, parent ? parent.code : null, formLevel);
    if (!val.valid) {
      setFormError(val.error || 'کد حساب نامعتبر است.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: normCode,
          name: trimmedName,
          parentId: formParentId || null,
          level: formLevel,
          accountType: formAccountType,
          normalBalance: formNormalBalance,
          requiresWeight: formRequiresWeight,
          isMultiCurrency: formIsMultiCurrency,
          isPostable: formIsPostable,
          description: formDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در ثبت سرفصل جدید.');
      }

      showSuccess(`سرفصل "${trimmedName}" با کد ${normCode} با موفقیت افزوده شد.`);
      setIsAddModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت اطلاعات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Edit Account
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setFormError(null);

    const normCode = normalizeAccountCode(formCode);
    const trimmedName = formName.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setFormError('نام حساب باید حداقل ۲ کاراکتر باشد.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/chart-of-accounts/${editingAccount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: normCode,
          name: trimmedName,
          description: formDescription,
          requiresWeight: formRequiresWeight,
          isMultiCurrency: formIsMultiCurrency,
          isPostable: formIsPostable,
          isActive: formIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در ویرایش سرفصل.');
      }

      showSuccess(`سرفصل "${trimmedName}" با موفقیت به‌روزرسانی شد.`);
      setIsEditModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ویرایش اطلاعات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Quick Toggle Active
  const handleToggleStatus = async (account: ChartOfAccountRecord) => {
    const editPerm = canEditAccount(account);
    if (!editPerm.canToggleActive) {
      alert(editPerm.reason || 'امکان تغییر وضعیت برای این سرفصل وجود ندارد.');
      return;
    }

    try {
      const nextStatus = account.isActive === false;
      const res = await fetch(`/api/chart-of-accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'خطا در تغییر وضعیت.');
      }

      showSuccess(`وضعیت حساب "${account.name}" به ${nextStatus ? 'فعال' : 'غیرفعال'} تغییر یافت.`);
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت سرفصل.');
    }
  };

  // Handle Delete Account
  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/chart-of-accounts/${deletingAccount.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در حذف سرفصل.');
      }

      showSuccess(data.message || `سرفصل "${deletingAccount.name}" با موفقیت حذف شد.`);
      setIsDeleteModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'خطا در حذف سرفصل.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Export CSV or JSON
  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    window.open(`/api/chart-of-accounts/export?format=${format}`, '_blank');
  };

  // Handle Import JSON
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importJsonText.trim()) {
      setImportStatus('لطفاً محتوای JSON معتبر وارد کنید.');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText);
      const accountsArray = Array.isArray(parsed) ? parsed : parsed.accounts || [];
      if (!Array.isArray(accountsArray) || accountsArray.length === 0) {
        setImportStatus('فرمت فایل JSON نامعتبر است یا آرایه‌ای از حساب‌ها یافت نشد.');
        return;
      }

      setIsSubmitting(true);
      setImportStatus('در حال بارگذاری سرفصل‌ها...');

      const res = await fetch('/api/chart-of-accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: accountsArray }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در بارگذاری سرفصل‌ها.');
      }

      showSuccess(data.message || 'بارگذاری سرفصل‌ها با موفقیت انجام شد.');
      setIsImportModalOpen(false);
      setImportJsonText('');
      setImportStatus(null);
      await fetchAccounts();
    } catch (err: any) {
      setImportStatus(`خطا: ${err.message || 'فایل نامعتبر است.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reset to Defaults
  const handleResetDefaults = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/chart-of-accounts/reset-default', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در بازنشانی سرفصل‌های پیش‌فرض.');
      }
      showSuccess(data.message || 'سرفصل‌های پیش‌فرض با موفقیت بازنشانی شدند.');
      setIsResetModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'خطا در بازنشانی.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin ml-2" />
        در حال بارگذاری درختواره حسابداری...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-right" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <FolderTree className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                کدینگ و درختواره سرفصل‌های حسابداری
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                  {accounts.length} سرفصل
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                ساختار درختی استاندارد حسابداری طلا و جواهر (گروه، کل، معین و تفصیلی) با کلیدهای یکتا و ارجاعات امن
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAddChildModal()}
              type="button"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all text-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              افزودن سرفصل گروه (ریشه)
            </button>

            <button
              onClick={() => handleExport('excel')}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-sm transition-all"
              title="دریافت فایل اکسل (CSV)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              خروجی اکسل
            </button>

            <button
              onClick={() => handleExport('json')}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-sm transition-all"
              title="دریافت فایل JSON استاندارد"
            >
              <FileJson className="w-4 h-4 text-cyan-400" />
              خروجی JSON
            </button>

            <button
              onClick={() => {
                setImportStatus(null);
                setImportJsonText('');
                setIsImportModalOpen(true);
              }}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-sm transition-all"
            >
              <Upload className="w-4 h-4 text-sky-400" />
              بارگذاری (Import)
            </button>

            <button
              onClick={() => setIsResetModalOpen(true)}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-800 rounded-xl text-slate-300 hover:text-rose-300 text-sm transition-all"
              title="بازنشانی به ساختار ۴۴ حساب استاندارد اولیه"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              سرفصل‌های پیش‌فرض
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-4 border-t border-slate-800">
          {/* Search Box */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            <input
              type="text"
              placeholder="جستجو در کد، عنوان یا توضیحات سرفصل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2.5 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">همه ماهیت‌های حسابداری</option>
              <option value="asset">دارایی‌ها (Asset)</option>
              <option value="liability">بدهی‌ها (Liability)</option>
              <option value="equity">حقوق مالکانه (Equity)</option>
              <option value="revenue">درآمدها (Revenue)</option>
              <option value="cost_of_sales">بهای تمام‌شده (Cost of Sales)</option>
              <option value="expense">هزینه‌ها (Expense)</option>
              <option value="memorandum">حساب‌های انتظامی (Memorandum)</option>
            </select>
          </div>

          {/* Level Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">همه سطوح درخت</option>
              <option value="1">سطح ۱ - گروه</option>
              <option value="2">سطح ۲ - کل</option>
              <option value="3">سطح ۳ - معین</option>
              <option value="4">سطح ۴ - تفصیلی</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فقط حساب‌های فعال</option>
              <option value="inactive">فقط غیرفعال‌ها</option>
            </select>
          </div>

          {/* Expand / Collapse Controls */}
          <div className="lg:col-span-1 flex items-center justify-end gap-1">
            <button
              onClick={handleExpandAll}
              type="button"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all text-xs"
              title="باز کردن تمام شاخه‌ها"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={handleCollapseAll}
              type="button"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all text-xs"
              title="بستن تمام شاخه‌ها"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tree View Table / Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400">
          <div className="col-span-12 sm:col-span-5 flex items-center gap-2">
            <span>کد و عنوان سرفصل حسابداری</span>
          </div>
          <div className="hidden sm:block sm:col-span-2 text-center">ماهیت و مانده</div>
          <div className="hidden sm:block sm:col-span-2 text-center">سطح حساب</div>
          <div className="hidden sm:block sm:col-span-1 text-center">ویژگی‌ها</div>
          <div className="hidden sm:block sm:col-span-2 text-left pl-2">عملیات</div>
        </div>

        {/* Tree Rows List */}
        <div className="divide-y divide-slate-800/60 min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
              <p className="text-sm">در حال بارگذاری ساختار درختی سرفصل‌ها...</p>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <FolderTree className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">سرفصلی با مشخصات جستجویافته پیدا نشد.</p>
              <p className="text-xs text-slate-500 mt-1">می‌توانید فیلترها را ریست کرده یا سرفصل جدیدی اضافه نمایید.</p>
            </div>
          ) : (
            filteredTree.map((rootNode) => (
              <AccountTreeItem
                key={rootNode.id}
                node={rootNode}
                level={1}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onAddChild={openAddChildModal}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
                onToggleStatus={handleToggleStatus}
              />
            ))
          )}
        </div>
      </div>

      {/* MODAL: ADD CHILD / NEW ACCOUNT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                {selectedParent ? (
                  <>افزودن حساب فرزند ذیل: <span className="text-amber-400">{selectedParent.name} ({selectedParent.code})</span></>
                ) : (
                  'افزودن سرفصل گروه (ریشه)'
                )}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdd} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Code Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    کد حساب <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="مثال: 1111 یا 111001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {selectedParent && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      پیش‌کد والد: {selectedParent.code} (پیشنهاد هوشمند محاسبه شد)
                    </p>
                  )}
                </div>

                {/* Account Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    نام سرفصل حساب <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="عنوان فارسی سرفصل..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Level */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">سطح درختی</label>
                  <select
                    value={formLevel}
                    onChange={(e) => {
                      const lvl = Number(e.target.value) as AccountLevel;
                      setFormLevel(lvl);
                      setFormIsPostable(lvl >= 3);
                    }}
                    disabled={Boolean(selectedParent)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-200 text-sm focus:outline-none disabled:opacity-60"
                  >
                    <option value={1}>سطح ۱ - گروه</option>
                    <option value={2}>سطح ۲ - کل</option>
                    <option value={3}>سطح ۳ - معین</option>
                    <option value={4}>سطح ۴ - تفصیلی</option>
                  </select>
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">ماهیت حسابداری</label>
                  <select
                    value={formAccountType}
                    onChange={(e) => setFormAccountType(e.target.value as AccountType)}
                    disabled={Boolean(selectedParent)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-200 text-sm focus:outline-none disabled:opacity-60"
                  >
                    <option value="asset">دارایی‌ها</option>
                    <option value="liability">بدهی‌ها</option>
                    <option value="equity">حقوق مالکانه</option>
                    <option value="revenue">درآمدها</option>
                    <option value="cost_of_sales">بهای تمام‌شده</option>
                    <option value="expense">هزینه‌ها</option>
                    <option value="memorandum">حساب‌های انتظامی</option>
                  </select>
                </div>

                {/* Normal Balance */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">ماهیت مانده</label>
                  <select
                    value={formNormalBalance}
                    onChange={(e) => setFormNormalBalance(e.target.value as NormalBalance)}
                    disabled={Boolean(selectedParent)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-200 text-sm focus:outline-none disabled:opacity-60"
                  >
                    <option value="debit">بدهکار</option>
                    <option value="credit">بستانکار</option>
                    <option value="dual">دوگانه</option>
                  </select>
                </div>
              </div>

              {/* Gold flags & Postable check */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                <p className="text-xs font-semibold text-amber-300/90 mb-2">ویژگی‌ها و پرچم‌های تخصصی سرفصل:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formRequiresWeight}
                      onChange={(e) => setFormRequiresWeight(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span>⚖️ نیاز به ثبت وزن طلا</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formIsMultiCurrency}
                      onChange={(e) => setFormIsMultiCurrency(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span>💱 حساب چندارزی</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formIsPostable}
                      disabled={formLevel === 1}
                      onChange={(e) => setFormIsPostable(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 disabled:opacity-40"
                    />
                    <span>📝 مجاز به گردش (Postable)</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">توضیحات و یادداشت</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="توضیحات کاربرد این سرفصل در اسناد حسابداری..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  ثبت سرفصل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ACCOUNT */}
      {isEditModalOpen && editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                ویرایش سرفصل: <span className="text-amber-400">{editingAccount.name} ({editingAccount.code})</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Code Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    کد حساب {editingAccount.isSystem && <span className="text-amber-400 text-[10px]">(سیستمی - غیرقابل ویرایش)</span>}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingAccount.isSystem}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                  />
                </div>

                {/* Account Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    نام سرفصل حساب {editingAccount.isSystem && editingAccount.level === 1 && <span className="text-amber-400 text-[10px]">(ریشه اصلی - غیرقابل ویرایش)</span>}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingAccount.isSystem && editingAccount.level === 1}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Status and Flags */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-amber-300/90">تنظیمات و وضعیت:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      disabled={editingAccount.isSystem && editingAccount.level === 1}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 disabled:opacity-40"
                    />
                    <span>وضعیت سرفصل فعال باشد</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formIsPostable}
                      disabled={editingAccount.level === 1}
                      onChange={(e) => setFormIsPostable(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 disabled:opacity-40"
                    />
                    <span>مجاز به ثبت مستقیم سند (Postable)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formRequiresWeight}
                      onChange={(e) => setFormRequiresWeight(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span>⚖️ نیاز به ثبت وزن طلا</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={formIsMultiCurrency}
                      onChange={(e) => setFormIsMultiCurrency(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span>💱 حساب چندارزی</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">توضیحات و یادداشت</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {isDeleteModalOpen && deletingAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 text-right">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">حذف سرفصل حسابداری</h3>
            </div>

            {(() => {
              const rule = canDeleteAccount(deletingAccount, deletingAccount.childrenCount, false);
              return (
                <div className="space-y-4 text-sm text-slate-300">
                  <p>
                    آیا از حذف حساب <strong className="text-amber-400">{deletingAccount.name}</strong> با کد <strong className="text-amber-400">{deletingAccount.code}</strong> اطمینان دارید؟
                  </p>

                  {!rule.canDelete ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                      <p className="font-bold mb-1">هشدار امنیتی سیستم:</p>
                      <p>{rule.reason}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      این عملیات غیرقابل بازگشت است. در صورت عدم اطمینان می‌توانید وضعیت حساب را صرفاً غیرفعال کنید.
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
                    >
                      انصراف
                    </button>

                    {!rule.canDelete && rule.action === 'deactivate_only' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleStatus(deletingAccount);
                          setIsDeleteModalOpen(false);
                        }}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm"
                      >
                        غیرفعال‌سازی سرفصل
                      </button>
                    )}

                    {rule.canDelete && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleConfirmDelete}
                        className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                      >
                        {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        تایید حذف فیزیکی
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: IMPORT JSON */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Upload className="w-5 h-5 text-sky-400" />
                بارگذاری (Import) ساختار سرفصل‌ها
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-400">
                می‌توانید یک فایل استاندارد JSON را آپلود کرده یا محتوای آن را مستقیماً در کادر زیر جای‌گذاری کنید.
              </p>

              <div>
                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 border border-dashed border-slate-700 hover:border-amber-500 rounded-xl bg-slate-950/40 text-xs text-slate-300 flex items-center justify-center gap-2 hover:bg-slate-950 transition-all"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  انتخاب فایل JSON از حافظه
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">متن داده‌های JSON:</label>
                <textarea
                  rows={8}
                  dir="ltr"
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder='[\n  {\n    "code": "1110",\n    "name": "موجودی نقد و بانک",\n    "level": 3,\n    "accountType": "asset",\n    "normalBalance": "debit"\n  }\n]'
                  className="w-full font-mono text-xs p-3 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              {importStatus && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-300 text-xs">
                  {importStatus}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !importJsonText.trim()}
                  onClick={handleExecuteImport}
                  className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  اجرای بارگذاری
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET DEFAULTS */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 text-right">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">بازنشانی به سرفصل‌های پیش‌فرض</h3>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              آیا مایلید تمام ۴۴ سرفصل استاندارد طلا و جواهر (دارایی‌ها، بدهی‌ها، سرمایه، درآمدها و هزینه‌ها) به حالت اولیه سیستم همگام‌سازی شوند؟
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                تایید بازنشانی
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tree Node Item Row Component
function AccountTreeItem({
  node,
  level,
  expandedIds,
  toggleExpand,
  onAddChild,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  node: AccountTreeNode;
  level: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onAddChild: (parent: ChartOfAccountRecord) => void;
  onEdit: (account: ChartOfAccountRecord) => void;
  onDelete: (account: AccountTreeNode) => void;
  onToggleStatus: (account: ChartOfAccountRecord) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const paddingRight = (level - 1) * 26 + 16;

  // Visual indentation level border color
  const levelBorderColors = [
    'border-r-amber-500',
    'border-r-sky-500',
    'border-r-emerald-500',
    'border-r-purple-500',
  ];
  const borderClass = levelBorderColors[Math.min(level - 1, 3)] || 'border-r-slate-600';

  const typeBadgeColors: Record<AccountType, string> = {
    asset: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    liability: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    equity: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    revenue: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    cost_of_sales: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    expense: 'bg-red-500/10 text-red-300 border-red-500/30',
    memorandum: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  };

  return (
    <div className="w-full">
      <div
        className={`grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-slate-800/40 transition-colors border-r-2 ${borderClass} ${
          node.isActive === false ? 'opacity-50 grayscale' : ''
        }`}
        style={{ paddingRight: `${paddingRight}px` }}
      >
        {/* Code & Title */}
        <div className="col-span-12 sm:col-span-5 flex items-center gap-2">
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              type="button"
              className="p-1 text-slate-400 hover:text-amber-400 transition-transform"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6 inline-block" />
          )}

          {/* Account Code */}
          <span className="font-mono font-bold text-xs sm:text-sm px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-700/80 text-amber-300 flex-shrink-0">
            {node.code}
          </span>

          {/* Account Name */}
          <span className="font-medium text-sm text-slate-100 truncate" title={node.description || node.name}>
            {node.name}
          </span>

          {/* System Lock Badge */}
          {node.isSystem && (
            <span title="سرفصل سیستمی محافظت‌شده">
              <Lock className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" />
            </span>
          )}

          {/* Postable indicator */}
          {node.isPostable && (
            <span className="text-[10px] px-1.5 py-0.2 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded" title="مجاز به گردش و ثبت سند">
              گردش
            </span>
          )}
        </div>

        {/* Account Type & Normal Balance */}
        <div className="hidden sm:flex sm:col-span-2 items-center justify-center gap-1.5 flex-wrap">
          <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${typeBadgeColors[node.accountType] || 'bg-slate-800 text-slate-300'}`}>
            {ACCOUNT_TYPE_LABELS[node.accountType] || node.accountType}
          </span>
          <span className="text-[10px] text-slate-400">
            ({NORMAL_BALANCE_LABELS[node.normalBalance]?.split(' ')[0] || node.normalBalance})
          </span>
        </div>

        {/* Level */}
        <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
          <span className="text-xs text-slate-300 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-lg">
            {LEVEL_SHORT_LABELS[node.level]} (سطح {node.level})
          </span>
        </div>

        {/* Badges / Flags (Weight, Currency) */}
        <div className="hidden sm:flex sm:col-span-1 items-center justify-center gap-1">
          {node.requiresWeight && (
            <span title="نیاز به وزن طلا و جواهر" className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Scale className="w-3.5 h-3.5" />
            </span>
          )}
          {node.isMultiCurrency && (
            <span title="حساب چندارزی" className="p-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Coins className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
          {node.level < 4 && (
            <button
              onClick={() => onAddChild(node)}
              type="button"
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="افزودن حساب فرزند ذیل این سرفصل"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onEdit(node)}
            type="button"
            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="ویرایش سرفصل"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => onToggleStatus(node)}
            type="button"
            className={`p-1.5 rounded-lg transition-colors ${
              node.isActive === false
                ? 'text-rose-400 hover:bg-slate-800'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
            }`}
            title={node.isActive === false ? 'فعال‌سازی سرفصل' : 'غیرفعال‌سازی سرفصل'}
          >
            {node.isActive === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onDelete(node)}
            type="button"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="حذف سرفصل"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Render Children Recursively */}
      {hasChildren && isExpanded && (
        <div className="w-full">
          {node.children.map((child) => (
            <AccountTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
