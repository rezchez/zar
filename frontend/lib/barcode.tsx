import React from 'react';

/**
 * High-performance, pure SVG Code 128 barcode generator.
 * Zero external dependencies, sharp vector output for thermal label printers.
 */

// Code 128 pattern table (Values 0 to 106)
// Each number represents widths of bars and spaces [b1, s1, b2, s2, b3, s3]
const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0
  [2, 2, 2, 1, 2, 2], // 1
  [2, 2, 2, 2, 2, 1], // 2
  [1, 2, 1, 2, 2, 3], // 3
  [1, 2, 1, 3, 2, 2], // 4
  [1, 3, 1, 2, 2, 2], // 5
  [1, 2, 2, 2, 1, 3], // 6
  [1, 2, 2, 3, 1, 2], // 7
  [1, 3, 2, 2, 1, 2], // 8
  [2, 2, 1, 2, 1, 3], // 9
  [2, 2, 1, 3, 1, 2], // 10
  [2, 3, 1, 2, 1, 2], // 11
  [1, 1, 2, 2, 3, 2], // 12
  [1, 2, 2, 1, 3, 2], // 13
  [1, 2, 2, 2, 3, 1], // 14
  [1, 1, 3, 2, 2, 2], // 15
  [1, 2, 3, 1, 2, 2], // 16
  [1, 2, 3, 2, 2, 1], // 17
  [2, 2, 3, 2, 1, 1], // 18
  [2, 2, 1, 1, 3, 2], // 19
  [2, 2, 1, 2, 3, 1], // 20
  [2, 1, 3, 2, 1, 2], // 21
  [2, 2, 3, 1, 1, 2], // 22
  [3, 1, 2, 1, 3, 1], // 23
  [3, 1, 1, 2, 2, 2], // 24
  [3, 2, 1, 1, 2, 2], // 25
  [3, 2, 1, 2, 2, 1], // 26
  [3, 1, 2, 2, 1, 2], // 27
  [3, 2, 2, 1, 1, 2], // 28
  [3, 2, 2, 2, 1, 1], // 29
  [2, 1, 2, 1, 2, 3], // 30
  [2, 1, 2, 3, 2, 1], // 31
  [2, 3, 2, 1, 2, 1], // 32
  [1, 1, 1, 3, 2, 3], // 33
  [1, 3, 1, 1, 2, 3], // 34
  [1, 3, 1, 3, 2, 1], // 35
  [1, 1, 2, 3, 1, 3], // 36
  [1, 3, 2, 1, 1, 3], // 37
  [1, 3, 2, 3, 1, 1], // 38
  [2, 1, 1, 3, 1, 3], // 39
  [2, 3, 1, 1, 1, 3], // 40
  [2, 3, 1, 3, 1, 1], // 41
  [1, 1, 2, 1, 3, 3], // 42
  [1, 1, 2, 3, 3, 1], // 43
  [1, 3, 2, 1, 3, 1], // 44
  [1, 1, 3, 1, 2, 3], // 45
  [1, 1, 3, 3, 2, 1], // 46
  [1, 3, 3, 1, 2, 1], // 47
  [3, 1, 3, 1, 2, 1], // 48
  [2, 1, 1, 3, 3, 1], // 49
  [2, 3, 1, 1, 3, 1], // 50
  [2, 1, 3, 1, 1, 3], // 51
  [2, 1, 3, 3, 1, 1], // 52
  [2, 1, 3, 1, 3, 1], // 53
  [3, 1, 1, 1, 2, 3], // 54
  [3, 1, 1, 3, 2, 1], // 55
  [3, 3, 1, 1, 2, 1], // 56
  [3, 1, 2, 1, 1, 3], // 57
  [3, 1, 2, 3, 1, 1], // 58
  [3, 3, 2, 1, 1, 1], // 59
  [3, 1, 4, 1, 1, 1], // 60
  [2, 2, 1, 4, 1, 1], // 61
  [4, 3, 1, 1, 1, 1], // 62
  [1, 1, 1, 2, 2, 4], // 63
  [1, 1, 1, 4, 2, 2], // 64
  [1, 2, 1, 1, 2, 4], // 65
  [1, 2, 1, 4, 2, 1], // 66
  [1, 4, 1, 1, 2, 2], // 67
  [1, 4, 1, 2, 2, 1], // 68
  [1, 1, 2, 2, 1, 4], // 69
  [1, 1, 2, 4, 1, 2], // 70
  [1, 2, 2, 1, 1, 4], // 71
  [1, 2, 2, 4, 1, 1], // 72
  [1, 4, 2, 1, 1, 2], // 73
  [1, 4, 2, 2, 1, 1], // 74
  [2, 4, 1, 2, 1, 1], // 75
  [2, 2, 1, 1, 1, 4], // 76
  [4, 1, 3, 1, 1, 1], // 77
  [2, 4, 1, 1, 1, 2], // 78
  [1, 3, 4, 1, 1, 1], // 79
  [1, 1, 1, 2, 4, 2], // 80
  [1, 2, 1, 1, 4, 2], // 81
  [1, 2, 1, 2, 4, 1], // 82
  [1, 1, 4, 2, 1, 2], // 83
  [1, 2, 4, 1, 1, 2], // 84
  [1, 2, 4, 2, 1, 1], // 85
  [4, 1, 1, 2, 1, 2], // 86
  [4, 2, 1, 1, 1, 2], // 87
  [4, 2, 1, 2, 1, 1], // 88
  [2, 1, 2, 1, 4, 1], // 89
  [2, 1, 4, 1, 2, 1], // 90
  [4, 1, 2, 1, 2, 1], // 91
  [1, 1, 1, 1, 4, 3], // 92
  [1, 1, 1, 3, 4, 1], // 93
  [1, 3, 1, 1, 4, 1], // 94
  [1, 1, 4, 1, 1, 3], // 95
  [1, 1, 4, 3, 1, 1], // 96
  [4, 1, 1, 1, 1, 3], // 97
  [4, 1, 1, 3, 1, 1], // 98
  [1, 1, 3, 1, 4, 1], // 99
  [1, 1, 4, 1, 3, 1], // 100
  [3, 1, 1, 1, 4, 1], // 101
  [4, 1, 1, 1, 3, 1], // 102
  [2, 1, 1, 4, 1, 2], // 103 (Start A)
  [2, 1, 1, 2, 1, 4], // 104 (Start B)
  [2, 1, 1, 2, 3, 2], // 105 (Start C)
  [2, 3, 3, 1, 1, 1, 2], // 106 (Stop - has 7 elements)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes ASCII string into Code 128 binary sequence (true for bar, false for space).
 */
