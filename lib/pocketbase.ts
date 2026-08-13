import 'server-only';

import PocketBase from 'pocketbase';

export const POCKETBASE_URL =
  process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';

export const PB_AUTH_COOKIE = process.env.PB_AUTH_COOKIE ?? 'pb_auth';

export function createPocketBaseClient() {
  const pb = new PocketBase(POCKETBASE_URL);
  // Server requests are short-lived and may legitimately run in parallel
  // (for example auth refresh + data loading). PocketBase's default
  // autocancellation can cancel a valid request when the same client is
  // reused, so cancellation is managed explicitly by the route layer.
  pb.autoCancellation(false);
  return pb;
}
