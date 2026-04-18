import { and, eq, isNull } from "drizzle-orm";

import { getEnv } from "@akyuu/shared-config";
import { getMessages } from "@akyuu/shared-i18n";
import { toSlug } from "@akyuu/shared-utils";

import { closeDb, db } from "./client/index.js";
import { appUser, topic, topicAlias, topicRule, watchSchedule, workspace, workspaceMember } from "./schema.js";

async function main(): Promise<void> {
  const env = getEnv();
  const messages = getMessages(env.DEFAULT_LOCALE);

  let [workspaceRow] = await db.select().from(workspace).where(eq(workspace.slug, env.DEFAULT_WORKSPACE_SLUG)).limit(1);

  if (!workspaceRow) {
    [workspaceRow] = await db
      .insert(workspace)
      .values({
        name: env.DEFAULT_WORKSPACE_NAME,
        slug: env.DEFAULT_WORKSPACE_SLUG,
        timezone: env.DEFAULT_TIMEZONE,
        locale: env.DEFAULT_LOCALE
      })
      .returning();
  }

  let [userRow] = await db.select().from(appUser).where(eq(appUser.email, env.DEFAULT_USER_EMAIL)).limit(1);

  if (!userRow) {
    [userRow] = await db
      .insert(appUser)
      .values({
        email: env.DEFAULT_USER_EMAIL,
        displayName: env.DEFAULT_USER_NAME
      })
      .returning();
  }

  if (!workspaceRow || !userRow) {
    throw new Error("Failed to create default workspace/user during seed.");
  }

  const membership = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceRow.id), eq(workspaceMember.userId, userRow.id)))
    .limit(1);

  if (membership.length === 0) {
    await db.insert(workspaceMember).values({
      workspaceId: workspaceRow.id,
      userId: userRow.id,
      role: "owner"
    });
  }

  const existingTopic = await db
    .select()
    .from(topic)
    .where(and(eq(topic.slug, "ai-agent"), isNull(topic.workspaceId)))
    .limit(1);

  if (existingTopic.length === 0) {
    const systemTopicName = messages.watches.defaultTopicName;
    const [topicRow] = await db
      .insert(topic)
      .values({
        workspaceId: null,
        name: systemTopicName,
        slug: toSlug("AI Agent"),
        description: messages.topics.systemDescription
      })
      .returning();

    if (!topicRow) {
      throw new Error("Failed to create default topic during seed.");
    }

    await db.insert(topicAlias).values({
      topicId: topicRow.id,
      alias: "agent",
      aliasType: "keyword",
      weight: "2"
    });

    await db.insert(topicRule).values([
      {
        topicId: topicRow.id,
        ruleType: "keyword",
        operator: "include",
        value: "agent",
        weight: "2"
      },
      {
        topicId: topicRow.id,
        ruleType: "keyword",
        operator: "include",
        value: "llm",
        weight: "1.5"
      }
    ]);
  }

  const schedules = await db.select().from(watchSchedule);

  console.log(
    JSON.stringify(
      {
        workspaceId: workspaceRow.id,
        userId: userRow.id,
        timezone: workspaceRow.timezone,
        locale: workspaceRow.locale,
        schedules: schedules.length
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
