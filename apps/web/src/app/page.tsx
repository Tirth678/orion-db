import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { SiteFooter } from '@/components/site-footer';
import { FeaturesShowcase } from '@/components/features-showcase';
import {
  Database,
  ShieldCheck,
  Zap,
  HardDrive,
  Code2,
  Boxes,
  ArrowUpRight,
  ArrowRight,
} from 'lucide-react';

const features = [
  {
    title: 'Postgres Database',
    description:
      'Every project is a full Postgres database. Portable, extensible, and ready to query.',
    icon: Database,
  },
  {
    title: 'Authentication',
    description:
      'Add user sign ups and logins. Email, magic link, and OAuth providers built in.',
    icon: ShieldCheck,
  },
  {
    title: 'Realtime',
    description:
      'Build multiplayer experiences with real-time data synchronization.',
    icon: Zap,
  },
  {
    title: 'Storage',
    description:
      'Store, organize, and serve large files — from avatars to videos.',
    icon: HardDrive,
  },
  {
    title: 'Data APIs',
    description:
      'Instant ready-to-use REST APIs for every table in your project.',
    icon: Code2,
  },
  {
    title: 'JavaScript SDK',
    description:
      'Query your backend from any app with the official Orion client library.',
    icon: Boxes,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1c1c1c] dark:bg-background dark:text-foreground">
      {/* Nav */}
      <header className="border-b border-[#e6e6e6] bg-[#fafafa]/80 backdrop-blur-sm dark:border-border dark:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1 transition-all duration-200 hover:bg-black/[0.04] active:scale-95 dark:hover:bg-white/[0.06]"
            >
              <span className="text-2xl font-bold tracking-tight text-[#1c1c1c] transition-colors duration-200 group-hover:text-black dark:text-foreground dark:group-hover:text-white">
                O
              </span>
              <span className="text-lg font-bold tracking-tight text-[#1c1c1c] transition-colors duration-200 group-hover:text-black dark:text-foreground dark:group-hover:text-white">
                orion
              </span>
            </Link>
            <nav className="hidden items-center gap-1.5 text-sm md:flex">
              {[
                { label: 'Product', href: '#features' },
                {
                  label: 'Developers',
                  href: 'https://github.com/Tirth678/orion-db',
                },
                { label: 'Pricing', href: '#pricing' },
                {
                  label: 'Docs',
                  href: 'https://github.com/Tirth678/orion-db#readme',
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group relative rounded-md px-3.5 py-2 text-sm font-medium text-[#5c5c5c] transition-all duration-200 hover:bg-black/12 hover:text-black active:scale-95 dark:text-muted-foreground dark:hover:bg-white/15 dark:hover:text-foreground"
                >
                  <span className="relative z-10 transition-colors duration-200 group-hover:text-black dark:group-hover:text-white">
                    {item.label}
                  </span>
                  <span className="absolute bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-black shadow-[0_0_8px_rgba(0,0,0,0.7)] transition-all duration-300 ease-out group-hover:w-3/5 dark:bg-white dark:shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="group relative hidden rounded-md px-3.5 py-2 text-sm font-medium text-[#5c5c5c] transition-all duration-200 hover:bg-black/12 hover:text-black active:scale-95 sm:inline-flex items-center dark:text-muted-foreground dark:hover:bg-white/15 dark:hover:text-foreground"
            >
              <span className="relative z-10 transition-colors duration-200 group-hover:text-black dark:group-hover:text-white">
                Sign in
              </span>
              <span className="absolute bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-black shadow-[0_0_8px_rgba(0,0,0,0.7)] transition-all duration-300 ease-out group-hover:w-3/5 dark:bg-white dark:shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
            </Link>
            <Link
              href="/dashboard"
              className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-[0_8px_20px_-2px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-[0.98] dark:bg-white dark:text-black dark:shadow-[0_2px_8px_rgba(255,255,255,0.25)] dark:hover:bg-gray-200 dark:hover:shadow-[0_8px_20px_-2px_rgba(255,255,255,0.5)]"
            >
              <span className="pointer-events-none absolute -left-full top-0 h-full w-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-all duration-700 ease-out group-hover:left-full dark:via-black/10" />
              <span>Dashboard</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-16 lg:px-8 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 lg:items-start">
          <div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Build in a weekend
              <br />
              <span className="text-black dark:text-white">Scale to millions</span>
            </h1>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.3)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-[0.98] dark:bg-white dark:text-black dark:shadow-[0_4px_14px_rgba(255,255,255,0.3)] dark:hover:bg-gray-200 dark:hover:shadow-[0_12px_28px_-4px_rgba(255,255,255,0.5)]"
              >
                <span className="pointer-events-none absolute -left-full top-0 h-full w-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-all duration-700 ease-out group-hover:left-full dark:via-black/10" />
                <span>Start your project</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </Link>
              <Link
                href="https://invalid-link.example.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-6 py-3 text-sm font-medium text-[#1c1c1c] shadow-xs transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[#a3a3a3] hover:bg-[#f9fafb] hover:shadow-md active:translate-y-0 active:scale-[0.98] dark:border-border dark:bg-card dark:text-foreground dark:hover:border-muted-foreground/40 dark:hover:bg-muted"
              >
                <span>Watch the tutorial</span>
              </Link>
            </div>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-[#5c5c5c] lg:pt-2 lg:text-xl dark:text-muted-foreground">
            Start your project with a Postgres database. Add Authentication,
            Data APIs, Realtime, Storage, and a JavaScript SDK — all from one
            dashboard.
          </p>
        </div>

        {/* Feature grid */}
        <div id="features" className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#e6e6e6] bg-white p-6 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-black/60 hover:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.18)] dark:border-border dark:bg-card dark:hover:border-white/60"
              >
                {/* Background ambient spotlight gradient on hover */}
                <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-black/[0.08] via-transparent to-transparent dark:from-white/[0.08]" />

                {/* Animated top accent bar */}
                <div className="absolute inset-x-0 top-0 h-[2px] w-0 bg-gradient-to-r from-transparent via-black to-transparent transition-all duration-500 ease-out group-hover:w-full dark:via-white" />

                <div className="relative mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-black/10 text-black transition-all duration-300 ease-out group-hover:scale-110 group-hover:bg-black group-hover:text-white group-hover:shadow-[0_0_20px_rgba(0,0,0,0.45)] dark:bg-white/10 dark:text-white dark:group-hover:bg-white dark:group-hover:text-black">
                    <Icon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-6" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-black opacity-0 -translate-x-2 translate-y-2 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 dark:text-white" />
                </div>

                <h3 className="relative text-base font-semibold text-[#1c1c1c] transition-colors duration-200 group-hover:text-black dark:text-foreground dark:group-hover:text-white">
                  {feature.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-[#5c5c5c] transition-colors duration-200 group-hover:text-[#2d2d2d] dark:text-muted-foreground dark:group-hover:text-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-16 text-center text-sm text-[#8c8c8c] dark:text-muted-foreground/80">
          Use one or all. Best-of-breed products. Integrated as a platform.
        </p>

        <div className="mt-14">
          <FeaturesShowcase />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
