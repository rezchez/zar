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

    // Fetch authoritative favorites from collection endpoint
    fetch('/api/customers/favorites')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !Array.isArray(data?.favoriteCustomerIds)) return;
        const serverFavorites = data.favoriteCustomerIds;
        setFavoriteCustomerIds(serverFavorites);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverFavorites));
        } catch {
          // ignore
        }
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

      // Optimistic update
      setFavoriteCustomerIds((prev) => {
        const isFav = prev.includes(customerId);
        const next = isFav ? prev.filter((id) => id !== customerId) : [...prev, customerId];

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: next }));
        } catch {
          // ignore
        }

        // Persist to collection endpoint
        fetch('/api/customers/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error('Failed to toggle favorite');
            const data = await res.json();
            if (typeof data.isFavorite === 'boolean') {
              setFavoriteCustomerIds((current) => {
                const hasIt = current.includes(customerId);
                if (data.isFavorite && !hasIt) {
                  const updated = [...current, customerId];
                  try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: updated }));
                  } catch {
                    // ignore
                  }
                  return updated;
                } else if (!data.isFavorite && hasIt) {
                  const updated = current.filter((id) => id !== customerId);
                  try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: updated }));
                  } catch {
                    // ignore
                  }
                  return updated;
                }
                return current;
              });
            }
          })
          .catch((err) => {
            console.error('Failed to sync favorite customer to collection:', err);
            // Rollback
            setFavoriteCustomerIds((current) => {
              const rolledBack = isFav ? [...current, customerId] : current.filter((id) => id !== customerId);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(rolledBack));
                window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: rolledBack }));
              } catch {
                // ignore
              }
              return rolledBack;
            });
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
