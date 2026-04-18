import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import puppeteer, { type Browser, type Page } from "puppeteer-core";

import { createApiIntegrationHarness, type ApiIntegrationHarness } from "../api/support/harness.js";

process.loadEnvFile?.();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../..");
const screenshotDir = path.join(repoRoot, "test-results", "browser");
const uniqueSuffix = String(Date.now());
const repoWatchName = `Next.js Browser ${uniqueSuffix}`;
const topicWatchName = `Runtime Browser Topic ${uniqueSuffix}`;
const trendWatchName = `Trending Browser ${uniqueSuffix}`;
const liveRepoWatchName = `Node.js Live Browser ${uniqueSuffix}`;
const liveTopicWatchName = `Runtime Live Browser Topic ${uniqueSuffix}`;
const askQuestion = `浏览器测试问题 ${uniqueSuffix}`;
const defaultTimeoutMs = 15_000;
const liveTimeoutMs = 180_000;

type Scenario = {
  name: string;
  timeoutMs?: number;
  run: (page: Page, harness: ApiIntegrationHarness) => Promise<void>;
};

type Suite = {
  name: string;
  harnessOptions: {
    mode: "fixture" | "live";
    startWeb: true;
    startScheduler?: boolean;
  };
  scenarios: Scenario[];
};

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function buildMarker(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveBrowserExecutable(): string {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    configured,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter((value): value is string => Boolean(value));

  const executablePath = candidates.find((candidate) => existsSync(candidate));

  if (!executablePath) {
    throw new Error("No browser executable found. Set PUPPETEER_EXECUTABLE_PATH to a local Chrome or Chromium binary.");
  }

  return executablePath;
}

async function waitForText(page: Page, text: string, rootSelector = "body", timeoutMs = defaultTimeoutMs): Promise<void> {
  await page.waitForFunction(
    ({ expectedText, selector }) => {
      const root = document.querySelector(selector) ?? document.body;
      return root.textContent?.replace(/\s+/g, " ").includes(expectedText) ?? false;
    },
    {
      timeout: timeoutMs
    },
    {
      expectedText: text,
      selector: rootSelector
    }
  );
}

async function waitForTextToDisappear(
  page: Page,
  text: string,
  rootSelector = "body",
  timeoutMs = defaultTimeoutMs
): Promise<void> {
  await page.waitForFunction(
    ({ expectedText, selector }) => {
      const root = document.querySelector(selector) ?? document.body;
      return !(root.textContent?.replace(/\s+/g, " ").includes(expectedText) ?? false);
    },
    {
      timeout: timeoutMs
    },
    {
      expectedText: text,
      selector: rootSelector
    }
  );
}

async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs = defaultTimeoutMs,
  intervalMs = 250
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}

async function markContainerByHeading(page: Page, containerSelector: string, headingText: string, timeoutMs = defaultTimeoutMs): Promise<string> {
  const marker = buildMarker("container");

  await page.waitForFunction(
    ({ selector, title, attributeValue }) => {
      const containers = Array.from(document.querySelectorAll(selector));
      const match = containers.find((container) =>
        Array.from(container.querySelectorAll("h1, h2, h3")).some((heading) => normalize(heading.textContent) === title)
      );

      if (!(match instanceof HTMLElement)) {
        return false;
      }

      match.setAttribute("data-e2e-marker", attributeValue);
      return true;

      function normalize(value: string | null): string {
        return value?.replace(/\s+/g, " ").trim() ?? "";
      }
    },
    {
      timeout: timeoutMs
    },
    {
      selector: containerSelector,
      title: headingText,
      attributeValue: marker
    }
  );

  return `[data-e2e-marker="${marker}"]`;
}

async function markElementByText(page: Page, options: {
  selector: string;
  text: string;
  rootSelector?: string;
  index?: number;
  exact?: boolean;
  timeoutMs?: number;
}): Promise<string> {
  const marker = buildMarker("element");

  await page.waitForFunction(
    ({ selector, rootSelector, text, index, exact, attributeValue }) => {
      const root = document.querySelector(rootSelector) ?? document.body;
      const matches = Array.from(root.querySelectorAll(selector)).filter((element) => {
        const value = (element.textContent ?? "").replace(/\s+/g, " ").trim();
        return exact ? value === text : value.includes(text);
      });
      const match = matches[index];

      if (!(match instanceof HTMLElement)) {
        return false;
      }

      match.setAttribute("data-e2e-marker", attributeValue);
      return true;
    },
    {
      timeout: options.timeoutMs ?? defaultTimeoutMs
    },
    {
      selector: options.selector,
      rootSelector: options.rootSelector ?? "body",
      text: normalizeText(options.text),
      index: options.index ?? 0,
      exact: options.exact ?? true,
      attributeValue: marker
    }
  );

  return `[data-e2e-marker="${marker}"]`;
}

