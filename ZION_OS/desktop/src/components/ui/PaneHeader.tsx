import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  sub?: string;
}

export function PaneHeader({ icon, title, sub }: Props) {
  return (
    <div className="zion-pane-header">
      {icon && <div className="pane-icon">{icon}</div>}
      <div>
        <h2>{title}</h2>
        {sub && <div className="pane-sub">{sub}</div>}
      </div>
    </div>
  );
}
