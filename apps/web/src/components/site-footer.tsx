'use client';

import * as React from 'react';
import DuneHaulFooter, {
  type DuneHaulFooterProps,
} from '@/components/ui/dune-haul-footer';

/**
 * Orion's take on the dune footer: the brand black/white replaces the preset accent,
 * and the sky/card colours follow the site tokens so the scene blends into the
 * page instead of sitting on top of it. Monochrome by day, monochrome at night — and it
 * follows the theme toggle live, not just on load.
 */
const LIGHT_PALETTE: DuneHaulFooterProps['palette'] = {
  sky: ['#fafafa', '#e9efdc'],
  card: '#ffffff',
  ink: '#1c1c1c',
  muted: '#5c5c5c',
  line: '#e6e6e6',
  accent: '#000000',
  accentInk: '#ffffff',
};

const DARK_PALETTE: DuneHaulFooterProps['palette'] = {
  sky: ['#0a0a0a', '#1a1a1a'],
  card: '#171717',
  ink: '#fafafa',
  muted: '#a3a3a3',
  line: 'rgba(255, 255, 255, 0.1)',
  accent: '#ffffff',
  accentInk: '#000000',
};

const COLUMNS: DuneHaulFooterProps['columns'] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Start a project', href: '/register' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'GitHub', href: 'https://github.com/Tirth678/orion-db' },
      { label: 'Documentation', href: 'https://github.com/Tirth678/orion-db#readme' },
      { label: 'Client SDK', href: 'https://github.com/Tirth678/orion-db/tree/main/packages/orion-js' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Create account', href: '/register' },
    ],
  },
];

const SOCIALS: DuneHaulFooterProps['socials'] = [
  { icon: 'github', href: 'https://github.com/Tirth678/orion-db' },
  { icon: 'youtube', href: 'https://www.youtube.com/@codewithlari' },
];

export function SiteFooter() {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains('dark'));
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  const logo = (
    <span className="text-2xl font-bold tracking-tight">
      O
    </span>
  );

  return (
    <DuneHaulFooter
      name="orion"
      brandHref="/"
      logo={logo}
      preset={dark ? 'dusk' : 'sage'}
      palette={dark ? DARK_PALETTE : LIGHT_PALETTE}
      columns={COLUMNS}
      socials={SOCIALS}
      seed={7}
      tripSeconds={12}
      parallax={false}
    />
  );
}
