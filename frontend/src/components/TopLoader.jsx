import React, { useEffect, useState } from 'react';
import { subscribeActivity } from '../api/client';

export default function TopLoader() {
  const [active, setActive] = useState(false);

  useEffect(() => subscribeActivity((count) => setActive(count > 0)), []);

  return (
    <div className={`dori-top-loader ${active ? 'is-active' : ''}`} aria-hidden="true">
      <div className="dori-top-loader-bar" />
    </div>
  );
}
