import { desc, eq } from "drizzle-orm";

import { buildAskSession } from "@akyuu/domain-ask";
import { composeAskAnswer } from "@akyuu/infra-llm";
import type { AskRequest, AskSessionView, DigestView, TopicView } from "@akyuu/shared-types";
import { db, answerRecord, questionSession } from "@akyuu/infra-db";

import type { RequestContext } from "./context.js";
import { listDigestViews, listTopicViews, loadDigestViewById, loadTopicViewById } from "./views.js";

async function loadAnchorDigest(workspaceId: string, anchorType: AskRequest["anchorType"], anchorId?: string): Promise<DigestView | null> {
  if (anchorType === "digest" && anchorId) {
    return loadDigestViewById(anchorId);
  }

  const digests = await listDigestViews(workspaceId);
  return digests.find((digest) => digest.digestType === "daily") ?? digests[0] ?? null;
}

async function loadAnchorTopics(
  workspaceId: string,
  anchorType: AskRequest["anchorType"],
  anchorId?: string
): Promise<TopicView[]> {
  if (anchorType === "topic" && anchorId) {
    const topic = await loadTopicViewById(anchorId, workspaceId);
    return topic ? [topic] : [];
  }

  return listTopicViews(workspaceId);
}

export async function askQuestion(
  context: RequestContext,
  input: AskRequest
): Promise<AskSessionView> {
  const [digestView, topics] = await Promise.all([
    loadAnchorDigest(context.workspaceId, input.anchorType, input.anchorId),
    loadAnchorTopics(context.workspaceId, input.anchorType, input.anchorId)
  ]);

  const built = buildAskSession({
    anchorType: input.anchorType,
    anchorId: input.anchorId ?? null,
    question: input.question,
    digest: digestView,
    topics
  });
  const composed = await composeAskAnswer({
    question: built.question,
    anchorType: built.anchorType,
    anchorId: built.anchorId,
    retrievalContext: built.retrievalContext,
    fallbackAnswerMarkdown: built.answerMarkdown
  });
  const answerMarkdown = composed.markdown;
  const llmVersion = composed.llmVersion ?? built.llmVersion;

  const [sessionRow] = await db
    .insert(questionSession)
    .values({
      workspaceId: context.workspaceId,
      userId: context.userId,
      anchorType: built.anchorType,
      anchorId: built.anchorId,
      question: built.question
    })
    .returning();

  if (!sessionRow) {
    throw new Error("Failed to create question session");
  }

  await db.insert(answerRecord).values({
    questionSessionId: sessionRow.id,
    answerMarkdown,
    retrievalContext: built.retrievalContext as Record<string, unknown>,
    llmVersion
  });

  return {
    sessionId: sessionRow.id,
    anchorType: built.anchorType,
    anchorId: built.anchorId,
    question: built.question,
    answerMarkdown,
    llmVersion,
    createdAt: sessionRow.createdAt.toISOString(),
    retrievalContext: built.retrievalContext
  };
}

export async function listAskSessions(workspaceId: string): Promise<AskSessionView[]> {
  const sessionRows = await db
    .select()
    .from(questionSession)
    .where(eq(questionSession.workspaceId, workspaceId))
    .orderBy(desc(questionSession.createdAt))
    .limit(20);

  return Promise.all(
    sessionRows.map(async (sessionRow) => {
      const [answerRow] = await db
        .select()
        .from(answerRecord)
        .where(eq(answerRecord.questionSessionId, sessionRow.id))
        .limit(1);

      return {
        sessionId: sessionRow.id,
        anchorType: sessionRow.anchorType as AskSessionView["anchorType"],
        anchorId: sessionRow.anchorId,
        question: sessionRow.question,
        answerMarkdown: answerRow?.answerMarkdown ?? "",
        llmVersion: answerRow?.llmVersion ?? "deterministic-v1",
        createdAt: sessionRow.createdAt.toISOString(),
        retrievalContext: (answerRow?.retrievalContext ?? {
          digestId: null,
          digestTitle: null,
          digestSummary: null,
          digestBullets: [],
          recommendedItems: [],
          topics: [],
          evidence: []
        }) as AskSessionView["retrievalContext"]
      };
    })
  );
}
