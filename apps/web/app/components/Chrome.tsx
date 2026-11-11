import Link from "next/link";
import type { ReactNode } from "react";

export function Masthead() {
  return (
    <header className="border-b border-line/80 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="font-display text-2xl tracking-tight text-grove">
          Research<span className="text-gold">X</span>
        </Link>
        <p className="text-right text-sm text-ink-soft">Ethiopian health research intelligence</p>
      </div>
    </header>
  );
}

export function FullScreen({
  kicker,
  title,
  tone = "grove",
  children,
}: {
  kicker: string;
  title: string;
  tone?: "grove" | "clay" | "ink";
  children: ReactNode;
}) {
  const rule = tone === "clay" ? "bg-clay" : tone === "ink" ? "bg-ink" : "bg-grove-bright";
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4.75rem)] w-full max-w-3xl flex-col justify-center px-5 py-16 sm:px-8">
      <div className={`mb-6 h-1 w-16 ${rule}`} />
      <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">{kicker}</p>
      <h1 className="font-display mt-3 text-4xl leading-tight text-balance text-ink sm:text-5xl">{title}</h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export function ScopeBadge({ scope }: { scope: "ethiopia" | "international" }) {
  const label = scope === "ethiopia" ? "Ethiopia" : "International";
  const className =
    scope === "ethiopia" ? "bg-grove text-paper" : "bg-gold/15 text-gold ring-1 ring-gold/40";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}
