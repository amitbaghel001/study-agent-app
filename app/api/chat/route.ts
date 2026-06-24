import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatRequestBody = {
  userMessage?: string;
  subject?: string;
  concept?: string;
};

type ConceptRow = {
  weak_areas: string | null;
  strong_areas: string | null;
};

function createSystemPrompt(conceptRow: ConceptRow | null) {
  const basePrompt = [
    "You are a helpful study assistant.",
    "Answer clearly, accurately, and in a supportive tone.",
    "Focus on helping the student understand the concept and avoid unnecessary detail unless it helps clarity.",
    "At the end of every response, include a final machine-readable block exactly in this format:",
    "[[SAVE_PROGRESS]]",
    '{"masteryLevel":"","overviewGist":"","deepDiveGist":[],"strongAreas":[],"weakAreas":[],"nextSteps":[],"notes":""}',
    "[[/SAVE_PROGRESS]]",
    "Keep the JSON values concise and directly relevant to the answer.",
  ];

  if (!conceptRow) {
    return basePrompt.join("\n");
  }

  const contextLines = [
    "Use the following student context when relevant:",
    conceptRow.strong_areas ? `Strong areas: ${conceptRow.strong_areas}` : null,
    conceptRow.weak_areas ? `Weak areas: ${conceptRow.weak_areas}` : null,
  ].filter(Boolean);

  return [...basePrompt, "", ...contextLines].join("\n");
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  let conceptRow: ConceptRow | null = null;

  if (subject && concept) {
    const { data, error } = await supabase
      .from("concepts")
      .select("weak_areas, strong_areas")
      .eq("subject", subject)
      .eq("concept", concept)
      .maybeSingle();

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
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    prompt: userMessage,
  });

  return createTextStreamResponse(result.textStream);
}
