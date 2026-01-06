import React from 'react';

const medalSrcByRank = {
  1: '/img/badges/gold_badge.png',
  2: '/img/badges/silver_badge.png',
  3: '/img/badges/bronze_badge.png',
};

export default function MedalIcon({ rank, size = 32, className = '' }) {
  if (!rank || rank > 3) return null;
  const src = medalSrcByRank[rank];
  const alt = rank === 1 ? 'Gold medal' : rank === 2 ? 'Silver medal' : 'Bronze medal';
  
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="select-none absolute inset-0"
        loading="lazy"
      />
    </div>
  );
}
