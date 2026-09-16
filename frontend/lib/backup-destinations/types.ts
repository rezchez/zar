export type BackupDestinationType = 'local' | 'bale' | 'arvan';

export type DestinationUploadPayload = {
  backupId: string;
  filename: string;
  buffer: Buffer;
  size: number;
  checksum: string;
  createdAt: string;
  createdAtJalali: string;
  encryptionEnabled: boolean;
  note?: string;
};

export type DestinationUploadResult = {
  destination: BackupDestinationType;
  success: boolean;
  message?: string;
  remotePath?: string;
  error?: string;
};

export interface BackupDestinationAdapter {
  readonly name: BackupDestinationType;
  readonly label: string;
  isConfigured(): boolean | Promise<boolean>;
  upload(payload: DestinationUploadPayload): Promise<DestinationUploadResult>;
}
