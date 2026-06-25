"use client";

import { useState } from "react";

export type ConceptRow = {
  subject: string;
  concept: string;
  mastery_level: string | null;
  last_updated: string;
  strong_areas: string[] | null;
  weak_areas: string[] | null;
  next_steps: string[] | null;
  overview_gist?: string | null;
  deep_dive_gist?: string[] | null;
  notes?: string | null;
};

const MASTERY_SCORES: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  "In Progress": 0,
};

const SUBJECT_PILL_CLASSES: Record<string, string> = {
  physics: "bg-blue-900/60 text-blue-200 border-blue-800",
  biology: "bg-green-900/60 text-green-200 border-green-800",
  mathematics: "bg-purple-900/60 text-purple-200 border-purple-800",
  "computer science": "bg-orange-900/60 text-orange-200 border-orange-800",
  chemistry: "bg-red-900/60 text-red-200 border-red-800",
};

const SUBJECT_BAR_CLASSES: Record<string, string> = {
  physics: "bg-blue-500",
  biology: "bg-green-500",
  mathematics: "bg-purple-500",
  "computer science": "bg-orange-500",
  chemistry: "bg-red-500",
};

const MASTERY_BADGE_CLASSES: Record<string, string> = {
  Strong: "bg-green-900/60 text-green-200 border-green-800",
  Proficient: "bg-blue-900/60 text-blue-200 border-blue-800",
  Developing: "bg-yellow-900/60 text-yellow-200 border-yellow-800",
  Introduced: "bg-orange-900/60 text-orange-200 border-orange-800",
  "In Progress": "bg-gray-800 text-gray-400 border-gray-700",
};

function getSubjectPill(subject: string): string {
  return (
    SUBJECT_PILL_CLASSES[subject.toLowerCase()] ??
    "bg-gray-800 text-gray-300 border-gray-700"
  );
}

function getSubjectBar(subject: string): string {
  return (
    SUBJECT_BAR_CLASSES[subject.toLowerCase()] ?? "bg-gray-500"
  );
}

function getMasteryScore(level: string | null): number {
  if (!level) return 0;
  return MASTERY_SCORES[level] ?? 0;
}

function getMasteryBadge(level: string | null): string {
  if (!level) return "bg-gray-800 text-gray-500 border-gray-700";
  return (
    MASTERY_BADGE_CLASSES[level] ?? "bg-gray-800 text-gray-500 border-gray-700"
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ConceptCard({ concept }: { concept: ConceptRow }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const score = getMasteryScore(concept.mastery_level);
  const percentage = (score / 4) * 100;

  const strongAreas = concept.strong_areas ?? [];
  const weakAreas = concept.weak_areas ?? [];
  const nextSteps = concept.next_steps ?? [];
  const hasDetails =
    strongAreas.length > 0 || weakAreas.length > 0 || nextSteps.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <button
        type="button"
        onClick={() => hasDetails && setIsExpanded((v) => !v)}
        disabled={!hasDetails}
        aria-expanded={isExpanded}
        className="w-full px-5 py-4 text-left transition-colors hover:bg-gray-800/50 disabled:cursor-default disabled:hover:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${getSubjectPill(concept.subject)}`}
              >
                {concept.subject}
              </span>
              <span
                className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${getMasteryBadge(concept.mastery_level)}`}
              >
                {concept.mastery_level ?? "Not started"}
              </span>
            </div>
            <h3 className="truncate text-base font-medium text-gray-100">
              {concept.concept}
            </h3>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${getSubjectBar(concept.subject)}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Updated {formatDate(concept.last_updated)}
            </p>
          </div>
          {hasDetails && (
            <svg
              className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </button>

      {isExpanded && hasDetails && (
        <div className="space-y-4 border-t border-gray-800 bg-gray-900/50 px-5 py-4">
          {concept.overview_gist && (
            <p className="text-sm text-gray-300">{concept.overview_gist}</p>
          )}
          {strongAreas.length > 0 && (
            <TagSection
              title="Strong areas"
              items={strongAreas}
              variant="green"
            />
          )}
          {weakAreas.length > 0 && (
            <TagSection
              title="Weak areas"
              items={weakAreas}
              variant="red"
            />
          )}
          {nextSteps.length > 0 && (
            <TagSection
              title="Next steps"
              items={nextSteps}
              variant="blue"
            />
          )}
        </div>
      )}
    </div>
  );
}

function TagSection({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "green" | "red" | "blue";
}) {
  const variantClasses: Record<typeof variant, string> = {
    green: "bg-green-900/40 text-green-200 border-green-800",
    red: "bg-red-900/40 text-red-200 border-red-800",
    blue: "bg-blue-900/40 text-blue-200 border-blue-800",
  };

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${title}-${i}`}
            className={`rounded-md border px-2 py-1 text-xs ${variantClasses[variant]}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
