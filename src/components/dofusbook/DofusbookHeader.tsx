import React from 'react';
import {
  Sparkles,
  Link as LinkIcon,
  Search,
  RefreshCw,
  EyeOff,
  Eye,
  AlertCircle,
} from 'lucide-react';

interface DofusbookHeaderProps {
  urlInput: string;
  setUrlInput: (val: string) => void;
  isLoading: boolean;
  error: string | null;
  excludeDofus: boolean;
  excludeTrophies: boolean;
  onAnalyze: (overrideUrl?: string) => void;
  onToggleExcludeDofus: () => void;
  onToggleExcludeTrophies: () => void;
}

export const DofusbookHeader: React.FC<DofusbookHeaderProps> = ({
  urlInput,
  setUrlInput,
  isLoading,
  error,
  excludeDofus,
  excludeTrophies,
  onAnalyze,
  onToggleExcludeDofus,
  onToggleExcludeTrophies,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Estimado de set de <span className="text-amber-400">Dofusbook</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Input & Options Form */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <LinkIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
              placeholder="Pega el enlace de Dofusbook (ej: https://d-bk.net/fr/d/10s7V o código 10s7V)..."
              className="w-full pl-10 pr-24 py-2.5 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-amber-500 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-xl outline-none transition-all shadow-inner font-mono"
            />
            {urlInput && (
              <button
                type="button"
                onClick={() => setUrlInput('')}
                className="absolute inset-y-0 right-16 pr-2 flex items-center text-xs text-slate-500 hover:text-slate-300"
              >
                Limpiar
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) {
                    setUrlInput(text);
                    onAnalyze(text);
                  }
                } catch {}
              }}
              className="absolute inset-y-1.5 right-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700/60"
              title="Pegar del portapapeles"
            >
              Pegar
            </button>
          </div>

          <button
            onClick={() => onAnalyze()}
            disabled={isLoading || !urlInput.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analizando Set...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Analizar Set</span>
              </>
            )}
          </button>
        </div>

        {/* Toggles Row */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-1 text-xs">
          {/* Exclude Dofus toggle */}
          <button
            type="button"
            onClick={onToggleExcludeDofus}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold text-xs transition-all cursor-pointer ${
              excludeDofus
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Excluir los Dofus del cálculo de precio del set"
          >
            {excludeDofus ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Excluir Dofus</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
              {excludeDofus ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Exclude Trophies toggle */}
          <button
            type="button"
            onClick={onToggleExcludeTrophies}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold text-xs transition-all cursor-pointer ${
              excludeTrophies
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Excluir trofeos del cálculo"
          >
            <span>Excluir Trofeos</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-slate-700 text-slate-300 font-mono">
              {excludeTrophies ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">No se pudo cargar el set:</span>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
