# 연구 데이터 API v1

공개 경로는 `/eiayn/data/research/v1/manifest.json`이다.
`snapshots/<sha256>.json`은 UTF-8 응답 바이트의 SHA-256으로 식별한다.
`node scripts/build-research.mjs`로 생성하며, 데이터 갱신 워크플로우가 과거 스냅샷까지
커밋하고 Pages를 배포한다. 빌드에도 같은 생성기가 적용된다. 기존 버전을 삭제하지 않는다.

ETF 상품 메타데이터와 `scripts/data/research-pairs.json`에서 검토한 비교 후보를 제공한다.
원천 자료에서 두 상품의 통화·기초지수가 검토 조건과 일치하는지 검사한다.
환헤지·복제·분배 정책 미확인 값은 null이다. 순위 점수를 거래 신호로 내보내지 않는다.
보수는 퍼센트 단위다. NAV·호가·일별 분배금의 과거 시계열은 이 API에 포함하지 않는다.

finance-pi가 해시·신선도(14일 이내)를 검사하고 원본을 보관한다. 종목별 가격·유동성과
백테스트는 finance-pi가 담당한다. value-invest는 데이터 버전을 고정한 연구·관찰을 제공한다.
현재 상품 조건은 과거 시점 검증 자료가 아니며 실거래 승인 필드는 항상 false다.
