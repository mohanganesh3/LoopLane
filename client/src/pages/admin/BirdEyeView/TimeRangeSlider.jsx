import { useState, useCallback } from 'react';
import { UI_COLORS } from './utils/colors';

const PRESETS = [
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
  { label: '30D', hours: 720 },
  { label: 'ALL', hours: 0 },
];

const TimeRangeSlider = ({ onDateRangeChange }) => {
  const [active, setActive] = useState('ALL');

  const handlePreset = useCallback((preset) => {
    setActive(preset.label);
    if (preset.hours === 0) {
      onDateRangeChange?.(null);
    } else {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - preset.hours * 3600000).toISOString();
      onDateRangeChange?.({ startDate, endDate });
    }
  }, [onDateRangeChange]);

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: 16, zIndex: 10,
      fontFamily: '"Space Grotesk", "Fira Code", monospace',
    }}>
      <div style={{
        background: UI_COLORS.bgPanel, backdropFilter: 'blur(12px)',
        border: `1px solid ${UI_COLORS.border}`, borderRadius: 12,
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <i className="fas fa-clock" style={{ color: UI_COLORS.textDim, fontSize: 10, marginRight: 4 }} />
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p)}
            style={{
              padding: '4px 12px', borderRadius: 6,
              background: active === p.label ? 'rgba(14,173,105,0.15)' : 'transparent',
              border: `1px solid ${active === p.label ? UI_COLORS.cyan : 'transparent'}`,
              color: active === p.label ? UI_COLORS.cyan : UI_COLORS.textDim,
              fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
              letterSpacing: 1, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (active !== p.label) e.currentTarget.style.color = UI_COLORS.text; }}
            onMouseOut={e => { if (active !== p.label) e.currentTarget.style.color = UI_COLORS.textDim; }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeRangeSlider;
