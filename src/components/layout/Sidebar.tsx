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
  Scroll,
  Briefcase,
  Hammer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  getStoredBankInventory,
  getShoppingList,
} from '../../services/dofusDbService';

// Type re-exported so App and AppShell can import it from here
export type ActiveTab =
  | 'recipes'
  | 'daily_crafts'
  | 'job_optimizer'
  | 'bank'
  | 'treasure_maps'
  | 'dofusbook'
  | 'rompedora'
  | 'ranking'
  | 'shopping'
  | 'prices'
  | 'consumables'
  | 'importer';

// Tab groups (same logical structure as before)
const TAB_GROUPS: {
  label: string;
  tabs: { id: ActiveTab; label: string; icon: React.ElementType }[];
}[] = [
  {
    label: 'Calcular',
    tabs: [
      { id: 'recipes',       label: 'Recetas',       icon: Wrench    },
      { id: 'daily_crafts',  label: 'Plan Crafteo',  icon: Briefcase },
      { id: 'job_optimizer', label: 'Subir Oficio',  icon: Hammer    },
      { id: 'rompedora',     label: 'Rompedora',     icon: Zap       },
      { id: 'dofusbook',     label: 'Set Dofusbook', icon: Sparkles  },
    ],
  },
  {
    label: 'Gestionar',
    tabs: [
      { id: 'bank',          label: 'Mi Banco',      icon: Vault       },
      { id: 'shopping',      label: 'Compras',       icon: ShoppingCart },
      { id: 'treasure_maps', label: 'Mapas & ByC',   icon: MapIcon     },
      { id: 'consumables',   label: 'Pergaminos',    icon: Scroll      },
    ],
  },
  {
    label: 'Explorar',
    tabs: [
      { id: 'ranking', label: 'Ranking', icon: Trophy   },
      { id: 'prices',  label: 'Precios', icon: Coins    },
      { id: 'importer',label: 'Base',    icon: Database },
    ],
  },
];

// Props
interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

// Sidebar component
export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const [shoppingCount, setShoppingCount] = useState(getShoppingList().length);
  const [bankCount, setBankCount]         = useState(getStoredBankInventory().length);

  useEffect(() => {
    const hydrate = () => {
      setShoppingCount(getShoppingList().length);
      setBankCount(getStoredBankInventory().length);
    };
    window.addEventListener('dofus_database_updated',      hydrate);
    window.addEventListener('dofus_shopping_list_updated', hydrate);
    window.addEventListener('dofus_bank_inventory_updated',hydrate);
    return () => {
      window.removeEventListener('dofus_database_updated',      hydrate);
      window.removeEventListener('dofus_shopping_list_updated', hydrate);
      window.removeEventListener('dofus_bank_inventory_updated',hydrate);
    };
  }, []);

  const badgeMap: Partial<Record<ActiveTab, number>> = {
    bank:     bankCount,
    shopping: shoppingCount,
  };

  const handleSelect = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
      aria-label="Navegacion principal"
    >
      {/* Scrollable nav */}
      <nav className="sidebar-scroll">
        {TAB_GROUPS.map((group) => (
          <div key={group.label} className="sidebar-group">
            <span className="sidebar-group-label">{group.label}</span>

            {group.tabs.map((tab) => {
              const Icon    = tab.icon;
              const isActive = activeTab === tab.id;
              const badge   = badgeMap[tab.id] ?? 0;

              return (
                <button
                  key={tab.id}
                  id={`sidebar-tab-${tab.id}`}
                  type="button"
                  onClick={() => handleSelect(tab.id)}
                  title={collapsed ? tab.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`sidebar-item${isActive ? ' active' : ''}`}
                >
                  <Icon className="sidebar-item-icon" />
                  <span className="sidebar-item-label">{tab.label}</span>
                  {badge > 0 && (
                    <span className="sidebar-badge">{badge > 99 ? '99+' : badge}</span>
                  )}
                  {badge > 0 && <span className="sidebar-badge-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
        aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 shrink-0" />
        ) : (
          <>
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span className="sidebar-collapse-btn-text">Colapsar</span>
          </>
        )}
      </button>
    </aside>
  );
};