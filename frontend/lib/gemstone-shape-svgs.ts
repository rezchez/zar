/**
 * Authoritative High-Precision Gemological Facet Wireframe SVGs
 * Standard diamond and gemstone crown & table facet diagrams (Top View).
 * ViewBox: 0 0 100 100
 */

export interface ShapeSvgDefinition {
  code: string;
  nameFa: string;
  nameEn: string;
  viewBox: string;
  paths: {
    d?: string;
    type?: 'path' | 'circle' | 'rect' | 'polygon' | 'line';
    props?: Record<string, string | number>;
  }[];
  rawSvg: string;
}

/**
 * Creates a complete SVG markup string from definition
 */
function createSvgString(innerMarkup: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${innerMarkup}</svg>`;
}

export const GEMSTONE_SHAPE_SVGS: Record<string, string> = {
  // 1. Round Brilliant (گرد / برلیان) - 57/58 facets standard GIA top view
  round: createSvgString(`
    <!-- Girdle Outline -->
    <circle cx="50" cy="50" r="44" stroke-width="2.5" />
    <!-- Table Octagon -->
    <polygon points="38,21 62,21 79,38 79,62 62,79 38,79 21,62 21,38" stroke-width="2" />
    <!-- 8 Star Facets -->
    <polygon points="50,6 38,21 62,21" />
    <polygon points="94,50 79,38 79,62" />
    <polygon points="50,94 62,79 38,79" />
    <polygon points="6,50 21,62 21,38" />
    <!-- 8 Kite Bezel Facets -->
    <polygon points="50,6 62,21 79,38 81,19" />
    <polygon points="94,50 79,62 62,79 81,81" />
    <polygon points="50,94 38,79 21,62 19,81" />
    <polygon points="6,50 21,38 38,21 19,19" />
    <!-- Outer radial girdle break rays -->
    <line x1="81" y1="19" x2="94" y2="50" />
    <line x1="81" y1="19" x2="50" y2="6" />
    <line x1="81" y1="81" x2="94" y2="50" />
    <line x1="81" y1="81" x2="50" y2="94" />
    <line x1="19" y1="81" x2="50" y2="94" />
    <line x1="19" y1="81" x2="6" y2="50" />
    <line x1="19" y1="19" x2="6" y2="50" />
    <line x1="19" y1="19" x2="50" y2="6" />
  `),

  // 2. Princess Cut (پرنسس) - Square brilliant cut with diagonal chevrons
  princess: createSvgString(`
    <!-- Girdle Square -->
    <rect x="8" y="8" width="84" height="84" rx="1" stroke-width="2.5" />
    <!-- Center Square Table -->
    <rect x="30" y="30" width="40" height="40" stroke-width="2" />
    <!-- Center Diamond Core -->
    <polygon points="50,30 70,50 50,70 30,50" stroke-width="1.5" />
    <!-- Corner Bezel Rays -->
    <line x1="8" y1="8" x2="30" y2="30" stroke-width="2" />
    <line x1="92" y1="8" x2="70" y2="30" stroke-width="2" />
    <line x1="92" y1="92" x2="70" y2="70" stroke-width="2" />
    <line x1="8" y1="92" x2="30" y2="70" stroke-width="2" />
    <!-- Outer Chevron Triangles -->
    <polygon points="50,8 30,30 70,30" />
    <polygon points="92,50 70,30 70,70" />
    <polygon points="50,92 70,70 30,70" />
    <polygon points="8,50 30,70 30,30" />
    <!-- Corner Chevron Wings -->
    <line x1="8" y1="8" x2="50" y2="8" />
    <line x1="92" y1="8" x2="50" y2="8" />
    <line x1="92" y1="8" x2="92" y2="50" />
    <line x1="92" y1="92" x2="92" y2="50" />
    <line x1="92" y1="92" x2="50" y2="92" />
    <line x1="8" y1="92" x2="50" y2="92" />
    <line x1="8" y1="92" x2="8" y2="50" />
    <line x1="8" y1="8" x2="8" y2="50" />
  `),

  // 3. Baguette Cut / Straight (باگت کالیبره / مستقیم) - Step cut rectangle
  baguette: createSvgString(`
    <!-- Outer Rectangular Girdle -->
    <rect x="22" y="8" width="56" height="84" stroke-width="2.5" />
    <!-- Inner Step Cut Rect 1 -->
    <rect x="30" y="16" width="40" height="68" stroke-width="1.5" />
    <!-- Flat Center Table -->
    <rect x="38" y="24" width="24" height="52" stroke-width="2" />
    <!-- Corner Miter Facet Lines -->
    <line x1="22" y1="8" x2="38" y2="24" stroke-width="1.8" />
    <line x1="78" y1="8" x2="62" y2="24" stroke-width="1.8" />
    <line x1="78" y1="92" x2="62" y2="76" stroke-width="1.8" />
    <line x1="22" y1="92" x2="38" y2="76" stroke-width="1.8" />
  `),

  baguette_calibre: createSvgString(`
    <!-- Outer Rectangular Girdle -->
    <rect x="22" y="8" width="56" height="84" stroke-width="2.5" />
    <!-- Inner Step Cut Rect 1 -->
    <rect x="30" y="16" width="40" height="68" stroke-width="1.5" />
    <!-- Flat Center Table -->
    <rect x="38" y="24" width="24" height="52" stroke-width="2" />
    <!-- Corner Miter Facet Lines -->
    <line x1="22" y1="8" x2="38" y2="24" stroke-width="1.8" />
    <line x1="78" y1="8" x2="62" y2="24" stroke-width="1.8" />
    <line x1="78" y1="92" x2="62" y2="76" stroke-width="1.8" />
    <line x1="22" y1="92" x2="38" y2="76" stroke-width="1.8" />
  `),

  baguette_straight: createSvgString(`
    <!-- Outer Rectangular Girdle -->
    <rect x="22" y="8" width="56" height="84" stroke-width="2.5" />
    <!-- Inner Step Cut Rect 1 -->
    <rect x="30" y="16" width="40" height="68" stroke-width="1.5" />
    <!-- Flat Center Table -->
    <rect x="38" y="24" width="24" height="52" stroke-width="2" />
    <!-- Corner Miter Facet Lines -->
    <line x1="22" y1="8" x2="38" y2="24" stroke-width="1.8" />
    <line x1="78" y1="8" x2="62" y2="24" stroke-width="1.8" />
    <line x1="78" y1="92" x2="62" y2="76" stroke-width="1.8" />
    <line x1="22" y1="92" x2="38" y2="76" stroke-width="1.8" />
  `),

  // 4. Baguette Tapered (باگت مخروطی / تیپر) - Symmetrical trapezoid
  baguette_taper: createSvgString(`
    <!-- Outer Trapezoid Girdle -->
    <polygon points="26,8 74,8 64,92 36,92" stroke-width="2.5" />
    <!-- Mid Step Trapezoid -->
    <polygon points="32,16 68,16 59,84 41,84" stroke-width="1.5" />
    <!-- Center Table Trapezoid -->
    <polygon points="38,24 62,24 55,76 45,76" stroke-width="2" />
    <!-- Corner Miter Lines -->
    <line x1="26" y1="8" x2="38" y2="24" stroke-width="1.8" />
    <line x1="74" y1="8" x2="62" y2="24" stroke-width="1.8" />
    <line x1="64" y1="92" x2="55" y2="76" stroke-width="1.8" />
    <line x1="36" y1="92" x2="45" y2="76" stroke-width="1.8" />
  `),

  baguette_tapered: createSvgString(`
    <!-- Outer Trapezoid Girdle -->
    <polygon points="26,8 74,8 64,92 36,92" stroke-width="2.5" />
    <!-- Mid Step Trapezoid -->
    <polygon points="32,16 68,16 59,84 41,84" stroke-width="1.5" />
    <!-- Center Table Trapezoid -->
    <polygon points="38,24 62,24 55,76 45,76" stroke-width="2" />
    <!-- Corner Miter Lines -->
    <line x1="26" y1="8" x2="38" y2="24" stroke-width="1.8" />
    <line x1="74" y1="8" x2="62" y2="24" stroke-width="1.8" />
    <line x1="64" y1="92" x2="55" y2="76" stroke-width="1.8" />
    <line x1="36" y1="92" x2="45" y2="76" stroke-width="1.8" />
  `),

  // 5. Cushion Cut (کوشن / بالشتکی) - Curved pillow square with brilliant faceting
  cushion: createSvgString(`
    <!-- Pillow Girdle Outline with Curved Sides -->
    <path d="M26,8 C40,6 60,6 74,8 C88,10 94,16 92,26 C94,40 94,60 92,74 C94,88 88,94 74,92 C60,94 40,94 26,92 C12,94 6,88 8,74 C6,60 6,40 8,26 C6,12 12,6 26,8 Z" stroke-width="2.5" />
    <!-- Soft Octagonal Table -->
    <polygon points="36,26 64,26 74,36 74,64 64,74 36,74 26,64 26,36" stroke-width="2" />
    <!-- Star Facets -->
    <polygon points="50,6 36,26 64,26" />
    <polygon points="93,50 74,36 74,64" />
    <polygon points="50,94 64,74 36,74" />
    <polygon points="7,50 26,64 26,36" />
    <!-- Corner Bezel Points -->
    <line x1="26" y1="36" x2="12" y2="18" stroke-width="1.8" />
    <line x1="64" y1="26" x2="88" y2="18" stroke-width="1.8" />
    <line x1="74" y1="64" x2="88" y2="82" stroke-width="1.8" />
    <line x1="36" y1="74" x2="12" y2="82" stroke-width="1.8" />
    <!-- Center Brilliant Diamond Core -->
    <polygon points="50,38 62,50 50,62 38,50" stroke-width="1.5" />
    <line x1="36" y1="26" x2="50" y2="38" />
    <line x1="64" y1="26" x2="50" y2="38" />
    <line x1="74" y1="36" x2="62" y2="50" />
    <line x1="74" y1="64" x2="62" y2="50" />
    <line x1="64" y1="74" x2="50" y2="62" />
    <line x1="36" y1="74" x2="50" y2="62" />
    <line x1="26" y1="64" x2="38" y2="50" />
    <line x1="26" y1="36" x2="38" y2="50" />
  `),

  // 6. Emerald Cut (امرالد / زمردی) - Octagonal rectangle step cut
  emerald: createSvgString(`
    <!-- Cut-Corner Outer Girdle -->
    <polygon points="28,8 72,8 88,24 88,76 72,92 28,92 12,76 12,24" stroke-width="2.5" />
    <!-- Mid Step Ring -->
    <polygon points="32,16 68,16 80,28 80,72 68,84 32,84 20,72 20,28" stroke-width="1.5" />
    <!-- Inner Table Ring -->
    <polygon points="36,24 64,24 72,32 72,68 64,76 36,76 28,68 28,32" stroke-width="2" />
    <!-- Corner Miter Ray Lines -->
    <line x1="12" y1="24" x2="28" y2="32" stroke-width="1.8" />
    <line x1="28" y1="8" x2="36" y2="24" stroke-width="1.8" />
    <line x1="72" y1="8" x2="64" y2="24" stroke-width="1.8" />
    <line x1="88" y1="24" x2="72" y2="32" stroke-width="1.8" />
    <line x1="88" y1="76" x2="72" y2="68" stroke-width="1.8" />
    <line x1="72" y1="92" x2="64" y2="76" stroke-width="1.8" />
    <line x1="28" y1="92" x2="36" y2="76" stroke-width="1.8" />
    <line x1="12" y1="76" x2="28" y2="68" stroke-width="1.8" />
  `),

  // 7. Oval Brilliant (بیضی) - Elliptical brilliant cut
  oval: createSvgString(`
    <!-- Girdle Ellipse Outline -->
    <ellipse cx="50" cy="50" rx="34" ry="44" stroke-width="2.5" />
    <!-- 8-sided Oval Table -->
    <polygon points="40,24 60,24 72,38 72,62 60,76 40,76 28,62 28,38" stroke-width="2" />
    <!-- North/South Star Triangles -->
    <polygon points="50,6 40,24 60,24" />
    <polygon points="50,94 60,76 40,76" />
    <!-- East/West Star Triangles -->
    <polygon points="84,50 72,38 72,62" />
    <polygon points="16,50 28,62 28,38" />
    <!-- Diagonal Kite Rays -->
    <line x1="40" y1="24" x2="26" y2="14" stroke-width="1.8" />
    <line x1="60" y1="24" x2="74" y2="14" stroke-width="1.8" />
    <line x1="72" y1="38" x2="81" y2="28" stroke-width="1.8" />
    <line x1="72" y1="62" x2="81" y2="72" stroke-width="1.8" />
    <line x1="60" y1="76" x2="74" y2="86" stroke-width="1.8" />
    <line x1="40" y1="76" x2="26" y2="86" stroke-width="1.8" />
    <line x1="28" y1="62" x2="19" y2="72" stroke-width="1.8" />
    <line x1="28" y1="38" x2="19" y2="28" stroke-width="1.8" />
  `),

  // 8. Pear Shape (اشک / گلابی) - Teardrop brilliant cut
  pear: createSvgString(`
    <!-- Teardrop Girdle Outline -->
    <path d="M50,6 C58,22 84,48 84,66 C84,84 69,94 50,94 C31,94 16,84 16,66 C16,48 42,22 50,6 Z" stroke-width="2.5" />
    <!-- Pear Faceted Table -->
    <path d="M50,26 L64,44 L68,66 L50,78 L32,66 L36,44 Z" stroke-width="2" />
    <!-- Top Apex Kite Facet -->
    <polygon points="50,6 42,26 50,34 58,26" />
    <!-- Base Star Facet -->
    <polygon points="50,94 32,66 50,78" />
    <polygon points="50,94 68,66 50,78" />
    <!-- Side Kite Facet Lines -->
    <line x1="50" y1="6" x2="64" y2="44" stroke-width="1.5" />
    <line x1="50" y1="6" x2="36" y2="44" stroke-width="1.5" />
    <line x1="64" y1="44" x2="84" y2="52" stroke-width="1.8" />
    <line x1="36" y1="44" x2="16" y2="52" stroke-width="1.8" />
    <line x1="68" y1="66" x2="82" y2="78" stroke-width="1.8" />
    <line x1="32" y1="66" x2="18" y2="78" stroke-width="1.8" />
  `),

  // 9. Radiant Cut (رادیانت) - Cut corners rectangle with brilliant crushed-ice faceting
  radiant: createSvgString(`
    <!-- Cut-Corner Outer Girdle -->
    <polygon points="26,10 74,10 88,24 88,76 74,90 26,90 12,76 12,24" stroke-width="2.5" />
    <!-- Octagonal Center Table -->
    <polygon points="34,26 66,26 74,34 74,66 66,74 34,74 26,66 26,34" stroke-width="2" />
    <!-- Internal Brilliant Starburst / Cross -->
    <polygon points="50,26 62,38 50,50 38,38" stroke-width="1.5" />
    <polygon points="50,74 62,62 50,50 38,62" stroke-width="1.5" />
    <polygon points="26,50 38,38 50,50 38,62" stroke-width="1.5" />
    <polygon points="74,50 62,38 50,50 62,62" stroke-width="1.5" />
    <!-- Corner Facet Lines -->
    <line x1="12" y1="24" x2="26" y2="34" stroke-width="1.8" />
    <line x1="26" y1="10" x2="34" y2="26" stroke-width="1.8" />
    <line x1="74" y1="10" x2="66" y2="26" stroke-width="1.8" />
    <line x1="88" y1="24" x2="74" y2="34" stroke-width="1.8" />
    <line x1="88" y1="76" x2="74" y2="66" stroke-width="1.8" />
    <line x1="74" y1="90" x2="66" y2="74" stroke-width="1.8" />
    <line x1="26" y1="90" x2="34" y2="74" stroke-width="1.8" />
    <line x1="12" y1="76" x2="26" y2="66" stroke-width="1.8" />
    <!-- Outer Cardinal Star Facets -->
    <line x1="50" y1="10" x2="50" y2="26" stroke-width="1.8" />
    <line x1="50" y1="90" x2="50" y2="74" stroke-width="1.8" />
    <line x1="12" y1="50" x2="26" y2="50" stroke-width="1.8" />
    <line x1="88" y1="50" x2="74" y2="50" stroke-width="1.8" />
  `),

  // 10. Heart Shape (قلب) - Heart brilliant cut
  heart: createSvgString(`
    <!-- Heart Girdle Outline -->
    <path d="M50,26 C44,14 32,8 20,12 C8,16 4,28 8,42 C12,56 28,72 50,92 C72,72 88,56 92,42 C96,28 92,16 80,12 C68,8 56,14 50,26 Z" stroke-width="2.5" />
    <!-- Inner Heart Table -->
    <path d="M50,38 C46,30 38,26 30,28 C22,30 20,38 24,48 C28,58 40,70 50,80 C60,70 72,58 76,48 C80,38 78,30 70,28 C62,26 54,30 50,38 Z" stroke-width="2" />
    <!-- Cleft & Apex Facet Lines -->
    <line x1="50" y1="26" x2="50" y2="38" stroke-width="1.8" />
    <line x1="50" y1="80" x2="50" y2="92" stroke-width="1.8" />
    <!-- Left Lobe Facet Rays -->
    <line x1="20" y1="12" x2="30" y2="28" stroke-width="1.5" />
    <line x1="8" y1="42" x2="24" y2="48" stroke-width="1.5" />
    <line x1="28" y1="72" x2="40" y2="70" stroke-width="1.5" />
    <!-- Right Lobe Facet Rays -->
    <line x1="80" y1="12" x2="70" y2="28" stroke-width="1.5" />
    <line x1="92" y1="42" x2="76" y2="48" stroke-width="1.5" />
    <line x1="72" y1="72" x2="60" y2="70" stroke-width="1.5" />
  `),

  // 11. Marquise Cut (مارکیز) - Navette pointed oval cut
  marquise: createSvgString(`
    <!-- Navette Girdle Outline -->
    <path d="M50,6 C68,26 84,40 84,50 C84,60 68,74 50,94 C32,74 16,60 16,50 C16,40 32,26 50,6 Z" stroke-width="2.5" />
    <!-- Center Rhombus/Navette Table -->
    <polygon points="50,22 68,50 50,78 32,50" stroke-width="2" />
    <!-- Center Diamond Core -->
    <polygon points="50,36 60,50 50,64 40,50" stroke-width="1.5" />
    <!-- North and South Apex Bezel Kites -->
    <polygon points="50,6 40,24 50,36 60,24" />
    <polygon points="50,94 60,76 50,64 40,76" />
    <!-- Side Star Rays -->
    <line x1="68" y1="50" x2="84" y2="50" stroke-width="1.8" />
    <line x1="32" y1="50" x2="16" y2="50" stroke-width="1.8" />
    <line x1="60" y1="24" x2="76" y2="34" stroke-width="1.5" />
    <line x1="40" y1="24" x2="24" y2="34" stroke-width="1.5" />
    <line x1="60" y1="76" x2="76" y2="66" stroke-width="1.5" />
    <line x1="40" y1="76" x2="24" y2="66" stroke-width="1.5" />
  `),

  // 12. Asscher Cut (آشر) - Square emerald cut with prominent windmill pattern
  asscher: createSvgString(`
    <!-- Deeply Clipped Corners Square Outline -->
    <polygon points="32,8 68,8 92,32 92,68 68,92 32,92 8,68 8,32" stroke-width="2.5" />
    <!-- Mid Step Octagon -->
    <polygon points="36,18 64,18 82,36 82,64 64,82 36,82 18,64 18,36" stroke-width="1.5" />
    <!-- Small Square Center Table -->
    <rect x="38" y="38" width="24" height="24" stroke-width="2" />
    <!-- Windmill Cross Facet Lines (Diagonal Rays from Corners to Center) -->
    <line x1="8" y1="32" x2="38" y2="38" stroke-width="1.8" />
    <line x1="32" y1="8" x2="38" y2="38" stroke-width="1.8" />
    <line x1="68" y1="8" x2="62" y2="38" stroke-width="1.8" />
    <line x1="92" y1="32" x2="62" y2="38" stroke-width="1.8" />
    <line x1="92" y1="68" x2="62" y2="62" stroke-width="1.8" />
    <line x1="68" y1="92" x2="62" y2="62" stroke-width="1.8" />
    <line x1="32" y1="92" x2="38" y2="62" stroke-width="1.8" />
    <line x1="8" y1="68" x2="38" y2="62" stroke-width="1.8" />
    <!-- Windmill Center Cross -->
    <line x1="38" y1="38" x2="62" y2="62" stroke-width="1.5" />
    <line x1="62" y1="38" x2="38" y2="62" stroke-width="1.5" />
  `),

  // 13. Triangle / Trillion Cut (مثلثی / تریلیون) - Curved or straight equilateral triangle
  triangle: createSvgString(`
    <!-- Trillion Girdle with Softly Bowed Edges -->
    <path d="M50,10 C68,36 84,62 88,80 C80,86 64,90 50,90 C36,90 20,86 12,80 C16,62 32,36 50,10 Z" stroke-width="2.5" />
    <!-- Triangular Center Table -->
    <polygon points="50,36 70,72 30,72" stroke-width="2" />
    <!-- Radiating Facet Triangles -->
    <line x1="50" y1="10" x2="50" y2="36" stroke-width="2" />
    <line x1="88" y1="80" x2="70" y2="72" stroke-width="2" />
    <line x1="12" y1="80" x2="30" y2="72" stroke-width="2" />
    <!-- Edge Star Facets -->
    <polygon points="50,10 40,36 50,36" />
    <polygon points="50,10 60,36 50,36" />
    <line x1="50" y1="90" x2="50" y2="72" stroke-width="1.8" />
  `),

  // 14. Rose Cut (رزکات) - Flat base with faceted dome, no flat table
  rose_cut: createSvgString(`
    <!-- Circular Outline Base -->
    <circle cx="50" cy="50" r="42" stroke-width="2.5" />
    <!-- Inner Hexagonal Dome Ring -->
    <polygon points="50,22 74,36 74,64 50,78 26,64 26,36" stroke-width="1.8" />
    <!-- Central Apex Star Meeting at (50,50) -->
    <line x1="50" y1="50" x2="50" y2="22" stroke-width="1.8" />
    <line x1="50" y1="50" x2="74" y2="36" stroke-width="1.8" />
    <line x1="50" y1="50" x2="74" y2="64" stroke-width="1.8" />
    <line x1="50" y1="50" x2="50" y2="78" stroke-width="1.8" />
    <line x1="50" y1="50" x2="26" y2="64" stroke-width="1.8" />
    <line x1="50" y1="50" x2="26" y2="36" stroke-width="1.8" />
    <!-- Perimeter Triangular Facet Rays -->
    <line x1="50" y1="8" x2="50" y2="22" stroke-width="1.5" />
    <line x1="86" y1="29" x2="74" y2="36" stroke-width="1.5" />
    <line x1="86" y1="71" x2="74" y2="64" stroke-width="1.5" />
    <line x1="50" y1="92" x2="50" y2="78" stroke-width="1.5" />
    <line x1="14" y1="71" x2="26" y2="64" stroke-width="1.5" />
    <line x1="14" y1="29" x2="26" y2="36" stroke-width="1.5" />
    <!-- Triangular Petals Outer Intersections -->
    <line x1="50" y1="8" x2="74" y2="36" />
    <line x1="86" y1="29" x2="74" y2="64" />
    <line x1="86" y1="71" x2="50" y2="78" />
    <line x1="50" y1="92" x2="26" y2="64" />
    <line x1="14" y1="71" x2="26" y2="36" />
    <line x1="14" y1="29" x2="50" y2="22" />
  `),

  // 15. Cabochon (دامله / کابوشن) - Smooth unfaceted dome with specular curved highlight
  cabochon: createSvgString(`
    <!-- Outer Smooth Oval Girdle -->
    <ellipse cx="50" cy="50" rx="36" ry="44" stroke-width="2.5" />
    <!-- Inner Contour Ring (Depth Gradient) -->
    <ellipse cx="50" cy="48" rx="28" ry="35" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.6" />
    <!-- Soft Specular Reflection Curved Highlight (representing smooth glassy polish) -->
    <path d="M36,26 C44,20 54,20 62,26 C54,24 44,24 36,26 Z" fill="currentColor" opacity="0.3" />
    <path d="M34,34 C42,28 56,28 64,34" stroke-width="2.5" stroke-linecap="round" />
    <!-- Base Depth Arc -->
    <path d="M30,76 C42,82 58,82 70,76" stroke-width="1.2" opacity="0.5" />
  `),

  // 16. Fancy / Other (سایر / فانتزی) - Brilliant multi-faceted diamond crystal
  other: createSvgString(`
    <!-- Geometric Octagon Gem Outline -->
    <polygon points="30,12 70,12 88,30 88,70 70,88 30,88 12,70 12,30" stroke-width="2.5" />
    <!-- Inner Hexagonal Table -->
    <polygon points="38,26 62,26 74,50 62,74 38,74 26,50" stroke-width="2" />
    <!-- Multi-Ray Brilliant Star Lines -->
    <line x1="30" y1="12" x2="38" y2="26" stroke-width="1.8" />
    <line x1="70" y1="12" x2="62" y2="26" stroke-width="1.8" />
    <line x1="88" y1="30" x2="74" y2="50" stroke-width="1.8" />
    <line x1="88" y1="70" x2="74" y2="50" stroke-width="1.8" />
    <line x1="70" y1="88" x2="62" y2="74" stroke-width="1.8" />
    <line x1="30" y1="88" x2="38" y2="74" stroke-width="1.8" />
    <line x1="12" y1="70" x2="26" y2="50" stroke-width="1.8" />
    <line x1="12" y1="30" x2="26" y2="50" stroke-width="1.8" />
    <!-- Center Sparkle Cross -->
    <line x1="50" y1="26" x2="50" y2="74" stroke-width="1.2" stroke-dasharray="2 2" />
    <line x1="26" y1="50" x2="74" y2="50" stroke-width="1.2" stroke-dasharray="2 2" />
  `),
};

/**
 * Normalizes shape code to resolve aliases (e.g. baguette_calibre -> baguette)
 */
export function getShapeSvg(code: string): string {
  const cleanCode = (code || '').toLowerCase().trim();
  if (GEMSTONE_SHAPE_SVGS[cleanCode]) {
    return GEMSTONE_SHAPE_SVGS[cleanCode];
  }

  // Alias fallbacks
  if (cleanCode.includes('taper')) {
    return GEMSTONE_SHAPE_SVGS.baguette_taper || GEMSTONE_SHAPE_SVGS.baguette;
  }
  if (cleanCode.includes('calibre') || cleanCode.includes('straight') || cleanCode.includes('baguette')) {
    return GEMSTONE_SHAPE_SVGS.baguette;
  }
  if (cleanCode.includes('trillion') || cleanCode.includes('triangle')) {
    return GEMSTONE_SHAPE_SVGS.triangle;
  }
  if (cleanCode.includes('rose')) {
    return GEMSTONE_SHAPE_SVGS.rose_cut;
  }
  if (cleanCode.includes('cabo')) {
    return GEMSTONE_SHAPE_SVGS.cabochon;
  }
  if (cleanCode.includes('round') || cleanCode.includes('brilliant')) {
    return GEMSTONE_SHAPE_SVGS.round;
  }

  return GEMSTONE_SHAPE_SVGS.other;
}
