import XLSX from "xlsx-js-style";
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

// =============================================================================
// PALETA DE COLORES PROFESIONAL (ESTILO EXECUTIVE FINANCIAL / DOFUS EMERALD)
// =============================================================================
const COLOR_NAVY = "0F172A";          // Slate 900
const COLOR_EMERALD = "059669";       // Emerald 600
const COLOR_DEEP_EMERALD = "064E3B";  // Emerald 900
const COLOR_SLATE_800 = "1E293B";     // Slate 800
const COLOR_SLATE_700 = "334155";
const COLOR_SLATE_500 = "64748B";
const COLOR_SLATE_400 = "94A3B8";
const COLOR_SLATE_200 = "E2E8F0";
const COLOR_SLATE_100 = "F1F5F9";
const COLOR_SLATE_50 = "F8FAFC";
const COLOR_WHITE = "FFFFFF";
const COLOR_BORDER = "CBD5E1";        // Slate 300
const COLOR_BORDER_DARK = "334155";
const COLOR_GOLD = "FDE047";          // Amber 300
const COLOR_GREEN_BG = "DCFCE7";      // Green 100
const COLOR_GREEN_TXT = "15803D";     // Green 700
const COLOR_RED_BG = "FEE2E2";        // Red 100
const COLOR_RED_TXT = "B91C1C";       // Red 700
const COLOR_PURPLE_BG = "F3E8FF";     // Purple 100
const COLOR_PURPLE_TXT = "7E22CE";    // Purple 700
const COLOR_SKY_BG = "E0F2FE";        // Sky 100
const COLOR_SKY_TXT = "0369A1";       // Sky 700
const COLOR_AMBER_BG = "FEF3C7";      // Amber 100
const COLOR_AMBER_TXT = "B45309";     // Amber 700

// BORDES ESTÁNDAR
const BORDER_THIN = {
  top: { style: "thin", color: { rgb: COLOR_BORDER } },
  bottom: { style: "thin", color: { rgb: COLOR_BORDER } },
  left: { style: "thin", color: { rgb: COLOR_BORDER } },
  right: { style: "thin", color: { rgb: COLOR_BORDER } },
};

const BORDER_HEADER = {
  top: { style: "thin", color: { rgb: COLOR_BORDER_DARK } },
  bottom: { style: "medium", color: { rgb: COLOR_EMERALD } },
  left: { style: "thin", color: { rgb: COLOR_BORDER_DARK } },
  right: { style: "thin", color: { rgb: COLOR_BORDER_DARK } },
};

const BORDER_TOTAL = {
  top: { style: "thin", color: { rgb: COLOR_NAVY } },
  bottom: { style: "double", color: { rgb: COLOR_NAVY } },
  left: { style: "thin", color: { rgb: COLOR_BORDER } },
  right: { style: "thin", color: { rgb: COLOR_BORDER } },
};

// =============================================================================
// CONSTRUCTORES DE CELDAS ESTILIZADAS CON BORDES Y FORMATEO
// =============================================================================
interface CellOptions {
  formula?: string;
  numFmt?: string;
  type?: "s" | "n" | "b";
  bgRgb?: string;
  colorRgb?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  align?: "left" | "center" | "right";
  border?: any;
  wrap?: boolean;
}

function makeCell(val: any, opts: CellOptions = {}) {
  const cell: any = {};
  if (opts.formula) {
    cell.f = opts.formula;
  } else {
    cell.v = val;
  }

  if (opts.type) {
    cell.t = opts.type;
  } else if (typeof val === "number") {
    cell.t = "n";
  } else if (typeof val === "boolean") {
    cell.t = "b";
  } else {
    cell.t = "s";
  }

  if (opts.numFmt) {
    cell.z = opts.numFmt;
  }

  cell.s = {
    fill: opts.bgRgb ? { fgColor: { rgb: opts.bgRgb } } : undefined,
    font: {
      name: "Segoe UI",
      sz: opts.fontSize || 9.5,
      bold: Boolean(opts.bold),
      italic: Boolean(opts.italic),
      color: opts.colorRgb ? { rgb: opts.colorRgb } : { rgb: "1E293B" },
    },
    alignment: {
      vertical: "center",
      horizontal: opts.align || (typeof val === "number" || opts.formula ? "right" : "left"),
      wrapText: Boolean(opts.wrap),
    },
    border: opts.border !== undefined ? opts.border : BORDER_THIN,
  };

  return cell;
}

// Atajos para tipos de datos comunes
const cHeader = (text: string, bgRgb = COLOR_NAVY, align: "left" | "center" | "right" = "center") =>
  makeCell(text, { bgRgb, colorRgb: COLOR_WHITE, bold: true, fontSize: 10, align, border: BORDER_HEADER, wrap: true });

const cText = (text: string, isZebra = false, align: "left" | "center" | "right" = "left", bold = false, colorRgb?: string) =>
  makeCell(text, { bgRgb: isZebra ? COLOR_SLATE_50 : COLOR_WHITE, align, bold, colorRgb });

const cKamas = (val: number, isZebra = false, bold = false, colorRgb?: string) =>
  makeCell(val, { numFmt: '#,##0 "K"', bgRgb: isZebra ? COLOR_SLATE_50 : COLOR_WHITE, bold, colorRgb: colorRgb || (val > 0 ? COLOR_NAVY : COLOR_SLATE_500), align: "right" });

