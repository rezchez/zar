'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Customer } from '@/lib/customer';
import type { DocumentNature } from '@/lib/document';
import type { MetalType } from '@/features/accounting/documents/services/metal-settlement-service';

export interface StickyPassedSections {
  customer: boolean;
  documentNumber: boolean;
  nature: boolean;
  metalType: boolean;
  currency: boolean;
  date: boolean;
}

export const DEFAULT_PASSED_SECTIONS: StickyPassedSections = {
  customer: false,
  documentNumber: false,
  nature: false,
  metalType: false,
  currency: false,
  date: false,
};

export interface DocumentStickyHeaderData {
  customer: Customer | null;
  documentNumber: string;
  nature: DocumentNature;
  metalType: MetalType;
  currency: string;
  dateJalali: string;
  isCustomerLocked: boolean;
  passedSections?: StickyPassedSections;
  onToggleNature?: () => void;
  onChangeMetalType?: (type: MetalType) => void;
  onCurrencyChange?: (curr: string) => void;
  onScrollToTop?: () => void;
  onScrollToCustomer?: () => void;
}

interface DocumentStickyHeaderActions {
  setData: (
    data:
      | DocumentStickyHeaderData
      | null
      | ((prev: DocumentStickyHeaderData | null) => DocumentStickyHeaderData | null),
  ) => void;
  setIsActive: (active: boolean) => void;
  setPassedSections: React.Dispatch<React.SetStateAction<StickyPassedSections>>;
}

interface DocumentStickyHeaderState {
  data: DocumentStickyHeaderData | null;
  isActive: boolean;
  passedSections: StickyPassedSections;
}

export type DocumentStickyHeaderContextType = DocumentStickyHeaderState & DocumentStickyHeaderActions;

export const DocumentStickyHeaderDataContext = createContext<DocumentStickyHeaderState>({
  data: null,
  isActive: false,
  passedSections: DEFAULT_PASSED_SECTIONS,
});

export const DocumentStickyHeaderActionsContext = createContext<DocumentStickyHeaderActions>({
  setData: () => {},
  setIsActive: () => {},
  setPassedSections: () => {},
});

// Legacy / combined context for backward compatibility
export const DocumentStickyHeaderContext = createContext<DocumentStickyHeaderContextType>({
  data: null,
  setData: () => {},
  isActive: false,
  setIsActive: () => {},
  passedSections: DEFAULT_PASSED_SECTIONS,
  setPassedSections: () => {},
});

export function DocumentStickyHeaderProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<DocumentStickyHeaderData | null>(null);
  const [isActive, setIsActiveState] = useState(false);
  const [passedSections, setPassedSectionsState] =
    useState<StickyPassedSections>(DEFAULT_PASSED_SECTIONS);

  // Stable action callbacks that never change reference
  const setData = useCallback(
    (
      val:
        | DocumentStickyHeaderData
        | null
        | ((prev: DocumentStickyHeaderData | null) => DocumentStickyHeaderData | null),
    ) => {
      setDataState(val);
    },
    [],
  );

  const setIsActive = useCallback((val: boolean) => {
    setIsActiveState(val);
  }, []);

  const setPassedSections = useCallback(
    (val: React.SetStateAction<StickyPassedSections>) => {
      setPassedSectionsState(val);
    },
    [],
  );

  const actionsValue = useMemo<DocumentStickyHeaderActions>(
    () => ({
      setData,
      setIsActive,
      setPassedSections,
    }),
    [setData, setIsActive, setPassedSections],
  );

  const effectiveIsActive = useMemo(() => {
    return Object.values(passedSections).some(Boolean);
  }, [passedSections]);

  const stateValue = useMemo<DocumentStickyHeaderState>(
    () => ({
      data: data ? { ...data, passedSections } : null,
      isActive: isActive || effectiveIsActive,
      passedSections,
    }),
    [data, isActive, effectiveIsActive, passedSections],
  );

  const combinedValue = useMemo<DocumentStickyHeaderContextType>(
    () => ({
      ...stateValue,
      ...actionsValue,
    }),
    [stateValue, actionsValue],
  );

  return (
    <DocumentStickyHeaderActionsContext.Provider value={actionsValue}>
      <DocumentStickyHeaderDataContext.Provider value={stateValue}>
        <DocumentStickyHeaderContext.Provider value={combinedValue}>
          {children}
        </DocumentStickyHeaderContext.Provider>
      </DocumentStickyHeaderDataContext.Provider>
    </DocumentStickyHeaderActionsContext.Provider>
  );
}

/**
 * Use when a component only needs to push updates to the sticky header (e.g. DocumentForm).
 * Prevents re-rendering when sticky header data or passedSections change.
 */
export function useDocumentStickyHeaderActions() {
  return useContext(DocumentStickyHeaderActionsContext);
}

/**
 * Use when a component only needs to read sticky header data (e.g. DashboardTopbar).
 */
export function useDocumentStickyHeaderData() {
  return useContext(DocumentStickyHeaderDataContext);
}

/**
 * Combined hook returning both state and actions.
 */
export function useDocumentStickyHeader() {
  return useContext(DocumentStickyHeaderContext);
}
