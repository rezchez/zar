import 'server-only';

import PocketBase from 'pocketbase';

export const POCKETBASE_URL =
  process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';

export const PB_AUTH_COOKIE = process.env.PB_AUTH_COOKIE ?? 'pb_auth';

export function createPocketBaseClient() {
  return new PocketBase(POCKETBASE_URL);
}
