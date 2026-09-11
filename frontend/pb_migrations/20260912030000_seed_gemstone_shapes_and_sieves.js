/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Seed gemstone_shapes and gemstone_sieves collections
 */
migrate((app) => {
  const shapesCol = app.findCollectionByNameOrId("gemstone_shapes");
  if (shapesCol) {
    const defaultShapes = [
      {
        code: 'round',
        name_fa: 'گرد (Round)',
        name_en: 'Round Brilliant',
        sort_order: 1,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="44" stroke-width="2.5" /><polygon points="38,21 62,21 79,38 79,62 62,79 38,79 21,62 21,38" stroke-width="2" /><polygon points="50,6 38,21 62,21" /><polygon points="94,50 79,38 79,62" /><polygon points="50,94 62,79 38,79" /><polygon points="6,50 21,62 21,38" /><polygon points="50,6 62,21 79,38 81,19" /><polygon points="94,50 79,62 62,79 81,81" /><polygon points="50,94 38,79 21,62 19,81" /><polygon points="6,50 21,38 38,21 19,19" /><line x1="81" y1="19" x2="94" y2="50" /><line x1="81" y1="19" x2="50" y2="6" /><line x1="81" y1="81" x2="94" y2="50" /><line x1="81" y1="81" x2="50" y2="94" /><line x1="19" y1="81" x2="50" y2="94" /><line x1="19" y1="81" x2="6" y2="50" /><line x1="19" y1="19" x2="6" y2="50" /><line x1="19" y1="19" x2="50" y2="6" /></svg>'
      },
      {
        code: 'princess',
        name_fa: 'پرنسس (Princess)',
        name_en: 'Princess Cut',
        sort_order: 2,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="84" height="84" rx="1" stroke-width="2.5" /><rect x="30" y="30" width="40" height="40" stroke-width="2" /><polygon points="50,30 70,50 50,70 30,50" stroke-width="1.5" /><line x1="8" y1="8" x2="30" y2="30" stroke-width="2" /><line x1="92" y1="8" x2="70" y2="30" stroke-width="2" /><line x1="92" y1="92" x2="70" y2="70" stroke-width="2" /><line x1="8" y1="92" x2="30" y2="70" stroke-width="2" /><polygon points="50,8 30,30 70,30" /><polygon points="92,50 70,30 70,70" /><polygon points="50,92 70,70 30,70" /><polygon points="8,50 30,70 30,30" /></svg>'
      },
      {
        code: 'baguette',
        name_fa: 'باگت (Baguette)',
        name_en: 'Baguette',
        sort_order: 3,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="22" y="8" width="56" height="84" stroke-width="2.5" /><rect x="30" y="16" width="40" height="68" stroke-width="1.5" /><rect x="38" y="24" width="24" height="52" stroke-width="2" /><line x1="22" y1="8" x2="38" y2="24" stroke-width="1.8" /><line x1="78" y1="8" x2="62" y2="24" stroke-width="1.8" /><line x1="78" y1="92" x2="62" y2="76" stroke-width="1.8" /><line x1="22" y1="92" x2="38" y2="76" stroke-width="1.8" /></svg>'
      },
      {
        code: 'baguette_calibre',
        name_fa: 'باگت کالیبره (Calibre)',
        name_en: 'Baguette Calibre',
        parent_code: 'baguette',
        sort_order: 4,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="22" y="8" width="56" height="84" stroke-width="2.5" /><rect x="30" y="16" width="40" height="68" stroke-width="1.5" /><rect x="38" y="24" width="24" height="52" stroke-width="2" /><line x1="22" y1="8" x2="38" y2="24" stroke-width="1.8" /><line x1="78" y1="8" x2="62" y2="24" stroke-width="1.8" /><line x1="78" y1="92" x2="62" y2="76" stroke-width="1.8" /><line x1="22" y1="92" x2="38" y2="76" stroke-width="1.8" /></svg>'
      },
      {
        code: 'baguette_taper',
        name_fa: 'باگت مخروطی (Tapered)',
        name_en: 'Tapered Baguette',
        parent_code: 'baguette',
        sort_order: 5,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="26,8 74,8 64,92 36,92" stroke-width="2.5" /><polygon points="32,16 68,16 59,84 41,84" stroke-width="1.5" /><polygon points="38,24 62,24 55,76 45,76" stroke-width="2" /><line x1="26" y1="8" x2="38" y2="24" stroke-width="1.8" /><line x1="74" y1="8" x2="62" y2="24" stroke-width="1.8" /><line x1="64" y1="92" x2="55" y2="76" stroke-width="1.8" /><line x1="36" y1="92" x2="45" y2="76" stroke-width="1.8" /></svg>'
      },
      {
        code: 'cushion',
        name_fa: 'کوشن (Cushion)',
        name_en: 'Cushion',
        sort_order: 6,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M26,8 C40,6 60,6 74,8 C88,10 94,16 92,26 C94,40 94,60 92,74 C94,88 88,94 74,92 C60,94 40,94 26,92 C12,94 6,88 8,74 C6,60 6,40 8,26 C6,12 12,6 26,8 Z" stroke-width="2.5" /><polygon points="36,26 64,26 74,36 74,64 64,74 36,74 26,64 26,36" stroke-width="2" /><polygon points="50,6 36,26 64,26" /><polygon points="93,50 74,36 74,64" /><polygon points="50,94 64,74 36,74" /><polygon points="7,50 26,64 26,36" /><polygon points="50,38 62,50 50,62 38,50" stroke-width="1.5" /></svg>'
      },
      {
        code: 'emerald',
        name_fa: 'امرالد / زمردی (Emerald Cut)',
        name_en: 'Emerald Cut',
        sort_order: 7,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="28,8 72,8 88,24 88,76 72,92 28,92 12,76 12,24" stroke-width="2.5" /><polygon points="32,16 68,16 80,28 80,72 68,84 32,84 20,72 20,28" stroke-width="1.5" /><polygon points="36,24 64,24 72,32 72,68 64,76 36,76 28,68 28,32" stroke-width="2" /><line x1="12" y1="24" x2="28" y2="32" stroke-width="1.8" /><line x1="28" y1="8" x2="36" y2="24" stroke-width="1.8" /><line x1="72" y1="8" x2="64" y2="24" stroke-width="1.8" /><line x1="88" y1="24" x2="72" y2="32" stroke-width="1.8" /><line x1="88" y1="76" x2="72" y2="68" stroke-width="1.8" /><line x1="72" y1="92" x2="64" y2="76" stroke-width="1.8" /><line x1="28" y1="92" x2="36" y2="76" stroke-width="1.8" /><line x1="12" y1="76" x2="28" y2="68" stroke-width="1.8" /></svg>'
      },
      {
        code: 'oval',
        name_fa: 'بیضی (Oval)',
        name_en: 'Oval',
        sort_order: 8,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="50" rx="34" ry="44" stroke-width="2.5" /><polygon points="40,24 60,24 72,38 72,62 60,76 40,76 28,62 28,38" stroke-width="2" /><polygon points="50,6 40,24 60,24" /><polygon points="50,94 60,76 40,76" /><polygon points="84,50 72,38 72,62" /><polygon points="16,50 28,62 28,38" /></svg>'
      },
      {
        code: 'pear',
        name_fa: 'اشک (Pear)',
        name_en: 'Pear',
        sort_order: 9,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M50,6 C58,22 84,48 84,66 C84,84 69,94 50,94 C31,94 16,84 16,66 C16,48 42,22 50,6 Z" stroke-width="2.5" /><path d="M50,26 L64,44 L68,66 L50,78 L32,66 L36,44 Z" stroke-width="2" /><polygon points="50,6 42,26 50,34 58,26" /><polygon points="50,94 32,66 50,78" /><polygon points="50,94 68,66 50,78" /></svg>'
      },
      {
        code: 'radiant',
        name_fa: 'رادیانت (Radiant)',
        name_en: 'Radiant',
        sort_order: 10,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="26,10 74,10 88,24 88,76 74,90 26,90 12,76 12,24" stroke-width="2.5" /><polygon points="34,26 66,26 74,34 74,66 66,74 34,74 26,66 26,34" stroke-width="2" /><polygon points="50,26 62,38 50,50 38,38" stroke-width="1.5" /><polygon points="50,74 62,62 50,50 38,62" stroke-width="1.5" /><line x1="12" y1="24" x2="26" y2="34" stroke-width="1.8" /><line x1="26" y1="10" x2="34" y2="26" stroke-width="1.8" /><line x1="74" y1="10" x2="66" y2="26" stroke-width="1.8" /><line x1="88" y1="24" x2="74" y2="34" stroke-width="1.8" /><line x1="88" y1="76" x2="74" y2="66" stroke-width="1.8" /><line x1="74" y1="90" x2="66" y2="74" stroke-width="1.8" /><line x1="26" y1="90" x2="34" y2="74" stroke-width="1.8" /><line x1="12" y1="76" x2="26" y2="66" stroke-width="1.8" /></svg>'
      },
      {
        code: 'heart',
        name_fa: 'قلب (Heart)',
        name_en: 'Heart',
        sort_order: 11,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M50,26 C44,14 32,8 20,12 C8,16 4,28 8,42 C12,56 28,72 50,92 C72,72 88,56 92,42 C96,28 92,16 80,12 C68,8 56,14 50,26 Z" stroke-width="2.5" /><path d="M50,38 C46,30 38,26 30,28 C22,30 20,38 24,48 C28,58 40,70 50,80 C60,70 72,58 76,48 C80,38 78,30 70,28 C62,26 54,30 50,38 Z" stroke-width="2" /><line x1="50" y1="26" x2="50" y2="38" stroke-width="1.8" /><line x1="50" y1="80" x2="50" y2="92" stroke-width="1.8" /></svg>'
      },
      {
        code: 'marquise',
        name_fa: 'مارکیز (Marquise)',
        name_en: 'Marquise',
        sort_order: 12,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M50,6 C68,26 84,40 84,50 C84,60 68,74 50,94 C32,74 16,60 16,50 C16,40 32,26 50,6 Z" stroke-width="2.5" /><polygon points="50,22 68,50 50,78 32,50" stroke-width="2" /><polygon points="50,6 40,24 50,36 60,24" /><polygon points="50,94 60,76 50,64 40,76" /><line x1="68" y1="50" x2="84" y2="50" stroke-width="1.8" /><line x1="32" y1="50" x2="16" y2="50" stroke-width="1.8" /></svg>'
      },
      {
        code: 'asscher',
        name_fa: 'آشر (Asscher)',
        name_en: 'Asscher',
        sort_order: 13,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="32,8 68,8 92,32 92,68 68,92 32,92 8,68 8,32" stroke-width="2.5" /><polygon points="36,18 64,18 82,36 82,64 64,82 36,82 18,64 18,36" stroke-width="1.5" /><rect x="38" y="38" width="24" height="24" stroke-width="2" /><line x1="8" y1="32" x2="38" y2="38" stroke-width="1.8" /><line x1="32" y1="8" x2="38" y2="38" stroke-width="1.8" /><line x1="68" y1="8" x2="62" y2="38" stroke-width="1.8" /><line x1="92" y1="32" x2="62" y2="38" stroke-width="1.8" /><line x1="92" y1="68" x2="62" y2="62" stroke-width="1.8" /><line x1="68" y1="92" x2="62" y2="62" stroke-width="1.8" /><line x1="32" y1="92" x2="38" y2="62" stroke-width="1.8" /><line x1="8" y1="68" x2="38" y2="62" stroke-width="1.8" /></svg>'
      },
      {
        code: 'triangle',
        name_fa: 'مثلثی / تریلیون (Trillion)',
        name_en: 'Triangle / Trillion',
        sort_order: 14,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M50,10 C68,36 84,62 88,80 C80,86 64,90 50,90 C36,90 20,86 12,80 C16,62 32,36 50,10 Z" stroke-width="2.5" /><polygon points="50,36 70,72 30,72" stroke-width="2" /><line x1="50" y1="10" x2="50" y2="36" stroke-width="2" /><line x1="88" y1="80" x2="70" y2="72" stroke-width="2" /><line x1="12" y1="80" x2="30" y2="72" stroke-width="2" /></svg>'
      },
      {
        code: 'rose_cut',
        name_fa: 'رزکات (Rose Cut)',
        name_en: 'Rose Cut',
        sort_order: 15,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="42" stroke-width="2.5" /><polygon points="50,22 74,36 74,64 50,78 26,64 26,36" stroke-width="1.8" /><line x1="50" y1="50" x2="50" y2="22" stroke-width="1.8" /><line x1="50" y1="50" x2="74" y2="36" stroke-width="1.8" /><line x1="50" y1="50" x2="74" y2="64" stroke-width="1.8" /><line x1="50" y1="50" x2="50" y2="78" stroke-width="1.8" /><line x1="50" y1="50" x2="26" y2="64" stroke-width="1.8" /><line x1="50" y1="50" x2="26" y2="36" stroke-width="1.8" /></svg>'
      },
      {
        code: 'cabochon',
        name_fa: 'دامله / کابوشن (Cabochon)',
        name_en: 'Cabochon',
        sort_order: 16,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="50" rx="36" ry="44" stroke-width="2.5" /><ellipse cx="50" cy="48" rx="28" ry="35" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.6" /><path d="M34,34 C42,28 56,28 64,34" stroke-width="2.5" stroke-linecap="round" /></svg>'
      },
      {
        code: 'other',
        name_fa: 'سایر / فانتزی (Fancy)',
        name_en: 'Fancy / Other',
        sort_order: 17,
        is_active: true,
        svg_icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="30,12 70,12 88,30 88,70 70,88 30,88 12,70 12,30" stroke-width="2.5" /><polygon points="38,26 62,26 74,50 62,74 38,74 26,50" stroke-width="2" /><line x1="30" y1="12" x2="38" y2="26" stroke-width="1.8" /><line x1="70" y1="12" x2="62" y2="26" stroke-width="1.8" /><line x1="88" y1="30" x2="74" y2="50" stroke-width="1.8" /><line x1="88" y1="70" x2="74" y2="50" stroke-width="1.8" /><line x1="70" y1="88" x2="62" y2="74" stroke-width="1.8" /><line x1="30" y1="88" x2="38" y2="74" stroke-width="1.8" /><line x1="12" y1="70" x2="26" y2="50" stroke-width="1.8" /><line x1="12" y1="30" x2="26" y2="50" stroke-width="1.8" /></svg>'
      },
    ];

    for (const sh of defaultShapes) {
      try {
        const existing = app.findFirstRecordByData("gemstone_shapes", "code", sh.code);
        if (!existing) {
          const rec = new Record(shapesCol, sh);
          app.save(rec);
        } else if (!existing.get("svg_icon")) {
          existing.set("svg_icon", sh.svg_icon);
          app.save(existing);
        }
      } catch {
        // ignore
      }
    }
  }

  const sievesCol = app.findCollectionByNameOrId("gemstone_sieves");
  if (sievesCol) {
    const defaultSieves = [
      { sieve_size: '-0000', sieve_key: '-0000', mm_size: 0.70, carats_weight_per_piece: 0.0026, pieces_per_carat: 380, sort_order: 1, is_active: true },
      { sieve_size: '-000', sieve_key: '-000', mm_size: 0.80, carats_weight_per_piece: 0.0033, pieces_per_carat: 300, sort_order: 2, is_active: true },
      { sieve_size: '-00', sieve_key: '-00', mm_size: 0.90, carats_weight_per_piece: 0.0040, pieces_per_carat: 250, sort_order: 3, is_active: true },
      { sieve_size: '-0', sieve_key: '-0', mm_size: 1.00, carats_weight_per_piece: 0.0050, pieces_per_carat: 200, sort_order: 4, is_active: true },
      { sieve_size: '+0-1', sieve_key: '0-1', mm_size: 1.10, carats_weight_per_piece: 0.0063, pieces_per_carat: 160, sort_order: 5, is_active: true },
      { sieve_size: '+1-1.5', sieve_key: '1-1.5', mm_size: 1.15, carats_weight_per_piece: 0.0071, pieces_per_carat: 140, sort_order: 6, is_active: true },
      { sieve_size: '+1.5-2', sieve_key: '1.5-2', mm_size: 1.20, carats_weight_per_piece: 0.0083, pieces_per_carat: 120, sort_order: 7, is_active: true },
      { sieve_size: '+2-2.5', sieve_key: '2-2.5', mm_size: 1.25, carats_weight_per_piece: 0.0091, pieces_per_carat: 110, sort_order: 8, is_active: true },
      { sieve_size: '+2.5-3', sieve_key: '2.5-3', mm_size: 1.30, carats_weight_per_piece: 0.0100, pieces_per_carat: 100, sort_order: 9, is_active: true },
      { sieve_size: '+3-3.5', sieve_key: '3-3.5', mm_size: 1.35, carats_weight_per_piece: 0.0111, pieces_per_carat: 90, sort_order: 10, is_active: true },
      { sieve_size: '+3.5-4', sieve_key: '3.5-4', mm_size: 1.40, carats_weight_per_piece: 0.0125, pieces_per_carat: 80, sort_order: 11, is_active: true },
      { sieve_size: '+4-4.5', sieve_key: '4-4.5', mm_size: 1.45, carats_weight_per_piece: 0.0133, pieces_per_carat: 75, sort_order: 12, is_active: true },
      { sieve_size: '+4.5-5', sieve_key: '4.5-5', mm_size: 1.50, carats_weight_per_piece: 0.0143, pieces_per_carat: 70, sort_order: 13, is_active: true },
      { sieve_size: '+5-5.5', sieve_key: '5-5.5', mm_size: 1.55, carats_weight_per_piece: 0.0154, pieces_per_carat: 65, sort_order: 14, is_active: true },
      { sieve_size: '+5.5-6', sieve_key: '5.5-6', mm_size: 1.60, carats_weight_per_piece: 0.0167, pieces_per_carat: 60, sort_order: 15, is_active: true },
      { sieve_size: '+6-6.5', sieve_key: '6-6.5', mm_size: 1.70, carats_weight_per_piece: 0.0200, pieces_per_carat: 50, sort_order: 16, is_active: true },
      { sieve_size: '+6.5-7', sieve_key: '6.5-7', mm_size: 1.80, carats_weight_per_piece: 0.0250, pieces_per_carat: 40, princess_mm_size: 1.7, sort_order: 17, is_active: true },
      { sieve_size: '+7-7.5', sieve_key: '7-7.5', mm_size: 1.90, carats_weight_per_piece: 0.0286, pieces_per_carat: 35, princess_mm_size: 1.8, sort_order: 18, is_active: true },
      { sieve_size: '+7.5-8', sieve_key: '7.5-8', mm_size: 2.00, carats_weight_per_piece: 0.0333, pieces_per_carat: 30, princess_mm_size: 1.9, sort_order: 19, is_active: true },
      { sieve_size: '+8-8.5', sieve_key: '8-8.5', mm_size: 2.10, carats_weight_per_piece: 0.0400, pieces_per_carat: 25, princess_mm_size: 2.0, sort_order: 20, is_active: true },
      { sieve_size: '+8.5-9', sieve_key: '8.5-9', mm_size: 2.20, carats_weight_per_piece: 0.0435, pieces_per_carat: 23, princess_mm_size: 2.0, sort_order: 21, is_active: true },
      { sieve_size: '+9-9.5', sieve_key: '9-9.5', mm_size: 2.30, carats_weight_per_piece: 0.0500, pieces_per_carat: 20, princess_mm_size: 2.1, sort_order: 22, is_active: true },
      { sieve_size: '+9.5-10', sieve_key: '9.5-10', mm_size: 2.40, carats_weight_per_piece: 0.0556, pieces_per_carat: 18, princess_mm_size: 2.2, sort_order: 23, is_active: true },
      { sieve_size: '+10-10.5', sieve_key: '10-10.5', mm_size: 2.50, carats_weight_per_piece: 0.0625, pieces_per_carat: 16, princess_mm_size: 2.3, sort_order: 24, is_active: true },
      { sieve_size: '+10.5-11', sieve_key: '10.5-11', mm_size: 2.60, carats_weight_per_piece: 0.0714, pieces_per_carat: 14, princess_mm_size: 2.4, sort_order: 25, is_active: true },
      { sieve_size: '+11-11.5', sieve_key: '11-11.5', mm_size: 2.70, carats_weight_per_piece: 0.0769, pieces_per_carat: 13, princess_mm_size: 2.5, sort_order: 26, is_active: true },
      { sieve_size: '+11.5-12', sieve_key: '11.5-12', mm_size: 2.80, carats_weight_per_piece: 0.0833, pieces_per_carat: 12, princess_mm_size: 2.6, sort_order: 27, is_active: true },
      { sieve_size: '+12-12.5', sieve_key: '12-12.5', mm_size: 2.90, carats_weight_per_piece: 0.0909, pieces_per_carat: 11, princess_mm_size: 2.7, sort_order: 28, is_active: true },
      { sieve_size: '+12.5-13', sieve_key: '12.5-13', mm_size: 3.00, carats_weight_per_piece: 0.1000, pieces_per_carat: 10, princess_mm_size: 2.8, sort_order: 29, is_active: true },
      { sieve_size: '+13-13.5', sieve_key: '13-13.5', mm_size: 3.10, carats_weight_per_piece: 0.1111, pieces_per_carat: 9, princess_mm_size: 2.9, sort_order: 30, is_active: true },
      { sieve_size: '+13.5-14', sieve_key: '13.5-14', mm_size: 3.20, carats_weight_per_piece: 0.1250, pieces_per_carat: 8, princess_mm_size: 3.0, sort_order: 31, is_active: true },
      { sieve_size: '+14-14.5', sieve_key: '14-14.5', mm_size: 3.30, carats_weight_per_piece: 0.1429, pieces_per_carat: 7, princess_mm_size: 3.1, sort_order: 32, is_active: true },
      { sieve_size: '+14.5-15', sieve_key: '14.5-15', mm_size: 3.40, carats_weight_per_piece: 0.1538, pieces_per_carat: 6.5, princess_mm_size: 3.2, sort_order: 33, is_active: true },
      { sieve_size: '+15-15.5', sieve_key: '15-15.5', mm_size: 3.50, carats_weight_per_piece: 0.1667, pieces_per_carat: 6, princess_mm_size: 3.3, sort_order: 34, is_active: true },
      { sieve_size: '+15.5-16', sieve_key: '15.5-16', mm_size: 3.60, carats_weight_per_piece: 0.1818, pieces_per_carat: 5.5, princess_mm_size: 3.4, sort_order: 35, is_active: true },
      { sieve_size: '+16-16.5', sieve_key: '16-16.5', mm_size: 3.70, carats_weight_per_piece: 0.1900, pieces_per_carat: 5.2, princess_mm_size: 3.5, sort_order: 36, is_active: true },
      { sieve_size: '+16.5-17', sieve_key: '16.5-17', mm_size: 3.80, carats_weight_per_piece: 0.2000, pieces_per_carat: 5, princess_mm_size: 3.6, sort_order: 37, is_active: true },
    ];

    for (const sv of defaultSieves) {
      try {
        const existing = app.findFirstRecordByData("gemstone_sieves", "sieve_key", sv.sieve_key);
        if (!existing) {
          const rec = new Record(sievesCol, sv);
          app.save(rec);
        }
      } catch {
        // ignore
      }
    }
  }
});
