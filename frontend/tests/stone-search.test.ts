import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  buildSpeciesListForRoot,
  findSpeciesItem,
  GEMSTONE_SEARCH_KEYWORDS,
  normalizeGemstoneSearchText,
  POPULAR_BEGINNER_GEMSTONES,
  ROOT_CATEGORIES,
  scoreGemstoneMatch,
  searchGemstoneSpecies,
  type GemstoneSpeciesItem,
  type RootCategory,
} from '@/lib/gemstone';

describe('Beginner-Friendly Stone Search (جستجوی سریع سنگ)', () => {
  // Master list of all available species across all 5 GIA root categories
  const allSpecies: GemstoneSpeciesItem[] = (() => {
    const list: GemstoneSpeciesItem[] = [];
    const seen = new Set<string>();
    for (const rc of ROOT_CATEGORIES) {
      const rootList = buildSpeciesListForRoot(rc.id as RootCategory);
      for (const item of rootList) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }
    return list;
  })();

  it('normalizes Persian and Arabic text variants accurately', () => {
    expect(normalizeGemstoneSearchText('يـاقوت')).toBe('یاقوت');
    expect(normalizeGemstoneSearchText('كيوبيك')).toBe('کیوبیک');
    expect(normalizeGemstoneSearchText('الماس‌آزمایشگاهی')).toBe('الماس ازمایشگاهی');
    expect(normalizeGemstoneSearchText('زُمُرُّد   طبیعی')).toBe('زمرد طبیعی');
    expect(normalizeGemstoneSearchText('  DIAMOND  ')).toBe('diamond');
  });

  it('searches by name or partial name for beginner users without needing category exploration', () => {
    // 1. Searching for "اتمی" finds Cubic Zirconia directly
    const atomiResults = searchGemstoneSpecies('اتمی', allSpecies);
    expect(atomiResults.length).toBeGreaterThan(0);
    expect(atomiResults.some((s) => s.id === 'cubic_zirconia')).toBe(true);

    // 2. Searching for "برلیان" finds Natural Diamond and CZ simulant
    const brilliantResults = searchGemstoneSpecies('برلیان', allSpecies);
    expect(brilliantResults.length).toBeGreaterThan(0);
    expect(brilliantResults[0].id).toBe('diamond');

    // 3. Searching for "زمرد" finds Natural Emerald at top rank
    const emeraldResults = searchGemstoneSpecies('زمرد', allSpecies);
    expect(emeraldResults.length).toBeGreaterThan(0);
    expect(emeraldResults[0].id).toBe('beryl_emerald');

    // 4. Searching for "یاقوت سرخ" finds Ruby
    const rubyResults = searchGemstoneSpecies('یاقوت سرخ', allSpecies);
    expect(rubyResults.length).toBeGreaterThan(0);
    expect(rubyResults.some((s) => s.id === 'corundum_ruby')).toBe(true);

    // 5. Searching for "یاقوت کبود" finds Sapphire
    const sapphireResults = searchGemstoneSpecies('یاقوت کبود', allSpecies);
    expect(sapphireResults.length).toBeGreaterThan(0);
    expect(sapphireResults.some((s) => s.id === 'corundum_sapphire')).toBe(true);

    // 6. Searching for "موزانایت" finds Synthetic and Simulant Moissanite
    const moissaniteResults = searchGemstoneSpecies('موزانایت', allSpecies);
    expect(moissaniteResults.length).toBeGreaterThan(0);
    expect(moissaniteResults.some((s) => s.id.includes('moissanite'))).toBe(true);

    // 7. Searching for "cvd" or "CVD" finds Lab-Grown CVD diamond
    const cvdResults = searchGemstoneSpecies('cvd', allSpecies);
    expect(cvdResults.length).toBeGreaterThan(0);
    expect(cvdResults.some((s) => s.id === 'lab_diamond_cvd')).toBe(true);

    // 8. Searching for "نیشابور" finds Turquoise
    const neyshaburResults = searchGemstoneSpecies('نیشابور', allSpecies);
    expect(neyshaburResults.length).toBeGreaterThan(0);
    expect(neyshaburResults[0].id).toBe('turquoise');

    // 9. Searching for "سونگی" finds Songea Ruby
    const songeaResults = searchGemstoneSpecies('سونگی', allSpecies);
    expect(songeaResults.length).toBeGreaterThan(0);
    expect(songeaResults[0].id).toBe('corundum_ruby_songea');

    // 10. Searching for "لندن" or "لندن بلو" finds London Blue Topaz
    const londonResults = searchGemstoneSpecies('لندن بلو', allSpecies);
    expect(londonResults.length).toBeGreaterThan(0);
    expect(londonResults[0].id).toBe('topaz_london_blue');
  });

  it('supports partial substring searches for beginner ease', () => {
    // "زمر" should match "زمرد"
    const partialZomorrod = searchGemstoneSpecies('زمر', allSpecies);
    expect(partialZomorrod.length).toBeGreaterThan(0);
    expect(partialZomorrod.some((s) => s.id === 'beryl_emerald')).toBe(true);

    // "یاق" should match "یاقوت"
    const partialYaqoot = searchGemstoneSpecies('یاق', allSpecies);
    expect(partialYaqoot.length).toBeGreaterThan(0);
    expect(partialYaqoot.some((s) => s.id === 'corundum_ruby')).toBe(true);

    // "فیر" should match "فیروزه"
    const partialFiroozeh = searchGemstoneSpecies('فیر', allSpecies);
    expect(partialFiroozeh.length).toBeGreaterThan(0);
    expect(partialFiroozeh.some((s) => s.id === 'turquoise')).toBe(true);

    // "الکسان" should match "الکساندریت"
    const partialAlex = searchGemstoneSpecies('الکسان', allSpecies);
    expect(partialAlex.length).toBeGreaterThan(0);
    expect(partialAlex.some((s) => s.id === 'chrysoberyl_alexandrite')).toBe(true);
  });

  it('supports English search terms (ruby, sapphire, emerald, diamond, moissanite, opal)', () => {
    expect(searchGemstoneSpecies('ruby', allSpecies).some((s) => s.id === 'corundum_ruby')).toBe(true);
    expect(searchGemstoneSpecies('sapphire', allSpecies).some((s) => s.id === 'corundum_sapphire')).toBe(true);
    expect(searchGemstoneSpecies('emerald', allSpecies).some((s) => s.id === 'beryl_emerald')).toBe(true);
    expect(searchGemstoneSpecies('diamond', allSpecies).some((s) => s.id === 'diamond')).toBe(true);
    expect(searchGemstoneSpecies('opal', allSpecies).some((s) => s.id === 'opal')).toBe(true);
  });

  it('provides a curated popular list for beginner empty-search state', () => {
    expect(POPULAR_BEGINNER_GEMSTONES.length).toBeGreaterThanOrEqual(8);
    expect(POPULAR_BEGINNER_GEMSTONES).toContain('diamond');
    expect(POPULAR_BEGINNER_GEMSTONES).toContain('cubic_zirconia');
    expect(POPULAR_BEGINNER_GEMSTONES).toContain('corundum_ruby');
    expect(POPULAR_BEGINNER_GEMSTONES).toContain('corundum_sapphire');
    expect(POPULAR_BEGINNER_GEMSTONES).toContain('beryl_emerald');
  });

  it('validates that StoneTab includes the beginner search section and imports GemstoneQuickSearch', () => {
    const stoneTabPath = path.resolve(__dirname, '../features/accounting/documents/components/StoneTab.tsx');
    const content = fs.readFileSync(stoneTabPath, 'utf8');

    expect(content).toContain('GemstoneQuickSearch');
    expect(content).toContain('جستجوی هوشمند و سریع');
    expect(content).toContain('selectedSpeciesId={species}');
    expect(content).toContain('onSelectSpecies');
  });

  it('validates that InitialGemstoneInventoryModal includes GemstoneQuickSearch', () => {
    const modalPath = path.resolve(__dirname, '../features/gemstones/components/InitialGemstoneInventoryModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    expect(content).toContain('GemstoneQuickSearch');
    expect(content).toContain('selectedSpeciesId={species}');
    expect(content).toContain('onSelectSpecies');
  });
});
