import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function GuideModal({ onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="guide-title">사용 가이드</h2>
          <button
            ref={closeRef}
            className="icon-button small"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
        <div className="guide-content">
          <p>
            검색창에 이름의 일부나 종목코드를 입력하세요. KODEX200, 나스닥 100처럼 띄어쓰기가 달라도
            찾을 수 있고, 미국 배당처럼 여러 단어를 함께 쓸 수 있습니다.
          </p>
          <p>
            Enter 또는 검색 버튼으로 전체 결과를 확인합니다. 결과를 클릭하거나 방향키로 선택한 뒤
            Enter를 누르면 개별 분석이 열립니다. Esc는 검색창을 닫고, /는 검색창으로 이동합니다.
          </p>
          <p>
            상단 검색은 전체 ETF를 대상으로 합니다. 전체 결과를 열면 기존 필터가 초기화되며,
            목록에서 시장·테마·운용사·리스크를 다시 좁힐 수 있습니다.
          </p>
          <p>
            삼성전자 같은 보유종목명으로도 ETF를 찾습니다. 검색된 이유를 각 결과에 표시하며, 구성
            내역이 공개되지 않은 ETF는 보유종목 검색에서 누락될 수 있습니다.
          </p>
          <p>관심상품과 최근 조회는 이 브라우저에 저장되어 새로고침 후에도 유지됩니다.</p>
          <p>
            내보내기는 현재 화면의 비교 상품, 검색 결과, 랭킹 또는 개별 분석을 CSV로 저장합니다.
            공유 링크에는 현재 화면과 검색·필터 조건이 포함됩니다.
          </p>
        </div>
      </section>
    </div>
  );
}
