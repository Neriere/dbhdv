import React, { useEffect, useState } from 'react';
import { Trophy, Coins, Layers, Wrench, Database } from 'lucide-react';
import {
  getActivePriceProfileId,
  getPriceProfiles,
  initializeDatabase,
  setActiveLocalPriceProfile,
} from '../services/dofusDbService';

export type ActiveTab = 'recipes' | 'ranking' | 'prices' | 'importer';

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
    { id: 'ranking' as ActiveTab, label: 'Ranking', icon: Trophy, desc: 'Mejores márgenes' },
    { id: 'prices' as ActiveTab, label: 'Precios', icon: Coins, desc: 'Precios por perfil' },
    { id: 'importer' as ActiveTab, label: 'Base', icon: Database, desc: 'Importación y sync' },
  ];

  return (
    <header className="bg-[#0f0f0f] border-b border-neutral-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 min-h-16 py-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-[#0a0a0a] rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">DofusDB <span className="text-amber-500">HDV</span></h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Dofus 3.0 / 2.x
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Servidor
              </span>
              <select
                value={activeProfileId}
                onChange={(event) => {
                  setActiveProfileId(Number(event.target.value));
                  void handleProfileChange(Number(event.target.value));
                }}
                className="w-[140px] sm:w-[180px] px-3 py-2 bg-[#0a0a0a] border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

            <nav className="flex items-center gap-1 sm:gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                    }`}
                    title={tab.desc}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
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
