import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Coins,
  Layers,
  Wrench,
  Database,
  Zap,
  ShoppingCart,
  Sparkles,
  Vault,
  Map as MapIcon,
  HardDriveDownload,
  Circle,
} from 'lucide-react';
import {
  getActivePriceProfileId,
  getPriceProfiles,
  initializeDatabase,
  setActiveLocalPriceProfile,
  getShoppingList,
  getStoredBankInventory,
  getStoredTheme,
  setStoredTheme,
} from '../services/dofusDbService';
import { DofusTheme } from '../types';
import { groupPriceProfilesByCategory } from '../utils/serverUtils';
import { BackupModal } from './common/BackupModal';

export type ActiveTab =
  | 'recipes'
  | 'bank'
  | 'treasure_maps'
  | 'dofusbook'
  | 'rompedora'
  | 'ranking'
  | 'shopping'
  | 'prices'
  | 'importer';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

// Theme options with their accent colors for the visual swatch
const THEMES: { value: DofusTheme; label: string; color: string }[] = [
  { value: 'bonta',   label: 'Bonta',   color: '#38bdf8' },
  { value: 'brakmar', label: 'Brakmar', color: '#f43f5e' },
  { value: 'pandala', label: 'Bosque',  color: '#10b981' },
  { value: 'calm',    label: 'Calmo',   color: '#f59e0b' },
];

// Tab groups — purely visual grouping, same tabs as before
const TAB_GROUPS = [
  {
    label: 'Calcular',
    tabs: [
      { id: 'recipes'       as ActiveTab, label: 'Recetas',      icon: Wrench },
      { id: 'rompedora'     as ActiveTab, label: 'Rompedora',    icon: Zap },
      { id: 'dofusbook'     as ActiveTab, label: 'Set Dofusbook', icon: Sparkles },
    ],
  },
  {
    label: 'Gestionar',
    tabs: [
      { id: 'bank'          as ActiveTab, label: 'Mi Banco',     icon: Vault },
      { id: 'shopping'      as ActiveTab, label: 'Compras',      icon: ShoppingCart },
      { id: 'treasure_maps' as ActiveTab, label: 'Mapas & ByC',  icon: MapIcon },
    ],
  },
  {
    label: 'Explorar',
    tabs: [
      { id: 'ranking'       as ActiveTab, label: 'Ranking',      icon: Trophy },
      { id: 'prices'        as ActiveTab, label: 'Precios',      icon: Coins },
      { id: 'importer'      as ActiveTab, label: 'Base',         icon: Database },
    ],
  },
];

