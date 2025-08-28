import React from 'react';

const medalSrcByRank = {
  1: '/img/badges/gold_badge.png',
  2: '/img/badges/silver_badge.png',
  3: '/img/badges/bronze_badge.png',
};

export default function MedalIcon({ rank, size = 32, className = '', userAvatar = null }) {
  if (!rank || rank > 3) return null;
  const src = medalSrcByRank[rank];
  const alt = rank === 1 ? 'Gold medal' : rank === 2 ? 'Silver medal' : 'Bronze medal';
  
  return (
    <div className={`relative inline-block ${className}`}>
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="select-none"
        loading="lazy"
      />
      {userAvatar && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={userAvatar}
            alt="User avatar"
            width={size * 0.6}
            height={size * 0.6}
            className="rounded-full object-cover border-2 border-white shadow-sm"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}