const cKamasF = (formula: string, isZebra = false, bold = false, colorRgb?: string) =>
  makeCell(null, { formula, numFmt: '#,##0 "K"', bgRgb: isZebra ? COLOR_SLATE_50 : COLOR_WHITE, bold, colorRgb, align: "right" });

const cPercentF = (formula: string, isZebra = false, bold = false) =>
  makeCell(null, { formula, numFmt: '0.0%', bgRgb: isZebra ? COLOR_SLATE_50 : COLOR_WHITE, bold, align: "right" });

const cNum = (num: number, isZebra = false, bold = false) =>
  makeCell(num, { numFmt: '#,##0', bgRgb: isZebra ? COLOR_SLATE_50 : COLOR_WHITE, bold, align: "center" });

const cStatus = (val: string) =>
  makeCell(val, {
    bgRgb: val === "SÍ" ? COLOR_GREEN_BG : COLOR_RED_BG,
    colorRgb: val === "SÍ" ? COLOR_GREEN_TXT : COLOR_RED_TXT,
    bold: true,
    align: "center",
    border: BORDER_THIN,
  });

const cStatusF = (formula: string) =>
  makeCell(null, {
    formula,
    bgRgb: COLOR_GREEN_BG,
    colorRgb: COLOR_GREEN_TXT,
    bold: true,
    align: "center",
    border: BORDER_THIN,
  });

const cStrategyF = (formula: string, isZebra = false) =>
  makeCell(null, {
    formula,
    bgRgb: isZebra ? COLOR_SLATE_50 : COLOR_WHITE,
    colorRgb: COLOR_PURPLE_TXT,
    bold: true,
    align: "center",
    border: BORDER_THIN,
  });

const cTotal = (val: any, formula?: string, numFmt?: string, align: "left" | "center" | "right" = "right") =>
  makeCell(val, {
    formula,
    numFmt,
    bgRgb: COLOR_SLATE_200,
    colorRgb: COLOR_NAVY,
    bold: true,
    fontSize: 10,
    align,
    border: BORDER_TOTAL,
  });

