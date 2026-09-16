import 'server-only';
import crypto from 'crypto';
import type { BackupDestinationAdapter, DestinationUploadPayload, DestinationUploadResult } from './types';

export type ArvanS3Config = {
  endpoint?: string;
  bucket?: string;
  accessKey?: string;
  secretKey?: string;
  region?: string;
};

export class ArvanS3BackupDestination implements BackupDestinationAdapter {
  readonly name = 'arvan' as const;
  readonly label = 'ابر آروان (ArvanCloud S3)';

  private config: ArvanS3Config;

  constructor(config?: ArvanS3Config) {
    this.config = {
      endpoint: config?.endpoint || process.env.ARVAN_S3_ENDPOINT || 'https://s3.ir-thr-at1.arvanstorage.ir',
      bucket: config?.bucket || process.env.ARVAN_S3_BUCKET || '',
      accessKey: config?.accessKey || process.env.ARVAN_S3_ACCESS_KEY || '',
      secretKey: config?.secretKey || process.env.ARVAN_S3_SECRET_KEY || '',
      region: config?.region || process.env.ARVAN_S3_REGION || 'ir-thr-at1',
    };
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.endpoint &&
      this.config.bucket &&
      this.config.accessKey &&
      this.config.secretKey
    );
  }

  /**
   * Generates standard AWS Signature Version 4 for S3-compatible PUT object request.
   */
  private buildAwsV4Headers({
    method,
    url,
    body,
    contentType,
  }: {
    method: string;
    url: URL;
    body: Buffer;
    contentType: string;
  }): Record<string, string> {
    const accessKey = this.config.accessKey!;
    const secretKey = this.config.secretKey!;
    const region = this.config.region || 'ir-thr-at1';
    const service = 's3';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    const host = url.host;

    const canonicalUri = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`;
    const canonicalQueryString = '';

    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;

    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest, 'utf-8').digest('hex');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf-8').digest('hex');

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      'Content-Type': contentType,
      Host: host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorizationHeader,
    };
  }

  async upload(payload: DestinationUploadPayload): Promise<DestinationUploadResult> {
    if (!this.isConfigured()) {
      return {
        destination: 'arvan',
        success: false,
        error: 'تنظیمات فضای ابری آروان (Bucket، Endpoint، AccessKey یا SecretKey) کامل نیست.',
      };
    }

    try {
      const endpoint = this.config.endpoint!.replace(/\/+$/, '');
      const bucket = this.config.bucket!.trim();
      const objectKey = `zarfolio-backups/${payload.filename}`;
      const targetUrl = new URL(`${endpoint}/${bucket}/${objectKey}`);

      const headers = this.buildAwsV4Headers({
        method: 'PUT',
        url: targetUrl,
        body: payload.buffer,
        contentType: 'application/octet-stream',
      });

      const response = await fetch(targetUrl.toString(), {
        method: 'PUT',
        headers,
        body: new Uint8Array(payload.buffer),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          destination: 'arvan',
          success: false,
          error: `خطای ذخیره‌سازی ابری آروان (${response.status}): ${text.slice(0, 200)}`,
        };
      }

      return {
        destination: 'arvan',
        success: true,
        remotePath: `${bucket}/${objectKey}`,
        message: `فایل با موفقیت در فضای ذخیره‌سازی ابری آروان (مسیر ${objectKey}) بارگذاری شد.`,
      };
    } catch (err) {
      return {
        destination: 'arvan',
        success: false,
        error: `خطا در ارتباط با فضای ابری آروان: ${err instanceof Error ? err.message : 'خطای ناشناخته'}`,
      };
    }
  }
}