export function encodeCode128B(text: string): boolean[] {
  const codes: number[] = [START_CODE_B];
  let checkSum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // ASCII 32 to 126 map directly to Code 128 values 0 to 94
    let val = charCode - 32;
    if (val < 0 || val > 94) {
      val = 0; // fallback to space
    }
    codes.push(val);
    checkSum += val * (i + 1);
  }

  const checkDigit = checkSum % 103;
  codes.push(checkDigit);
  codes.push(STOP_CODE);

  const bits: boolean[] = [];
  // Quiet zone at start (10 modules)
  for (let q = 0; q < 10; q++) bits.push(false);

  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c];
    if (!pattern) continue;
    let isBar = true;
    for (const len of pattern) {
      for (let k = 0; k < len; k++) {
        bits.push(isBar);
      }
      isBar = !isBar;
    }
  }

  // Quiet zone at end (10 modules)
  for (let q = 0; q < 10; q++) bits.push(false);

  return bits;
}

export interface BarcodeSvgProps {
  value: string;
  width?: number | string;
  height?: number;
  showText?: boolean;
  className?: string;
  barColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

export function BarcodeSvg({
  value,
  width = '100%',
  height = 42,
  showText = true,
  className = '',
  barColor = '#000000',
  backgroundColor = 'transparent',
  textColor = '#0f172a',
}: BarcodeSvgProps) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const bits = encodeCode128B(value.trim());
    const totalModules = bits.length;
    const barHeight = showText ? height - 12 : height;

    // Build rectangles for contiguous bar blocks for optimal SVG DOM size
    const rects: Array<{ x: number; width: number }> = [];
    let currentBarStart: number | null = null;

    for (let i = 0; i < totalModules; i++) {
      if (bits[i]) {
        if (currentBarStart === null) currentBarStart = i;
      } else {
        if (currentBarStart !== null) {
          rects.push({ x: currentBarStart, width: i - currentBarStart });
          currentBarStart = null;
        }
      }
    }
    if (currentBarStart !== null) {
      rects.push({ x: currentBarStart, width: totalModules - currentBarStart });
    }

    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <svg
          viewBox={`0 0 ${totalModules} ${height}`}
          width={width}
          height={height}
          preserveAspectRatio="none"
          style={{ shapeRendering: 'crispEdges', display: 'block' }}
        >
          {backgroundColor && backgroundColor !== 'transparent' && (
            <rect width={totalModules} height={height} fill={backgroundColor} />
          )}
          {rects.map((r, idx) => (
            <rect key={idx} x={r.x} y={0} width={r.width} height={barHeight} fill={barColor} />
          ))}
          {showText && (
            <text
              x={totalModules / 2}
              y={height - 1}
              fill={textColor}
              fontSize={10}
              fontFamily="monospace"
              fontWeight="600"
              textAnchor="middle"
              letterSpacing="1"
            >
              {value.trim()}
            </text>
          )}
        </svg>
      </div>
    );
  } catch {
    return (
      <div className="text-[10px] text-muted-foreground border border-dashed rounded p-1 text-center font-mono">
        {value}
      </div>
    );
  }
}
