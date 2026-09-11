import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  DIAMOND_SIEVE_CHART,
  normalizeSieveKey,
  type DiamondSieveRecord,
} from '@/lib/gemstone-sieve';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    let records: Record<string, unknown>[] = [];
    try {
      records = await context.pb.collection('gemstone_sieves').getFullList({
        filter: 'is_active = true',
        sort: 'sort_order,id',
      });
    } catch {
      records = [];
    }

    if (records.length === 0) {
      // Auto-seed to PocketBase if empty
      try {
        let order = 1;
        for (const sv of DIAMOND_SIEVE_CHART) {
          const rec = await context.pb.collection('gemstone_sieves').create({
            sieve_size: sv.sieveSize,
            sieve_key: normalizeSieveKey(sv.sieveSize),
            mm_size: sv.mmSize,
            carats_weight_per_piece: sv.caratsWeightPerPiece,
            pieces_per_carat: sv.piecesPerCarat,
            princess_mm_size: sv.princessMmSize ?? null,
            sort_order: order++,
            is_active: true,
          }).catch(() => null);

          if (rec) {
            records.push(rec as unknown as Record<string, unknown>);
          }
        }
      } catch {
        // Fall back to memory records
      }
    }

    const items: DiamondSieveRecord[] = records.length > 0
      ? records.map((r) => ({
          sieveSize: String(r.sieve_size || ''),
          mmSize: Number(r.mm_size || 0),
          caratsWeightPerPiece: Number(r.carats_weight_per_piece || 0),
          piecesPerCarat: Number(r.pieces_per_carat || 0),
          princessMmSize: r.princess_mm_size !== undefined && r.princess_mm_size !== null ? Number(r.princess_mm_size) : undefined,
        }))
      : DIAMOND_SIEVE_CHART;

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({
      items: DIAMOND_SIEVE_CHART,
      message: err instanceof Error ? err.message : 'خطای بارگذاری الک‌ها',
    });
  }
}