async function markLabeledControl(page: Page, options: {
  labelText: string;
  controlSelector: string;
  rootSelector?: string;
  timeoutMs?: number;
}): Promise<string> {
  const marker = buildMarker("control");

  await page.waitForFunction(
    ({ labelText, controlSelector, rootSelector, attributeValue }) => {
      const root = document.querySelector(rootSelector) ?? document.body;
      const labels = Array.from(root.querySelectorAll("label"));
      const label = labels.find((candidate) =>
        (candidate.textContent ?? "").replace(/\s+/g, " ").trim().startsWith(labelText)
      );
      const control = label?.querySelector(controlSelector);

      if (!(control instanceof HTMLElement)) {
        return false;
      }

      control.setAttribute("data-e2e-marker", attributeValue);
      return true;
    },
    {
      timeout: options.timeoutMs ?? defaultTimeoutMs
    },
    {
      labelText: options.labelText,
      controlSelector: options.controlSelector,
      rootSelector: options.rootSelector ?? "body",
      attributeValue: marker
    }
  );

  return `[data-e2e-marker="${marker}"]`;
}

async function fillLabeledControl(page: Page, options: {
  labelText: string;
  value: string;
  controlSelector?: string;
  rootSelector?: string;
  timeoutMs?: number;
}): Promise<void> {
  const selector = await markLabeledControl(page, {
    labelText: options.labelText,
    controlSelector: options.controlSelector ?? "input, textarea",
    rootSelector: options.rootSelector,
    timeoutMs: options.timeoutMs
  });

  await page.click(selector, {
    clickCount: 3
  });
  await page.keyboard.press("Backspace");
  await page.type(selector, options.value);
}

async function selectLabeledControl(page: Page, options: {
  labelText: string;
  value: string;
  rootSelector?: string;
  timeoutMs?: number;
}): Promise<void> {
  const selector = await markLabeledControl(page, {
    labelText: options.labelText,
    controlSelector: "select",
    rootSelector: options.rootSelector,
    timeoutMs: options.timeoutMs
  });

  await page.select(selector, options.value);
}

async function clickByText(page: Page, options: {
  selector: string;
  text: string;
  rootSelector?: string;
  index?: number;
  exact?: boolean;
  timeoutMs?: number;
}): Promise<void> {
  const selector = await markElementByText(page, options);
  await page.click(selector);
}

async function clickByTextAndWaitForNavigation(page: Page, options: {
  selector: string;
  text: string;
  rootSelector?: string;
  index?: number;
  exact?: boolean;
  timeoutMs?: number;
}): Promise<void> {
  const selector = await markElementByText(page, options);

  await Promise.all([
    page.waitForNavigation({
      waitUntil: "networkidle0",
      timeout: options.timeoutMs ?? defaultTimeoutMs
    }),
    page.click(selector)
  ]);
}

async function performMutationAndRefresh(
  page: Page,
  matcher: (url: string, method: string, status: number) => boolean,
  action: () => Promise<void>,
  timeoutMs = defaultTimeoutMs
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) => matcher(response.url(), response.request().method(), response.status()),
    {
      timeout: timeoutMs
    }
  );
  const navigationPromise = page
    .waitForNavigation({
      waitUntil: "networkidle0",
      timeout: timeoutMs
    })
    .catch(() => undefined);

  await action();
  await responsePromise;
  await navigationPromise;
}

async function openPage(page: Page, url: string, timeoutMs = defaultTimeoutMs): Promise<void> {
  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: timeoutMs
  });
}

