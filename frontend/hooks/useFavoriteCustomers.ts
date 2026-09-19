'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'zarfolio_favorite_customers';
const EVENT_KEY = 'zarfolio:favorite_customers_changed';

export function useFavoriteCustomers() {
  const [favoriteCustomerIds, setFavoriteCustomerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        }
      }
    } catch {
      // ignore
    }

    // Fetch authoritative preferences from server
    fetch('/api/account/preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.preferences?.favoriteCustomers) return;
        const serverFavorites = data.preferences.favoriteCustomers;
        if (Array.isArray(serverFavorites)) {
          setFavoriteCustomerIds(serverFavorites);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(serverFavorites));
          } catch {
            // ignore
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load user preferences:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // Listen to local custom event for cross-component sync
    const handleLocalSync = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (Array.isArray(customEvent.detail)) {
        setFavoriteCustomerIds(customEvent.detail);
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

      setFavoriteCustomerIds((prev) => {
        const isFav = prev.includes(customerId);
        const next = isFav ? prev.filter((id) => id !== customerId) : [...prev, customerId];

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: next }));
        } catch {
          // ignore
        }

        // Persist to user preferences endpoint
        fetch('/api/account/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favoriteCustomers: next }),
        }).catch((err) => {
          console.error('Failed to sync favorite customer to server:', err);
        });

        return next;
      });
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
