import React from 'react';

const SIZES = { sm: 14, md: 22, lg: 34, xl: 46 };

export default function Spinner({ size = 'md', className = '' }) {
  const px = SIZES[size] || SIZES.md;
  return (
    <span
      className={`dori-spinner ${className}`}
      style={{ width: px, height: px }}
      role="status"
      aria-label="Loading"
    />
  );
}
