import { eq } from "drizzle-orm";

import { getEnv } from "@akyuu/shared-config";
import { db, appUser, workspace } from "@akyuu/infra-db";

export type RequestContext = {
  workspaceId: string;
  workspaceName: string;
  timezone: string;
  userId: string;
};

export async function getRequestContext(): Promise<RequestContext> {
  const env = getEnv();

  const [workspaceRow] = await db.select().from(workspace).where(eq(workspace.slug, env.DEFAULT_WORKSPACE_SLUG)).limit(1);
  const [userRow] = await db.select().from(appUser).where(eq(appUser.email, env.DEFAULT_USER_EMAIL)).limit(1);

  if (!workspaceRow || !userRow) {
    throw new Error("Default workspace/user not found. Run pnpm db:seed first.");
  }

  return {
    workspaceId: workspaceRow.id,
    workspaceName: workspaceRow.name,
    timezone: workspaceRow.timezone,
    userId: userRow.id
  };
}
