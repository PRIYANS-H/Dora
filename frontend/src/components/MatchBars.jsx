import React from 'react';

const METRICS = [
  { key: 'skill_overlap', label: 'Skill match', weight: '35%' },
  { key: 'distance_score', label: 'Proximity', weight: '25%' },
  { key: 'rating_score', label: 'Rating', weight: '20%' },
  { key: 'portfolio_overlap', label: 'Portfolio overlap', weight: '20%' },
];

export default function MatchBars({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div className="match-bars">
      {METRICS.map((metric, index) => {
        const value = Math.round(Number(breakdown[metric.key]) || 0);
        return (
          <div className="match-bar" key={metric.key}>
            <span className="match-bar-label">{metric.label} <em>{metric.weight}</em></span>
            <span className="match-bar-value">{value}%</span>
            <span className="match-bar-track"><i style={{ width: `${Math.max(value, 3)}%`, animationDelay: `${index * 90}ms` }} /></span>
          </div>
        );
      })}
    </div>
  );
}
