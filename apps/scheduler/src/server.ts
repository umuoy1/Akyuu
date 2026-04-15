import { getEnv } from "@akyuu/shared-config";

import { createApp, runSchedulerTick } from "./app.js";

const env = getEnv();
const app = await createApp();

await app.listen({
  host: env.SCHEDULER_HOST,
  port: env.SCHEDULER_PORT
});

if (env.SCHEDULER_AUTO_RUN) {
  setInterval(() => {
    void runSchedulerTick();
  }, env.SCHEDULER_POLL_INTERVAL_MS);
}
