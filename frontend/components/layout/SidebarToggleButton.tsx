'use client';

import { MorphIcon } from 'morphicons/react';

// Icon SVG path nodes for Morphicons Panel Left Close & Open states
const PANEL_CLOSE_NODES = [
  ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
  ['path', { d: 'M9 3v18' }],
  ['path', { d: 'm16 15-3-3 3-3' }],
] as const;

const PANEL_OPEN_NODES = [
  ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
  ['path', { d: 'M9 3v18' }],
  ['path', { d: 'm14 9 3 3-3 3' }],
] as const;

export type SidebarToggleButtonProps = {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
};

export default function SidebarToggleButton({
  collapsed,
  onToggle,
  className = 'dashboard-icon-button dashboard-desktop-toggle',
}: SidebarToggleButtonProps) {
  const label = collapsed ? 'باز کردن منو' : 'جمع کردن منو';
  const iconNodes = collapsed ? PANEL_OPEN_NODES : PANEL_CLOSE_NODES;

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={collapsed}
    >
      <MorphIcon
        icon={iconNodes}
        spring="smooth"
        reducedMotion="user"
        size={18}
        strokeWidth={2}
      />
    </button>
  );
}
