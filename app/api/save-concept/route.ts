import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

type SaveConceptRequest = {
  subject?: unknown;
  concept?: unknown;
  masteryLevel?: unknown;
  overviewGist?: unknown;
  deepDiveGist?: unknown;
  strongAreas?: unknown;
  weakAreas?: unknown;
  nextSteps?: unknown;
  notes?: unknown;
};

type SavedConceptRow = {
  subject: string;
  concept: string;
  mastery_level: string | null;
  last_updated: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function POST(request: Request) {
  let body: SaveConceptRequest;

  try {
    body = (await request.json()) as SaveConceptRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = asString(body.subject);
  const concept = asString(body.concept);

  if (!subject) {
    return NextResponse.json({ error: "subject is required." }, { status: 400 });
  }
  if (!concept) {
    return NextResponse.json({ error: "concept is required." }, { status: 400 });
  }

  const row = {
    subject,
    concept,
    mastery_level: asString(body.masteryLevel),
    overview_gist: asString(body.overviewGist),
    deep_dive_gist: asStringArray(body.deepDiveGist),
    strong_areas: asStringArray(body.strongAreas),
    weak_areas: asStringArray(body.weakAreas),
    next_steps: asStringArray(body.nextSteps),
    notes: asString(body.notes),
    last_updated: new Date().toISOString(),
  };

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialise Supabase client." },
      { status: 500 },
    );
  }

  // Requires a composite unique constraint on the `concepts` table covering
  // (subject, concept). Without it, Postgres will reject the upsert with
  // "no unique or exclusion constraint matching the ON CONFLICT specification".
  // Add it with:
  //   ALTER TABLE concepts ADD CONSTRAINT concepts_subject_concept_key
  //     UNIQUE (subject, concept);
  const { data, error } = await supabase
    .from("concepts")
    .upsert(row, { onConflict: "subject,concept" })
    .select("subject, concept, mastery_level, last_updated")
    .maybeSingle<SavedConceptRow>();

  if (error) {
    return NextResponse.json(
      { error: "Failed to save concept.", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, row: data });
}
