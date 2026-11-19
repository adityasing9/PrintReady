import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutShell } from './components/LayoutShell';
import { AccountSettingsView } from './components/customer/AccountSettingsView';
import { PrintQueueView } from './components/customer/PrintQueueView';
import { SavedShopsView } from './components/customer/SavedShopsView';
import { ScannerPdfToolsView } from './components/customer/ScannerPdfToolsView';
import { SentHistoryView } from './components/customer/SentHistoryView';
import { PrintReadyProvider, usePrintReady } from './context/PrintReadyContext';

function CustomerAppRouter() {
  const { activeTab } = usePrintReady();

  switch (activeTab) {
    case 'shops':
      return <SavedShopsView />;
    case 'scanner':
      return <ScannerPdfToolsView />;
    case 'history':
      return <SentHistoryView />;
    case 'account':
    case 'settings':
      return <AccountSettingsView />;
    case 'queue':
    case 'home':
    case 'basket':
    case 'vault':
    default:
      return <PrintQueueView />;
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
