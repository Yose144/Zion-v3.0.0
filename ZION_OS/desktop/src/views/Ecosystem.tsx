import LayerStatusPanel from '../components/LayerStatusPanel';
import DefiPanel from '../components/DefiPanel';
import BridgePanel from '../components/BridgePanel';
import CexPanel from '../components/CexPanel';
import WarpPanel from '../components/WarpPanel';
import DaoPanel from '../components/DaoPanel';

export default function Ecosystem() {
  return (
    <div className="space-y-5">
      <LayerStatusPanel />
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">DeFi · Bridge · WARP · DAO</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <DefiPanel />
          <BridgePanel />
          <CexPanel />
          <WarpPanel />
          <DaoPanel />
        </div>
      </section>
    </div>
  );
}
