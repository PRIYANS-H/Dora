import React from 'react';
import Spinner from './Spinner';

export default function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="dori-page-loader" role="status" aria-live="polite">
      <Spinner size="lg" />
      <p>{label}</p>
    </div>
  );
}
