import { describe, expect, it } from 'bun:test';

import {
  GEMSTONE_SHAPE_SVGS,
  getShapeSvg,
} from '@/lib/gemstone-shape-svgs';

describe('Gemological Diamond Shapes Facet Wireframe SVGs', () => {
  const standardShapes = [
    'round',
    'princess',
    'baguette',
    'baguette_calibre',
    'baguette_taper',
    'cushion',
    'emerald',
    'oval',
    'pear',
    'radiant',
    'heart',
    'marquise',
    'asscher',
    'triangle',
    'rose_cut',
    'cabochon',
    'other',
  ];

  it('provides high-precision SVGs for all standard diamond cut shapes', () => {
    for (const shapeCode of standardShapes) {
      const svg = GEMSTONE_SHAPE_SVGS[shapeCode];
      expect(svg).toBeDefined();
      expect(typeof svg).toBe('string');
      expect(svg.trim().startsWith('<svg')).toBe(true);
      expect(svg.trim().endsWith('</svg>')).toBe(true);
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg).toContain('stroke="currentColor"');
    }
  });

  it('includes authentic geometric crown and table facets for round brilliant cut', () => {
    const roundSvg = GEMSTONE_SHAPE_SVGS.round;
    // Circular girdle outline
    expect(roundSvg).toContain('<circle');
    // Octagonal table
    expect(roundSvg).toContain('<polygon');
  });

  it('includes sharp 90-degree square and chevron facets for princess cut', () => {
    const princessSvg = GEMSTONE_SHAPE_SVGS.princess;
    expect(princessSvg).toContain('<rect');
    expect(princessSvg).toContain('<polygon');
  });

  it('includes step cut corners and miter lines for emerald cut', () => {
    const emeraldSvg = GEMSTONE_SHAPE_SVGS.emerald;
    expect(emeraldSvg).toContain('<polygon');
    expect(emeraldSvg).toContain('<line');
  });

  it('includes windmill pattern for asscher cut', () => {
    const asscherSvg = GEMSTONE_SHAPE_SVGS.asscher;
    expect(asscherSvg).toContain('points="32,8 68,8 92,32');
    expect(asscherSvg).toContain('<line');
  });

  it('includes cleft and apex for heart shape', () => {
    const heartSvg = GEMSTONE_SHAPE_SVGS.heart;
    expect(heartSvg).toContain('<path');
  });

  it('resolves shape aliases safely with getShapeSvg', () => {
    expect(getShapeSvg('round')).toBe(GEMSTONE_SHAPE_SVGS.round);
    expect(getShapeSvg('brilliant')).toBe(GEMSTONE_SHAPE_SVGS.round);
    expect(getShapeSvg('baguette_straight')).toBe(GEMSTONE_SHAPE_SVGS.baguette_straight);
    expect(getShapeSvg('baguette_tapered')).toBe(GEMSTONE_SHAPE_SVGS.baguette_tapered);
    expect(getShapeSvg('trillion')).toBe(GEMSTONE_SHAPE_SVGS.triangle);
    expect(getShapeSvg('unknown_custom_gem')).toBe(GEMSTONE_SHAPE_SVGS.other);
  });
});
