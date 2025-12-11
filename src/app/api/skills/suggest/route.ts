import { NextRequest, NextResponse } from "next/server";
import { generateSkillDraftFromMessages } from "@/lib/llm";
import { defaultSkillPrompt } from "@/lib/skillPrompt";
import { ConversationFeedback } from "@/types/conversation";

type SuggestRequestBody = {
  sourceText?: string;
  sourceUrls?: string[];
  prompt?: string;
  conversationMessages?: ConversationFeedback[];
};

export async function POST(request: NextRequest) {
  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceText = body?.sourceText?.trim() ?? "";
  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
    : [];

  const conversationMessages = extractConversationMessages(body?.conversationMessages);

  if (!sourceText && sourceUrls.length === 0 && conversationMessages.length === 0) {
    return NextResponse.json(
      { error: "Provide conversationMessages or at least one valid source entry." },
      { status: 400 },
    );
  }

  try {
    const promptText = (body?.prompt ?? "").trim() || defaultSkillPrompt;
    if (conversationMessages.length > 0) {
      const draft = await generateSkillDraftFromMessages(conversationMessages, promptText);
      return NextResponse.json({ draft });
    }

    const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);
    const initialMessage = formatInitialMessage(mergedSource);
    const draft = await generateSkillDraftFromMessages(
      [{ role: "user", content: initialMessage }],
      promptText,
    );
    return NextResponse.json({ draft, initialMessage });
  } catch (error) {
    console.error("Failed to generate skill draft:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate skill draft. Please try again later.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

async function buildSourceMaterial(sourceText: string, sourceUrls: string[]): Promise<string> {
  const sections: string[] = [];
  if (sourceText.trim()) {
    sections.push(sourceText.trim());
  }

  for (const url of sourceUrls) {
    const text = await fetchUrlContent(url);
    if (text) {
      sections.push(`Source: ${url}\n${text}`);
    }
  }

  if (sections.length === 0) {
    throw new Error("Unable to load any content from the provided sources.");
  }

  const combined = sections.join("\n\n---\n\n").trim();
  return combined.slice(0, 100000);
}

function formatInitialMessage(sourceText: string): string {
  return ["Source material:", sourceText.trim(), "", "Return ONLY JSON in the expected shape."].join(
    "\n",
  );
}

function extractConversationMessages(
  messages: ConversationFeedback[] | undefined,
): ConversationFeedback[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      const role = message?.role === "assistant" ? "assistant" : "user";
      const content = typeof message?.content === "string" ? message.content.trim() : "";
      return { role, content };
    })
    .filter((message): message is ConversationFeedback => message.content.length > 0);
}

async function fetchUrlContent(urlString: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    console.warn(`Skipping invalid URL: ${urlString}`);
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    console.warn(`Skipping unsupported protocol: ${urlString}`);
    return null;
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "TransparentRfpSkillBot/1.0" },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch ${urlString}: ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text")) {
      console.warn(`Skipping non-text content from ${urlString}`);
      return null;
    }

    const text = await response.text();
    return text.slice(0, 20000);
  } catch (error) {
    console.warn(`Error fetching ${urlString}:`, error);
    return null;
  }
}
