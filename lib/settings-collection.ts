import 'server-only';

import type PocketBase from 'pocketbase';

let ensurePromise: Promise<void> | null = null;

const appSettingsPayload = {
  name: 'app_settings',
  type: 'base',
  fields: [
    { id: 'text_org_name', name: 'organizationName', type: 'text', required: false, max: 120 },
    { id: 'text_fiscal_start', name: 'fiscalYearStartDate', type: 'text', required: false, max: 40 },
    { id: 'text_fiscal_start_jalali', name: 'fiscalYearStartDateJalali', type: 'text', required: false, max: 30 },
    { id: 'text_base_currency', name: 'baseCurrency', type: 'text', required: false, max: 12 },
    { id: 'num_weight_precision', name: 'weightDecimalPlaces', type: 'number', required: false, min: 1, max: 3 },
    { id: 'text_doc_code_prefix', name: 'docCodePrefix', type: 'text', required: false, max: 12 },
    { id: 'text_body_font_family', name: 'bodyFontFamily', type: 'text', required: false, max: 60 },
    { id: 'text_heading_font_family', name: 'headingFontFamily', type: 'text', required: false, max: 60 },
    { id: 'text_body_font_size', name: 'bodyFontSize', type: 'text', required: false, max: 20 },
    { id: 'text_heading_font_size', name: 'headingFontSize', type: 'text', required: false, max: 20 },
    { id: 'num_body_font_weight', name: 'bodyFontWeight', type: 'number', required: false, min: 100, max: 900 },
    { id: 'num_heading_font_weight', name: 'headingFontWeight', type: 'number', required: false, min: 100, max: 900 },
    { id: 'relation_updated_by', name: 'updatedBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
    { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
  updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
  deleteRule: '@request.auth.role = "admin"',
};

const customFontsPayload = {
  name: 'custom_fonts',
  type: 'base',
  fields: [
    { id: 'text_display_name', name: 'displayName', type: 'text', required: true, min: 1, max: 100 },
    { id: 'text_font_family', name: 'fontFamily', type: 'text', required: true, min: 1, max: 100 },
    { id: 'file_font_file', name: 'fontFile', type: 'file', required: true, maxSelect: 1, maxSize: 10485760 },
    { id: 'text_font_format', name: 'format', type: 'text', required: false, max: 20 },
    { id: 'json_weights', name: 'availableWeights', type: 'json', required: false },
    { id: 'bool_is_active', name: 'isActive', type: 'bool', required: false },
    { id: 'relation_uploaded_by', name: 'uploadedBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
    { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
  updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
  deleteRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
};

export async function ensureSettingsCollections(pb: PocketBase) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      for (const payload of [appSettingsPayload, customFontsPayload]) {
        const existing = await pb.collections.getFirstListItem(
          pb.filter('name = {:name}', { name: payload.name }),
        ).catch(() => null);

        if (existing) {
          await pb.collections.update(existing.id, payload);
        } else {
          await pb.collections.create(payload);
        }
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}
