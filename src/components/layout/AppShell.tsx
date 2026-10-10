import React, { useState, useEffect } from 'react';
import { ActiveTab, Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

// Storage key
const COLLAPSED_KEY = 'dofus_sidebar_collapsed_v1';

// Props
interface AppShellProps {
  activeTab:    ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  children:     React.ReactNode;
  footer?:      React.ReactNode;
}

// AppShell manages sidebar state and overall layout
export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  setActiveTab,
  children,
  footer,
}) => {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist collapse state
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem(COLLAPSED_KEY, String(v)); }
    catch { /* ignore */ }
  };

  // Close mobile sidebar on resize
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close mobile sidebar on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="app-layout">
      {/* Fixed top header */}
      <TopHeader
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Body: sidebar + main */}
      <div className="app-body">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <main
          className={`app-main${collapsed ? ' sidebar-collapsed' : ''}`}
          id="main-content"
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      {footer && (
        <div className={`app-footer${collapsed ? ' sidebar-collapsed' : ''}`}>
          {footer}
        </div>
      )}
    </div>
  );
};