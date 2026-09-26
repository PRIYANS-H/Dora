import React from 'react';

export default function MatchBars({ breakdown }) {
  if (!breakdown) return null;

  const metrics = [
    { key: 'skill_overlap', label: 'Skill Match', weight: '35%', val: breakdown.skill_overlap, color: 'bg-emerald-400' },
    { key: 'distance_score', label: 'Proximity', weight: '25%', val: breakdown.distance_score, color: 'lp-glass-button' },
    { key: 'rating_score', label: 'Rating', weight: '20%', val: breakdown.rating_score, color: 'bg-purple-400' },
    { key: 'portfolio_overlap', label: 'Portfolio Overlap', weight: '20%', val: breakdown.portfolio_overlap, color: 'bg-sky-400' }
  ];

  return (
    <div className="space-y-2 py-1">
      <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider flex justify-between">
        <span>AI Match Criteria</span>
        <span>Weighted Score Breakdown</span>
      </div>
      {metrics.map((m) => (
        <div key={m.key} className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-gray-300 flex items-center gap-1.5">
              {m.label}
              <span className="text-[10px] text-gray-500 font-mono">({m.weight})</span>
            </span>
            <span className="text-gray-300 font-mono text-[11px]">{m.val}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden border border-white/20">
            <div
              className={`h-full rounded-full transition-all duration-500 ${m.color}`}
              style={{ width: `${Math.max(m.val, 5)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
