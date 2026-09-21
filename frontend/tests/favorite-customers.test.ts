import { describe, it, expect, mock } from 'bun:test';
import {
  getFavoriteCustomerIds,
  setFavoriteCustomerInCollection,
  toggleFavoriteCustomerInCollection,
} from '@/lib/favorite-customers';
import type PocketBase from 'pocketbase';

describe('Favorite Customers Collection Service Tests', () => {
  describe('getFavoriteCustomerIds', () => {
    it('returns empty array if userId is empty', async () => {
      const mockPb = {} as PocketBase;
      const res = await getFavoriteCustomerIds('', mockPb);
      expect(res).toEqual([]);
    });

    it('fetches and maps customer IDs from collection', async () => {
      const mockPb = {
        filter: (q: string, params: Record<string, string>) => `user = '${params.userId}'`,
        collection: (name: string) => {
          expect(name).toBe('favorite_customers');
          return {
            getFullList: async ({ filter }: { filter: string }) => {
              expect(filter).toBe("user = 'u123'");
              return [
                { id: 'fav1', customer: 'c100' },
                { id: 'fav2', customer: 'c200' },
                { id: 'fav3', customer: '' },
              ];
            },
          };
        },
      } as unknown as PocketBase;

      const res = await getFavoriteCustomerIds('u123', mockPb);
      expect(res).toEqual(['c100', 'c200']);
    });

    it('handles query failures gracefully by returning empty array', async () => {
      const mockPb = {
        filter: () => '',
        collection: () => ({
          getFullList: async () => {
            throw new Error('Connection failed');
          },
        }),
      } as unknown as PocketBase;

      const res = await getFavoriteCustomerIds('u123', mockPb);
      expect(res).toEqual([]);
    });
  });

  describe('setFavoriteCustomerInCollection', () => {
    it('throws error when userId or customerId is missing', async () => {
      const mockPb = {} as PocketBase;
      expect(setFavoriteCustomerInCollection('', 'c1', true, mockPb)).rejects.toThrow();
      expect(setFavoriteCustomerInCollection('u1', '', true, mockPb)).rejects.toThrow();
    });

    it('creates record when setting favorite=true and not currently existing', async () => {
      let createdData: unknown = null;
      const mockPb = {
        filter: () => 'filter_query',
        collection: (name: string) => ({
          getFirstListItem: async () => {
            throw { status: 404 };
          },
          create: async (data: Record<string, unknown>) => {
            createdData = data;
            return { id: 'new_fav', ...data };
          },
        }),
      } as unknown as PocketBase;

      const res = await setFavoriteCustomerInCollection('u10', 'c20', true, mockPb);
      expect(res).toEqual({ isFavorite: true, customerId: 'c20' });
      expect(createdData).toEqual({ user: 'u10', customer: 'c20' });
    });

    it('is idempotent when setting favorite=true and already existing', async () => {
      let createCalled = false;
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => ({ id: 'fav_exists', user: 'u10', customer: 'c20' }),
          create: async () => {
            createCalled = true;
            return {};
          },
        }),
      } as unknown as PocketBase;

      const res = await setFavoriteCustomerInCollection('u10', 'c20', true, mockPb);
      expect(res).toEqual({ isFavorite: true, customerId: 'c20' });
      expect(createCalled).toBe(false);
    });

    it('recovers gracefully from unique constraint violation during race condition on create', async () => {
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => {
            throw { status: 404 };
          },
          create: async () => {
            const err = new Error('UNIQUE constraint failed: favorite_customers.user, favorite_customers.customer') as any;
            err.status = 400;
            err.data = { code: 'idx_fav_user_customer' };
            throw err;
          },
        }),
      } as unknown as PocketBase;

      const res = await setFavoriteCustomerInCollection('u10', 'c20', true, mockPb);
      expect(res).toEqual({ isFavorite: true, customerId: 'c20' });
    });

    it('deletes record when setting favorite=false and currently existing', async () => {
      let deletedId: string | null = null;
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => ({ id: 'fav_999' }),
          delete: async (id: string) => {
            deletedId = id;
            return true;
          },
        }),
      } as unknown as PocketBase;

      const res = await setFavoriteCustomerInCollection('u10', 'c20', false, mockPb);
      expect(res).toEqual({ isFavorite: false, customerId: 'c20' });
      expect(deletedId as string | null).toBe('fav_999');
    });

    it('is idempotent when setting favorite=false and record does not exist', async () => {
      let deleteCalled = false;
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => {
            throw { status: 404 };
          },
          delete: async () => {
            deleteCalled = true;
            return true;
          },
        }),
      } as unknown as PocketBase;

      const res = await setFavoriteCustomerInCollection('u10', 'c20', false, mockPb);
      expect(res).toEqual({ isFavorite: false, customerId: 'c20' });
      expect(deleteCalled).toBe(false);
    });

    it('recovers gracefully from 404 during race condition on delete', async () => {
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => ({ id: 'fav_999' }),
          delete: async () => {
            const err = new Error('Record not found') as any;
            err.status = 404;
            throw err;
          },
        }),
      } as unknown as PocketBase;

      const res = await setFavoriteCustomerInCollection('u10', 'c20', false, mockPb);
      expect(res).toEqual({ isFavorite: false, customerId: 'c20' });
    });
  });

  describe('toggleFavoriteCustomerInCollection', () => {
    it('toggles from unstarred to starred when desiredState is undefined', async () => {
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => {
            throw { status: 404 };
          },
          create: async (data: Record<string, unknown>) => ({ id: 'f1', ...data }),
        }),
      } as unknown as PocketBase;

      const res = await toggleFavoriteCustomerInCollection('u1', 'c1', mockPb);
      expect(res).toEqual({ isFavorite: true, customerId: 'c1' });
    });

    it('toggles from starred to unstarred when desiredState is undefined', async () => {
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => ({ id: 'f1' }),
          delete: async () => true,
        }),
      } as unknown as PocketBase;

      const res = await toggleFavoriteCustomerInCollection('u1', 'c1', mockPb);
      expect(res).toEqual({ isFavorite: false, customerId: 'c1' });
    });

    it('obeys explicit desiredState even if opposite is detected', async () => {
      const mockPb = {
        filter: () => 'filter_query',
        collection: () => ({
          getFirstListItem: async () => ({ id: 'f1' }),
          delete: async () => true,
        }),
      } as unknown as PocketBase;

      // Even if f1 exists, if desiredState=true, it stays true
      const res = await toggleFavoriteCustomerInCollection('u1', 'c1', mockPb, true);
      expect(res).toEqual({ isFavorite: true, customerId: 'c1' });
    });
  });
});
