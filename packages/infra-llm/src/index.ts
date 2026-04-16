import type { AskAnchorType, AskRetrievalContext } from "@akyuu/shared-types";
import { getEnv } from "@akyuu/shared-config";

export type LlmRenderResult = {
  markdown: string;
  llmVersion: string | null;
};

type ChatCompletionContentPart = {
  type?: string;
  text?: string;
};

type ChatCompletionChoice = {
  message?: {
    content?: string | ChatCompletionContentPart[];
  };
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

type ChatCompletionMessage = {
  role: "system" | "user";
  content: string;
};

const renderSystemPrompt = [
  "You are editing a GitHub monitoring digest.",
  "Keep every factual detail, title, ranking, and URL grounded in the input markdown.",
  "Improve readability and flow, but do not add new claims.",
  "Return markdown only."
].join(" ");

const askSystemPrompt = [
  "You answer follow-up questions about a GitHub monitoring workspace.",
  "Use only the provided retrieval context.",
  "Do not invent repositories, pull requests, dates, rankings, or evidence that are not in the context.",
  "If the context is insufficient, say so directly.",
  "Write concise markdown only and match the user's language."
].join(" ");

export function normalizeOpenAiBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function buildChatCompletionsUrl(baseUrl: string): string {
  return new URL("chat/completions", normalizeOpenAiBaseUrl(baseUrl)).toString();
}

export function extractRenderedMarkdown(response: ChatCompletionResponse): string | null {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const markdown = content
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim();

    return markdown || null;
  }

  return null;
}

export function buildAskAnswerPrompt(input: {
  question: string;
  anchorType: AskAnchorType;
  anchorId: string | null;
  retrievalContext: AskRetrievalContext;
}): string {
  return [
    "Question:",
    input.question,
    "",
    `Anchor Type: ${input.anchorType}`,
    `Anchor Id: ${input.anchorId ?? "null"}`,
    "",
    "Retrieval Context JSON:",
    JSON.stringify(input.retrievalContext, null, 2)
  ].join("\n");
}

async function completeMarkdown(messages: ChatCompletionMessage[], fallbackMarkdown: string): Promise<LlmRenderResult> {
  const env = getEnv();

  if (!env.OPENAI_API_KEY) {
    return {
      markdown: fallbackMarkdown,
      llmVersion: null
    };
  }

  try {
    const response = await fetch(buildChatCompletionsUrl(env.OPENAI_BASE_URL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.2,
        messages
      }),
      signal: AbortSignal.timeout(30_000)
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const renderedMarkdown = extractRenderedMarkdown(payload);

    if (!renderedMarkdown) {
      return {
        markdown: fallbackMarkdown,
        llmVersion: null
      };
    }

    return {
      markdown: renderedMarkdown,
      llmVersion: env.OPENAI_MODEL
    };
  } catch {
    return {
      markdown: fallbackMarkdown,
      llmVersion: null
    };
  }
}

export async function renderDigestMarkdown(markdown: string): Promise<LlmRenderResult> {
  return completeMarkdown(
    [
      {
        role: "system",
        content: renderSystemPrompt
      },
      {
        role: "user",
        content: markdown
      }
    ],
    markdown
  );
}

export async function composeAskAnswer(input: {
  question: string;
  anchorType: AskAnchorType;
  anchorId: string | null;
  retrievalContext: AskRetrievalContext;
  fallbackAnswerMarkdown: string;
}): Promise<LlmRenderResult> {
  return completeMarkdown(
    [
      {
        role: "system",
        content: askSystemPrompt
      },
      {
        role: "user",
        content: buildAskAnswerPrompt({
          question: input.question,
          anchorType: input.anchorType,
          anchorId: input.anchorId,
          retrievalContext: input.retrievalContext
        })
      }
    ],
    input.fallbackAnswerMarkdown
  );
}
