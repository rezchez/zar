'use client';

import React from 'react';
import { getShapeSvg } from '@/lib/gemstone-shape-svgs';

interface GemstoneShapeIconProps {
  shapeCode?: string;
  svgIcon?: string;
  className?: string;
  size?: number;
  title?: string;
}

/**
 * GemstoneShapeIcon: Renders gemological line wireframe vector for diamond/gemstone cuts.
 */
export default function GemstoneShapeIcon({
  shapeCode,
  svgIcon,
  className = 'size-5',
  size,
  title,
}: GemstoneShapeIconProps) {
  const rawSvg = svgIcon || (shapeCode ? getShapeSvg(shapeCode) : '');
  if (!rawSvg) return null;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400 [&>svg]:size-full [&>svg]:stroke-current ${className}`}
      style={size ? { width: size, height: size } : undefined}
      title={title}
      dangerouslySetInnerHTML={{ __html: rawSvg }}
    />
  );
}