async function createWatch(page: Page, values: {
  type: "repo" | "topic" | "trend";
  name: string;
  repo?: string;
  scope?: string;
  repoBindings?: string;
  aliases?: string;
  keywords?: string;
}, timeoutMs = defaultTimeoutMs): Promise<void> {
  const watchForm = await markContainerByHeading(page, "form", "Add Watch", timeoutMs);

  if (values.type !== "repo") {
    await selectLabeledControl(page, {
      labelText: "Type",
      value: values.type,
      rootSelector: watchForm,
      timeoutMs
    });
  }

  await fillLabeledControl(page, {
    labelText: "Name",
    value: values.name,
    rootSelector: watchForm,
    timeoutMs
  });

  if (values.type === "repo") {
    await fillLabeledControl(page, {
      labelText: "Repo",
      value: values.repo ?? "nodejs/node",
      rootSelector: watchForm,
      timeoutMs
    });
  } else if (values.type === "trend") {
    await fillLabeledControl(page, {
      labelText: "Scope",
      value: values.scope ?? "global",
      rootSelector: watchForm,
      timeoutMs
    });
  } else {
    await fillLabeledControl(page, {
      labelText: "Repo Bindings",
      value: values.repoBindings ?? "nodejs/node",
      rootSelector: watchForm,
      timeoutMs
    });
    await fillLabeledControl(page, {
      labelText: "Aliases",
      value: values.aliases ?? "runtime browser",
      rootSelector: watchForm,
      timeoutMs
    });
    await fillLabeledControl(page, {
      labelText: "Keywords",
      value: values.keywords ?? "permission, browser",
      rootSelector: watchForm,
      timeoutMs
    });
  }

  await performMutationAndRefresh(
    page,
    (url, method, status) => url.endsWith("/api/v1/watches") && method === "POST" && status === 201,
    async () => {
      await clickByText(page, {
        selector: "button",
        text: "Create Watch",
        rootSelector: watchForm,
        timeoutMs
      });
    },
    timeoutMs
  );

  await waitForText(page, values.name, "body", timeoutMs);
}

async function clickPipelineButton(page: Page, label: string, timeoutMs = liveTimeoutMs): Promise<void> {
  await performMutationAndRefresh(
    page,
    (url, method, status) => url.endsWith("/api/v1/pipeline/run") && method === "POST" && status === 202,
    async () => {
      await clickByText(page, {
        selector: "button",
        text: label,
        timeoutMs
      });
    },
    timeoutMs
  );
}

const fixtureScenarios: Scenario[] = [
  {
    name: "fixture: renders the dashboard and browses history, delivery, and trends",
    run: async (page, harness) => {
      await openPage(page, `${harness.webBaseUrl}/today`);

      await waitForText(page, "Today");
      await waitForText(page, "Daily Digest");
      await waitForText(page, "Recommended Items");
      await waitForText(page, "Rendered Markdown");

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "History"
      });
      await waitForText(page, "History");
      await waitForText(page, "Monthly Digest");

      await selectLabeledControl(page, {
        labelText: "Type",
        value: "monthly",
        rootSelector: "form.form--inline"
      });
      await clickByTextAndWaitForNavigation(page, {
        selector: "button",
        text: "Apply",
        rootSelector: "form.form--inline"
      });
      await waitForText(page, "Monthly Digest");

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Open Digest",
        index: 0
      });
      await waitForText(page, "Monthly Digest");
      await waitForText(page, "Top Stories");

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Delivery"
      });
      await waitForText(page, "Delivery");
      await waitForText(page, "Open Digest");

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Observe"
      });
      await waitForText(page, "Current Watches");

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Trends"
      });
      await waitForText(page, "Trends");
      await waitForText(page, "github_trending");
    }
  },
  {
    name: "fixture: creates watches from the browser and shows the new topic on Topics",
    run: async (page, harness) => {
      await openPage(page, `${harness.webBaseUrl}/watches`);

      await createWatch(page, {
        type: "repo",
        name: repoWatchName,
        repo: "vercel/next.js"
      });

      await createWatch(page, {
        type: "topic",
        name: topicWatchName,
        repoBindings: "nodejs/node",
        aliases: "runtime browser",
        keywords: "permission, browser"
      });

      await createWatch(page, {
        type: "trend",
        name: trendWatchName,
        scope: "global"
      });

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Topics"
      });
      await waitForText(page, "Topics");
      await waitForText(page, topicWatchName);
      await waitForText(page, `Topic watch for ${topicWatchName}.`);
    }
  },
  {
    name: "fixture: records feedback and asks a follow-up question through browser actions",
    run: async (page, harness) => {
      await openPage(page, `${harness.webBaseUrl}/today`);

      const recommendedCard = await markContainerByHeading(page, "article.card", "Recommended Items");
      await performMutationAndRefresh(
        page,
        (url, method, status) => url.endsWith("/api/v1/feedback") && method === "POST" && status === 201,
        async () => {
          await clickByText(page, {
            selector: "button",
            text: "Worthwhile",
            rootSelector: recommendedCard
          });
        }
      );
      await waitForText(page, "feedback 1");
      await waitForText(page, "item type PR");

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Continue with Ask"
      });
      await waitForText(page, "Ask Follow-up");

      const askForm = await markContainerByHeading(page, "form", "Ask Follow-up");
      await fillLabeledControl(page, {
        labelText: "Question",
        value: askQuestion,
        controlSelector: "textarea",
        rootSelector: askForm
      });
      await performMutationAndRefresh(
        page,
        (url, method, status) => url.endsWith("/api/v1/ask") && method === "POST" && status === 201,
        async () => {
          await clickByText(page, {
            selector: "button",
            text: "Ask",
            rootSelector: askForm
          });
        }
      );
      await waitForText(page, "Ask History");
      await waitForText(page, askQuestion);
    }
  },
  {
    name: "fixture: switches locale and rerenders the translated shell",
    run: async (page, harness) => {
      await openPage(page, `${harness.webBaseUrl}/today`);

      await selectLabeledControl(page, {
        labelText: "Language",
        value: "zh-CN",
        rootSelector: ".nav__controls"
      });
      await waitForCondition(async () => {
        const response = await fetch(`${harness.apiBaseUrl}/api/v1/settings`);
        const payload = (await response.json()) as {
          locale?: string;
        };

        return payload.locale === "zh-CN";
      }, 10_000);
      await openPage(page, `${harness.webBaseUrl}/today`);

      await waitForText(page, "今日", "body", 30_000);
      await waitForText(page, "语言", "body", 30_000);
      await waitForText(page, "运行主链路", "body", 30_000);
    }
  }
];

