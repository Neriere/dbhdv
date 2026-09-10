import React, { useState } from "react";
import {
  X,
  Briefcase,
  Check,
  RotateCcw,
  Sparkles,
  Pickaxe,
  Wheat,
  Axe,
  Fish,
  FlaskConical,
  Drumstick,
  Sword,
  Scissors,
  Footprints,
  Gem,
  Shield,
  Wrench,
  Heart,
  Wand2,
  Zap,
} from "lucide-react";
import {
  USER_JOBS_DEFINITIONS,
  JobCategory,
  JobConfigDefinition,
} from "../../services/userJobsService";
import { useUserJobs } from "../../hooks/useUserJobs";

const ICON_MAP: Record<string, React.ElementType> = {
  FlaskConical,
  Wheat,
  Drumstick,
  Axe,
  Pickaxe,
  Fish,
  Gem,
  Scissors,
  Footprints,
  Sword,
  Wand2,
  Shield,
  Wrench,
  Heart,
  Sparkles,
};

interface UserJobsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserJobsModal: React.FC<UserJobsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isEnabled,
    jobLevels,
    setJobLevel,
    setAllLevels,
    toggleEnabled,
  } = useUserJobs();

  const [activeCategoryTab, setActiveCategoryTab] = useState<"all" | JobCategory>("all");

  if (!isOpen) return null;

  const categories = [
    { id: "all" as const, label: "Todos", count: USER_JOBS_DEFINITIONS.length },
    {
      id: "gathering" as const,
      label: "Recolección",
      count: USER_JOBS_DEFINITIONS.filter((j) => j.category === "gathering").length,
    },
    {
      id: "crafting" as const,
      label: "Crafteo",
      count: USER_JOBS_DEFINITIONS.filter((j) => j.category === "crafting").length,
    },
    {
      id: "maging" as const,
      label: "Forjamagia",
      count: USER_JOBS_DEFINITIONS.filter((j) => j.category === "maging").length,
    },
  ];

  const filteredJobs =
    activeCategoryTab === "all"
      ? USER_JOBS_DEFINITIONS
      : USER_JOBS_DEFINITIONS.filter((j) => j.category === activeCategoryTab);

  const handleInputChange = (jobId: number, raw: string) => {
    const num = parseInt(raw.replace(/\D/g, ""), 10);
    if (!isNaN(num)) {
      setJobLevel(jobId, Math.max(1, Math.min(200, num)));
    } else if (raw === "") {
      setJobLevel(jobId, 1);
    }
  };

  const handleDelta = (jobId: number, delta: number) => {
    const current = jobLevels[jobId] ?? 200;
    setJobLevel(jobId, Math.max(1, Math.min(200, current + delta)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl text-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-amber-600/30 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Niveles de Mis Oficios
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isEnabled
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {isEnabled ? "Filtro Activo" : "Filtro Desactivado"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura tus niveles para que la plataforma filtre solo lo que tu personaje puede craftear o magear.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Master Switch Card ── */}
        <div className="p-4 sm:p-5 bg-slate-950/40 border-b border-slate-800/80 shrink-0 space-y-3">
          <div
            onClick={() => toggleEnabled()}
            className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none ${
              isEnabled
                ? "bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  isEnabled
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  Usar mis oficios
                  <span className="text-xs font-normal text-slate-400">
                    (Filtro global activo en Recetas, Rompedora, Ranking, Banco, Mapas & ByC)
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isEnabled
                    ? "Solo se muestran ítems dentro del rango de nivel de tus oficios registrados."
                    : "Desactivado: Se muestran todos los ítems sin importar tu nivel de oficio."}
                </div>
              </div>
            </div>

            {/* Toggle Switch */}
            <div
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                isEnabled ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform shadow-md ${
                  isEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Acciones rápidas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAllLevels(200)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
              >
                Todos al 200
              </button>
              <button
                type="button"
                onClick={() => setAllLevels(200, "crafting")}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition cursor-pointer"
              >
                Solo Crafteo al 200
              </button>
              <button
                type="button"
                onClick={() => setAllLevels(200, "maging")}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 transition cursor-pointer"
              >
                Solo Magos al 200
              </button>
              <button
                type="button"
                onClick={() => setAllLevels(1)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reiniciar a 1
              </button>
            </div>
          </div>
        </div>

        {/* ── Category Filter Tabs ── */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-950/40 border-b border-slate-800 shrink-0 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategoryTab(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeCategoryTab === c.id
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {c.label}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeCategoryTab === c.id
                    ? "bg-slate-950 text-amber-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {c.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Jobs Grid List ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredJobs.map((job: JobConfigDefinition) => {
              const currentLvl = jobLevels[job.id] ?? 200;
              const IconComp = ICON_MAP[job.icon] || Sparkles;
              const percent = Math.round((currentLvl / 200) * 100);

              const categoryBadge =
                job.category === "gathering"
                  ? { label: "Recolección", color: "text-teal-400 bg-teal-500/10 border-teal-500/30" }
                  : job.category === "crafting"
                  ? { label: "Crafteo", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" }
                  : { label: "Forjamagia", color: "text-purple-400 bg-purple-500/10 border-purple-500/30" };

              return (
                <div
                  key={job.id}
                  className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl hover:border-slate-700/90 transition flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          {job.nameEs}
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${categoryBadge.color}`}
                          >
                            {categoryBadge.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {job.description}
                        </div>
                      </div>
                    </div>

                    {/* Level Number & Max pill */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-bold block">NIVEL</span>
                        <span className="text-sm font-black text-amber-400 font-mono">
                          {currentLvl}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Level Controls & Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelta(job.id, -10)}
                        title="-10 niveles"
                        className="px-2 py-1 text-[10px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelta(job.id, -1)}
                        title="-1 nivel"
                        className="px-2 py-1 text-[10px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                      >
                        -1
                      </button>

                      <input
                        type="text"
                        value={currentLvl}
                        onChange={(e) => handleInputChange(job.id, e.target.value)}
                        className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs font-black text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                        title="Escribe el nivel deseado (1 a 200)"
                      />

                      <button
                        type="button"
                        onClick={() => handleDelta(job.id, 1)}
                        title="+1 nivel"
                        className="px-2 py-1 text-[10px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelta(job.id, 10)}
                        title="+10 niveles"
                        className="px-2 py-1 text-[10px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                      >
                        +10
                      </button>

                      <button
                        type="button"
                        onClick={() => setJobLevel(job.id, 200)}
                        title="Subir al nivel 200"
                        className="ml-auto px-2 py-1 text-[10px] font-bold rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition cursor-pointer"
                      >
                        Max (200)
                      </button>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Configuración guardada localmente de manera automática.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
