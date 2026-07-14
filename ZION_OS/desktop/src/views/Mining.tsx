import { useDashboard } from '../context/DashboardContext';
import MinerPanel from '../components/MinerPanel';
import PoolPanel from '../components/PoolPanel';
import PerformanceCharts from '../components/PerformanceCharts';
import HashrateChart from '../components/HashrateChart';
import AuxPowPanel from '../components/AuxPowPanel';
import { RevenueSection, EventsSection } from './sections';

export default function Mining() {
  const { status, revenue, poolDashboard, events } = useDashboard();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <MinerPanel miner={status?.miner} />
        <PoolPanel pool={status?.pool} poolEdge={status?.pool_edge} />
        <PerformanceCharts miner={status?.miner} />
      </div>
      <HashrateChart />
      <RevenueSection revenue={revenue} poolDashboard={poolDashboard} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AuxPowPanel />
        <EventsSection events={events} connectionHistory={poolDashboard?.connection_history} />
      </div>
    </div>
  );
}
