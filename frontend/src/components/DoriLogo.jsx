import React, { useId } from 'react';

// The landing page's DORI wordmark, with its inner cut-outs masked so the
// logo stays see-through on glass instead of punching black holes into it.
export function DoriWordmark({ className = '', title }) {
  const maskId = `dori-mask-${useId().replace(/:/g, '')}`;
  return (
    <svg className={className} viewBox="0 0 96 32" fill="currentColor" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="96" height="32">
          <rect width="96" height="32" fill="#fff" />
          <path d="M13 4c7 0 13 5.5 13 12S20 28 13 28" fill="none" stroke="#000" strokeWidth="2" />
          <circle cx="44" cy="16" r="5" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <path d="M2 4h10c8 0 14 5.5 14 12S20 28 12 28H2V4z" />
        <circle cx="44" cy="16" r="12" />
        <rect x="60" y="4" width="4" height="24" rx="2" />
        <path d="M64 16l12-12v24L64 16z" />
      </g>
    </svg>
  );
}
