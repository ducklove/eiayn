import { X } from 'lucide-react';

export function GuideModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 id="guide-title">사용 가이드</h2>
          <button className="icon-button small" type="button" onClick={onClose} aria-label="닫기"><X size={16} /></button>
        </div>
        <div className="guide-content">
          <p>통합검색은 ETF명, 티커, 운용사, 테마, 카테고리, 주요 보유종목명을 함께 검색합니다.</p>
          <p>검색 결과에서 ETF를 선택하면 메인 화면의 개별 분석이 해당 상품으로 전환됩니다.</p>
          <p>관심상품과 최근 조회는 브라우저 localStorage에 저장되어 새로고침 후에도 유지됩니다.</p>
          <p>내보내기는 현재 선택 ETF의 핵심 데이터를 CSV로 저장하고, 공유는 `code` 딥링크를 URL에 반영합니다.</p>
        </div>
      </section>
    </div>
  );
}