const liveScenarios: Scenario[] = [
  {
    name: "live: completes the full watch to digest to ask browser path",
    timeoutMs: 240_000,
    run: async (page, harness) => {
      await openPage(page, `${harness.webBaseUrl}/today`, liveTimeoutMs);
      await waitForText(page, "Create at least one active watch before running the pipeline.", "body", liveTimeoutMs);

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Observe",
        timeoutMs: liveTimeoutMs
      });
      await waitForText(page, "Current Watches", "body", liveTimeoutMs);

      await createWatch(
        page,
        {
          type: "repo",
          name: liveRepoWatchName,
          repo: "nodejs/node"
        },
        liveTimeoutMs
      );

      await createWatch(
        page,
        {
          type: "topic",
          name: liveTopicWatchName,
          repoBindings: "nodejs/node",
          aliases: "runtime permissions",
          keywords: "permission, ffi"
        },
        liveTimeoutMs
      );

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Today",
        timeoutMs: liveTimeoutMs
      });
      await waitForTextToDisappear(page, "Create at least one active watch before running the pipeline.", "body", liveTimeoutMs);

      await clickPipelineButton(page, "Run Pipeline", liveTimeoutMs);
      await waitForText(page, "Daily Digest", "body", liveTimeoutMs);
      await waitForText(page, "Recommended Items", "body", liveTimeoutMs);
      await waitForText(page, "Rendered Markdown", "body", liveTimeoutMs);

      await clickPipelineButton(page, "Run Weekly Digest", liveTimeoutMs);
      await waitForText(page, "Daily Digest", "body", liveTimeoutMs);

      await clickPipelineButton(page, "Run Monthly Digest", liveTimeoutMs);
      await waitForText(page, "Daily Digest", "body", liveTimeoutMs);

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "History",
        timeoutMs: liveTimeoutMs
      });
      await waitForText(page, "Daily Digest", "body", liveTimeoutMs);
      await waitForText(page, "Weekly Digest", "body", liveTimeoutMs);
      await waitForText(page, "Monthly Digest", "body", liveTimeoutMs);

      await selectLabeledControl(page, {
        labelText: "Type",
        value: "monthly",
        rootSelector: "form.form--inline",
        timeoutMs: liveTimeoutMs
      });
      await clickByTextAndWaitForNavigation(page, {
        selector: "button",
        text: "Apply",
        rootSelector: "form.form--inline",
        timeoutMs: liveTimeoutMs
      });
      await waitForText(page, "Monthly Digest", "body", liveTimeoutMs);

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Open Digest",
        index: 0,
        timeoutMs: liveTimeoutMs
      });
      await waitForText(page, "Top Stories", "body", liveTimeoutMs);
      await waitForText(page, "Recommended Reading", "body", liveTimeoutMs);

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Today",
        timeoutMs: liveTimeoutMs
      });
      await waitForText(page, "Recommended Items", "body", liveTimeoutMs);

      const recommendedCard = await markContainerByHeading(page, "article.card", "Recommended Items", liveTimeoutMs);
      await performMutationAndRefresh(
        page,
        (url, method, status) => url.endsWith("/api/v1/feedback") && method === "POST" && status === 201,
        async () => {
          await clickByText(page, {
            selector: "button",
            text: "Worthwhile",
            rootSelector: recommendedCard,
            timeoutMs: liveTimeoutMs
          });
        },
        liveTimeoutMs
      );
      await waitForText(page, "feedback 1", "body", liveTimeoutMs);
      await waitForText(page, "item type", "body", liveTimeoutMs);

      await clickByTextAndWaitForNavigation(page, {
        selector: "a",
        text: "Continue with Ask",
        timeoutMs: liveTimeoutMs
      });
      await waitForText(page, "Ask Follow-up", "body", liveTimeoutMs);

      const askForm = await markContainerByHeading(page, "form", "Ask Follow-up", liveTimeoutMs);
      await fillLabeledControl(page, {
        labelText: "Question",
        value: askQuestion,
        controlSelector: "textarea",
        rootSelector: askForm,
        timeoutMs: liveTimeoutMs
      });
      await performMutationAndRefresh(
        page,
        (url, method, status) => url.endsWith("/api/v1/ask") && method === "POST" && status === 201,
        async () => {
          await clickByText(page, {
            selector: "button",
            text: "Ask",
            rootSelector: askForm,
            timeoutMs: liveTimeoutMs
          });
        },
        liveTimeoutMs
      );
      await waitForText(page, "Ask History", "body", liveTimeoutMs);
      await waitForText(page, askQuestion, "body", liveTimeoutMs);
    }
  }
];

