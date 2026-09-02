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

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const [profiles, setProfiles] = useState(getPriceProfiles());
  const [activeProfileId, setActiveProfileId] = useState(getActivePriceProfileId());
  const [shoppingCount, setShoppingCount] = useState(getShoppingList().length);
  const [bankCount, setBankCount] = useState(getStoredBankInventory().length);
  const [currentTheme, setCurrentTheme] = useState<DofusTheme>(getStoredTheme());
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

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
      .then(() => {
        hydrate();
      })
      .catch((error) => {
        console.error('Error cargando perfiles:', error);
      });

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

  const tabs = [
    { id: 'recipes' as ActiveTab, label: 'Recetas', icon: Wrench },
    { id: 'bank' as ActiveTab, label: 'Mi Banco', icon: Vault, badge: bankCount },
    { id: 'treasure_maps' as ActiveTab, label: 'Mapas & ByC', icon: MapIcon },
    { id: 'dofusbook' as ActiveTab, label: 'Set Dofusbook', icon: Sparkles },
    { id: 'rompedora' as ActiveTab, label: 'Rompedora', icon: Zap },
    { id: 'ranking' as ActiveTab, label: 'Ranking', icon: Trophy },
    { id: 'shopping' as ActiveTab, label: 'Compras', icon: ShoppingCart, badge: shoppingCount },
    { id: 'prices' as ActiveTab, label: 'Precios', icon: Coins },
    { id: 'importer' as ActiveTab, label: 'Base', icon: Database },
  ];

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            {/* Left: Brand & Theme Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-sky-500 p-0.5 shadow-md">
                <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center">
                  <Layers className="w-4 h-4 text-amber-400" />
                </div>
              </div>

              <h1 className="text-base sm:text-lg font-black text-white tracking-tight shrink-0 mr-1">
                Dofus <span className="text-amber-400">Craft</span>
              </h1>

              {/* Theme Selector */}
              <select
                value={currentTheme}
                onChange={(e) => handleThemeSelect(e.target.value as DofusTheme)}
                aria-label="Seleccionar tema visual"
                className="bg-slate-950 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer transition-colors shadow-inner"
              >
                <option value="bonta" className="bg-slate-900 text-sky-300">
                  Bonta (Gris / Azul Claro)
                </option>
                <option value="brakmar" className="bg-slate-900 text-rose-300">
                  Brakmar (Rojo / Negro / Gris)
                </option>
                <option value="pandala" className="bg-slate-900 text-emerald-300">
                  Bosque (Verde / Salvia)
                </option>
                <option value="calm" className="bg-slate-900 text-amber-300">
                  Modo Calmo (Cálido / Anti-Fatiga)
                </option>
              </select>
            </div>

            {/* Right: Server Profile & Tabs */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="hidden md:inline text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Servidor:
                </span>
                <select
                  value={activeProfileId}
                  onChange={(event) => {
                    setActiveProfileId(Number(event.target.value));
                    void handleProfileChange(Number(event.target.value));
                  }}
                  className="w-[125px] sm:w-[155px] px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
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

                <button
                  type="button"
                  onClick={() => setIsBackupModalOpen(true)}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:text-amber-300 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Hacer copia de seguridad o restaurar datos (JSON)"
                >
                  <HardDriveDownload className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xl:inline">Backup</span>
                </button>
              </div>

              <nav className="flex items-center gap-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                      {typeof tab.badge === 'number' && tab.badge > 0 && (
                        <span className="w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shrink-0">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </header>

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </>
  );
};
