import 'server-only';

import PocketBase from 'pocketbase';

// Ensure local loopback addresses are never routed through environment proxies
const localHosts = ['127.0.0.1', 'localhost', '::1'];
const currentNoProxy = process.env.NO_PROXY || process.env.no_proxy || '';
const missingHosts = localHosts.filter((h) => !currentNoProxy.includes(h));
if (missingHosts.length > 0) {
  const updatedNoProxy = currentNoProxy
    ? `${currentNoProxy},${missingHosts.join(',')}`
    : localHosts.join(',');
  process.env.NO_PROXY = updatedNoProxy;
  process.env.no_proxy = updatedNoProxy;
}

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

  // Attach a reasonable default fail-fast timeout (5s) to avoid unhandled hangs
  pb.beforeSend = (url, options) => {
    if (!options.signal) {
      options.signal = AbortSignal.timeout(5000);
    }
    return { url, options };
  };

  return pb;
}

