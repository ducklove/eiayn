import { Compass } from 'lucide-react';

// Each preset was validated against the current snapshot to return results
// (e.g. 국내+시장대표 218, 채권 222, 커버드콜 52, 반도체 44, 배당 46).
const PRESETS = [
  { label: '국내 시장대표', filters: { market: '국내', theme: '시장대표' } },
  { label: '고배당', filters: { theme: '배당' } },
  { label: '반도체', filters: { theme: '반도체' } },
  { label: '커버드콜', filters: { theme: '커버드콜' } },
  { label: '채권', filters: { theme: '채권' } },
  { label: '낮은 변동성', filters: { risk: '낮음' } },
];

export function PresetBar({ onApply }) {
  return (
    <div className="preset-bar" role="group" aria-label="빠른 탐색 프리셋">
      <span className="preset-label">
        <Compass size={15} />
        빠른 탐색
      </span>
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className="preset-chip"
          onClick={() => onApply(preset)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