// =============================================================================
// MOTOR PRINCIPAL DE GENERACIÓN DEL LIBRO EXCEL (.XLSX) CON ESTILOS COMPLETOS
// =============================================================================
export function buildBycWorkbook(options: BycExportOptions = {}): XLSX.WorkBook {
  const playersCount = options.playersCount ?? 5;
  const sebuscalinPrice = options.sebuscalinPrice ?? 320;
  const marketTaxRate = options.marketTaxRate ?? 0.02;
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

  // 1. Agrupar las 45 cacerías por Zona y ordenar por nivel de monstruo ascendente
  const sortedHunts = [...BYC_LEGENDARY_HUNTS].sort((a, b) => {
    const zA = ZONE_ORDER.indexOf(normalizeZone(a.category));
    const zB = ZONE_ORDER.indexOf(normalizeZone(b.category));
    if (zA !== zB) return zA - zB;
    return a.monsterLevel - b.monsterLevel;
  });

  const wb = XLSX.utils.book_new();

  // Fila de totales en Hoja 2:
  // 4 filas superiores + 45 filas de datos = fila 49.
  // Fila 50 en blanco, Fila 51 es la fila de totales (totRow = 51)
  const rankStartRow = 5;
  const rankEndRow = 4 + sortedHunts.length; // 49
  const s2TotRow = rankEndRow + 2;            // 51

  // ===========================================================================
  // HOJA 1: ANALISIS_POR_BYC (Detalle Cacería por Cacería con Formato Tabular)
  // ===========================================================================
  const s1Rows: any[][] = [];

  // Fila 1: Banner de Título Principal
  s1Rows.push([
    makeCell("PLANIFICADOR FINANCIERO Y ESTRATÉGICO DE BÚSQUEDAS Y CAPTURAS (ByC) - DOFUS", {
      bgRgb: COLOR_NAVY,
      colorRgb: COLOR_GOLD,
      bold: true,
      fontSize: 12,
      align: "left",
      border: BORDER_HEADER,
    }),
  ]);

  // Fila 2: Subtítulo
  s1Rows.push([
    makeCell("Simulación cooperativa de inversión grupal (N integrantes), retorno de Sebuscalines y plusvalía de crafteo vs venta directa en HDV (-2% impuesto).", {
      bgRgb: COLOR_SLATE_800,
      colorRgb: COLOR_SLATE_400,
      italic: true,
      fontSize: 9,
      align: "left",
      border: BORDER_HEADER,
    }),
  ]);

  s1Rows.push([]); // Fila 3 separadora

  // Fila 4: Panel de Parámetros de Control Global
  s1Rows.push([
    makeCell("Jugadores en el Grupo (N):", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    makeCell(playersCount, { bgRgb: COLOR_AMBER_BG, colorRgb: COLOR_AMBER_TXT, bold: true, fontSize: 11, align: "center", numFmt: '#,##0' }),
    "",
    makeCell("Kamas por Sebuscalín:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    makeCell(sebuscalinPrice, { bgRgb: COLOR_AMBER_BG, colorRgb: COLOR_AMBER_TXT, bold: true, fontSize: 11, align: "center", numFmt: '#,##0 "K"' }),
    "",
    makeCell("Impuesto Mercadillo HDV:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    makeCell(marketTaxRate, { bgRgb: COLOR_AMBER_BG, colorRgb: COLOR_AMBER_TXT, bold: true, fontSize: 11, align: "center", numFmt: '0.0%' }),
  ]);

  // Fila 5: Inversión y Ganancias Base (Venta Directa)
  s1Rows.push([
    makeCell("Inversión Total Grupo (Venta Directa):", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cKamasF(`SUMIF(RESUMEN_EJECUTIVO_RANKING!A${rankStartRow}:A${rankEndRow}, "SÍ", RESUMEN_EJECUTIVO_RANKING!G${rankStartRow}:G${rankEndRow}) * $B$4`, false, true),
    "",
    makeCell("Inversión / Jugador:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cKamasF(`B5/$B$4`, false, true),
    "",
    makeCell("Ganancia Neta Grupo (Venta Directa):", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cKamasF(`SUMIF(RESUMEN_EJECUTIVO_RANKING!A${rankStartRow}:A${rankEndRow}, "SÍ", RESUMEN_EJECUTIVO_RANKING!H${rankStartRow}:H${rankEndRow}) * $B$4`, false, true, COLOR_EMERALD),
    "",
    makeCell("ROI Global Venta:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cPercentF(`IF(B5>0, H5/B5, 0)`, false, true),
  ]);

  // Fila 6: Ganancia Jugador y Estrategia Óptima Grupo
  s1Rows.push([
    makeCell("Ganancia Neta / Jugador (Venta):", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cKamasF(`H5/$B$4`, false, true, COLOR_EMERALD),
    "",
    makeCell("Inversión Grupo (Estrategia Óptima):", { bgRgb: COLOR_DEEP_EMERALD, colorRgb: COLOR_GOLD, bold: true, align: "left" }),
    cKamasF(`SUMIF(RESUMEN_EJECUTIVO_RANKING!A${rankStartRow}:A${rankEndRow}, "SÍ", RESUMEN_EJECUTIVO_RANKING!P${rankStartRow}:P${rankEndRow}) * $B$4`, false, true),
    "",
    makeCell("Ganancia Neta Grupo (Óptima):", { bgRgb: COLOR_DEEP_EMERALD, colorRgb: COLOR_GOLD, bold: true, align: "left" }),
    cKamasF(`SUMIF(RESUMEN_EJECUTIVO_RANKING!A${rankStartRow}:A${rankEndRow}, "SÍ", RESUMEN_EJECUTIVO_RANKING!Q${rankStartRow}:Q${rankEndRow}) * $B$4`, false, true, COLOR_EMERALD),
    "",
    makeCell("Ganancia Óptima / Jugador:", { bgRgb: COLOR_DEEP_EMERALD, colorRgb: COLOR_GOLD, bold: true, align: "left" }),
    cKamasF(`H6/$B$4`, false, true, COLOR_EMERALD),
  ]);

  // Fila 7: Plusvalía Crafteo vs Venta
  s1Rows.push([
    makeCell("Plusvalía Crafteo vs Venta / Jug:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cKamasF(`K6 - B6`, false, true, COLOR_PURPLE_TXT),
    "",
    makeCell("Ganancia Total Grupo en Crafteo:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cKamasF(`SUMIF(RESUMEN_EJECUTIVO_RANKING!A${rankStartRow}:A${rankEndRow}, "SÍ", RESUMEN_EJECUTIVO_RANKING!L${rankStartRow}:L${rankEndRow}) * $B$4`, false, true, COLOR_EMERALD),
    "",
    makeCell("Ganancia Crafteo / Jugador:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cKamasF(`E7/$B$4`, false, true, COLOR_EMERALD),
    "",
    makeCell("ROI Global Estrategia Óptima:", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
    cPercentF(`IF(E6>0, H6/E6, 0)`, false, true),
  ]);

  // Fila 8: Guía rápida interactiva
  s1Rows.push([
    makeCell("* Guía interactiva: Edita las celdas B4 (Jugadores) o E4 (Precio Sebuscalín) para recalcular todo el libro al instante. En la hoja RESUMEN_EJECUTIVO_RANKING columna 'Incluir ByC', cambia 'SÍ' a 'NO' para excluir cualquier cacería.", {
      colorRgb: COLOR_SLATE_500,
      italic: true,
      fontSize: 8.5,
    }),
  ]);

  s1Rows.push([]); // Fila 9 separadora

  // Encabezados de columnas de cada tabla de ByC
  const headerCols = [
    cHeader("Módulo / Opción", COLOR_NAVY, "left"),
    cHeader("Ítem / Recompensa", COLOR_NAVY, "left"),
    cHeader("Nivel / Tipo", COLOR_NAVY, "center"),
    cHeader("Costo / Inv. Grupo", COLOR_NAVY, "right"),
    cHeader("Inv. / Jugador", COLOR_NAVY, "right"),
    cHeader("Sebuscalines Grupo", COLOR_NAVY, "center"),
    cHeader("Valor Sebus (k)", COLOR_NAVY, "right"),
    cHeader("Precio Venta HDV", COLOR_NAVY, "right"),
    cHeader("Ingreso Neto HDV", COLOR_NAVY, "right"),
    cHeader("Costo Otros Ingred.", COLOR_NAVY, "right"),
    cHeader("Ingreso Total Pozo", COLOR_NAVY, "right"),
    cHeader("Beneficio Neto Grupo", COLOR_NAVY, "right"),
    cHeader("GANANCIA / JUGADOR", COLOR_EMERALD, "right"),
    cHeader("ROI %", COLOR_NAVY, "right"),
    cHeader("Plusvalía vs Venta", COLOR_NAVY, "right"),
    cHeader("Ventas 24h", COLOR_NAVY, "center"),
    cHeader("Ventas 7d", COLOR_NAVY, "center"),
    cHeader("Ventas 30d", COLOR_NAVY, "center"),
    cHeader("Estrategia Óptima", COLOR_NAVY, "center"),
    cHeader("Incluir ByC", COLOR_EMERALD, "center"),
  ];

  let currentZone = "";
  const huntRowIndexMap: Record<
    number,
    { incRow: number; rawRow: number; bestCraftRow: number; bestCraftIdx?: number }
  > = {};

  sortedHunts.forEach((hunt) => {
    const zone = normalizeZone(hunt.category);
    if (zone !== currentZone) {
      currentZone = zone;
      s1Rows.push([]);
      s1Rows.push([
        makeCell(`=== ZONA: ${currentZone.toUpperCase()} ===`, {
          bgRgb: COLOR_DEEP_EMERALD,
          colorRgb: COLOR_GOLD,
          bold: true,
          fontSize: 11,
          align: "left",
          border: BORDER_HEADER,
        }),
      ]);
      s1Rows.push([]);
    }

    const startRowIdx = s1Rows.length + 1; // 1-based index
    const incCellRef = `T${startRowIdx}`;

    // Cabecera del Monstruo ByC específico
    s1Rows.push([
      makeCell(`[ByC #${hunt.id}] ${hunt.monsterName} (Nv. ${hunt.monsterLevel}) - ${hunt.category}`, {
        bgRgb: COLOR_SLATE_800,
        colorRgb: "38BDF8", // Sky 400
        bold: true,
        fontSize: 10.5,
        align: "left",
        border: BORDER_HEADER,
      }),
      "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
      makeCell("Incluir en el Plan:", { bgRgb: COLOR_SLATE_800, colorRgb: COLOR_WHITE, bold: true, align: "right" }),
      cStatus("SÍ"),
    ]);

    s1Rows.push(headerCols);

    // 1. Fragmentos y costo del mapa
    const fragsCount = hunt.fragments?.length || 4;
    const wholeMapPrice = getPrice(hunt.mapItem.id, hunt.mapItem.defaultPrice);

    const fragRowStart = s1Rows.length + 1;
    (hunt.fragments || []).forEach((f, fIdx) => {
      const isZ = fIdx % 2 === 1;
      s1Rows.push([
        cText(`Fragmento ${fIdx + 1}/${fragsCount}`, isZ),
        cText(f.name, isZ),
        cText("Fragmento", isZ, "center"),
        cKamas(getPrice(f.id, f.defaultPrice), isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cText("", isZ),
        cNum(getSales(f.id).s24, isZ),
        cNum(getSales(f.id).s7, isZ),
        cNum(getSales(f.id).s30, isZ),
        cText("", isZ),
        cStatusF(incCellRef),
      ]);
    });
    const fragRowEnd = s1Rows.length;

    // Fila Subtotal Fragmentos
    const sumFragsRow = s1Rows.length + 1;
    s1Rows.push([
      cText("Subtotal Fragmentos", false, "left", true),
      cText(`${fragsCount} fragmentos`, false),
      cText("Cálculo", false, "center"),
      cKamasF(`SUM(D${fragRowStart}:D${fragRowEnd})`, false, true),
      cKamasF(`D${sumFragsRow}/$B$4`, false),
      cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""),
      cText(""), cText(""), cText(""), cText(""),
      cStatusF(incCellRef),
    ]);

    // Fila Mapa Completo
    const wholeMapRow = s1Rows.length + 1;
    s1Rows.push([
      cText("Mapa Completo", false, "left", true),
      cText(hunt.mapItem.name, false),
      cText("Mapa ensamblado", false, "center"),
      cKamas(wholeMapPrice, false, true),
      cKamasF(`D${wholeMapRow}/$B$4`, false),
      cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""), cText(""),
      cNum(getSales(hunt.mapItem.id).s24),
      cNum(getSales(hunt.mapItem.id).s7),
      cNum(getSales(hunt.mapItem.id).s30),
      cText(""),
      cStatusF(incCellRef),
    ]);

    // Fila Costo Óptimo del Mapa
    const optMapRow = s1Rows.length + 1;
    s1Rows.push([
      makeCell("Costo Óptimo Mapa (Base)", { bgRgb: COLOR_SLATE_100, bold: true, align: "left" }),
      makeCell("Mejor adquisición", { bgRgb: COLOR_SLATE_100, italic: true }),
      makeCell("Mínimo", { bgRgb: COLOR_SLATE_100, align: "center" }),
      cKamasF(`MIN(D${sumFragsRow}, D${wholeMapRow})`, false, true),
      cKamasF(`D${optMapRow}/$B$4`, false, true),
      cText("", false), cText("", false), cText("", false), cText("", false), cText("", false), cText("", false), cText("", false), cText("", false), cText("", false), cText("", false),
      cText("", false), cText("", false), cText("", false),
      cStrategyF(`IF(D${sumFragsRow}<=D${wholeMapRow}, "COMPRAR FRAGMENTOS", "COMPRAR MAPA")`),
      cStatusF(incCellRef),
    ]);

    // 2. Fila de Recompensa en Sebuscalines (Cofre + Misión)
    const chestSebus = hunt.chestSebuscalines || hunt.sebuscalines || 0;
    const missionSebus = hunt.missionSebuscalines || (chestSebus * 2);
    const sebusRow = s1Rows.length + 1;
    s1Rows.push([
      makeCell("Recompensa Sebuscalines", { bgRgb: COLOR_AMBER_BG, colorRgb: COLOR_AMBER_TXT, bold: true }),
      makeCell(`Cofre (${chestSebus}) + Misión c/u (${missionSebus})`, { bgRgb: COLOR_AMBER_BG, italic: true }),
      makeCell("Sebuscalines", { bgRgb: COLOR_AMBER_BG, align: "center" }),
      cKamas(0, false),
      cKamas(0, false),
      makeCell(null, { formula: `${chestSebus} + ($B$4 * ${missionSebus})`, bgRgb: COLOR_AMBER_BG, bold: true, align: "center", numFmt: '#,##0' }),
      cKamasF(`F${sebusRow} * $E$4`, false, true),
      cText("", false),
      cText("", false),
      cText("", false),
      cKamasF(`G${sebusRow}`, false, true),
      cKamasF(`G${sebusRow}`, false, true),
      cKamasF(`L${sebusRow}/$B$4`, false, true, COLOR_EMERALD),
      cText("", false), cText("", false), cText("", false), cText("", false), cText("", false),
      makeCell("CANJE SEBUSCALINES", { bgRgb: COLOR_AMBER_BG, colorRgb: COLOR_AMBER_TXT, bold: true, align: "center" }),
      cStatusF(incCellRef),
    ]);

    // 3. Opción A: Venta Directa del Recurso Crudo
    const resId = hunt.resource.id;
    const resPrice = getPrice(resId, hunt.resource.defaultPrice);
    const resSales = getSales(resId);
    const rawRow = s1Rows.length + 1;

    s1Rows.push([
      makeCell("OPCIÓN A: Venta Recurso Bruto", { bgRgb: COLOR_SKY_BG, colorRgb: COLOR_SKY_TXT, bold: true }),
      cText(hunt.resource.name, false, "left", true),
      cText(hunt.resource.type || "Recurso ByC", false, "center"),
      cKamasF(`D${optMapRow}`, false, true),
      cKamasF(`D${rawRow}/$B$4`, false),
      makeCell(null, { formula: `F${sebusRow}`, align: "center", numFmt: '#,##0' }),
      cKamasF(`G${sebusRow}`),
      cKamas(resPrice, false, true),
      cKamasF(`H${rawRow} * (1 - $H$4)`),
      cKamas(0),
      cKamasF(`I${rawRow} + G${sebusRow}`),
      cKamasF(`K${rawRow} - D${rawRow}`, false, true),
      cKamasF(`L${rawRow}/$B$4`, false, true, COLOR_EMERALD),
      cPercentF(`IF(D${rawRow}>0, L${rawRow}/D${rawRow}, 0)`),
      cKamas(0),
      cNum(resSales.s24),
      cNum(resSales.s7),
      cNum(resSales.s30),
      makeCell("BASE (VENTA RECURSO)", { bgRgb: COLOR_SKY_BG, colorRgb: COLOR_SKY_TXT, bold: true, align: "center" }),
      cStatusF(incCellRef),
    ]);

    // 4. Opción B: Crafteo de Equipables (Todas las recetas asociadas)
    const crafts = hunt.equipments || [];
    const craftRows: number[] = [];
    let bestCraftRow = rawRow;
    let bestCraftIdx = -1;
    let maxProfit = -Infinity;

    crafts.forEach((eq, eqIdx) => {
      const eqRow = s1Rows.length + 1;
      craftRows.push(eqRow);

      const eqPrice = getPrice(eq.id, eq.defaultSalePrice || 0);
      const otherIngredients = (eq.recipeIngredients || []).filter(
        (ing) => ing.id !== hunt.resource.id
      );
      const otherIngCost = otherIngredients.reduce((acc, ing) => {
        return acc + ing.quantity * getPrice(ing.id, ing.defaultPrice);
      }, 0);
      const eqSales = getSales(eq.id);

      // Evaluación del crafteo con mayor ganancia neta para la Hoja 2
      const netEquip = eqPrice * (1 - marketTaxRate);
      const profitCraft = netEquip - otherIngCost;
      if (profitCraft > maxProfit) {
        maxProfit = profitCraft;
        bestCraftRow = eqRow;
        bestCraftIdx = eqIdx;
      }

      s1Rows.push([
        makeCell(`OPCIÓN B.${eqIdx + 1}: Crafteo`, { bgRgb: COLOR_PURPLE_BG, colorRgb: COLOR_PURPLE_TXT, bold: true }),
        cText(eq.name, false, "left", true),
        cText(`Nv. ${eq.level} ${eq.type}`, false, "center"),
        cKamasF(`D${optMapRow} + J${eqRow}`, false, true),
        cKamasF(`D${eqRow}/$B$4`, false),
        makeCell(null, { formula: `F${sebusRow}`, align: "center", numFmt: '#,##0' }),
        cKamasF(`G${sebusRow}`),
        cKamas(eqPrice, false, true),
        cKamasF(`H${eqRow} * (1 - $H$4)`),
        cKamas(otherIngCost, false, false, COLOR_AMBER_TXT),
        cKamasF(`I${eqRow} + G${sebusRow}`),
        cKamasF(`K${eqRow} - D${eqRow}`, false, true),
        cKamasF(`L${eqRow}/$B$4`, false, true, COLOR_EMERALD),
        cPercentF(`IF(D${eqRow}>0, L${eqRow}/D${eqRow}, 0)`),
        cKamasF(`M${eqRow} - M${rawRow}`, false, true, COLOR_PURPLE_TXT),
        cNum(eqSales.s24),
        cNum(eqSales.s7),
        cNum(eqSales.s30),
        cStrategyF(`IF(M${eqRow}>M${rawRow}, "CRAFTEAR " & B${eqRow}, "VENDER RECURSO")`),
        cStatusF(incCellRef),
      ]);
    });

    if (craftRows.length === 0) {
      bestCraftRow = rawRow;
    }
    huntRowIndexMap[hunt.id] = { incRow: startRowIdx, rawRow, bestCraftRow, bestCraftIdx };

    s1Rows.push([]); // Espaciador entre cacerías
  });

  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);

  ws1["!cols"] = [
    { wch: 32 }, // A: Módulo / Opción
    { wch: 34 }, // B: Ítem
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
    { wch: 20 }, // M: GANANCIA JUGADOR
    { wch: 12 }, // N: ROI %
    { wch: 18 }, // O: Plusvalía
    { wch: 12 }, // P: 24h
    { wch: 12 }, // Q: 7d
    { wch: 12 }, // R: 30d
    { wch: 28 }, // S: Estrategia
    { wch: 14 }, // T: Incluir ByC
  ];

  XLSX.utils.book_append_sheet(wb, ws1, "ANALISIS_POR_BYC");

  // ===========================================================================
  // HOJA 2: RESUMEN_EJECUTIVO_RANKING (Tabla Formateada con Filtro y Totales)
  // ===========================================================================
  const s2Rows: any[][] = [];

  s2Rows.push([
    makeCell("RESUMEN EJECUTIVO Y RANKING COMPARATIVO (45 BÚSQUEDAS Y CAPTURAS)", {
      bgRgb: COLOR_NAVY,
      colorRgb: COLOR_GOLD,
      bold: true,
      fontSize: 12,
      border: BORDER_HEADER,
    }),
  ]);

  s2Rows.push([
    makeCell("* Usa la columna 'Incluir' para activar o desactivar cacerías del cálculo global. Todo el libro se actualiza automáticamente.", {
      bgRgb: COLOR_SLATE_800,
      colorRgb: COLOR_SLATE_400,
      italic: true,
      fontSize: 9,
      border: BORDER_HEADER,
    }),
  ]);

  s2Rows.push([]); // Separador

  // Encabezados con estilo de tabla profesional
  const rankHeader = [
    cHeader("Incluir", COLOR_EMERALD, "center"),
    cHeader("Zona", COLOR_NAVY, "left"),
    cHeader("Monstruo ByC", COLOR_NAVY, "left"),
    cHeader("Nivel", COLOR_NAVY, "center"),
    cHeader("N° Frags", COLOR_NAVY, "center"),
    cHeader("Recurso ByC", COLOR_NAVY, "left"),
    cHeader("Inv. / Jug. (Venta)", COLOR_NAVY, "right"),
    cHeader("Ganancia / Jug. (Venta)", COLOR_NAVY, "right"),
    cHeader("ROI % (Venta)", COLOR_NAVY, "right"),
    cHeader("Mejor Equipable", COLOR_NAVY, "left"),
    cHeader("Inv. / Jug. (Crafteo)", COLOR_NAVY, "right"),
    cHeader("Ganancia / Jug. (Crafteo)", COLOR_NAVY, "right"),
    cHeader("ROI % (Crafteo)", COLOR_NAVY, "right"),
    cHeader("Plusvalía Crafteo", COLOR_EMERALD, "right"),
    cHeader("Estrategia Recomendada", COLOR_NAVY, "center"),
    cHeader("Inv. Estrat. Óptima", COLOR_DEEP_EMERALD, "right"),
    cHeader("Ganancia Estrat. Óptima", COLOR_DEEP_EMERALD, "right"),
    cHeader("ROI Estrat. Óptima", COLOR_DEEP_EMERALD, "right"),
    cHeader("Ventas Recurso (24h/7d/30d)", COLOR_NAVY, "center"),
    cHeader("Ventas Equipo (24h/7d/30d)", COLOR_NAVY, "center"),
  ];
  s2Rows.push(rankHeader);

  sortedHunts.forEach((hunt, hIdx) => {
    const isZ = hIdx % 2 === 1;
    const rIdx = s2Rows.length + 1; // Fila actual en Excel
    const mapInfo = huntRowIndexMap[hunt.id];
    const rawR = mapInfo ? mapInfo.rawRow : 10;
    const craftR = mapInfo ? mapInfo.bestCraftRow : 11;
    const incR = mapInfo ? mapInfo.incRow : 10;
    const resSales = getSales(hunt.resource.id);
    const bestEq =
      mapInfo && mapInfo.bestCraftIdx !== undefined && mapInfo.bestCraftIdx >= 0 && hunt.equipments
        ? hunt.equipments[mapInfo.bestCraftIdx]
        : hunt.equipments && hunt.equipments.length > 0
        ? hunt.equipments[0]
        : null;
    const eqSales = bestEq ? getSales(bestEq.id) : { s24: 0, s7: 0, s30: 0 };

    s2Rows.push([
      cStatusF(`ANALISIS_POR_BYC!T${incR}`),
      cText(normalizeZone(hunt.category), isZ),
      cText(hunt.monsterName, isZ, "left", true),
      cNum(hunt.monsterLevel, isZ),
      cNum(hunt.fragments?.length || 4, isZ),
      cText(hunt.resource.name, isZ),
      cKamasF(`ANALISIS_POR_BYC!E${rawR}`, isZ),
      cKamasF(`ANALISIS_POR_BYC!M${rawR}`, isZ, true, COLOR_NAVY),
      cPercentF(`ANALISIS_POR_BYC!N${rawR}`, isZ),
      cText(bestEq ? bestEq.name : "N/A", isZ, "left", true),
      cKamasF(`ANALISIS_POR_BYC!E${craftR}`, isZ),
      cKamasF(`ANALISIS_POR_BYC!M${craftR}`, isZ, true, COLOR_EMERALD),
      cPercentF(`ANALISIS_POR_BYC!N${craftR}`, isZ),
      cKamasF(`ANALISIS_POR_BYC!O${craftR}`, isZ, true, COLOR_PURPLE_TXT),
      cStrategyF(`ANALISIS_POR_BYC!S${craftR}`, isZ),
      // Columnas calculadas de Estrategia Óptima (si craftear supera vender recurso)
      cKamasF(`IF(A${rIdx}="SÍ", IF(L${rIdx}>H${rIdx}, K${rIdx}, G${rIdx}), 0)`, isZ),
      cKamasF(`IF(A${rIdx}="SÍ", IF(L${rIdx}>H${rIdx}, L${rIdx}, H${rIdx}), 0)`, isZ, true, COLOR_EMERALD),
      cPercentF(`IF(P${rIdx}>0, Q${rIdx}/P${rIdx}, 0)`, isZ, true),
      cText(`${resSales.s24} / ${resSales.s7} / ${resSales.s30}`, isZ, "center"),
      cText(`${eqSales.s24} / ${eqSales.s7} / ${eqSales.s30}`, isZ, "center"),
    ]);
  });

  // Fila separadora y Fila de Totales de Hoja 2
  s2Rows.push([]);
  s2Rows.push([
    cTotal("TOTALES ACTIVOS", undefined, undefined, "center"),
    cTotal(""),
    cTotal("Suma de ítems con SÍ", undefined, undefined, "left"),
    cTotal(""),
    cTotal(""),
    cTotal(""),
    cTotal(null, `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", G${rankStartRow}:G${rankEndRow})`, '#,##0 "K"'),
    cTotal(null, `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", H${rankStartRow}:H${rankEndRow})`, '#,##0 "K"'),
    cTotal(null, `IF(G${s2TotRow}>0, H${s2TotRow}/G${s2TotRow}, 0)`, '0.0%'),
    cTotal(""),
    cTotal(null, `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", K${rankStartRow}:K${rankEndRow})`, '#,##0 "K"'),
    cTotal(null, `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", L${rankStartRow}:L${rankEndRow})`, '#,##0 "K"'),
    cTotal(null, `IF(K${s2TotRow}>0, L${s2TotRow}/K${s2TotRow}, 0)`, '0.0%'),
    cTotal(null, `SUMIF(A${rankStartRow}:A${rankEndRow}, "SÍ", N${rankStartRow}:N${rankEndRow})`, '#,##0 "K"'),
    cTotal("ESTRATEGIA ÓPTIMA", undefined, undefined, "center"),
    cTotal(null, `SUM(P${rankStartRow}:P${rankEndRow})`, '#,##0 "K"'),
    cTotal(null, `SUM(Q${rankStartRow}:Q${rankEndRow})`, '#,##0 "K"'),
    cTotal(null, `IF(P${s2TotRow}>0, Q${s2TotRow}/P${s2TotRow}, 0)`, '0.0%'),
    cTotal(""),
    cTotal(""),
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(s2Rows);

  // Auto-filtro en la tabla de ranking (Fila 4)
  ws2["!autofilter"] = { ref: `A4:T${rankEndRow}` };

  ws2["!cols"] = [
    { wch: 10 }, // A: Incluir
    { wch: 22 }, // B: Zona
    { wch: 26 }, // C: Monstruo
    { wch: 8 },  // D: Nivel
    { wch: 10 }, // E: Frags
    { wch: 26 }, // F: Recurso
    { wch: 18 }, // G: Inv Venta
    { wch: 20 }, // H: Ganancia Venta
    { wch: 12 }, // I: ROI Venta
    { wch: 26 }, // J: Mejor Equipable
    { wch: 18 }, // K: Inv Crafteo
    { wch: 20 }, // L: Ganancia Crafteo
    { wch: 12 }, // M: ROI Crafteo
    { wch: 18 }, // N: Plusvalía Crafteo
    { wch: 28 }, // O: Estrategia Recomendada
    { wch: 20 }, // P: Inv Estrat. Óptima
    { wch: 22 }, // Q: Ganancia Estrat. Óptima
    { wch: 14 }, // R: ROI Estrat. Óptima
    { wch: 22 }, // S: Ventas Recurso
    { wch: 22 }, // T: Ventas Equipo
  ];

  XLSX.utils.book_append_sheet(wb, ws2, "RESUMEN_EJECUTIVO_RANKING");

  // ===========================================================================
  // HOJA 3: DETALLE_RECETAS_MATERIALES (Tabla Maestra de Ingredientes)
  // ===========================================================================
  const s3Rows: any[][] = [];

  const rHead = [
    cHeader("Monstruo ByC", COLOR_NAVY, "left"),
    cHeader("Zona", COLOR_NAVY, "left"),
    cHeader("Nivel ByC", COLOR_NAVY, "center"),
    cHeader("Equipable Vinculado", COLOR_NAVY, "left"),
    cHeader("Nivel Equipo", COLOR_NAVY, "center"),
    cHeader("Tipo Equipo", COLOR_NAVY, "center"),
    cHeader("Precio Venta HDV", COLOR_NAVY, "right"),
    cHeader("Ingrediente Secundario", COLOR_NAVY, "left"),
    cHeader("Cantidad", COLOR_NAVY, "center"),
    cHeader("Precio Unitario HDV", COLOR_NAVY, "right"),
    cHeader("Subtotal Material", COLOR_EMERALD, "right"),
  ];
  s3Rows.push(rHead);

  let s3DataRowCount = 0;
  sortedHunts.forEach((hunt) => {
    (hunt.equipments || []).forEach((eq) => {
      const eqPrice = getPrice(eq.id, eq.defaultSalePrice || 0);
      const ingredients = (eq.recipeIngredients || []).filter(
        (ing) => ing.id !== hunt.resource.id
      );

      ingredients.forEach((ing, iIdx) => {
        s3DataRowCount++;
        const isZ = s3DataRowCount % 2 === 1;
        const uPrice = getPrice(ing.id, ing.defaultPrice || 0);
        const startR = s3Rows.length + 1;

        s3Rows.push([
          cText(iIdx === 0 ? hunt.monsterName : "", isZ, "left", iIdx === 0),
          cText(iIdx === 0 ? normalizeZone(hunt.category) : "", isZ),
          iIdx === 0 ? cNum(hunt.monsterLevel, isZ) : cText("", isZ),
          cText(iIdx === 0 ? eq.name : "", isZ, "left", iIdx === 0),
          iIdx === 0 ? cNum(eq.level, isZ) : cText("", isZ),
          cText(iIdx === 0 ? eq.type : "", isZ, "center"),
          iIdx === 0 ? cKamas(eqPrice, isZ, true) : cText("", isZ),
          cText(ing.name, isZ, "left", true),
          cNum(ing.quantity, isZ),
          cKamas(uPrice, isZ),
          cKamasF(`I${startR} * J${startR}`, isZ, true, COLOR_EMERALD),
        ]);
      });
    });
  });

  const ws3 = XLSX.utils.aoa_to_sheet(s3Rows);
  ws3["!autofilter"] = { ref: `A1:K${s3Rows.length}` };

  ws3["!cols"] = [
    { wch: 24 }, // Monstruo
    { wch: 20 }, // Zona
    { wch: 10 }, // Nivel ByC
    { wch: 28 }, // Equipo
    { wch: 12 }, // Nivel Equipo
    { wch: 16 }, // Tipo
    { wch: 18 }, // Precio HDV
    { wch: 30 }, // Ingrediente
    { wch: 10 }, // Cantidad
    { wch: 18 }, // Unitario
    { wch: 18 }, // Subtotal
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "DETALLE_RECETAS_MATERIALES");

  // ===========================================================================
  // HOJA 4: COTIZACIONES_Y_MERCADO (Maestro de Precios y Velocidad de Venta)
  // ===========================================================================
  const s4Rows: any[][] = [];

  s4Rows.push([
    makeCell("BASE MAESTRA DE COTIZACIONES Y ROTACIÓN DE MERCADO", {
      bgRgb: COLOR_NAVY,
      colorRgb: COLOR_GOLD,
      bold: true,
      fontSize: 12,
      border: BORDER_HEADER,
    }),
  ]);
  s4Rows.push([
    makeCell("* Lista maestra de ítems involucrados con precios actualizados y velocidades de venta (24h, 7d, 30d).", {
      bgRgb: COLOR_SLATE_800,
      colorRgb: COLOR_SLATE_400,
      italic: true,
      fontSize: 9,
      border: BORDER_HEADER,
    }),
  ]);
  s4Rows.push([]);

  const mHead = [
    cHeader("ID", COLOR_NAVY, "center"),
    cHeader("Nombre del Ítem", COLOR_NAVY, "left"),
    cHeader("Categoría", COLOR_NAVY, "left"),
    cHeader("Precio HDV (kamas)", COLOR_NAVY, "right"),
    cHeader("Ventas 24 Horas", COLOR_NAVY, "center"),
    cHeader("Ventas 7 Días", COLOR_NAVY, "center"),
    cHeader("Ventas 30 Días", COLOR_NAVY, "center"),
  ];
  s4Rows.push(mHead);

  const seenItems = new Set<number>();
  let s4DataRowCount = 0;

  const addItemToMarket = (id: number, name: string, cat: string, defPrice: number) => {
    if (seenItems.has(id)) return;
    seenItems.add(id);
    s4DataRowCount++;
    const isZ = s4DataRowCount % 2 === 1;
    const p = getPrice(id, defPrice);
    const s = getSales(id);
    s4Rows.push([
      cNum(id, isZ),
      cText(name, isZ, "left", true),
      cText(cat, isZ),
      cKamas(p, isZ, true),
      cNum(s.s24, isZ),
      cNum(s.s7, isZ),
      cNum(s.s30, isZ),
    ]);
  };

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
  ws4["!autofilter"] = { ref: `A4:G${s4Rows.length}` };

  ws4["!cols"] = [
    { wch: 10 }, // ID
    { wch: 34 }, // Nombre
    { wch: 22 }, // Categoría
    { wch: 20 }, // Precio HDV
    { wch: 16 }, // Ventas 24h
    { wch: 16 }, // Ventas 7d
    { wch: 16 }, // Ventas 30d
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
