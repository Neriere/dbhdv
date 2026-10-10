import React from 'react';
import { TrendingUp, Briefcase } from 'lucide-react';
import { LegendaryHuntInfo } from '../../data/legendaryHuntsData';
import { BycRelatedEquipment } from '../../data/bycEquipmentData';
import { ItemSalesVolume } from '../../services/salesVolumeService';
import { BycAcquisitionMethod } from './types';
import { BycEquipmentCard } from './BycEquipmentCard';

interface BycEquipmentSectionProps {
  hunt: LegendaryHuntInfo;
  relatedEquipment: BycRelatedEquipment[];
  isUserJobsEnabled: boolean;
  fragmentsTotalCost: number;
  wholeMapPrice: number;
  resourcePriceGross: number;
  resourceNetIncome: number;
  sebuscalinesValue: number;
  chestSebuscalines: number;
  optimalAcquisitionMethod: BycAcquisitionMethod;
  expandedEquipmentIds: Record<number, boolean>;
  onToggleExpand: (id: number) => void;
  selectedEquipmentMethod: Record<number, BycAcquisitionMethod>;
  onSelectMethod: (id: number, method: BycAcquisitionMethod) => void;
  priceDrafts: Record<number, string>;
  onPriceDraftChange: (itemId: number, rawVal: string) => void;
  onPriceCommit: (itemId: number, rawVal: string) => void;
  salesVolumeMap: Record<number, ItemSalesVolume>;
  activeVolumeModalItemId: number | null;
  onToggleVolumeModal: (id: number) => void;
  onUpdateVolume: (
    itemId: number,
    field: 'sales24h' | 'sales7d' | 'sales30d',
    val: string
  ) => void;
  getPrice: (itemId: number, defaultVal: number) => number;
  getBankQty: (itemId: number) => number;
  formatKamas: (val: number) => string;
}

export const BycEquipmentSection: React.FC<BycEquipmentSectionProps> = ({
  hunt,
  relatedEquipment,
  isUserJobsEnabled,
  fragmentsTotalCost,
  wholeMapPrice,
  resourcePriceGross,
  resourceNetIncome,
  sebuscalinesValue,
  chestSebuscalines,
  optimalAcquisitionMethod,
  expandedEquipmentIds,
  onToggleExpand,
  selectedEquipmentMethod,
  onSelectMethod,
  priceDrafts,
  onPriceDraftChange,
  onPriceCommit,
  salesVolumeMap,
  activeVolumeModalItemId,
  onToggleVolumeModal,
  onUpdateVolume,
  getPrice,
  getBankQty,
  formatKamas,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              2. Decisión de Negocio: ¿Vender Recurso o Craftear Equipable?
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Calcula si vale la pena transformar {hunt.resource.name} crafteando
            el equipable vs solo vender el recurso crudo en mercadillo. Incluye
            impuesto del 2% en ventas de mercadillo.
          </p>
        </div>

        <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 self-start sm:self-center font-medium">
          {relatedEquipment.length} equipable(s)
        </div>
      </div>

      {isUserJobsEnabled && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs font-medium">
          <Briefcase className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            Filtro activo: Mostrando únicamente equipables que tus oficios pueden
            fabricar actualmente.
          </span>
        </div>
      )}

      {/* Equipment List */}
      <div className="space-y-4">
        {relatedEquipment.map((eq) => {
          const isExpanded = expandedEquipmentIds[eq.id] ?? true;
          const activeMethod =
            selectedEquipmentMethod[eq.id] || optimalAcquisitionMethod;
          const isVolumeModalOpen = activeVolumeModalItemId === eq.id;

          return (
            <BycEquipmentCard
              key={eq.id}
              eq={eq}
              hunt={hunt}
              fragmentsTotalCost={fragmentsTotalCost}
              wholeMapPrice={wholeMapPrice}
              resourcePriceGross={resourcePriceGross}
              resourceNetIncome={resourceNetIncome}
              sebuscalinesValue={sebuscalinesValue}
              chestSebuscalines={chestSebuscalines}
              optimalAcquisitionMethod={optimalAcquisitionMethod}
              isExpanded={isExpanded}
              onToggleExpand={() => onToggleExpand(eq.id)}
              activeMethod={activeMethod}
              onSelectMethod={(method) => onSelectMethod(eq.id, method)}
              priceDrafts={priceDrafts}
              onPriceDraftChange={onPriceDraftChange}
              onPriceCommit={onPriceCommit}
              salesVolume={salesVolumeMap[eq.id]}
              isVolumeModalOpen={isVolumeModalOpen}
              onToggleVolumeModal={() => onToggleVolumeModal(eq.id)}
              onUpdateVolume={onUpdateVolume}
              getPrice={getPrice}
              getBankQty={getBankQty}
              formatKamas={formatKamas}
            />
          );
        })}
      </div>
    </div>
  );
};