// Flat list used for badge counts
const ALL_TABS = TAB_GROUPS.flatMap((g) => g.tabs);

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [profiles, setProfiles] = useState(getPriceProfiles());
  const [activeProfileId, setActiveProfileId] = useState(getActivePriceProfileId());
  const [shoppingCount, setShoppingCount] = useState(getShoppingList().length);
  const [bankCount, setBankCount] = useState(getStoredBankInventory().length);
  const [currentTheme, setCurrentTheme] = useState<DofusTheme>(getStoredTheme());
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Badge map so we can look up quickly per tab id
  const badgeMap: Partial<Record<ActiveTab, number>> = {
    bank: bankCount,
    shopping: shoppingCount,
  };

  useEffect(() => {
    const hydrate = () => {
      setProfiles(getPriceProfiles());
      setActiveProfileId(getActivePriceProfileId());
      setShoppingCount(getShoppingList().length);
      setBankCount(getStoredBankInventory().length);
    };

    const handleThemeChange = (e: any) => {
      if (e.detail) {
        setCurrentTheme(e.detail);
        document.documentElement.setAttribute('data-theme', e.detail);
      }
    };

    initializeDatabase()
      .then(() => hydrate())
      .catch((error) => console.error('Error cargando perfiles:', error));

    document.documentElement.setAttribute('data-theme', currentTheme);

    window.addEventListener('dofus_database_updated', hydrate);
    window.addEventListener('dofus_shopping_list_updated', hydrate);
    window.addEventListener('dofus_bank_inventory_updated', hydrate);
    window.addEventListener('dofus_theme_updated', handleThemeChange);

    return () => {
      window.removeEventListener('dofus_database_updated', hydrate);
      window.removeEventListener('dofus_shopping_list_updated', hydrate);
      window.removeEventListener('dofus_bank_inventory_updated', hydrate);
      window.removeEventListener('dofus_theme_updated', handleThemeChange);
    };
  }, [currentTheme]);

  const handleProfileChange = async (profileId: number) => {
    try {
      await setActiveLocalPriceProfile(profileId);
    } catch (error) {
      console.error('Error cambiando perfil:', error);
    }
  };

  const handleThemeSelect = (theme: DofusTheme) => {
    setCurrentTheme(theme);
    setStoredTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  return (
    <>
      {/* ── ROW 1: Brand + Global Controls ─────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800/60 sticky top-0 z-40 shadow-lg">
        <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8">

          {/* Top strip — brand, server, theme, backup */}
          <div className="flex items-center justify-between gap-3 h-11">

            {/* Brand */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-amber-600 to-sky-500 p-0.5 shadow">
                <div className="w-full h-full bg-slate-950 rounded-[5px] flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                </div>
              </div>
              <h1 className="text-sm font-black text-white tracking-tight">
                Dofus <span className="text-amber-400">Craft</span>
              </h1>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">

              {/* Theme segmented control */}
              <div className="hidden sm:flex items-center gap-0.5 bg-slate-950/70 border border-slate-800 rounded-lg p-0.5">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleThemeSelect(t.value)}
                    title={t.label}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      currentTheme === t.value
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.color, boxShadow: currentTheme === t.value ? `0 0 6px ${t.color}80` : 'none' }}
                    />
                    <span className="hidden md:inline">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Mobile theme — keep native select as fallback */}
              <select
                value={currentTheme}
                onChange={(e) => handleThemeSelect(e.target.value as DofusTheme)}
                aria-label="Seleccionar tema visual"
                className="sm:hidden bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer"
              >
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {/* Divider */}
              <div className="hidden sm:block w-px h-5 bg-slate-800" />

              {/* Server selector */}
              <div className="flex items-center gap-1.5">
                <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Servidor
                </span>
                <select
                  value={activeProfileId}
                  onChange={(event) => {
                    setActiveProfileId(Number(event.target.value));
                    void handleProfileChange(Number(event.target.value));
                  }}
                  className="w-[120px] sm:w-[145px] px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                  title="Seleccionar servidor de Dofus"
                >
                  {groupPriceProfilesByCategory(profiles).map((group) => (
                    <optgroup
                      key={group.category}
                      label={`── ${group.label} ──`}
                      className="bg-slate-950 text-amber-400 font-bold"
                    >
                      {group.profiles.map((profile) => (
                        <option
                          key={profile.id}
                          value={profile.id}
                          className="bg-slate-900 text-slate-100 font-normal py-1"
                        >
                          {profile.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Backup button */}
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(true)}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-bold text-slate-400 hover:text-amber-300 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Copia de seguridad / restaurar datos"
              >
                <HardDriveDownload className="w-3.5 h-3.5 text-amber-500/80" />
                <span className="hidden xl:inline">Backup</span>
              </button>
            </div>
          </div>

          {/* ── ROW 2: Tab Navigation ──────────────────────────────────── */}
          <nav className="flex items-stretch gap-0 -mb-px overflow-x-auto scrollbar-none">
            {TAB_GROUPS.map((group, groupIdx) => (
              <React.Fragment key={group.label}>
                {/* Group separator */}
                {groupIdx > 0 && (
                  <div className="flex items-center px-1.5">
                    <div className="w-px h-4 bg-slate-700/60" />
                  </div>
                )}

                {/* Tabs within this group */}
                {group.tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const badge = badgeMap[tab.id];
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`nav-tab ${isActive ? 'active' : ''} flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'text-white border-[color:var(--accent,#f59e0b)]'
                          : 'text-slate-500 border-transparent hover:text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[color:var(--accent,#f59e0b)]' : 'text-slate-500'}`}
                      />
                      <span>{tab.label}</span>
                      {typeof badge === 'number' && badge > 0 && (
                        <span className="w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shrink-0">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </nav>
        </div>
      </header>

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </>
  );
};
