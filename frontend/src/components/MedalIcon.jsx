import React from 'react';

const medalSrcByRank = {
  1: '/img/badges/gold_badge.png',
  2: '/img/badges/silver_badge.png',
  3: '/img/badges/bronze_badge.png',
};

const rankTextColors = {
  1: 'text-yellow-900',
  2: 'text-gray-700',
  3: 'text-orange-900',
};

export default function MedalIcon({ rank, size = 32, className = '' }) {
  if (!rank || rank > 3) return null;
  const src = medalSrcByRank[rank];
  const alt = rank === 1 ? 'Gold medal' : rank === 2 ? 'Silver medal' : 'Bronze medal';
  const textColor = rankTextColors[rank];
  const fontSize = size * 0.4;
  
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
      <span 
        className={`relative font-bold ${textColor}`}
        style={{ fontSize: `${fontSize}px`, lineHeight: 1, marginTop: size * 0.05 }}
      >
        {rank}.
      </span>
    </div>
  );
}
