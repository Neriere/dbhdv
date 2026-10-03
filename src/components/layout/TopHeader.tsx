import React, { useState, useEffect } from 'react';
import { Layers, Briefcase, Menu, X } from 'lucide-react';
import {
  getActivePriceProfileId,
  getPriceProfiles,
  initializeDatabase,
  setActiveLocalPriceProfile,
  getStoredTheme,
  setStoredTheme,
} from '../../services/dofusDbService';
import { DofusTheme } from '../../types';
import { groupPriceProfilesByCategory } from '../../utils/serverUtils';
import { useUserJobs } from '../../hooks/useUserJobs';
import { UserJobsModal } from '../common/UserJobsModal';
import { ActiveTab } from './Sidebar';

// Sniffer status hook
function useSnifferStatus() {
  const [lastSync, setLastSync] = useState<number | null>(null);
  useEffect(() => {
    const handler = () => setLastSync(Date.now());
    window.addEventListener('dofus_database_updated', handler);
    return () => window.removeEventListener('dofus_database_updated', handler);
  }, []);
  const isActive    = lastSync !== null && Date.now() - lastSync < 5 * 60 * 1000;
  const relativeTime = lastSync
    ? (() => {
        const mins = Math.round((Date.now() - lastSync) / 60000);
        if (mins < 1) return 'ahora mismo';
        if (mins === 1) return 'hace 1 min';
        return `hace ${mins} min`;
      })()
    : null;
  return { isActive, relativeTime };
}

// Theme config
const THEMES: { value: DofusTheme; label: string; color: string }[] = [
  { value: 'bonta',   label: 'Bonta',   color: '#38bdf8' },
  { value: 'brakmar', label: 'Brakmar', color: '#f43f5e' },
  { value: 'pandala', label: 'Bosque',  color: '#10b981' },
  { value: 'calm',    label: 'Calmo',   color: '#f59e0b' },
];

// Props
interface TopHeaderProps {
  mobileOpen:    boolean;
  setMobileOpen: (v: boolean) => void;
  activeTab:     ActiveTab;
  setActiveTab:  (tab: ActiveTab) => void;
}

// TopHeader component
export const TopHeader: React.FC<TopHeaderProps> = ({
  mobileOpen,
  setMobileOpen,
  setActiveTab,
}) => {
  const [profiles,       setProfiles]       = useState(getPriceProfiles());
  const [activeProfileId,setActiveProfileId]= useState(getActivePriceProfileId());
  const [currentTheme,   setCurrentTheme]   = useState<DofusTheme>(getStoredTheme());
  const [isJobsModalOpen,setIsJobsModalOpen]= useState(false);
  const { isActive: snifferActive, relativeTime: snifferTime } = useSnifferStatus();
  const { isEnabled: isJobsEnabled } = useUserJobs();

  useEffect(() => {
    const hydrate = () => {
      setProfiles(getPriceProfiles());
      setActiveProfileId(getActivePriceProfileId());
    };
    const handleThemeChange = (e: any) => {
      if (e.detail) {
        setCurrentTheme(e.detail);
        document.documentElement.setAttribute('data-theme', e.detail);
      }
    };
    initializeDatabase()
      .then(() => hydrate())
      .catch((err) => console.error('Error cargando perfiles:', err));
    document.documentElement.setAttribute('data-theme', currentTheme);
    window.addEventListener('dofus_database_updated', hydrate);
    window.addEventListener('dofus_theme_updated',    handleThemeChange);
    return () => {
      window.removeEventListener('dofus_database_updated', hydrate);
      window.removeEventListener('dofus_theme_updated',    handleThemeChange);
    };
  }, [currentTheme]);

  const handleProfileChange = async (id: number) => {
    try { await setActiveLocalPriceProfile(id); }
    catch (e) { console.error('Error cambiando perfil:', e); }
  };

  const handleThemeSelect = (theme: DofusTheme) => {
    setCurrentTheme(theme);
    setStoredTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  return (
    <>
      <header className="top-header">

        {/* Hamburger (mobile only) */}
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        {/* Brand */}
        <button
          type="button"
          className="top-header-brand"
          onClick={() => setActiveTab('recipes')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          aria-label="Ir a inicio"
        >
          <div className="top-header-logo">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <h1 className="top-header-title">
            Dofus <span>Craft</span>
          </h1>
        </button>

        {/* Spacer */}
        <div className="top-header-spacer" />

        {/* Controls */}
        <div className="top-header-controls">

          {/* Sniffer status pill */}
          <div
            className={`sniffer-pill ${snifferActive ? 'active' : 'inactive'}`}
            title={snifferActive ? `Ultima sync: ${snifferTime}` : 'Sniffer inactivo'}
          >
            <span className="sniffer-pill-dot" />
            <span className="hidden sm:inline">
              {snifferActive ? `Sync ${snifferTime}` : 'Sniffer off'}
            </span>
          </div>

          <div className="top-header-divider" />

          {/* Theme swatch group */}
          <div className="theme-swatch-group hidden sm:flex" role="group" aria-label="Tema visual">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleThemeSelect(t.value)}
                className={`theme-swatch-btn${currentTheme === t.value ? ' active' : ''}`}
                title={t.label}
                aria-pressed={currentTheme === t.value}
              >
                <span
                  className="theme-swatch-dot"
                  style={{
                    backgroundColor: t.color,
                    boxShadow: currentTheme === t.value ? `0 0 5px ${t.color}90` : 'none',
                  }}
                />
                <span className="hidden md:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile theme select */}
          <select
            value={currentTheme}
            onChange={(e) => handleThemeSelect(e.target.value as DofusTheme)}
            aria-label="Tema visual"
            className="sm:hidden bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer"
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="top-header-divider" />

          {/* Mis Oficios button */}
          <button
            type="button"
            id="btn-mis-oficios"
            onClick={() => setIsJobsModalOpen(true)}
            title="Configurar niveles de oficio"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              isJobsEnabled
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-transparent border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
            }`}
          >
            <Briefcase className={`w-3.5 h-3.5 shrink-0 ${isJobsEnabled ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="hidden sm:inline">Mis Oficios</span>
            {isJobsEnabled ? (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 leading-none">ON</span>
            ) : (
              <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-slate-800 text-slate-400 leading-none">OFF</span>
            )}
          </button>

          <div className="top-header-divider" />

          {/* Server selector */}
          <div className="flex items-center gap-1.5">
            <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Servidor
            </span>
            <select
              value={activeProfileId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setActiveProfileId(id);
                void handleProfileChange(id);
              }}
              className="w-[120px] sm:w-[145px] px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
              title="Seleccionar servidor"
              aria-label="Servidor de Dofus"
            >
              {groupPriceProfilesByCategory(profiles).map((group) => (
                <optgroup
                  key={group.category}
                  label={`-- ${group.label} --`}
                  className="bg-slate-950 text-amber-400 font-bold"
                >
                  {group.profiles.map((profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                      className="bg-slate-900 text-slate-100 font-normal"
                    >
                      {profile.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

        </div>
      </header>

      {/* Jobs modal */}
      <UserJobsModal
        isOpen={isJobsModalOpen}
        onClose={() => setIsJobsModalOpen(false)}
        onSelectJobForOptimizer={(jobId) => {
          try {
            const raw  = localStorage.getItem('dofus_job_leveling_plan_v1');
            const plan = raw ? JSON.parse(raw) : {};
            localStorage.setItem('dofus_job_leveling_plan_v1', JSON.stringify({ ...plan, jobId }));
          } catch { /* ignore */ }
          setActiveTab('job_optimizer');
        }}
      />
    </>
  );
};