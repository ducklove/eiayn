import { Sparkles } from 'lucide-react';
import { useDataFile } from '../../hooks/useDataFile.js';
import { hasAnyChanges } from '../../lib/history.js';
import { formatDateTime, formatPlainPercent } from '../../lib/format.js';
import { etfDeepLink, handleEtfLinkClick } from '../../lib/links.js';

// Renders nothing until the pipeline ships changes.json (first scheduled
// refresh after this feature) or when a refresh produced no changes.
export function ChangesPanel({ onOpenEtf }) {
  const { data: changes } = useDataFile('changes.json');
  if (!hasAnyChanges(changes)) return null;

  return (
    <section className="changes-panel" aria-labelledby="changes-title">
      <div className="section-heading">
        <div className="heading-title">
          <Sparkles size={16} />
          <h3 id="changes-title">오늘의 변화</h3>
        </div>
        <span>{formatDateTime(changes.generatedAt)} KST 갱신 기준</span>
      </div>
      <div className="changes-grid">
        <ChangeGroup
          title={`신규 상장 (${changes.newListings?.length ?? 0})`}
          empty="신규 상장 없음"
          items={changes.newListings}
          onOpenEtf={onOpenEtf}
          render={(item) => <em>{item.market}</em>}
        />
        <ChangeGroup
          title={`총보수 변동 (${changes.feeChanges?.length ?? 0})`}
          empty="보수 변동 없음"
          items={changes.feeChanges}
          onOpenEtf={onOpenEtf}
          render={(item) => (
            <em>
              {formatPlainPercent(item.from)} → {formatPlainPercent(item.to)}
            </em>
          )}
        />
        <ChangeGroup
          title={`점수 급변 (${changes.scoreMoves?.length ?? 0})`}
          empty="점수 급변 없음"
          items={changes.scoreMoves}
          onOpenEtf={onOpenEtf}
          render={(item) => (
            <em className={item.to - item.from >= 0 ? 'positive' : 'negative'}>
              {item.from} → {item.to}점
            </em>
          )}
        />
      </div>
    </section>
  );
}

function ChangeGroup({ title, empty, items, render, onOpenEtf }) {
  const list = (items ?? []).slice(0, 5);
  return (
    <div className="change-group">
      <h4>{title}</h4>
      {list.length ? (
        list.map((item) => (
          <a
            className="change-row"
            href={etfDeepLink(item.id)}
            key={item.id}
            onClick={(event) => handleEtfLinkClick(event, item.id, onOpenEtf)}
          >
            <strong>{item.name}</strong>
            {render(item)}
          </a>
        ))
      ) : (
        <p className="empty-state">{empty}</p>
      )}
    </div>
  );
}
