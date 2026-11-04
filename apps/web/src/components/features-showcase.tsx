'use client';

import * as React from 'react';
import InkOrbitFeatures from '@/components/ui/ink-orbit-features';

/**
 * Orion's take on the ink-orbit features bento: the three live diagrams retold
 * as realtime channels, generated REST APIs, per-project primitives and query
 * insights. The component's neutral paper/ink palette is re-pointed at the site
 * tokens with a monochrome accent, and it follows the theme toggle (not just the OS)
 * so it never sits light inside a dark page.
 */
const LIGHT_VARS = {
  '--ib-page': '#fafafa',
  '--ib-hatch': 'rgba(0, 0, 0, 0.04)',
  '--ib-paper': '#ffffff',
  '--ib-card': '#fafafa',
  '--ib-raise': '#ffffff',
  '--ib-ink': '#1c1c1c',
  '--ib-soft': '#3d3d3d',
  '--ib-muted': '#5c5c5c',
  '--ib-faint': '#8c8c8c',
  '--ib-line': '#e6e6e6',
  '--ib-line-strong': '#d4d4d4',
  '--ib-bracket': '#c4c4c4',
  '--ib-inv': '#161616',
  '--ib-inv-ink': '#fafafa',
  '--ib-accent': '#000000',
} as React.CSSProperties;

const DARK_VARS = {
  '--ib-page': '#0a0a0a',
  '--ib-hatch': 'rgba(255, 255, 255, 0.04)',
  '--ib-paper': '#171717',
  '--ib-card': '#1c1c1c',
  '--ib-raise': '#202020',
  '--ib-ink': '#fafafa',
  '--ib-soft': '#d4d4d4',
  '--ib-muted': '#a3a3a3',
  '--ib-faint': '#6b6b6b',
  '--ib-line': '#262626',
  '--ib-line-strong': '#363636',
  '--ib-bracket': '#444444',
  '--ib-inv': '#fafafa',
  '--ib-inv-ink': '#0a0a0a',
  '--ib-accent': '#ffffff',
} as React.CSSProperties;

export function FeaturesShowcase() {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains('dark'));
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  return (
    <InkOrbitFeatures
      theme={dark ? 'dark' : 'light'}
      brand="Orion"
      tag="Why Orion"
      title={'Everything around your Postgres,\n*already* built'}
      collaboration={{
        title: 'Realtime channels',
        description:
          'Subscribe to any table from orion-js and every insert, update and delete arrives the moment it commits — no polling, no triggers to write.',
      }}
      reports={{
        title: 'Instant REST APIs',
        description:
          'Create a table in the visual editor and its endpoints exist: select, filter, order and paginate, guarded by your anon or service-role key.',
      }}
      integrations={{
        title: 'One project, every primitive',
        description:
          'Schema, storage buckets, end-user auth and API keys live side by side, so the dashboard, the REST API and orion-js read the same source.',
        tools: ['Buckets', 'Uploads', 'Sessions', 'API keys'],
      }}
      insights={{
        title: 'SQL editor & history',
        description:
          'Run raw Postgres from the browser, then reopen any past statement from history with its row count and execution time still attached.',
        values: [18, 22, 21, 27, 25, 31, 30, 36, 41, 45, 52, 60],
        forecastFrom: 8,
      }}
      className="rounded-2xl overflow-hidden"
      style={dark ? DARK_VARS : LIGHT_VARS}
    />
  );
}
