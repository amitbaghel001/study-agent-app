import { ConceptCard, type ConceptRow } from "@/components/ConceptCard";
import { createServiceClient } from "@/lib/supabase";

const MASTERY_SCORES: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  "In Progress": 0,
};

export const metadata = {
  title: "Dashboard · Study Agent",
};

// Always render on demand — the dashboard reflects live Supabase data and
// must not be prerendered at build time (otherwise a missing service-role key
// at build would cache an error state into the static HTML).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let concepts: ConceptRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("concepts")
      .select(
        "subject, concept, mastery_level, last_updated, strong_areas, weak_areas, next_steps, overview_gist, deep_dive_gist, notes",
      )
      .order("last_updated", { ascending: false });

    if (error) {
      loadError = error.message;
    } else {
      concepts = (data as ConceptRow[] | null) ?? [];
    }
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : "Failed to connect to Supabase. Is SUPABASE_SERVICE_ROLE_KEY set?";
  }

  // Stats: only count rows whose mastery_level maps to a known score.
  const scoredConcepts = concepts.filter(
    (c) => c.mastery_level && MASTERY_SCORES[c.mastery_level] !== undefined,
  );
  const total = concepts.length;
  const uniqueSubjects = new Set(concepts.map((c) => c.subject.toLowerCase()))
    .size;
  const avgScore =
    scoredConcepts.length > 0
      ? scoredConcepts.reduce(
          (sum, c) => sum + MASTERY_SCORES[c.mastery_level as string],
          0,
        ) / scoredConcepts.length
      : 0;
  const avgPercentage = (avgScore / 4) * 100;

  return (
    <main className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">
            Track every concept you have studied and how well you know it.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Concepts studied" value={total.toString()} />
          <StatCard
            label="Unique subjects"
            value={uniqueSubjects.toString()}
          />
          <StatCard
            label="Average mastery"
            value={
              scoredConcepts.length > 0
                ? `${avgPercentage.toFixed(0)}%`
                : "—"
            }
            subtext={
              scoredConcepts.length > 0
                ? `Across ${scoredConcepts.length} scored concept${scoredConcepts.length === 1 ? "" : "s"}`
                : "No scored concepts yet"
            }
          />
        </div>

        {loadError && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-200">
            Failed to load concepts: {loadError}
          </div>
        )}

        {concepts.length === 0 && !loadError ? (
          <div className="mt-16 text-center text-gray-500">
            <p className="text-lg">No concepts yet</p>
            <p className="mt-1 text-sm">
              Start a conversation in the chat and click &ldquo;Save progress&rdquo;
              to build your study dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {concepts.map((c) => (
              <ConceptCard
                key={`${c.subject}-${c.concept}`}
                concept={c}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-100">{value}</p>
      {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
    </div>
  );
}
