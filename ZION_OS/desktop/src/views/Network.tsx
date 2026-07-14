import { useDashboard } from '../context/DashboardContext';
import ChainPanel from '../components/ChainPanel';
import MempoolPanel from '../components/MempoolPanel';
import AgentPanel from '../components/AgentPanel';
import { WalletsSection, ExplorerSection, AlertsHistorySection } from './sections';

export default function Network() {
  const { status, wallets, blocks, edgeOverview, alertsHistory } = useDashboard();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChainPanel status={status} />
        <MempoolPanel />
        <AgentPanel />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WalletsSection wallets={wallets} />
        <ExplorerSection blocks={blocks} overview={edgeOverview} />
      </div>
      <AlertsHistorySection history={alertsHistory} />
    </div>
  );
}
