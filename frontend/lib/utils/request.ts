export function isSecureRequest(request: Request) {
  const forwardedProtocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProtocol) {
    return forwardedProtocol === 'https';
  }

  return new URL(request.url).protocol === 'https:';
}
