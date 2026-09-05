import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './components/OverviewPage';
import { MerchantOverviewPage } from './components/merchant/MerchantOverviewPage';
import { RevenueAtRiskPage } from './components/risk/RevenueAtRiskPage';
import { RecoveryOpportunitiesPage } from './components/opportunities/RecoveryOpportunitiesPage';
import { CustomersPage } from './components/customers/CustomersPage';
import { ActiveRecoveriesPage } from './components/active/ActiveRecoveriesPage';
import { CampaignsPage } from './components/campaigns/CampaignsPage';
import { RecoveryStrategiesPage } from './components/strategies/RecoveryStrategiesPage';
import { RecoveryControlPage } from './components/control/RecoveryControlPage';
import { PlaceholderPage } from './components/PlaceholderPage';
import { RecoveryProvider } from './context/RecoveryContext';
import { PageId } from './types';

function AppContent() {
  // Sync state with URL hash for browser history / direct linking
  const getInitialPage = (): PageId => {
    const hash = window.location.hash.replace('#', '') as PageId;
    const validPages: PageId[] = [
      'recovery-control',
      'overview',
      'merchant-overview',
      'revenue-at-risk',
      'recovery-opportunities',
      'customers',
      'active-recoveries',
      'campaigns',
      'recovery-strategies',
      'approvals',
      'audit-trail',
      'ask-revive-ai',
      'settings',
    ];
    return validPages.includes(hash) ? hash : 'merchant-overview';
  };

  const [currentPage, setCurrentPage] = useState<PageId>(getInitialPage);

  // Handle hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as PageId;
      if (hash && hash !== currentPage) {
        setCurrentPage(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentPage]);

  const handleNavigate = (page: PageId = 'recovery-control') => {
    setCurrentPage(page);
    window.location.hash = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1C1C1C] flex font-sans relative selection:bg-blue-100 selection:text-blue-900">

      {/* Fixed Left Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Main Content Area (Offset by sidebar width: 16rem / 64) */}
      <div className="flex-1 ml-64 min-w-0 flex flex-col min-h-screen relative z-10">
        {/* Top Sticky Header */}
        <Header currentPage={currentPage} onRefresh={() => handleNavigate(currentPage)} />

        {/* Dynamic Page View Container */}
        <main className="flex-1 px-8 py-7 max-w-7xl w-full mx-auto">
          {currentPage === 'recovery-control' ? (
            <RecoveryControlPage onNavigate={handleNavigate} />
          ) : currentPage === 'overview' ? (
            <OverviewPage onNavigate={handleNavigate} />
          ) : currentPage === 'merchant-overview' ? (
            <MerchantOverviewPage onNavigate={handleNavigate} />
          ) : currentPage === 'revenue-at-risk' ? (
            <RevenueAtRiskPage onNavigate={handleNavigate} />
          ) : currentPage === 'recovery-opportunities' ? (
            <RecoveryOpportunitiesPage />
          ) : currentPage === 'customers' ? (
            <CustomersPage onNavigate={handleNavigate} />
          ) : currentPage === 'active-recoveries' ? (
            <ActiveRecoveriesPage onNavigate={handleNavigate} />
          ) : currentPage === 'campaigns' ? (
            <CampaignsPage onNavigate={handleNavigate} />
          ) : currentPage === 'recovery-strategies' ? (
            <RecoveryStrategiesPage onNavigate={handleNavigate} />
          ) : (
            <PlaceholderPage pageId={currentPage} onNavigate={handleNavigate} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <RecoveryProvider>
      <AppContent />
    </RecoveryProvider>
  );
}

