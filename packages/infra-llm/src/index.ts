import { getMessages } from "@akyuu/shared-i18n";
import type { AskAnchorType, AskRetrievalContext, SupportedLocale } from "@akyuu/shared-types";
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
  locale: SupportedLocale;
}): string {
  const messages = getMessages(input.locale);
  return [
    `${messages.llm.questionLabel}:`,
    input.question,
    "",
    `${messages.llm.anchorTypeLabel}: ${input.anchorType}`,
    `${messages.llm.anchorIdLabel}: ${input.anchorId ?? "null"}`,
    "",
    `${messages.llm.retrievalContextLabel}:`,
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

export async function renderDigestMarkdown(markdown: string, locale: SupportedLocale): Promise<LlmRenderResult> {
  const messages = getMessages(locale);
  return completeMarkdown(
    [
      {
        role: "system",
        content: `${messages.llm.renderDigestSystemPrompt} Write the final answer in ${messages.llm.targetLanguage}.`
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
  locale: SupportedLocale;
}): Promise<LlmRenderResult> {
  const messages = getMessages(input.locale);
  return completeMarkdown(
    [
      {
        role: "system",
        content: `${messages.llm.askSystemPrompt} Write the final answer in ${messages.llm.targetLanguage}.`
      },
      {
        role: "user",
        content: buildAskAnswerPrompt({
          question: input.question,
          anchorType: input.anchorType,
          anchorId: input.anchorId,
          retrievalContext: input.retrievalContext,
          locale: input.locale
        })
      }
    ],
    input.fallbackAnswerMarkdown
  );
}
