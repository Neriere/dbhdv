import * as XLSX from "xlsx";
import { BYC_LEGENDARY_HUNTS, BycHuntData, BycEquipmentItem, BycRecipeIngredient } from "../data/bycDatabase";
import { ItemSalesVolume, SalesVolumeMap } from "./salesVolumeService";

export interface BycExportOptions {
  playersCount?: number;
  sebuscalinPrice?: number;
  marketTaxRate?: number;
  marketPrices?: Record<number, number>;
  salesVolumeMap?: SalesVolumeMap;
}

const ZONE_ORDER = [
  "Astrub",
  "Castillo de Amakna",
  "Frigost I",
  "Frigost II",
  "Frigost III",
  "Dimensiones Divinas y Especiales",
];

function normalizeZone(cat: string): string {
  if (cat === "Astrub") return "Astrub";
  if (cat === "Castillo de Amakna") return "Castillo de Amakna";
  if (cat === "Frigost I") return "Frigost I";
  if (cat === "Frigost II") return "Frigost II";
  if (cat === "Frigost III") return "Frigost III";
  return "Dimensiones Divinas y Especiales";
}

export function buildBycWorkbook(options: BycExportOptions = {}): XLSX.WorkBook {
  const playersCount = options.playersCount ?? 5;
  const sebuscalinPrice = options.sebuscalinPrice ?? 320;
  const marketTaxRate = options.marketTaxRate ?? 0.03;
  const marketPrices = options.marketPrices ?? {};
  const salesVolumeMap = options.salesVolumeMap ?? {};

  const getPrice = (itemId: number, defaultVal: number): number => {
    if (marketPrices[itemId] !== undefined && marketPrices[itemId] !== null) {
      return Number(marketPrices[itemId]) || 0;
    }
    return defaultVal || 0;
  };

  const getSales = (itemId: number): { s24: number; s7: number; s30: number } => {
    const vol = salesVolumeMap[itemId];
    return {
      s24: vol?.sales24h ?? 0,
      s7: vol?.sales7d ?? 0,
      s30: vol?.sales30d ?? 0,
    };
  };

  // 1. Group the 45 hunts by Zone and sort by monster level ascending
  const sortedHunts = [...BYC_LEGENDARY_HUNTS].sort((a, b) => {
    const zA = ZONE_ORDER.indexOf(normalizeZone(a.category));
    const zB = ZONE_ORDER.indexOf(normalizeZone(b.category));
    if (zA !== zB) return zA - zB;
    return a.monsterLevel - b.monsterLevel;
  });

  const wb = XLSX.utils.book_new();

  // =========================================================================
  // HOJA 1: ANALISIS_POR_BYC
  // =========================================================================
  const s1Rows: any[][] = [];

  // Row 1: Title
  s1Rows.push(["DOFUS UNITY - INVERSION COOPERATIVA EN BUSCA Y CAPTURA (45 ByCs)"]);
  // Row 2: Blank
  s1Rows.push([]);

  // Row 3: Subheader
  s1Rows.push(["PARAMETROS GLOBALES", "", "", "COTIZACIONES Y TASAS"]);
  
  // Row 4: Parameters: B4 = N (5), E4 = Kamas/Sebus (320), H4 = Tax (0.03)
  s1Rows.push([
    "N° de Jugadores en el Grupo (N):",
    playersCount,
    "",
    "Kamas por Sebuscalin:",
    sebuscalinPrice,
    "",
    "Impuesto HDV (3%):",
    marketTaxRate,
  ]);

  // Row 5: Global Summary Totals
  s1Rows.push([
    "Inversion Total Grupo Activa:",
    { f: 'SUMIF(T10:T5000, "SÍ", D10:D5000)' },
    "",
    "Inversion Total / Jugador:",
    { f: "B5/$B$4" },
    "",
    "Ganancia Neta Total Grupo:",
    { f: 'SUMIF(T10:T5000, "SÍ", L10:L5000)' },
  ]);

  // Row 6: Global Player Profit & ROI
  s1Rows.push([
    "Ganancia Neta / Jugador Activa:",
    { f: "H5/$B$4" },
    "",
    "ROI Global Ponderado:",
    { f: "IF(B5>0, H5/B5, 0)" },
  ]);

  // Row 7 & 8: Notes
  s1Rows.push([]);
  s1Rows.push(["* Nota: Cambia la celda B4 (Jugadores) o E4 (Kamas/Sebuscalin) para recalcular todo el libro al instante."]);
  s1Rows.push([]);

  // Column Headers for ByC tables
  const headerCols = [
    "Módulo / Opción",
    "Ítem / Recompensa",
    "Nivel / Tipo",
    "Costo / Inv. Grupo",
    "Inv. / Jugador",
    "Sebuscalines Grupo",
    "Valor Sebus (k)",
    "Precio Venta HDV",
    "Ingreso Neto HDV",
    "Costo Otros Ingred.",
    "Ingreso Total Pozo",
    "Beneficio Neto Grupo",
    "GANANCIA / JUGADOR",
    "ROI %",
    "Plusvalía vs Venta",
    "Ventas 24h",
    "Ventas 7d",
    "Ventas 30d",
    "Estrategia Óptima",
    "Incluir ByC",
  ];

  let currentZone = "";
  const huntRowIndexMap: Record<number, { incRow: number; rawRow: number; bestCraftRow: number }> = {};

  sortedHunts.forEach((hunt) => {
    const zone = normalizeZone(hunt.category);
    if (zone !== currentZone) {
      currentZone = zone;
      s1Rows.push([]);
      s1Rows.push([`=== ZONA: ${currentZone.toUpperCase()} ===`]);
      s1Rows.push([]);
    }

    const startRowIdx = s1Rows.length + 1; // 1-based index in Excel
    const incCellRef = `T${startRowIdx}`;

    // Section Header for this specific ByC
    s1Rows.push([
      `[ByC #${hunt.id}] ${hunt.monsterName} (Nv. ${hunt.monsterLevel}) - ${hunt.category}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Incluir en el Plan:",
      "SÍ",
    ]);

    s1Rows.push(headerCols);

    // 1. Fragments & Map calculations
    const fragsCount = hunt.fragments?.length || 4;
    const wholeMapPrice = getPrice(hunt.mapItem.id, hunt.mapItem.defaultPrice);

    const fragRowStart = s1Rows.length + 1;
    (hunt.fragments || []).forEach((f, fIdx) => {
      s1Rows.push([
        `Fragmento ${fIdx + 1}/${fragsCount}`,
        f.name,
        `Fragmento`,
        getPrice(f.id, f.defaultPrice),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        getSales(f.id).s24,
        getSales(f.id).s7,
        getSales(f.id).s30,
        "",
        { f: `${incCellRef}` },
      ]);
    });
    const fragRowEnd = s1Rows.length;

    // Sum Fragments Row
    const sumFragsRow = s1Rows.length + 1;
    s1Rows.push([
      "Subtotal Fragmentos",
      `${fragsCount} fragmentos`,
      "Cálculo",
      { f: `SUM(D${fragRowStart}:D${fragRowEnd})` },
      { f: `D${sumFragsRow}/$B$4` },
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      { f: `${incCellRef}` },
    ]);

    // Whole Map Price Row
    const wholeMapRow = s1Rows.length + 1;
    s1Rows.push([
      "Mapa Completo",
      hunt.mapItem.name,
      "Mapa ensamblado",
      wholeMapPrice,
      { f: `D${wholeMapRow}/$B$4` },
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      getSales(hunt.mapItem.id).s24,
      getSales(hunt.mapItem.id).s7,
      getSales(hunt.mapItem.id).s30,
      "",
      { f: `${incCellRef}` },
    ]);

    // Optimal Map Cost Row
    const optMapRow = s1Rows.length + 1;
    s1Rows.push([
      "Costo Óptimo Mapa (Base)",
      "Mejor adquisición",
      "Mínimo",
      { f: `MIN(D${sumFragsRow}, D${wholeMapRow})` },
      { f: `D${optMapRow}/$B$4` },
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      { f: `IF(D${sumFragsRow}<=D${wholeMapRow}, "COMPRAR FRAGMENTOS", "COMPRAR MAPA")` },
      { f: `${incCellRef}` },
    ]);

    // 2. Sebuscalines row (Chest + Quest)
    const chestSebus = hunt.chestSebuscalines || hunt.sebuscalines || 0;
    const missionSebus = hunt.missionSebuscalines || (chestSebus * 2);
    const sebusRow = s1Rows.length + 1;
    s1Rows.push([
      "Recompensa Sebuscalines",
      `Cofre (${chestSebus}) + Misión c/u (${missionSebus})`,
      "Sebuscalines",
      0,
      0,
      { f: `${chestSebus} + ($B$4 * ${missionSebus})` },
      { f: `F${sebusRow} * $E$4` },
      "",
      "",
      "",
      { f: `G${sebusRow}` },
      { f: `G${sebusRow}` },
      { f: `L${sebusRow}/$B$4` },
      "",
      "",
      "",
      "",
      "",
      "CANJE SEBUSCALINES",
      { f: `${incCellRef}` },
    ]);

    // 3. Option A: Sell Raw Resource
    const resId = hunt.resource.id;
    const resPrice = getPrice(resId, hunt.resource.defaultPrice);
    const resSales = getSales(resId);
    const rawRow = s1Rows.length + 1;

    s1Rows.push([
      "OPCIÓN A: Venta Recurso Bruto",
      hunt.resource.name,
      hunt.resource.type || "Recurso ByC",
      { f: `D${optMapRow}` },
      { f: `D${rawRow}/$B$4` },
      { f: `F${sebusRow}` },
      { f: `G${sebusRow}` },
      resPrice,
      { f: `H${rawRow} * (1 - $H$4)` },
      0,
      { f: `I${rawRow} + G${sebusRow}` },
      { f: `K${rawRow} - D${rawRow}` },
      { f: `L${rawRow}/$B$4` },
      { f: `IF(D${rawRow}>0, L${rawRow}/D${rawRow}, 0)` },
      0,
      resSales.s24,
      resSales.s7,
      resSales.s30,
      "BASE (VENTA RECURSO)",
      { f: `${incCellRef}` },
    ]);

    // 4. Option B: Craft Equipments (all associated recipes)
    const crafts = hunt.equipments || [];
    const craftRows: number[] = [];

    crafts.forEach((eq, eqIdx) => {
      const eqRow = s1Rows.length + 1;
      craftRows.push(eqRow);

      const eqPrice = getPrice(eq.id, eq.defaultSalePrice || 0);
      const otherIngCost = (eq.recipeIngredients || []).reduce((acc, ing) => {
        return acc + ing.quantity * getPrice(ing.id, ing.defaultPrice);
      }, 0);
      const eqSales = getSales(eq.id);

      s1Rows.push([
        `OPCIÓN B.${eqIdx + 1}: Crafteo`,
        eq.name,
        `Nv. ${eq.level} ${eq.type}`,
        { f: `D${optMapRow} + J${eqRow}` },
        { f: `D${eqRow}/$B$4` },
        { f: `F${sebusRow}` },
        { f: `G${sebusRow}` },
        eqPrice,
        { f: `H${eqRow} * (1 - $H$4)` },
        otherIngCost,
        { f: `I${eqRow} + G${sebusRow}` },
        { f: `K${eqRow} - D${eqRow}` },
        { f: `L${eqRow}/$B$4` },
        { f: `IF(D${eqRow}>0, L${eqRow}/D${eqRow}, 0)` },
        { f: `M${eqRow} - M${rawRow}` },
        eqSales.s24,
        eqSales.s7,
        eqSales.s30,
        { f: `IF(M${eqRow}>M${rawRow}, "CRAFTEAR " & B${eqRow}, "VENDER RECURSO")` },
        { f: `${incCellRef}` },
      ]);
    });

    // Best craft row index (or raw row if no crafts)
    const bestCraftRow = craftRows.length > 0 ? craftRows[0] : rawRow;
    huntRowIndexMap[hunt.id] = { incRow: startRowIdx, rawRow, bestCraftRow };

    s1Rows.push([]); // blank line between ByCs
  });

  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);

  // Set column widths for Sheet 1
  ws1["!cols"] = [
    { wch: 30 }, // A: Módulo / Opción
    { wch: 32 }, // B: Ítem
    { wch: 22 }, // C: Tipo / Nivel
    { wch: 18 }, // D: Costo Grupo
    { wch: 16 }, // E: Inv. Jugador
    { wch: 16 }, // F: Sebus Grupo
    { wch: 16 }, // G: Valor Sebus
    { wch: 16 }, // H: Precio HDV
    { wch: 16 }, // I: Ingreso Neto
    { wch: 18 }, // J: Costo Otros
    { wch: 18 }, // K: Ingreso Pozo
    { wch: 18 }, // L: Beneficio Grupo
    { wch: 18 }, // M: GANANCIA JUGADOR
    { wch: 12 }, // N: ROI %
    { wch: 16 }, // O: Plusvalía
    { wch: 12 }, // P: 24h
    { wch: 12 }, // Q: 7d
    { wch: 12 }, // R: 30d
    { wch: 28 }, // S: Estrategia
    { wch: 14 }, // T: Incluir ByC
  ];

  XLSX.utils.book_append_sheet(wb, ws1, "ANALISIS_POR_BYC");

  // =========================================================================
  // HOJA 2: RESUMEN_EJECUTIVO_RANKING
  // =========================================================================
  const s2Rows: any[][] = [];

  s2Rows.push(["RESUMEN EJECUTIVO Y RANKING COMPARATIVO (45 ByCs)"]);
  s2Rows.push(["* Usa la columna 'Incluir' para activar o desactivar cacerías del cálculo global."]);
  s2Rows.push([]);

  const rankHeader = [
    "Incluir",
    "Zona",
    "Monstruo ByC",
    "Nivel",
    "N° Frags",
    "Recurso ByC",
    "Inv. / Jugador (Venta)",
    "Ganancia / Jug. (Venta)",
    "ROI % (Venta)",
    "Mejor Equipable",
    "Inv. / Jugador (Crafteo)",
    "Ganancia / Jug. (Crafteo)",
    "ROI % (Crafteo)",
    "Plusvalía Crafteo",
    "Estrategia Recomendada",
    "Ventas Recurso (24h/7d/30d)",
    "Ventas Equipo (24h/7d/30d)",
  ];
  s2Rows.push(rankHeader);

  sortedHunts.forEach((hunt) => {
    const mapInfo = huntRowIndexMap[hunt.id];
    const rawR = mapInfo ? mapInfo.rawRow : 10;
    const craftR = mapInfo ? mapInfo.bestCraftRow : 11;
    const incR = mapInfo ? mapInfo.incRow : 10;
    const resSales = getSales(hunt.resource.id);
    const bestEq = (hunt.equipments && hunt.equipments.length > 0) ? hunt.equipments[0] : null;
    const eqSales = bestEq ? getSales(bestEq.id) : { s24: 0, s7: 0, s30: 0 };

    s2Rows.push([
      { f: `ANALISIS_POR_BYC!T${incR}` },
      normalizeZone(hunt.category),
      hunt.monsterName,
      hunt.monsterLevel,
      hunt.fragments?.length || 4,
      hunt.resource.name,
      { f: `ANALISIS_POR_BYC!E${rawR}` },
      { f: `ANALISIS_POR_BYC!M${rawR}` },
      { f: `ANALISIS_POR_BYC!N${rawR}` },
      bestEq ? bestEq.name : "N/A",
      { f: `ANALISIS_POR_BYC!E${craftR}` },
      { f: `ANALISIS_POR_BYC!M${craftR}` },
      { f: `ANALISIS_POR_BYC!N${craftR}` },
      { f: `ANALISIS_POR_BYC!O${craftR}` },
      { f: `ANALISIS_POR_BYC!S${craftR}` },
      `${resSales.s24} / ${resSales.s7} / ${resSales.s30}`,
      `${eqSales.s24} / ${eqSales.s7} / ${eqSales.s30}`,
    ]);
  });

  // Totals Row at the bottom of Sheet 2
  const rankStartRow = 5;
  const rankEndRow = s2Rows.length;
  const totRow = rankEndRow + 2;

  s2Rows.push([]);
  s2Rows.push([
    "TOTALES ACTIVOS",
    "",
    "Suma de ítems incluidos (SÍ)",
    "",
    "",
    "",
    { f: `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", G${rankStartRow}:G${rankEndRow})` },
    { f: `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", H${rankStartRow}:H${rankEndRow})` },
    { f: `IF(G${totRow}>0, H${totRow}/G${totRow}, 0)` },
    "",
    { f: `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", K${rankStartRow}:K${rankEndRow})` },
    { f: `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", L${rankStartRow}:L${rankEndRow})` },
    { f: `IF(K${totRow}>0, L${totRow}/K${totRow}, 0)` },
    { f: `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", N${rankStartRow}:N${rankEndRow})` },
    "PLAN GENERAL",
    "",
    "",
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(s2Rows);
  ws2["!cols"] = [
    { wch: 10 }, // Incluir
    { wch: 22 }, // Zona
    { wch: 26 }, // Monstruo
    { wch: 8 },  // Nivel
    { wch: 10 }, // Frags
    { wch: 26 }, // Recurso
    { wch: 18 }, // Inv Venta
    { wch: 18 }, // Ganancia Venta
    { wch: 12 }, // ROI Venta
    { wch: 26 }, // Mejor Equipable
    { wch: 18 }, // Inv Crafteo
    { wch: 18 }, // Ganancia Crafteo
    { wch: 12 }, // ROI Crafteo
    { wch: 16 }, // Plusvalía
    { wch: 28 }, // Estrategia
    { wch: 18 }, // Ventas Recurso
    { wch: 18 }, // Ventas Equipo
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "RESUMEN_EJECUTIVO_RANKING");

  // =========================================================================
  // HOJA 3: DETALLE_RECETAS_MATERIALES
  // =========================================================================
  const s3Rows: any[][] = [];

  s3Rows.push(["CATÁLOGO DE RECETAS Y MATERIALES ASOCIADOS A BYC (152 EQUIPABLES)"]);
  s3Rows.push(["* Desglose de materiales secundarios requeridos para craftear cada equipable."]);
  s3Rows.push([]);

  const rHead = [
    "Monstruo ByC",
    "Zona",
    "Nivel ByC",
    "Equipo Crafteable",
    "Nivel Equipo",
    "Tipo Equipo",
    "Precio Venta HDV",
    "Ingrediente Secundario",
    "Cantidad",
    "Precio Unitario HDV",
    "Subtotal Material",
  ];
  s3Rows.push(rHead);

  sortedHunts.forEach((hunt) => {
    (hunt.equipments || []).forEach((eq) => {
      const eqPrice = getPrice(eq.id, eq.defaultSalePrice || 0);
      const ingredients = eq.recipeIngredients || [];

      ingredients.forEach((ing, iIdx) => {
        const uPrice = getPrice(ing.id, ing.defaultPrice || 0);
        const startR = s3Rows.length + 1;
        s3Rows.push([
          iIdx === 0 ? hunt.monsterName : "",
          iIdx === 0 ? normalizeZone(hunt.category) : "",
          iIdx === 0 ? hunt.monsterLevel : "",
          iIdx === 0 ? eq.name : "",
          iIdx === 0 ? eq.level : "",
          iIdx === 0 ? eq.type : "",
          iIdx === 0 ? eqPrice : "",
          ing.name,
          ing.quantity,
          uPrice,
          { f: `I${startR} * J${startR}` },
        ]);
      });
    });
  });

  const ws3 = XLSX.utils.aoa_to_sheet(s3Rows);
  ws3["!cols"] = [
    { wch: 24 }, // Monstruo
    { wch: 20 }, // Zona
    { wch: 10 }, // Nivel ByC
    { wch: 26 }, // Equipo
    { wch: 12 }, // Nivel Equipo
    { wch: 16 }, // Tipo
    { wch: 16 }, // Precio HDV
    { wch: 28 }, // Ingrediente
    { wch: 10 }, // Cantidad
    { wch: 16 }, // Unitario
    { wch: 16 }, // Subtotal
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "DETALLE_RECETAS_MATERIALES");

  // =========================================================================
  // HOJA 4: COTIZACIONES_Y_MERCADO
  // =========================================================================
  const s4Rows: any[][] = [];

  s4Rows.push(["BASE DE COTIZACIONES Y ROTACIÓN DE MERCADO"]);
  s4Rows.push(["* Lista maestra de ítems involucrados con sus precios y velocidades de venta."]);
  s4Rows.push([]);

  const mHead = ["ID", "Nombre del Ítem", "Categoría", "Precio HDV (kamas)", "Ventas 24 Horas", "Ventas 7 Días", "Ventas 30 Días"];
  s4Rows.push(mHead);

  const seenItems = new Set<number>();

  const addItemToMarket = (id: number, name: string, cat: string, defPrice: number) => {
    if (seenItems.has(id)) return;
    seenItems.add(id);
    const p = getPrice(id, defPrice);
    const s = getSales(id);
    s4Rows.push([id, name, cat, p, s.s24, s.s7, s.s30]);
  };

  // Add Maps, Fragments, Resources, Equipments, and Ingredients
  sortedHunts.forEach((h) => {
    addItemToMarket(h.mapItem.id, h.mapItem.name, "Mapa Completo", h.mapItem.defaultPrice);
    (h.fragments || []).forEach((f) => addItemToMarket(f.id, f.name, "Fragmento", f.defaultPrice));
    addItemToMarket(h.resource.id, h.resource.name, "Recurso ByC", h.resource.defaultPrice);
    (h.equipments || []).forEach((eq) => {
      addItemToMarket(eq.id, eq.name, "Equipable ByC", eq.defaultSalePrice || 0);
      (eq.recipeIngredients || []).forEach((ing) => {
        addItemToMarket(ing.id, ing.name, "Ingrediente Receta", ing.defaultPrice || 0);
      });
    });
  });

  const ws4 = XLSX.utils.aoa_to_sheet(s4Rows);
  ws4["!cols"] = [
    { wch: 10 }, // ID
    { wch: 32 }, // Nombre
    { wch: 20 }, // Categoría
    { wch: 18 }, // Precio HDV
    { wch: 14 }, // Ventas 24h
    { wch: 14 }, // Ventas 7d
    { wch: 14 }, // Ventas 30d
  ];
  XLSX.utils.book_append_sheet(wb, ws4, "COTIZACIONES_Y_MERCADO");

  return wb;
}

export function downloadBycWorkbook(options: BycExportOptions = {}): string {
  const wb = buildBycWorkbook(options);
  const fileName = `DOFUS_BYC_INVERSION_GRUPO_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
