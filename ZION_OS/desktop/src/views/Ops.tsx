import { controlAction } from '../lib/api';
import { useDashboard } from '../context/DashboardContext';
import BackupPanel from '../components/BackupPanel';
import SecurityPanel from '../components/SecurityPanel';
import LogViewer from '../components/LogViewer';
import { ServiceControlsSection } from './sections';

export default function Ops() {
  const { controls } = useDashboard();

  const handleControl = async (action: string) => {
    const res = await controlAction(action);
    if (!res?.ok) throw new Error(res?.error || 'Action failed');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ServiceControlsSection actions={controls?.actions ?? []} onAction={handleControl} />
        <BackupPanel />
        <SecurityPanel />
      </div>
      <LogViewer />
    </div>
  );
}
