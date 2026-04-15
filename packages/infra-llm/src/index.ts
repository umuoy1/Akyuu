export type LlmRenderResult = {
  markdown: string;
  llmVersion: string | null;
};

export async function renderDigestMarkdown(markdown: string): Promise<LlmRenderResult> {
  return {
    markdown,
    llmVersion: null
  };
}