async function runScenario(browser: Browser, harness: ApiIntegrationHarness, suiteName: string, scenario: Scenario): Promise<void> {
  const page = await browser.newPage();
  const timeoutMs = scenario.timeoutMs ?? defaultTimeoutMs;
  page.setDefaultTimeout(timeoutMs);

  try {
    await scenario.run(page, harness);
    console.log(`✓ [${suiteName}] ${scenario.name}`);
  } catch (error) {
    await mkdir(screenshotDir, {
      recursive: true
    });
    const screenshotPath = path.join(screenshotDir, `${slugify(`${suiteName}-${scenario.name}`)}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.error(`✗ [${suiteName}] ${scenario.name}`);
    console.error(error);
    console.error(`screenshot: ${screenshotPath}`);
    throw error;
  } finally {
    await page.close();
  }
}

const suites: Suite[] = [
  {
    name: "fixture",
    harnessOptions: {
      mode: "fixture",
      startWeb: true
    },
    scenarios: fixtureScenarios
  }
];

if (process.env.GITHUB_TOKEN && process.env.OPENAI_API_KEY) {
  suites.push({
    name: "live",
    harnessOptions: {
      mode: "live",
      startWeb: true
    },
    scenarios: liveScenarios
  });
} else {
  console.log("Skipping live browser suite because GITHUB_TOKEN or OPENAI_API_KEY is missing.");
}

let browser: Browser | null = null;

try {
  browser = await puppeteer.launch({
    executablePath: resolveBrowserExecutable(),
    headless: process.env.PUPPETEER_HEADLESS === "false" ? false : true,
    defaultViewport: {
      width: 1440,
      height: 960
    }
  });

  let scenarioCount = 0;

  for (const suite of suites) {
    const harness = await createApiIntegrationHarness(suite.harnessOptions);

    try {
      for (const scenario of suite.scenarios) {
        await runScenario(browser, harness, suite.name, scenario);
        scenarioCount += 1;
      }
    } finally {
      await harness.stop();
    }
  }

  console.log(`\n${scenarioCount} browser scenarios passed across ${suites.length} suite(s).`);
} finally {
  if (browser) {
    await browser.close();
  }
}
