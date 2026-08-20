import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090');

const appSettingsFields = [
  { id: 'text_org_name', name: 'organizationName', type: 'text', required: false, max: 120 },
  { id: 'text_fiscal_start', name: 'fiscalYearStartDate', type: 'text', required: false, max: 40 },
  { id: 'text_fiscal_start_jalali', name: 'fiscalYearStartDateJalali', type: 'text', required: false, max: 20 },
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
];

const customFontsFields = [
  { id: 'text_display_name', name: 'displayName', type: 'text', required: true, min: 1, max: 100 },
  { id: 'text_font_family', name: 'fontFamily', type: 'text', required: true, min: 1, max: 100 },
  { id: 'file_font_file', name: 'fontFile', type: 'file', required: true, maxSelect: 1, maxSize: 10485760 },
  { id: 'text_font_format', name: 'format', type: 'text', required: false, max: 20 },
  { id: 'json_weights', name: 'availableWeights', type: 'json', required: false },
  { id: 'bool_is_active', name: 'isActive', type: 'bool', required: false },
  { id: 'relation_uploaded_by', name: 'uploadedBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
  { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

async function main() {
  const token = process.env.POCKETBASE_SUPERUSER_TOKEN;
  if (token) {
    pb.authStore.save(token);
  } else {
    const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
    const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
    if (email && password) {
      await pb.collection('_superusers').authWithPassword(email, password).catch(() => null);
    }
  }

  // Ensure app_settings
  const existingSettings = await pb.collections.getFirstListItem(
    pb.filter('name = {:name}', { name: 'app_settings' }),
  ).catch(() => null);

  const settingsPayload = {
    name: 'app_settings',
    type: 'base',
    fields: appSettingsFields,
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    deleteRule: '@request.auth.role = "admin"',
  };

  if (existingSettings) {
    await pb.collections.update(existingSettings.id, settingsPayload).catch(console.error);
    console.log('app_settings collection updated');
  } else {
    await pb.collections.create(settingsPayload).catch(console.error);
    console.log('app_settings collection created');
  }

  // Ensure custom_fonts
  const existingFonts = await pb.collections.getFirstListItem(
    pb.filter('name = {:name}', { name: 'custom_fonts' }),
  ).catch(() => null);

  const fontsPayload = {
    name: 'custom_fonts',
    type: 'base',
    fields: customFontsFields,
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    deleteRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
  };

  if (existingFonts) {
    await pb.collections.update(existingFonts.id, fontsPayload).catch(console.error);
    console.log('custom_fonts collection updated');
  } else {
    await pb.collections.create(fontsPayload).catch(console.error);
    console.log('custom_fonts collection created');
  }
}

main().catch(console.error);
