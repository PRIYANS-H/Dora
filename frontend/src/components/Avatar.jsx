import React, { useState } from 'react';
import { isRealPhoto } from '../utils/avatar';
import { DoriWordmark } from './DoriLogo';

export default function Avatar({ src, name = '', size = 40, square = false, className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showPhoto = isRealPhoto(src) && failedSrc !== src;
  const classes = ['avatar', showPhoto ? '' : 'avatar-logo', square ? 'is-square' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} style={{ width: size, height: size }} title={name || undefined}>
      {showPhoto
        ? <img src={src} alt={name} loading="lazy" onError={() => setFailedSrc(src)} />
        : <DoriWordmark title={name ? `${name} (no photo yet)` : 'DORI'} />}
    </span>
  );
}
