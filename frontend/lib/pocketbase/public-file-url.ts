import type PocketBase from 'pocketbase';

export function getPublicFileUrl(
  client: Pick<PocketBase, 'files'>,
  ...parameters: Parameters<PocketBase['files']['getURL']>
): string {
  const internalUrl = client.files.getURL(...parameters);
  const publicUrl = process.env.POCKETBASE_PUBLIC_URL;
  if (!publicUrl || !internalUrl) {
    return internalUrl;
  }

  const fileUrl = new URL(internalUrl);
  return new URL(fileUrl.pathname + fileUrl.search, publicUrl).toString();
}
