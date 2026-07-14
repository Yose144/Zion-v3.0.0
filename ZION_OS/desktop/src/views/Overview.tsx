import { useDashboard } from '../context/DashboardContext';
import ReadinessBar from '../components/ReadinessBar';
import ServiceGrid from '../components/ServiceGrid';
import MonitoringPanel from '../components/MonitoringPanel';
import ChainPanel from '../components/ChainPanel';
import AlertsPanel from '../components/AlertsPanel';
import { ChecklistSection, EdgeOverviewSection } from './sections';

export default function Overview() {
  const { readiness, checklist, edgeOverview, services, status, monitoring, alerts } = useDashboard();

  return (
    <div className="space-y-5">
      <ReadinessBar readiness={readiness} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChecklistSection checklist={checklist} />
        <EdgeOverviewSection overview={edgeOverview} />
      </div>
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Services</h2>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Live</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Degraded</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Down</span>
          </div>
        </div>
        <ServiceGrid services={services} />
      </section>
      <MonitoringPanel monitoring={monitoring} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChainPanel status={status} />
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}
