/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Safely seed all 37 gemstone_sieves records
 */
migrate((app) => {
  const sievesCol = app.findCollectionByNameOrId("gemstone_sieves");
  if (!sievesCol) return;

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
    let existing = null;
    try {
      existing = app.findFirstRecordByData("gemstone_sieves", "sieve_key", sv.sieve_key);
    } catch {
      existing = null;
    }
    if (!existing) {
      const rec = new Record(sievesCol, sv);
      app.save(rec);
    }
  }
});
