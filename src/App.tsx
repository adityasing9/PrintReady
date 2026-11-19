import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutShell } from './components/LayoutShell';
import { AccountSettingsView } from './components/customer/AccountSettingsView';
import { CustomerHomeView } from './components/customer/CustomerHomeView';
import { CustomerOrdersView } from './components/customer/CustomerOrdersView';
import { DocumentVaultView } from './components/customer/DocumentVaultView';
import { PrintBasketView } from './components/customer/PrintBasketView';
import { ScannerPdfToolsView } from './components/customer/ScannerPdfToolsView';
import { ShopDiscoveryView } from './components/customer/ShopDiscoveryView';
import { PrintReadyProvider, usePrintReady } from './context/PrintReadyContext';

function CustomerAppRouter() {
  const { activeTab } = usePrintReady();

  switch (activeTab) {
    case 'vault':
      return <DocumentVaultView />;
    case 'scanner':
      return <ScannerPdfToolsView />;
    case 'basket':
      return <PrintBasketView />;
    case 'shops':
      return <ShopDiscoveryView />;
    case 'orders':
      return <CustomerOrdersView />;
    case 'account':
      return <AccountSettingsView />;
    case 'home':
    default:
      return <CustomerHomeView />;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <PrintReadyProvider>
        <LayoutShell>
          <CustomerAppRouter />
        </LayoutShell>
      </PrintReadyProvider>
    </ErrorBoundary>
  );
}
