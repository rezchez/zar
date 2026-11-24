import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { getLatestMarketQuotes } from '@/lib/price-api';
import { STANDARD_COINS, getCoinDisplayPersianName } from '@/features/coins/services/coin';
import { DEFAULT_BASE_KARATS, metalAtBaseKarat, roundWeight } from '@/lib/weight';

export const dynamic = 'force-dynamic';

export interface StorageLocationSummary {
  id: string;
  name: string;
  code?: string;
  goldWeight750: number;
  totalItemsCount: number;
  estimatedValuationRial: number;
}

export async function GET(request: NextRequest) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.view') &&
    !hasPermission(context.user, 'document.manage') &&
    !hasPermission(context.user, 'transaction.view') &&
    context.user.role !== 'admin'
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به گزارش موجودی انبار.' }, { status: 403 });
  }

  let client = context.pb;
  try {
    const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
    const servicePb = await getPocketBaseServiceClient();
    if (servicePb) client = servicePb;
  } catch {}

  client.autoCancellation?.(false);

  const { searchParams } = new URL(request.url);
  const locationFilter = searchParams.get('location') || '';
  const searchFilter = (searchParams.get('search') || '').trim().toLowerCase();

  try {
    // 1. Fetch Storage Locations
    const locationsRecords = await client
      .collection('storage_locations')
      .getFullList({ filter: 'is_active = true', sort: 'sort_order,created' })
      .catch(() => []);

    const storageLocations = locationsRecords.map((r) => ({
      id: r.id,
      name: String(r.name || ''),
      code: String(r.code || ''),
    }));

    // 2. Fetch Metal Inventory Records (Melted, Scrap, Conditional, Silver, Platinum)
    const metalRecords = await client
      .collection('metal_inventory')
      .getFullList({
        filter: 'is_deleted = false',
        sort: '-date,-created',
      })
      .catch(() => []);

    // 3. Fetch Coin Inventory Records
    const coinRecords = await client
      .collection('coin_inventory')
      .getFullList({
        filter: 'is_deleted = false',
        sort: '-date,-created',
      })
      .catch(() => []);

    // 4. Fetch Etiquettes (Showcase & Manufactured Jewelry)
    const etiquetteRecords = await client
      .collection('etiquettes')
      .getFullList({
        filter: 'is_deleted = false',
        sort: '-created',
      })
      .catch(() => []);

    // 5. Fetch Gemstone Inventory
    const gemstoneRecords = await client
      .collection('gemstone_inventory')
      .getFullList({
        filter: 'is_deleted = false',
        sort: '-created',
      })
      .catch(() => []);

    // 6. Fetch Goods Inventory (Workshop & Casting Supplies)
    const goodsRecords = await client
      .collection('goods_inventory')
      .getFullList({
        filter: 'is_deleted = false',
        sort: '-created',
      })
      .catch(() => []);

    // 7. Fetch Latest Market Quotes
    let marketQuotes = await getLatestMarketQuotes(client).catch(() => []);
    let goldGram18PriceRial = 0;
    let goldMesghalPriceRial = 0;

    for (const quote of marketQuotes) {
      const sym = (quote.symbol || '').toUpperCase();
      const title = (quote.title || '').toLowerCase();
      if (sym === 'GERAM_18' || sym === 'GOLD_18K' || title.includes('گرمی ۱۸') || title.includes('گرم 18')) {
        goldGram18PriceRial = quote.price || 0;
      }
      if (sym === 'MESGHAL' || sym === 'GOLD_MESGHAL' || title.includes('مثقال')) {
        goldMesghalPriceRial = quote.price || 0;
      }
    }

    // Fallback if 18k price is derived from Mesghal: 1 Mesghal (17 karat / 705) -> 18k gram = Mesghal / 4.3318
    if (goldGram18PriceRial === 0 && goldMesghalPriceRial > 0) {
      goldGram18PriceRial = Math.round(goldMesghalPriceRial / 4.3318);
    } else if (goldMesghalPriceRial === 0 && goldGram18PriceRial > 0) {
      goldMesghalPriceRial = Math.round(goldGram18PriceRial * 4.3318);
    }

    // Default fallback estimation if no price api is synced yet (reasonable market level)
    if (goldGram18PriceRial === 0) {
      goldGram18PriceRial = 45000000; // 4.5M Toman = 45M Rial default baseline
      goldMesghalPriceRial = Math.round(goldGram18PriceRial * 4.3318);
    }

    // --- Process Metals ---
    const meltedItems: Array<{
      id: string;
      metal: string;
      inventoryType: string;
      labName: string;
      stampNumber: string;
      rawWeight: number;
      purity: number;
      baseKarat: number;
      convertedWeight: number;
      mesghal17: number;
      mesghal18: number;
      unitPrice: number;
      totalAmount: number;
      date: string;
      description: string;
      storageLocation: string;
      isOpeningBalance: boolean;
      estimatedMarketValueRial: number;
    }> = [];

    const scrapItems: typeof meltedItems = [];
    const conditionalItems: typeof meltedItems = [];
    const otherMetalsItems: typeof meltedItems = [];

    let totalMeltedRawWeight = 0;
    let totalMeltedConverted750 = 0;
    let totalScrapRawWeight = 0;
    let totalScrapConverted750 = 0;
    let totalConditionalRawWeight = 0;
    let totalConditionalConverted750 = 0;
    let totalSilverRawWeight = 0;
    let totalSilverConverted = 0;
    let totalPlatinumRawWeight = 0;
    let totalPlatinumConverted = 0;

    for (const rec of metalRecords) {
      const metal = String(rec.metal || 'gold').toLowerCase();
      const invType = String(rec.inventory_type || 'melted').toLowerCase();
      const direction = String(rec.direction || 'in').toLowerCase();
      const sign = direction === 'out' ? -1 : 1;

      const rawWeight = roundWeight(Number(rec.raw_weight || 0) * sign, 3);
      const purity = Number(rec.purity || (metal === 'gold' ? 750 : metal === 'silver' ? 999 : 950));
      const baseKarat = Number(rec.base_karat || (metal === 'gold' ? 750 : metal === 'silver' ? 999 : 950));
      const convertedWeight = roundWeight(metalAtBaseKarat(rawWeight, purity, baseKarat, 3), 3);

      const mesghal18 = roundWeight(convertedWeight / 4.6083, 4);
      const mesghal17 = roundWeight((convertedWeight / 4.6083) * (750 / 705), 4);
      const estimatedMarketValueRial = metal === 'gold' ? Math.round(convertedWeight * goldGram18PriceRial) : 0;

      const itemObj = {
        id: rec.id,
        metal,
        inventoryType: invType,
        labName: String(rec.lab_name || ''),
        stampNumber: String(rec.stamp_number || ''),
        rawWeight,
        purity,
        baseKarat,
        convertedWeight,
        mesghal17,
        mesghal18,
        unitPrice: Number(rec.unit_price || 0),
        totalAmount: Number(rec.total_amount || 0),
        date: String(rec.date || ''),
        description: String(rec.description || ''),
        storageLocation: String(rec.storage_location || 'گاوصندوق اصلی'),
        isOpeningBalance: Boolean(rec.is_opening_balance),
        estimatedMarketValueRial,
      };

      if (metal === 'gold') {
        if (invType === 'melted' || invType === 'miscellaneous_melted' || invType === 'general_metal') {
          meltedItems.push(itemObj);
          totalMeltedRawWeight = roundWeight(totalMeltedRawWeight + rawWeight, 3);
          totalMeltedConverted750 = roundWeight(totalMeltedConverted750 + convertedWeight, 3);
        } else if (invType === 'conditional' || invType === 'conditional_melted') {
          conditionalItems.push(itemObj);
          totalConditionalRawWeight = roundWeight(totalConditionalRawWeight + rawWeight, 3);
          totalConditionalConverted750 = roundWeight(totalConditionalConverted750 + convertedWeight, 3);
        } else {
          // scrap / miscellaneous / sowaleh
          scrapItems.push(itemObj);
          totalScrapRawWeight = roundWeight(totalScrapRawWeight + rawWeight, 3);
          totalScrapConverted750 = roundWeight(totalScrapConverted750 + convertedWeight, 3);
        }
      } else if (metal === 'silver') {
        otherMetalsItems.push(itemObj);
        totalSilverRawWeight = roundWeight(totalSilverRawWeight + rawWeight, 3);
        totalSilverConverted = roundWeight(totalSilverConverted + convertedWeight, 3);
      } else if (metal === 'platinum') {
        otherMetalsItems.push(itemObj);
        totalPlatinumRawWeight = roundWeight(totalPlatinumRawWeight + rawWeight, 3);
        totalPlatinumConverted = roundWeight(totalPlatinumConverted + convertedWeight, 3);
      }
    }

    // --- Process Coins & Bullion ---
    // Group coins by item_name / nature to obtain net quantities and weights
    const coinGroups = new Map<string, {
      itemName: string;
      nature: string;
      metal: string;
      unitWeight: number;
      purity: number;
      quantity: number;
      totalWeight: number;
      convertedWeight750: number;
      unitPrice: number;
      totalValuationRial: number;
      storageLocation: string;
      items: Array<Record<string, unknown>>;
    }>();

    for (const rec of coinRecords) {
      const rawName = String(rec.item_name || rec.nature || 'سکه');
      const nature = String(rec.nature || 'bank_coin');
      const metal = String(rec.metal || 'gold').toLowerCase();
      const unitWeight = Number(rec.unit_weight || 0);
      const purity = Number(rec.purity || (nature === 'parsian' ? 750 : 900));
      const direction = String(rec.direction || 'in').toLowerCase();
      const qtySign = direction === 'out' ? -1 : 1;
      const qty = Number(rec.quantity || 0) * qtySign;
      const unitPrice = Number(rec.unit_price || 0);
      const location = String(rec.storage_location || 'گاوصندوق مسکوکات');

      const key = `${rawName}__${purity}__${unitWeight}__${location}`;

      if (!coinGroups.has(key)) {
        coinGroups.set(key, {
          itemName: rawName,
          nature,
          metal,
          unitWeight,
          purity,
          quantity: 0,
          totalWeight: 0,
          convertedWeight750: 0,
          unitPrice,
          totalValuationRial: 0,
          storageLocation: location,
          items: [],
        });
      }

      const group = coinGroups.get(key)!;
      group.quantity += qty;
      group.items.push(rec as unknown as Record<string, unknown>);
    }

    // Recompute totals for coin groups
    const coinsSummaryList: Array<{
      key: string;
      itemName: string;
      persianName: string;
      nature: string;
      metal: string;
      quantity: number;
      unitWeight: number;
      totalWeight: number;
      purity: number;
      convertedWeight750: number;
      mesghal18: number;
      unitPrice: number;
      totalValuationRial: number;
      storageLocation: string;
    }> = [];

    let totalCoinsCount = 0;
    let totalCoinsWeight = 0;
    let totalCoinsConverted750 = 0;
    let totalCoinsValuationRial = 0;

    for (const [key, group] of coinGroups.entries()) {
      // Only include groups with positive or non-zero stock
      if (group.quantity === 0) continue;

      const totalWeight = roundWeight(group.quantity * group.unitWeight, 3);
      const converted750 = group.metal === 'gold'
        ? roundWeight(metalAtBaseKarat(totalWeight, group.purity, 750, 3), 3)
        : 0;

      // Estimate coin market price: check if quote exists for coin type, or fallback to pure gold value + standard minting premium
      let estimatedUnitPrice = group.unitPrice;
      if (estimatedUnitPrice === 0 && group.metal === 'gold') {
        const coinPureGoldValue = Math.round(converted750 / (group.quantity || 1) * goldGram18PriceRial);
        // Add typical minting hubag/premium for coins
        estimatedUnitPrice = Math.round(coinPureGoldValue * 1.15);
      }

      const totalValuation = Math.round(group.quantity * estimatedUnitPrice);

      totalCoinsCount += group.quantity;
      totalCoinsWeight = roundWeight(totalCoinsWeight + totalWeight, 3);
      totalCoinsConverted750 = roundWeight(totalCoinsConverted750 + converted750, 3);
      totalCoinsValuationRial += totalValuation;

      const persianName = getCoinDisplayPersianName(undefined, group.itemName) || group.itemName;

      coinsSummaryList.push({
        key,
        itemName: group.itemName,
        persianName,
        nature: group.nature,
        metal: group.metal,
        quantity: group.quantity,
        unitWeight: group.unitWeight,
        totalWeight,
        purity: group.purity,
        convertedWeight750: converted750,
        mesghal18: roundWeight(converted750 / 4.6083, 4),
        unitPrice: estimatedUnitPrice,
        totalValuationRial: totalValuation,
        storageLocation: group.storageLocation,
      });
    }

    // --- Process Etiquettes (Showcase Jewelry) ---
    const etiquetteItems: Array<{
      id: string;
      barcode: string;
      title: string;
      itemCode: string;
      metal: string;
      purity: number;
      totalWeight: number;
      stoneWeight: number;
      netWeight: number;
      convertedWeight750: number;
      mesghal18: number;
      stoneCount: number;
      stonePrice: number;
      wage: number;
      wageType: string;
      profitPercentage: number;
      otherCosts: number;
      totalPrice: number;
      storageLocation: string;
      status: string;
      quantity: number;
    }> = [];

    let totalEtiquettePieces = 0;
    let totalEtiquetteGrossWeight = 0;
    let totalEtiquetteStoneWeight = 0;
    let totalEtiquetteNetWeight = 0;
    let totalEtiquetteConverted750 = 0;
    let totalEtiquetteValuationRial = 0;

    for (const rec of etiquetteRecords) {
      const status = String(rec.status || 'in_stock').toLowerCase();
      // Only items currently in stock participate in active inventory
      if (status !== 'in_stock' && status !== 'available') continue;

      const totalWeight = Number(rec.total_weight || 0);
      const stoneWeight = Number(rec.stone_weight || 0);
      const netWeight = Number(rec.net_weight ?? Math.max(0, totalWeight - stoneWeight));
      const purity = Number(rec.purity || 750);
      const converted750 = roundWeight(metalAtBaseKarat(netWeight, purity, 750, 3), 3);
      const mesghal18 = roundWeight(converted750 / 4.6083, 4);
      const totalPrice = Number(rec.total_price || 0);
      const qty = Number(rec.quantity || 1);

      totalEtiquettePieces += qty;
      totalEtiquetteGrossWeight = roundWeight(totalEtiquetteGrossWeight + totalWeight, 3);
      totalEtiquetteStoneWeight = roundWeight(totalEtiquetteStoneWeight + stoneWeight, 3);
      totalEtiquetteNetWeight = roundWeight(totalEtiquetteNetWeight + netWeight, 3);
      totalEtiquetteConverted750 = roundWeight(totalEtiquetteConverted750 + converted750, 3);
      totalEtiquetteValuationRial += totalPrice > 0 ? totalPrice : Math.round(converted750 * goldGram18PriceRial);

      etiquetteItems.push({
        id: rec.id,
        barcode: String(rec.barcode || ''),
        title: String(rec.title || 'مصنوع طلا'),
        itemCode: String(rec.item_code || ''),
        metal: String(rec.metal || 'gold'),
        purity,
        totalWeight,
        stoneWeight,
        netWeight,
        convertedWeight750: converted750,
        mesghal18,
        stoneCount: Number(rec.stone_count || 0),
        stonePrice: Number(rec.stone_price || 0),
        wage: Number(rec.wage || 0),
        wageType: String(rec.wage_type || 'per_gram'),
        profitPercentage: Number(rec.profit_percentage || 0),
        otherCosts: Number(rec.other_costs || 0),
        totalPrice,
        storageLocation: String(rec.storage_location || 'ویترین اصلی'),
        status,
        quantity: qty,
      });
    }

    // --- Process Gemstones ---
    const gemstoneItems: Array<{
      id: string;
      inventoryCode: string;
      tradeName: string;
      category: string;
      inventoryMode: string;
      quantity: number;
      weightCt: number;
      weightG: number;
      storageLocation: string;
      valuationAmount: number;
    }> = [];

    let totalGemstonePieces = 0;
    let totalGemstoneCarats = 0;
    let totalGemstoneGrams = 0;
    let totalGemstonesValuationRial = 0;

    for (const rec of gemstoneRecords) {
      const qty = Number(rec.quantity || 1);
      const weightCt = Number(rec.weight_ct || 0);
      const weightG = Number(rec.weight_g || (weightCt * 0.2));
      const val = Number(rec.valuation_amount || 0);

      totalGemstonePieces += qty;
      totalGemstoneCarats = roundWeight(totalGemstoneCarats + weightCt, 3);
      totalGemstoneGrams = roundWeight(totalGemstoneGrams + weightG, 3);
      totalGemstonesValuationRial += val;

      gemstoneItems.push({
        id: rec.id,
        inventoryCode: String(rec.inventory_code || ''),
        tradeName: String(rec.trade_name || rec.species || 'سنگ قیمتی'),
        category: String(rec.category || 'diamond'),
        inventoryMode: String(rec.inventory_mode || 'single'),
        quantity: qty,
        weightCt,
        weightG,
        storageLocation: String(rec.storage_location || 'گاوصندوق سنگ'),
        valuationAmount: val,
      });
    }

    // --- Process Workshop & Goods Supplies ---
    const goodsItems: Array<{
      id: string;
      itemName: string;
      category: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalAmount: number;
      storageLocation: string;
      sku: string;
    }> = [];

    let totalGoodsValuationRial = 0;

    for (const rec of goodsRecords) {
      const qty = Number(rec.quantity || 0);
      const unitPrice = Number(rec.unit_price || 0);
      const totalAmount = Number(rec.total_amount || (qty * unitPrice));

      totalGoodsValuationRial += totalAmount;

      goodsItems.push({
        id: rec.id,
        itemName: String(rec.item_name || 'کالا'),
        category: String(rec.category || 'general_goods'),
        quantity: qty,
        unit: String(rec.unit || 'عدد'),
        unitPrice,
        totalAmount,
        storageLocation: String(rec.storage_location || 'انبار کارگاه'),
        sku: String(rec.sku || ''),
      });
    }

    // --- Grand Totals & Iranian Gold Market Balances ---
    // Total 18k Pure Gold in the whole inventory (Melted + Scrap + Conditional + Showcase + Coins)
    const grandTotalGoldConverted750 = roundWeight(
      totalMeltedConverted750 +
      totalScrapConverted750 +
      totalConditionalConverted750 +
      totalEtiquetteConverted750 +
      totalCoinsConverted750,
      3
    );

    const grandTotalGoldMesghal18 = roundWeight(grandTotalGoldConverted750 / 4.6083, 4);
    const grandTotalGoldMesghal17 = roundWeight((grandTotalGoldConverted750 / 4.6083) * (750 / 705), 4);

    // Total Financial Market Valuation
    const totalGoldMarketValueRial = Math.round(grandTotalGoldConverted750 * goldGram18PriceRial);
    const grandTotalInventoryValuationRial =
      totalGoldMarketValueRial +
      totalCoinsValuationRial +
      totalGemstonesValuationRial +
      totalGoodsValuationRial;

    // --- Breakdown by Storage Locations ---
    const locationMap = new Map<string, StorageLocationSummary>();

    // Seed defined storage locations
    for (const loc of storageLocations) {
      locationMap.set(loc.name, {
        id: loc.id,
        name: loc.name,
        code: loc.code,
        goldWeight750: 0,
        totalItemsCount: 0,
        estimatedValuationRial: 0,
      });
    }

    // Helper to add to location
    const addToLocation = (locName: string, gold750: number, valueRial: number) => {
      const name = locName || 'مرکز نامشخص';
      if (!locationMap.has(name)) {
        locationMap.set(name, {
          id: `loc_${name}`,
          name,
          goldWeight750: 0,
          totalItemsCount: 0,
          estimatedValuationRial: 0,
        });
      }
      const item = locationMap.get(name)!;
      item.goldWeight750 = roundWeight(item.goldWeight750 + gold750, 3);
      item.totalItemsCount += 1;
      item.estimatedValuationRial += valueRial;
    };

    meltedItems.forEach((i) => addToLocation(i.storageLocation, i.convertedWeight, i.estimatedMarketValueRial));
    scrapItems.forEach((i) => addToLocation(i.storageLocation, i.convertedWeight, i.estimatedMarketValueRial));
    conditionalItems.forEach((i) => addToLocation(i.storageLocation, i.convertedWeight, i.estimatedMarketValueRial));
    coinsSummaryList.forEach((i) => addToLocation(i.storageLocation, i.convertedWeight750, i.totalValuationRial));
    etiquetteItems.forEach((i) => addToLocation(i.storageLocation, i.convertedWeight750, i.totalPrice));
    gemstoneItems.forEach((i) => addToLocation(i.storageLocation, 0, i.valuationAmount));
    goodsItems.forEach((i) => addToLocation(i.storageLocation, 0, i.totalAmount));

    const storageBreakdown = Array.from(locationMap.values()).filter(
      (loc) => loc.totalItemsCount > 0 || loc.goldWeight750 > 0 || loc.estimatedValuationRial > 0
    );

    return NextResponse.json({
      success: true,
      rates: {
        goldGram18PriceRial,
        goldMesghalPriceRial,
        lastUpdated: new Date().toISOString(),
      },
      summary: {
        grandTotalGoldConverted750,
        grandTotalGoldMesghal18,
        grandTotalGoldMesghal17,
        grandTotalInventoryValuationRial,
        grandTotalInventoryValuationToman: Math.floor(grandTotalInventoryValuationRial / 10),

        // Sub-totals
        melted: {
          rawWeight: totalMeltedRawWeight,
          converted750: totalMeltedConverted750,
          mesghal18: roundWeight(totalMeltedConverted750 / 4.6083, 4),
          piecesCount: meltedItems.length,
          valuationRial: Math.round(totalMeltedConverted750 * goldGram18PriceRial),
        },
        scrap: {
          rawWeight: totalScrapRawWeight,
          converted750: totalScrapConverted750,
          mesghal18: roundWeight(totalScrapConverted750 / 4.6083, 4),
          piecesCount: scrapItems.length,
          valuationRial: Math.round(totalScrapConverted750 * goldGram18PriceRial),
        },
        conditional: {
          rawWeight: totalConditionalRawWeight,
          converted750: totalConditionalConverted750,
          mesghal18: roundWeight(totalConditionalConverted750 / 4.6083, 4),
          piecesCount: conditionalItems.length,
          valuationRial: Math.round(totalConditionalConverted750 * goldGram18PriceRial),
        },
        coins: {
          piecesCount: totalCoinsCount,
          totalWeight: totalCoinsWeight,
          converted750: totalCoinsConverted750,
          mesghal18: roundWeight(totalCoinsConverted750 / 4.6083, 4),
          valuationRial: totalCoinsValuationRial,
        },
        etiquettes: {
          piecesCount: totalEtiquettePieces,
          grossWeight: totalEtiquetteGrossWeight,
          stoneWeight: totalEtiquetteStoneWeight,
          netGoldWeight: totalEtiquetteNetWeight,
          converted750: totalEtiquetteConverted750,
          mesghal18: roundWeight(totalEtiquetteConverted750 / 4.6083, 4),
          valuationRial: totalEtiquetteValuationRial,
        },
        gemstones: {
          piecesCount: totalGemstonePieces,
          totalCarats: totalGemstoneCarats,
          totalGrams: totalGemstoneGrams,
          valuationRial: totalGemstonesValuationRial,
        },
        otherMetals: {
          silverRawWeight: totalSilverRawWeight,
          silverConverted: totalSilverConverted,
          platinumRawWeight: totalPlatinumRawWeight,
          platinumConverted: totalPlatinumConverted,
        },
        goods: {
          itemsCount: goodsItems.length,
          valuationRial: totalGoodsValuationRial,
        },
      },
      data: {
        melted: meltedItems,
        scrap: scrapItems,
        conditional: conditionalItems,
        coins: coinsSummaryList,
        etiquettes: etiquetteItems,
        gemstones: gemstoneItems,
        otherMetals: otherMetalsItems,
        goods: goodsItems,
        storageBreakdown,
      },
    });
  } catch (error) {
    console.error('Error generating gold & jewelry inventory report:', error);
    return NextResponse.json(
      { message: 'خطا در محاسبه و تولید گزارش جامع موجودی انبار طلا و جواهر.' },
      { status: 500 }
    );
  }
}
