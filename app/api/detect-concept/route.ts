import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, jsonSchema } from "ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DetectConceptRequest = {
  userMessage?: string;
};

type DetectConceptResponse = {
  subject: string;
  concept: string;
};

const SYSTEM_PROMPT = [
  "You extract the academic subject and the specific concept a student is asking about from their message.",
  "",
  "Return a JSON object with exactly these two string fields:",
  '  - "subject": the broad academic subject (e.g. "mathematics", "biology", "history"). Use lowercase.',
  '  - "concept": the specific concept within that subject (e.g. "fractions", "mitosis", "world war 1"). Use lowercase.',
  "",
  "If the message is not about studying a concept (small talk, greetings, off-topic chatter, or ambiguous input), return:",
  '  {"subject": "", "concept": ""}',
  "",
  "Be conservative: if the message is ambiguous or does not clearly identify a study concept, prefer empty strings over guessing.",
].join("\n");

const conceptSchema = jsonSchema<DetectConceptResponse>({
  type: "object",
  properties: {
    subject: { type: "string" },
    concept: { type: "string" },
  },
  required: ["subject", "concept"],
  additionalProperties: false,
});

export async function POST(request: Request) {
  let body: DetectConceptRequest;

  try {
    body = (await request.json()) as DetectConceptRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userMessage = body.userMessage?.trim();

  if (!userMessage) {
    return NextResponse.json({ error: "userMessage is required." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-5"),
      schema: conceptSchema,
      schemaName: "ConceptDetection",
      schemaDescription:
        "The academic subject and specific concept detected in the student's message.",
      system: SYSTEM_PROMPT,
      prompt: userMessage,
    });

    // Defensive normalization: trim, lowercase, coerce non-strings to empty.
    return NextResponse.json({
      subject: typeof object.subject === "string" ? object.subject.trim().toLowerCase() : "",
      concept: typeof object.concept === "string" ? object.concept.trim().toLowerCase() : "",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to detect concept." },
      { status: 502 },
    );
  }
}
