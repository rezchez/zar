import React from 'react';

export function BaleIcon({ className = 'w-4 h-4', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#00BC8C" />
      <path
        d="M24 10C16.268 10 10 16.268 10 24C10 27.24 11.096 30.228 12.944 32.612L11.08 37.168C10.876 37.668 11.332 38.124 11.832 37.92L16.388 36.056C18.772 37.904 21.76 39 25 39C32.732 39 39 32.732 39 25C39 17.268 32.732 10 25 10H24ZM19 21.5C19 20.672 19.672 20 20.5 20H28.5C29.328 20 30 20.672 30 21.5C30 22.328 29.328 23 28.5 23H20.5C19.672 23 19 22.328 19 21.5ZM19 27.5C19 26.672 19.672 26 20.5 26H26.5C27.328 26 28 26.672 28 27.5C28 28.328 27.328 29 26.5 29H20.5C19.672 29 19 28.328 19 27.5Z"
        fill="white"
      />
    </svg>
  );
}

export default BaleIcon;
