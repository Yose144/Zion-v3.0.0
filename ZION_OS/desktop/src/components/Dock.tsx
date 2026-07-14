import {
  LayoutGrid,
  Pickaxe,
  Network,
  Globe,
  Terminal,
  Settings,
  type LucideIcon,
} from 'lucide-react';

type TabId = 'overview' | 'mining' | 'network' | 'ecosystem' | 'operations';

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

const ITEMS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Home', icon: LayoutGrid },
  { id: 'mining', label: 'Mining', icon: Pickaxe },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'ecosystem', label: 'DeFi', icon: Globe },
  { id: 'operations', label: 'Ops', icon: Terminal },
];

export default function Dock({ active, onChange }: Props) {
  return (
    <nav className="zion-dock">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`zion-dock-item${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
      <div className="zion-dock-sep" />
      <button className="zion-dock-item" title="Settings">
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
