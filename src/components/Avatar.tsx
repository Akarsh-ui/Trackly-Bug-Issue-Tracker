import React, { useState } from 'react';
import { getInitials } from '../utils/formatters';

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  color?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-11 h-11 text-sm',
};

export function Avatar({
  name,
  src,
  color = '#605E59',
  size = 'sm',
  className = '',
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name || 'Team member'}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${SIZE_CLASSES[size]} rounded object-cover shrink-0 border border-[#E4E2DC] dark:border-[#3A3835] ${className}`}
      />
    );
  }

  return (
    <span
      title={name || 'Unassigned'}
      aria-label={name || 'Unassigned'}
      style={{ backgroundColor: color || '#605E59' }}
      className={`${SIZE_CLASSES[size]} rounded inline-flex items-center justify-center font-medium text-white shrink-0 select-none tracking-tight ${className}`}
    >
      {getInitials(name)}
    </span>
  );
}
