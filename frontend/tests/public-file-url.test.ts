import { afterEach, describe, expect, test } from 'bun:test';
import type PocketBase from 'pocketbase';
import { getPublicFileUrl } from '@/lib/pocketbase/public-file-url';

const originalPublicUrl = process.env.POCKETBASE_PUBLIC_URL;
const internalUrl = 'http://127.0.0.1:8090/api/files/users/user123/avatar%20one.webp?thumb=100x100&token=private';
const record = { id: 'user123', collectionId: 'users', collectionName: 'users' };

afterEach(() => {
  if (originalPublicUrl === undefined) {
    delete process.env.POCKETBASE_PUBLIC_URL;
  } else {
    process.env.POCKETBASE_PUBLIC_URL = originalPublicUrl;
  }
});

function fileClient(url: string) {
  return { files: { getURL: () => url } } as unknown as Pick<PocketBase, 'files'>;
}

describe('public PocketBase file URLs', () => {
  test('preserves existing URLs outside the HTTPS deployment', () => {
    delete process.env.POCKETBASE_PUBLIC_URL;
    expect(getPublicFileUrl(fileClient(internalUrl), record, 'avatar one.webp')).toBe(internalUrl);
  });

  test('uses HTTPS while preserving encoded paths and protected file tokens', () => {
    process.env.POCKETBASE_PUBLIC_URL = 'https://86.104.86.188';
    expect(getPublicFileUrl(fileClient(internalUrl), record, 'avatar one.webp')).toBe(
      'https://86.104.86.188/api/files/users/user123/avatar%20one.webp?thumb=100x100&token=private',
    );
  });

  test('keeps missing file URLs empty', () => {
    process.env.POCKETBASE_PUBLIC_URL = 'https://86.104.86.188';
    expect(getPublicFileUrl(fileClient(''), record, '')).toBe('');
  });

  test('passes file options to the SDK without changing the internal endpoint', () => {
    process.env.POCKETBASE_PUBLIC_URL = 'https://86.104.86.188';
    let receivedParameters: unknown[] = [];
    const client = {
      files: {
        getURL: (...parameters: unknown[]) => {
          receivedParameters = parameters;
          return internalUrl;
        },
      },
    } as unknown as Pick<PocketBase, 'files'>;
    const options = { thumb: '100x100', token: 'private' };
    getPublicFileUrl(client, record, 'avatar one.webp', options);
    expect(receivedParameters).toEqual([record, 'avatar one.webp', options]);
  });
});
