import React from 'react';
import {
  Coins,
  HardDriveDownload,
  Radio,
  History,
  Tag,
} from 'lucide-react';

interface PriceManagerHeaderProps {
  activeProfileName: string;
  hasPriceCount: number;
  onOpenBackupModal: () => void;
  onOpenSnifferModal: () => void;
  onOpenGlobalHistoryModal: () => void;
}

export const PriceManagerHeader: React.FC<PriceManagerHeaderProps> = ({
  activeProfileName,
  hasPriceCount,
  onOpenBackupModal,
  onOpenSnifferModal,
  onOpenGlobalHistoryModal,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider mb-1 font-black">
            <Coins className="w-4 h-4" /> Gestor de Precios
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Precios de Mercadillo (HDV)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Perfil activo:{' '}
            <strong className="text-slate-200">
              {activeProfileName}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenBackupModal}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-300 border border-slate-700 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title="Descargar copia de seguridad o restaurar datos desde un archivo JSON"
          >
            <HardDriveDownload className="w-4 h-4 text-amber-400" />
            Backup / Restaurar
          </button>
          <button
            onClick={onOpenSnifferModal}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/5"
            title="Configurar y probar Sniffer Automático de Mercadillo en segundo plano"
          >
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            Auto Sniffer (Python)
          </button>
          <button
            onClick={onOpenGlobalHistoryModal}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <History className="w-4 h-4" />
            Historial de Precios
          </button>
          <span className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs font-black flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            {hasPriceCount} Precios Guardados
          </span>
        </div>
      </div>
    </div>
  );
};
