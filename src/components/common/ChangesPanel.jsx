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
        <span>
          {formatDateTime(changes.generatedAt)} KST 갱신 기준 · 목록 편입·제외는 수집 대상의
          변화입니다.
        </span>
      </div>
      {changes.scoreModelChange && (
        <p className="empty-state">
          점수 산식이 {changes.scoreModelChange.from}에서 {changes.scoreModelChange.to}으로
          변경되었습니다. 산식 변경 전후 점수 차이는 급변 알림에서 제외합니다.
        </p>
      )}
      <div className="changes-grid">
        <ChangeGroup
          title={`목록 편입 (${changes.newListings?.length ?? 0})`}
          empty="목록 편입 없음"
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
