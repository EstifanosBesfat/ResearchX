"use client";

import { DEMO_QUESTIONS, type AskFilters, type HistoryItem } from "@researchx/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { askResearch, getHistory } from "@/lib/api";
import { formatStamp } from "@/lib/format";
import { FullScreen } from "./Chrome";

export function Workspace() {
  const router = useRouter();
  const [question, setQuestion] = useState(DEMO_QUESTIONS[0].question);
  const [filters, setFilters] = useState<AskFilters>(DEMO_QUESTIONS[0].filters);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [historyMessage, setHistoryMessage] = useState("");
  const [screen, setScreen] = useState<"desk" | "sending" | "error">("desk");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getHistory()
      .then((items) => {
        if (cancelled) return;
        setHistory(items);
        setHistoryState(items.length ? "ready" : "empty");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setHistoryState("error");
        setHistoryMessage(reason instanceof Error ? reason.message : "Recent reports could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(nextQuestion: string, nextFilters: AskFilters) {
    setScreen("sending");
    try {
      const result = await askResearch({
        question: nextQuestion.trim(),
        filters: cleanFilters(nextFilters),
      });
      router.push(`/research/${result.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The question could not be sent.");
      setScreen("error");
    }
  }

  if (screen === "sending") {
    return (
      <FullScreen kicker="Processing" title="Sending the question">
        <p>The desk is opening a report. Passage retrieval has not finished yet.</p>
      </FullScreen>
    );
  }

  if (screen === "error") {
    return (
      <FullScreen kicker="Could not ask" title="The research API did not accept the question" tone="clay">
        <p>{error}</p>
        <button
          type="button"
          className="mt-2 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
          onClick={() => setScreen("desk")}
        >
          Return to the desk
        </button>
      </FullScreen>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
      <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_24px_60px_rgb(18_61_44_/_0.06)] sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Open-access corpus</p>
        <h1 className="font-display mt-3 text-4xl leading-tight text-grove sm:text-5xl">
          Ask a health question. Get a report that cites the papers.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
          ResearchX searches a checked set of maternal-health and malaria papers, Ethiopian and international,
          from 2015 to 2026. Answers are written only from retrieved passages.
        </p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(question, filters);
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-ink">Question</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={5}
              required
              minLength={8}
              className="mt-2 w-full resize-y rounded-2xl border border-line bg-paper px-4 py-3 text-base leading-relaxed outline-none ring-grove-bright focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {DEMO_QUESTIONS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                className="rounded-full border border-grove/20 bg-paper px-3 py-1.5 text-left text-sm text-grove hover:border-grove hover:bg-white"
                onClick={() => {
                  setQuestion(demo.question);
                  setFilters(demo.filters);
                  void submit(demo.question, demo.filters);
                }}
              >
                {demo.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Year from
              <input
                type="number"
                min={1990}
                max={2035}
                value={filters.yearFrom ?? ""}
                placeholder="2015"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, yearFrom: yearValue(event.target.value) }))
                }
                className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Year to
              <input
                type="number"
                min={1990}
                max={2035}
                value={filters.yearTo ?? ""}
                placeholder="2026"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, yearTo: yearValue(event.target.value) }))
                }
                className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterToggle
              pressed={filters.includeEthiopia !== false}
              label="Ethiopia"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  includeEthiopia: current.includeEthiopia === false,
                  country: current.includeEthiopia === false ? "Ethiopia" : undefined,
                }))
              }
            />
            <FilterToggle
              pressed={filters.includeInternational === true}
              label="International"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  includeInternational: current.includeInternational !== true,
                }))
              }
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-grove px-6 py-3 text-sm font-semibold text-paper hover:bg-grove-bright"
          >
            Build a cited report
          </button>
        </form>
      </section>
      <HistoryPanel state={historyState} items={history} message={historyMessage} />
    </div>
  );
}

function FilterToggle({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        pressed ? "bg-grove text-paper" : "bg-paper-deep text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function HistoryPanel({
  state,
  items,
  message,
}: {
  state: "loading" | "empty" | "ready" | "error";
  items: HistoryItem[];
  message: string;
}) {
  if (state === "loading") {
    return (
      <FullScreen kicker="Recent reports" title="Opening the desk">
        <p>Loading research history.</p>
      </FullScreen>
    );
  }
  if (state === "error") {
    return (
      <FullScreen kicker="Recent reports" title="History is unavailable" tone="clay">
        <p>{message}</p>
      </FullScreen>
    );
  }
  if (state === "empty") {
    return (
      <FullScreen kicker="Recent reports" title="No reports yet">
        <p>Ask a question to search the maternal-health and malaria corpus. Reports are stored without accounts.</p>
      </FullScreen>
    );
  }
  return (
    <aside className="rounded-[2rem] border border-line bg-card p-6">
      <h2 className="font-display text-2xl text-grove">Recent reports</h2>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/research/${item.id}`}
              className="block rounded-2xl border border-line bg-paper px-4 py-3 hover:border-grove"
            >
              <span className="text-xs font-semibold tracking-wide text-gold uppercase">{item.status}</span>
              <span className="mt-1 block text-sm leading-snug text-ink">{item.question}</span>
              <span className="mt-2 block text-xs text-ink-soft">{formatStamp(item.createdAt)} Guatemala</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function yearValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const year = Number(value);
  return Number.isInteger(year) ? year : undefined;
}

function cleanFilters(filters: AskFilters): AskFilters {
  return {
    country: filters.country,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    includeEthiopia: filters.includeEthiopia,
    includeInternational: filters.includeInternational,
  };
}
