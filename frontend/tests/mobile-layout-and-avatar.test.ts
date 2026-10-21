import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import QuickGoldActions from '../src/components/QuickGoldActions';

describe('Mobile Dashboard QuickGoldActions Mosaic & Account Avatar', () => {
  it('renders all 4 quick gold actions with mosaic grid container', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(QuickGoldActions));

    expect(html).toContain('class="quick-gold-actions"');
    expect(html).toContain('فاکتور خرید / فروش طلا');
    expect(html).toContain('ثبت طلای شرطی');
    expect(html).toContain('دریافت / پرداخت نقد');
    expect(html).toContain('ثبت چک');

    // Count action buttons (excluding container class quick-gold-actions)
    const matches = html.match(/class="quick-gold-action\b/g);
    expect(matches?.length).toBe(4);
  });

  it('globals.css configures quick-gold-actions as repeat(2, minmax(0, 1fr)) for mobile screens', () => {
    const cssPath = path.resolve(__dirname, '../app/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify 560px media query configures 2-column mosaic for quick-gold-actions
    const media560Match = cssContent.match(/@media\s*\(max-width:\s*560px\)[\s\S]*?\.quick-gold-actions\s*\{[\s\S]*?\}/);
    expect(media560Match).toBeTruthy();
    expect(media560Match?.[0]).toContain('repeat(2, minmax(0, 1fr))');

    // Verify gold-ticker-grid and gold-balance-grid are 1fr on mobile, but quick-gold-actions is not 1fr
    const mediaBlock = media560Match?.[0] || '';
    expect(mediaBlock).not.toMatch(/\.quick-gold-actions[\s\S]*?grid-template-columns:\s*1fr;/);
  });

  it('globals.css configures account-avatar-editor centered on mobile screens', () => {
    const cssPath = path.resolve(__dirname, '../app/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify 520px media query centers account-avatar-editor
    const media520Match = cssContent.match(/@media\s*\(max-width:\s*520px\)[\s\S]*?\.account-avatar-editor\s*\{[\s\S]*?\}/);
    expect(media520Match).toBeTruthy();
    expect(media520Match?.[0]).toContain('align-items: center');
    expect(media520Match?.[0]).toContain('flex-direction: column');
  });

  it('globals.css defines dark mode support for account-avatar-preview', () => {
    const cssPath = path.resolve(__dirname, '../app/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    expect(cssContent).toContain('.dark .account-avatar-preview');
  });
});
