import 'server-only';

export interface SendDocumentOptions {
  chatId: string;
  document: Buffer;
  filename: string;
  caption?: string;
}

export interface SendMessageOptions {
  chatId: string;
  message: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  botInfo?: {
    id?: string | number;
    username?: string;
    firstName?: string;
  };
}

export interface MessengerProvider {
  name: string;
  isConfigured: () => boolean;
  sendDocument: (options: SendDocumentOptions) => Promise<void>;
  sendMessage: (options: SendMessageOptions) => Promise<void>;
  testConnection: (token?: string, chatId?: string) => Promise<TestConnectionResult>;
}
