import { getEnv } from "@akyuu/shared-config";

import { createApp } from "./app.js";

const env = getEnv();
const app = await createApp();

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT
});
