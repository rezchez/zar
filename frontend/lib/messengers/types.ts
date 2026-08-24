import 'server-only';

export interface SendDocumentOptions {
  chatId: string;
  document: Buffer;
  filename: string;
  caption?: string;
}

export interface MessengerProvider {
  name: string;
  isConfigured: () => boolean;
  sendDocument: (options: SendDocumentOptions) => Promise<void>;
}
