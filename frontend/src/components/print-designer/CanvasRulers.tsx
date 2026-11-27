'use client';

import React from 'react';

type CanvasRulersProps = {
  widthMm: number;
  heightMm: number;
  zoom: number;
};

/**
 * Millimeter rulers (top RTL horizontal + right vertical) scaled to match the canvas zoom.
 */
export function CanvasRulers({ widthMm, heightMm, zoom }: CanvasRulersProps) {
  const majorStep = 10;
  const hTicks: number[] = [];
  for (let mm = 0; mm <= widthMm; mm += 5) {
    hTicks.push(mm);
  }
  const vTicks: number[] = [];
  for (let mm = 0; mm <= heightMm; mm += 5) {
    vTicks.push(mm);
  }

  return (
    <>
      {/* Top Horizontal RTL Ruler */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none relative h-5 bg-slate-100/95 dark:bg-slate-900/95 border-b border-slate-300 dark:border-slate-700 text-[8px] font-mono text-slate-500 dark:text-slate-400 shrink-0"
        style={{ width: `${widthMm * zoom}mm` }}
      >
        {hTicks.map((mm) => {
          const isMajor = mm % majorStep === 0;
          return (
            <div
              key={mm}
              style={{ right: `${mm * zoom}mm` }}
              className="absolute bottom-0 flex flex-col items-center"
            >
              {isMajor && mm > 0 && mm < widthMm && (
                <span className="translate-x-1/2 leading-none mb-0.5">{mm}</span>
              )}
              <div
                className={`w-px bg-slate-400 dark:bg-slate-600 ${
                  isMajor ? 'h-2' : 'h-1 opacity-60'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Right Vertical Ruler */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute top-5 right-0 w-5 bg-slate-100/95 dark:bg-slate-900/95 border-l border-slate-300 dark:border-slate-700 text-[8px] font-mono text-slate-500 dark:text-slate-400"
        style={{ height: `${heightMm * zoom}mm` }}
      >
        {vTicks.map((mm) => {
          const isMajor = mm % majorStep === 0;
          return (
            <div
              key={mm}
              style={{ top: `${mm * zoom}mm` }}
              className="absolute left-0 flex items-center"
            >
              <div
                className={`h-px bg-slate-400 dark:bg-slate-600 ${
                  isMajor ? 'w-2' : 'w-1 opacity-60'
                }`}
              />
              {isMajor && mm > 0 && mm < heightMm && (
                <span className="-translate-y-1/2 pr-0.5 leading-none">{mm}</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
