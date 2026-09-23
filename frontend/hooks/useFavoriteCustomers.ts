'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'zarfolio_favorite_customers';
const EVENT_KEY = 'zarfolio:favorite_customers_changed';

function syncLocalState(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: ids }));
  } catch {
    // ignore local storage errors
  }
}

export function useFavoriteCustomers() {
  const [favoriteCustomerIds, setFavoriteCustomerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // In-flight locks and refs to avoid race conditions and stale closures
  const inFlightRef = useRef<Set<string>>(new Set());
  const favoriteIdsRef = useRef<string[]>([]);

  useEffect(() => {
    favoriteIdsRef.current = favoriteCustomerIds;
  }, [favoriteCustomerIds]);

  // Initialize from localStorage and API
  useEffect(() => {
    let isMounted = true;

    // Fast initial load from localStorage
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && isMounted) {
          setFavoriteCustomerIds(parsed);
          favoriteIdsRef.current = parsed;
        }
      }
    } catch {
      // ignore
    }

    // Fetch authoritative favorites from collection endpoint
    fetch('/api/customers/favorites', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !Array.isArray(data?.favoriteCustomerIds)) return;
        const serverFavorites: string[] = data.favoriteCustomerIds;
        setFavoriteCustomerIds(serverFavorites);
        favoriteIdsRef.current = serverFavorites;
        syncLocalState(serverFavorites);
      })
      .catch((err) => {
        console.warn('Failed to load favorite customers from collection:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // Listen to local custom event for cross-component sync
    const handleLocalSync = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (Array.isArray(customEvent.detail)) {
        setFavoriteCustomerIds(customEvent.detail);
        favoriteIdsRef.current = customEvent.detail;
      }
    };

    window.addEventListener(EVENT_KEY, handleLocalSync);

    return () => {
      isMounted = false;
      window.removeEventListener(EVENT_KEY, handleLocalSync);
    };
  }, []);

  const isFavorite = useCallback(
    (customerId: string) => favoriteCustomerIds.includes(customerId),
    [favoriteCustomerIds],
  );

  const toggleFavorite = useCallback(
    async (customerId: string) => {
      if (!customerId) return;

      // Deduplicate rapid clicks / in-flight requests for the same customer
      if (inFlightRef.current.has(customerId)) {
        return;
      }
      inFlightRef.current.add(customerId);

      const currentList = favoriteIdsRef.current;
      const wasFav = currentList.includes(customerId);
      const targetIsFav = !wasFav;

      const optimisticList = targetIsFav
        ? [...currentList.filter((id) => id !== customerId), customerId]
        : currentList.filter((id) => id !== customerId);

      // 1. Optimistic update
      setFavoriteCustomerIds(optimisticList);
      favoriteIdsRef.current = optimisticList;
      syncLocalState(optimisticList);

      try {
        // 2. Perform network request outside setState to prevent double execution in StrictMode
        const res = await fetch('/api/customers/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId, isFavorite: targetIsFav }), credentials: 'include' });


        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const errorMsg =
            errData?.message || `Failed to toggle favorite (${res.status})`;
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (typeof data?.isFavorite === 'boolean') {
          const confirmedFav = data.isFavorite;
          setFavoriteCustomerIds((current) => {
            const has = current.includes(customerId);
            if (confirmedFav && !has) {
              const updated = [...current, customerId];
              favoriteIdsRef.current = updated;
              syncLocalState(updated);
              return updated;
            } else if (!confirmedFav && has) {
              const updated = current.filter((id) => id !== customerId);
              favoriteIdsRef.current = updated;
              syncLocalState(updated);
              return updated;
            }
            return current;
          });
        }
      } catch (err) {
        console.warn('Could not sync favorite customer with server, reverting:', err);
        // Rollback to previous state
        setFavoriteCustomerIds((current) => {
          const rolledBack = wasFav
            ? [...current.filter((id) => id !== customerId), customerId]
            : current.filter((id) => id !== customerId);
          favoriteIdsRef.current = rolledBack;
          syncLocalState(rolledBack);
          return rolledBack;
        });
      } finally {
        inFlightRef.current.delete(customerId);
      }
    },
    [],
  );

  return {
    favoriteCustomerIds,
    isLoading,
    isFavorite,
    toggleFavorite,
  };
}
