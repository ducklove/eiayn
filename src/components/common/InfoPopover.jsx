import { CircleHelp } from 'lucide-react';

export function InfoPopover({ title, children }) {
  return (
    <details className="info-popover">
      <summary aria-label={title}>
        <CircleHelp size={15} />
      </summary>
      <div className="popover-panel">
        <strong>{title}</strong>
        {children}
      </div>
    </details>
  );
}
