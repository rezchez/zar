import 'server-only';
import { type MessengerProvider, type SendDocumentOptions } from './types';

export class WhatsAppProvider implements MessengerProvider {
  name = 'WhatsApp';

  isConfigured() {
    return !!process.env.WHATSAPP_API_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  async sendDocument(options: SendDocumentOptions) {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp provider is not configured. Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID.');
    }

    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Step 1: Upload media to WhatsApp
    const uploadUrl = `https://graph.facebook.com/v17.0/${phoneNumberId}/media`;
    const uploadFormData = new FormData();
    uploadFormData.append('messaging_product', 'whatsapp');
    const blob = new Blob([new Uint8Array(options.document)], { type: 'application/pdf' });
    uploadFormData.append('file', blob, options.filename);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: uploadFormData,
    });

    const uploadData = await uploadResponse.json().catch(() => null) as { id?: string; error?: { message: string } } | null;
    if (!uploadResponse.ok || !uploadData?.id) {
      throw new Error(uploadData?.error?.message || `WhatsApp Media API returned ${uploadResponse.status}.`);
    }

    const mediaId = uploadData.id;

    // Step 2: Send message
    const sendUrl = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.chatId,
      type: 'document',
      document: {
        id: mediaId,
        filename: options.filename,
      }
    };

    if (options.caption) {
      payload.document.caption = options.caption;
    }

    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    });

    const sendData = await sendResponse.json().catch(() => null) as { error?: { message: string } } | null;
    if (!sendResponse.ok || sendData?.error) {
      throw new Error(sendData?.error?.message || `WhatsApp Messages API returned ${sendResponse.status}.`);
    }
  }
}
