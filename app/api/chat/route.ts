



import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const runtime = "nodejs";

type ChatRequestBody = {
  userMessage?: string;
  subject?: string;
  concept?: string;
};

type ConceptRow = {
  mastery_level: string | null;
  weak_areas: string | null;
  strong_areas: string | null;
};

type Mode = "A" | "B" | "C";

const SAVE_PROGRESS_FOOTER = [
  "",
  "At the end of every response, include a final machine-readable block exactly in this format:",
  "[[SAVE_PROGRESS]]",
  '{"masteryLevel":"","overviewGist":"","deepDiveGist":[],"strongAreas":[],"weakAreas":[],"nextSteps":[],"notes":""}',
  "[[/SAVE_PROGRESS]]",
  "Keep the JSON values concise and directly relevant to the answer.",
];

function pickMode(masteryLevel: string | null | undefined): Mode {
  switch (masteryLevel) {
    case "Introduced":
    case "Developing":
      return "B";
    case "Proficient":
    case "Strong":
      return "C";
    default:
      return "A";
  }
}

function modePrompt(mode: Mode): string[] {
  switch (mode) {
    case "B":
      return [
        "You are a helpful study assistant working with a student who has been Introduced to this concept or is still Developing it.",
        "You may reference prior knowledge the student already has, but do not assume deep familiarity.",
        "Pay particular attention to the student's weak areas (listed below) — revisit and reinforce those points.",
        "Maintain a moderate pace: scaffold each idea without over-explaining things they already know.",
      ];
    case "C":
      return [
        "You are a helpful study assistant working with a student who is Proficient or Strong in this concept.",
        "Skip basic definitions and foundational explanations — the student already knows them.",
        "Focus on nuance, edge cases, and the subtle distinctions that deepen understanding.",
        "Use technical language directly. Avoid analogies and hand-holding.",
      ];
    case "A":
    default:
      return [
        "You are a helpful study assistant introducing this concept for the first time (or to a student with no recorded progress).",
        "Use an analogy-first approach: open with a concrete, relatable analogy before introducing formal definitions.",
        "Define every technical term the first time you use it. Prefer plain language over jargon.",
        "Be warm and encouraging. Keep the pace gentle and check understanding before moving on.",
      ];
  }
}

function createSystemPrompt(conceptRow: ConceptRow | null): string {
  const mode = pickMode(conceptRow?.mastery_level);
  const lines = modePrompt(mode);

  if (conceptRow) {
    lines.push("", "Use the following student context when relevant:");
    if (conceptRow.strong_areas) {
      lines.push(`Strong areas: ${conceptRow.strong_areas}`);
    }
    if (conceptRow.weak_areas) {
      lines.push(`Weak areas: ${conceptRow.weak_areas}`);
    }
  }

  return [...lines, ...SAVE_PROGRESS_FOOTER].join("\n");
}

function createTextStreamResponse(stream: AsyncIterable<string>) {
  const encoder = new TextEncoder();
  const iterator = stream[Symbol.asyncIterator]();

  const readableStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      if (typeof iterator.return === "function") {
        await iterator.return();
      }
    },
  });

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userMessage = body.userMessage?.trim();
  const subject = body.subject?.trim() ?? "";
  const concept = body.concept?.trim() ?? "";

  if (!userMessage) {
    return NextResponse.json({ error: "userMessage is required." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialise Supabase client." },
      { status: 500 },
    );
  }

  let conceptRow: ConceptRow | null = null;

  if (subject && concept) {
    const { data, error } = await supabase
      .from("concepts")
      .select("mastery_level, weak_areas, strong_areas")
      .eq("subject", subject)
      .eq("concept", concept)
      .maybeSingle<ConceptRow>();

    if (error) {
      return NextResponse.json(
        { error: "Failed to load concept context.", details: error.message },
        { status: 500 },
      );
    }

    conceptRow = data;
  }

  const systemPrompt = createSystemPrompt(conceptRow);
  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: systemPrompt,
    prompt: userMessage,
  });

  return createTextStreamResponse(result.textStream);
}
