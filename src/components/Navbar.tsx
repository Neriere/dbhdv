import React, { useEffect, useState } from 'react';
import { Trophy, Coins, Layers, Wrench, Database, Zap } from 'lucide-react';
import {
  getActivePriceProfileId,
  getPriceProfiles,
  initializeDatabase,
  setActiveLocalPriceProfile,
} from '../services/dofusDbService';

export type ActiveTab = 'recipes' | 'ranking' | 'rompedora' | 'prices' | 'importer';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [profiles, setProfiles] = useState(getPriceProfiles());
  const [activeProfileId, setActiveProfileId] = useState(getActivePriceProfileId());

  useEffect(() => {
    const hydrateProfiles = () => {
      setProfiles(getPriceProfiles());
      setActiveProfileId(getActivePriceProfileId());
    };

    initializeDatabase()
      .then(() => {
        hydrateProfiles();
      })
      .catch((error) => {
        console.error('No se pudieron cargar los perfiles:', error);
      });

    window.addEventListener('dofus_database_updated', hydrateProfiles);
    return () => {
      window.removeEventListener('dofus_database_updated', hydrateProfiles);
    };
  }, []);

  const handleProfileChange = async (profileId: number) => {
    try {
      await setActiveLocalPriceProfile(profileId);
    } catch (error) {
      console.error('No se pudo cambiar el perfil:', error);
    }
  };

  const tabs = [
    { id: 'recipes' as ActiveTab, label: 'Recetas', icon: Wrench, desc: 'Recetas y costos' },
    { id: 'ranking' as ActiveTab, label: 'Ranking', icon: Trophy, desc: 'Mejores márgenes de crafteo' },
    { id: 'rompedora' as ActiveTab, label: 'Rompedora', icon: Zap, desc: 'Machacado de runas (Kamaskope)' },
    { id: 'prices' as ActiveTab, label: 'Precios', icon: Coins, desc: 'Precios por perfil' },
    { id: 'importer' as ActiveTab, label: 'Base', icon: Database, desc: 'Importación y sync' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex items-center justify-between gap-4 min-h-16 py-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">Dofus <span className="text-amber-400">HDV</span></h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Servidor
              </span>
              <select
                value={activeProfileId}
                onChange={(event) => {
                  setActiveProfileId(Number(event.target.value));
                  void handleProfileChange(Number(event.target.value));
                }}
                className="w-[140px] sm:w-[180px] px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id} className="bg-slate-900 text-white">
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

            <nav className="flex items-center gap-1 sm:gap-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                    title={tab.desc}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

        </div>
      </div>
    </header>
  );
};
