import React from "react";
import {
  Wrench,
  Shield,
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  Heart,
} from "lucide-react";
import { PresetCraftableItem } from "../../data/presetCraftableItems";
import { MarketCategory } from "../DailyCraftPlanner";

export const JOB_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Wrench,
  Shield,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  Heart,
};

export type StrategyFilter = "all" | "hdv" | "crush" | "profitable";
export type SalesLiquidityFilter = "all" | "verified" | "medium_high" | "high";
export type SortByOption =
  | "best_profit_desc"
  | "sale_profit_desc"
  | "crush_profit_desc"
  | "best_roi_desc"
  | "cost_asc"
  | "turnover_desc"
  | "fast_payback";

export interface CalculatedRecipeRanking {
  item: PresetCraftableItem;
  craftCost: number;
  salePrice: number;
  rawSalePrice: number;
  saleTax: number;
  saleNetProfit: number;
  saleRoiPercent: number;
  canCrush: boolean;
  runicEstimatedValue: number;
  crushNetProfit: number;
  crushRoiPercent: number;
  bestStrategy: "hdv" | "crush" | "none";
  bestNetProfit: number;
  bestRoiPercent: number;
  jobName: string;
  jobId: number;
  marketCategory: MarketCategory | null;
  hasSalesData: boolean;
  sales24h: number;
  sales7d: number;
  sales30d: number;
  avgDailySales: number;
  turnoverRating: "alta" | "media" | "baja" | null;
  turnoverLabel: string | null;
  paybackDays: number | null;
  paybackHours: number | null;
  isOutlierPrice: boolean;
  outlierRatio: number;
  referenceMedian: number | null;
}

export interface GlobalProfitRankingProps {
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
}
