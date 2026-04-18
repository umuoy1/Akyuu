import type {
  AskAnchorType,
  DigestView,
  FeedbackRecord,
  NotificationRecord,
  SupportedLocale,
  WatchRecord
} from "@akyuu/shared-types";

const supportedLocales = ["en-US", "zh-CN"] as const satisfies SupportedLocale[];

type MessageCatalog = {
  locale: {
    label: string;
    switcherLabel: string;
    options: Record<SupportedLocale, string>;
    updating: string;
    updateFailed: string;
  };
  metadata: {
    description: string;
  };
  nav: {
    brand: string;
    today: string;
    observe: string;
    watches: string;
    topics: string;
    trends: string;
    history: string;
    delivery: string;
    ask: string;
  };
  common: {
    noDescription: string;
    openDigest: string;
    apply: string;
    all: string;
    createdAt: string;
    attempts: string;
    noItems: string;
    unknownRepo: string;
    digest: string;
  };
  enums: {
    digestType: Record<DigestView["digestType"], string>;
    watchType: Record<WatchRecord["type"], string>;
    watchStatus: Record<WatchRecord["status"], string>;
      feedbackType: Record<FeedbackRecord["feedbackType"], string>;
      feedbackTargetType: Record<FeedbackRecord["targetType"], string>;
      askAnchorType: Record<AskAnchorType, string>;
      notificationChannel: Record<NotificationRecord["channel"], string>;
      notificationStatus: Record<NotificationRecord["status"], string>;
    itemType: Record<DigestView["recommendedItems"][number]["itemType"], string>;
    eventType: Record<string, string>;
  };
  actions: {
    runPipeline: string;
    runWeeklyDigest: string;
    runMonthlyDigest: string;
    running: string;
    createWatch: string;
    save: string;
    ask: string;
    asking: string;
    worthwhile: string;
    notWorthwhile: string;
  };
  today: {
    productLabel: string;
    title: string;
    intro: string;
    disabledReason: string;
    recommendedItems: string;
    continueWithAsk: string;
    recentFeedback: string;
    noFeedback: string;
    recentDelivery: string;
    noDelivery: string;
    openDelivery: string;
    preferenceProfile: string;
    noPreferenceProfile: string;
    feedbackCount: (count: number) => string;
    itemTypeWeight: (label: string, value: number) => string;
    repoWeight: (label: string, value: number) => string;
    renderedMarkdown: string;
    noDigest: string;
    noDigestHint: string;
    goToWatches: string;
    feedbackRecord: (feedbackType: string, targetType: string, createdAt: string) => string;
    deliveryRecord: (channel: string, targetAddress: string, status: string) => string;
  };
  watches: {
    addWatch: string;
    currentWatches: string;
    noWatches: string;
    defaultTopicName: string;
    type: string;
    name: string;
    repo: string;
    scope: string;
    repoBindings: string;
    aliases: string;
    keywords: string;
    optionalDisplayName: string;
    repoPlaceholder: string;
    scopePlaceholder: string;
    repoBindingsPlaceholder: string;
    aliasesPlaceholder: string;
    keywordsPlaceholder: string;
    priority: (priority: number) => string;
  };
  topics: {
    productLabel: string;
    title: string;
    intro: string;
    noTopics: string;
    noTopicsHint: string;
    watchDescription: (name: string) => string;
    systemDescription: string;
    repoBindingsAndEvidences: (repoBindings: number, evidences: number) => string;
    noTopicUpdates: string;
  };
  trends: {
    productLabel: string;
    title: string;
    intro: string;
    highlights: string;
    topSnapshotItems: string;
    noStructuralDiff: string;
    noTrendDiff: string;
    noTrendDiffHint: string;
    compare: (snapshotDate: string, comparedToDate: string) => string;
  };
  history: {
    title: string;
    search: string;
    searchPlaceholder: string;
    type: string;
    noHistory: string;
  };
  delivery: {
    title: string;
    fallbackDigestTitle: string;
    noDeliveryRecords: string;
    deliveryMeta: (channel: string, targetAddress: string, status: string) => string;
    deliveryAttempts: (attempts: number, createdAt: string) => string;
  };
  ask: {
    historyTitle: string;
    noHistory: string;
    followUpTitle: string;
    question: string;
    questionPlaceholder: string;
    failed: string;
    deterministic: {
      noContext: string;
      suggestedFirstReads: string;
      noRecommendations: string;
      evidence: string;
      topicPerspective: string;
      noTopicUpdates: string;
      trendConclusion: string;
      noTrendDiff: string;
      currentConclusion: string;
      digestFallbackLabel: string;
      windowEnd: (value: string) => string;
    };
  };
  digest: {
    topStories: string;
    repoSummary: string;
    topicSummary: string;
    trendSummary: string;
    recommendedReading: string;
    dailyTitle: (dateLabel: string) => string;
    rangedTitle: (typeLabel: string, start: string, end: string) => string;
    dailySummary: (dateLabel: string) => string;
    rangedSummary: (typeLabel: string, start: string, end: string) => string;
    topStorySummary: (eventType: string, repo: string) => string;
    repoItemSummary: (eventType: string, score: string) => string;
    recommendedReason: (score: string, eventType: string) => string;
    recommendedReasonWithPreference: (score: string, preference: string, eventType: string) => string;
  };
  topic: {
    matchedSignals: (topicName: string, count: number) => string;
    noMatchedSignals: (topicName: string) => string;
    highlight: (title: string, eventType: string, repoFullName: string | null) => string;
  };
  trend: {
    newEntries: (repos: string[]) => string;
    fastRisers: (items: Array<{ repoFullName: string; from: number; to: number }>) => string;
    leftTrending: (repos: string[]) => string;
  };
  api: {
    invalidRequest: string;
    internalServerError: string;
    topicWatchExists: string;
    watchCreateFailed: string;
    topicCreateFailed: string;
    digestNotFound: string;
    noDigestFound: string;
    topicNotFound: string;
    feedbackPersistFailed: string;
    noActiveWatches: string;
    pipelineRunFailed: string;
    workspaceBootstrapMissing: string;
  };
  llm: {
    renderDigestSystemPrompt: string;
    askSystemPrompt: string;
    questionLabel: string;
    anchorTypeLabel: string;
    anchorIdLabel: string;
    retrievalContextLabel: string;
    targetLanguage: string;
  };
};

type DateInput = Date | string;

function asDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function resolveSupportedLocale(input?: string | null): SupportedLocale {
  const candidate = (input ?? "").trim();

  if (!candidate) {
    return "en-US";
  }

  const firstPart = candidate
    .split(",")
    .map((item) => item.split(";")[0]?.trim() ?? "")
    .find(Boolean)
    ?.toLowerCase();

  if (!firstPart) {
    return "en-US";
  }

  if (firstPart.startsWith("zh")) {
    return "zh-CN";
  }

  if (firstPart.startsWith("en")) {
    return "en-US";
  }

  return "en-US";
}

export function listSupportedLocales(): SupportedLocale[] {
  return [...supportedLocales];
}

export function formatDate(value: DateInput, locale: SupportedLocale, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...options
  }).format(asDate(value));
}

export function formatDateTime(value: DateInput, locale: SupportedLocale, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options
  }).format(asDate(value));
}

export function formatNumber(value: number, locale: SupportedLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    ...options
  }).format(value);
}

const catalogs: Record<SupportedLocale, MessageCatalog> = {
  "en-US": {
    locale: {
      label: "Language",
      switcherLabel: "Language",
      options: {
        "en-US": "English",
        "zh-CN": "简体中文"
      },
      updating: "Updating...",
      updateFailed: "Failed to update language"
    },
    metadata: {
      description: "GitHub intelligence agent"
    },
    nav: {
      brand: "Akyuu",
      today: "Today",
      observe: "Observe",
      watches: "Watches",
      topics: "Topics",
      trends: "Trends",
      history: "History",
      delivery: "Delivery",
      ask: "Ask"
    },
    common: {
      noDescription: "No description.",
      openDigest: "Open Digest",
      apply: "Apply",
      all: "All",
      createdAt: "created",
      attempts: "attempts",
      noItems: "No items yet.",
      unknownRepo: "unknown repo",
      digest: "Digest"
    },
    enums: {
      digestType: {
        daily: "Daily",
        weekly: "Weekly",
        monthly: "Monthly"
      },
      watchType: {
        repo: "RepoWatch",
        topic: "TopicWatch",
        trend: "TrendWatch",
        rank_feed: "RankFeedWatch"
      },
      watchStatus: {
        active: "Active",
        paused: "Paused",
        archived: "Archived"
      },
      feedbackType: {
        worthwhile: "Worthwhile",
        not_worthwhile: "Not Worthwhile",
        more_like_this: "More Like This",
        less_like_this: "Less Like This",
        opened: "Opened",
        clicked: "Clicked"
      },
      feedbackTargetType: {
        digest: "Digest",
        recommended_item: "Recommended Item",
        topic_update: "Topic Update"
      },
      askAnchorType: {
        digest: "Digest",
        topic: "Topic",
        history: "History",
        search: "Search"
      },
      notificationChannel: {
        email: "Email",
        slack: "Slack",
        telegram: "Telegram",
        webhook: "Webhook"
      },
      notificationStatus: {
        pending: "Pending",
        sent: "Sent",
        failed: "Failed"
      },
      itemType: {
        pr: "PR",
        issue: "Issue",
        repo: "Repo",
        topic: "Topic",
        release: "Release"
      },
      eventType: {
        repo_metadata_refreshed: "repo metadata refreshed",
        pr_opened: "PR opened",
        pr_merged: "PR merged",
        issue_opened: "issue opened",
        issue_hot: "issue became hot",
        release_published: "release published",
        repo_entered_trending: "repo entered trending",
        repo_left_trending: "repo left trending"
      }
    },
    actions: {
      runPipeline: "Run Pipeline",
      runWeeklyDigest: "Run Weekly Digest",
      runMonthlyDigest: "Run Monthly Digest",
      running: "Running...",
      createWatch: "Create Watch",
      save: "Saving...",
      ask: "Ask",
      asking: "Asking...",
      worthwhile: "Worthwhile",
      notWorthwhile: "Not Worthwhile"
    },
    today: {
      productLabel: "GitHub Intel Agent",
      title: "Today",
      intro: "Run the pipeline after adding at least one RepoWatch, TopicWatch, or TrendWatch.",
      disabledReason: "Create at least one active watch before running the pipeline.",
      recommendedItems: "Recommended Items",
      continueWithAsk: "Continue with Ask",
      recentFeedback: "Recent Feedback",
      noFeedback: "No feedback yet.",
      recentDelivery: "Recent Delivery",
      noDelivery: "No deliveries yet.",
      openDelivery: "Open Delivery",
      preferenceProfile: "Preference Profile",
      noPreferenceProfile: "No preference profile yet.",
      feedbackCount: (count) => `feedback ${count}`,
      itemTypeWeight: (label, value) => `item type ${label} · ${value}`,
      repoWeight: (label, value) => `repo ${label} · ${value}`,
      renderedMarkdown: "Rendered Markdown",
      noDigest: "No digest yet",
      noDigestHint: "Create watches, start the worker, then run the pipeline here.",
      goToWatches: "Go to Watches",
      feedbackRecord: (feedbackType, targetType, createdAt) => `${feedbackType} on ${targetType} · ${createdAt}`,
      deliveryRecord: (channel, targetAddress, status) => `${channel} to ${targetAddress} · ${status}`
    },
    watches: {
      addWatch: "Add Watch",
      currentWatches: "Current Watches",
      noWatches: "No watches yet.",
      defaultTopicName: "AI Agent",
      type: "Type",
      name: "Name",
      repo: "Repo",
      scope: "Scope",
      repoBindings: "Repo Bindings",
      aliases: "Aliases",
      keywords: "Keywords",
      optionalDisplayName: "Optional display name",
      repoPlaceholder: "owner/repo",
      scopePlaceholder: "global",
      repoBindingsPlaceholder: "owner/repo, owner/repo",
      aliasesPlaceholder: "temporal, async context",
      keywordsPlaceholder: "temporal, proposal",
      priority: (priority) => `priority ${priority}`
    },
    topics: {
      productLabel: "TopicWatch",
      title: "Topics",
      intro: "Rules aggregate cross-repo signals into topic-level summaries.",
      noTopics: "No topics yet",
      noTopicsHint: "Create a TopicWatch from Watches to start aggregating cross-repo signals.",
      watchDescription: (name) => `Topic watch for ${name}.`,
      systemDescription: "System topic for AI coding agent related changes.",
      repoBindingsAndEvidences: (repoBindings, evidences) => `${repoBindings} repo bindings · ${evidences} evidences`,
      noTopicUpdates: "No topic updates yet. Run the pipeline after adding repo bindings."
    },
    trends: {
      productLabel: "Trend Intelligence",
      title: "Trends",
      intro: "Daily diff for trending snapshots with highlights, rank movement, and top repos.",
      highlights: "Highlights",
      topSnapshotItems: "Top Snapshot Items",
      noStructuralDiff: "No structural diff yet.",
      noTrendDiff: "No trend diff yet",
      noTrendDiffHint: "Create a TrendWatch and run the pipeline to populate trend snapshots.",
      compare: (snapshotDate, comparedToDate) => `${snapshotDate} vs ${comparedToDate}`
    },
    history: {
      title: "History",
      search: "Search",
      searchPlaceholder: "Digest title or summary",
      type: "Type",
      noHistory: "No history yet."
    },
    delivery: {
      title: "Delivery",
      fallbackDigestTitle: "Digest Delivery",
      noDeliveryRecords: "No delivery records yet.",
      deliveryMeta: (channel, targetAddress, status) => `${channel} · ${targetAddress} · ${status}`,
      deliveryAttempts: (attempts, createdAt) => `attempts ${attempts} · created ${createdAt}`
    },
    ask: {
      historyTitle: "Ask History",
      noHistory: "No follow-up questions yet.",
      followUpTitle: "Ask Follow-up",
      question: "Question",
      questionPlaceholder: "What are the 3 PRs worth reading first today?",
      failed: "Failed to ask question",
      deterministic: {
        noContext: "There is no usable context yet. Generate a digest first, or bind at least one repository to a TopicWatch.",
        suggestedFirstReads: "### Recommended First Reads",
        noRecommendations: "There are no recommended items in the current digest yet.",
        evidence: "### Evidence",
        topicPerspective: "### Topic Perspective",
        noTopicUpdates: "There are no matching topic updates right now.",
        trendConclusion: "### Trend Conclusion",
        noTrendDiff: "- There is no trend diff yet.",
        currentConclusion: "### Current Conclusion",
        digestFallbackLabel: "Digest",
        windowEnd: (value) => `- ${value}`
      }
    },
    digest: {
      topStories: "Top Stories",
      repoSummary: "Repo Summary",
      topicSummary: "Topic Summary",
      trendSummary: "Trend Summary",
      recommendedReading: "Recommended Reading",
      dailyTitle: (dateLabel) => `Daily Digest · ${dateLabel}`,
      rangedTitle: (typeLabel, start, end) => `${typeLabel} Digest · ${start} to ${end}`,
      dailySummary: (dateLabel) => `Workspace digest for ${dateLabel}.`,
      rangedSummary: (typeLabel, start, end) => `Workspace ${typeLabel.toLowerCase()} digest for ${start} to ${end}.`,
      topStorySummary: (eventType, repo) => `${eventType} in ${repo}`,
      repoItemSummary: (eventType, score) => `${eventType} (${score})`,
      recommendedReason: (score, eventType) => `Importance score ${score} from ${eventType}`,
      recommendedReasonWithPreference: (score, preference, eventType) =>
        `Importance score ${score} with preference ${preference} from ${eventType}`
    },
    topic: {
      matchedSignals: (topicName, count) => `${topicName} matched ${count} signals in the current window.`,
      noMatchedSignals: (topicName) => `${topicName} had no matched signals in the current window.`,
      highlight: (title, eventType, repoFullName) => `${title} -> ${eventType}${repoFullName ? ` in ${repoFullName}` : ""}`
    },
    trend: {
      newEntries: (repos) => `New entries: ${repos.slice(0, 3).join(", ")}`,
      fastRisers: (items) =>
        `Fast risers: ${items
          .slice(0, 3)
          .map((item) => `${item.repoFullName} ${item.from}->${item.to}`)
          .join(", ")}`,
      leftTrending: (repos) => `Left trending: ${repos.slice(0, 3).join(", ")}`
    },
    api: {
      invalidRequest: "Invalid request payload.",
      internalServerError: "Internal server error.",
      topicWatchExists: "Topic watch with the same name already exists.",
      watchCreateFailed: "Failed to create watch.",
      topicCreateFailed: "Failed to create topic.",
      digestNotFound: "Digest not found.",
      noDigestFound: "No digest found.",
      topicNotFound: "Topic not found.",
      feedbackPersistFailed: "Failed to persist feedback.",
      noActiveWatches: "No active repo, topic, or trend watches found.",
      pipelineRunFailed: "Failed to run pipeline.",
      workspaceBootstrapMissing: "Default workspace or user not found. Run pnpm db:seed first."
    },
    llm: {
      renderDigestSystemPrompt: [
        "You are editing a GitHub monitoring digest.",
        "Keep every factual detail, title, ranking, and URL grounded in the input markdown.",
        "Improve readability and flow, but do not add new claims.",
        "Return markdown only."
      ].join(" "),
      askSystemPrompt: [
        "You answer follow-up questions about a GitHub monitoring workspace.",
        "Use only the provided retrieval context.",
        "Do not invent repositories, pull requests, dates, rankings, or evidence that are not in the context.",
        "If the context is insufficient, say so directly.",
        "Write concise markdown only."
      ].join(" "),
      questionLabel: "Question",
      anchorTypeLabel: "Anchor Type",
      anchorIdLabel: "Anchor Id",
      retrievalContextLabel: "Retrieval Context JSON",
      targetLanguage: "English"
    }
  },
  "zh-CN": {
    locale: {
      label: "语言",
      switcherLabel: "语言",
      options: {
        "en-US": "English",
        "zh-CN": "简体中文"
      },
      updating: "切换中...",
      updateFailed: "切换语言失败"
    },
    metadata: {
      description: "GitHub 技术情报 Agent"
    },
    nav: {
      brand: "Akyuu",
      today: "今日",
      observe: "观察",
      watches: "监控",
      topics: "主题",
      trends: "趋势",
      history: "历史",
      delivery: "交付",
      ask: "追问"
    },
    common: {
      noDescription: "暂无描述。",
      openDigest: "查看报告",
      apply: "应用",
      all: "全部",
      createdAt: "创建于",
      attempts: "尝试次数",
      noItems: "暂无内容。",
      unknownRepo: "未知仓库",
      digest: "报告"
    },
    enums: {
      digestType: {
        daily: "日报",
        weekly: "周报",
        monthly: "月报"
      },
      watchType: {
        repo: "仓库监控",
        topic: "主题监控",
        trend: "趋势监控",
        rank_feed: "周榜监控"
      },
      watchStatus: {
        active: "启用中",
        paused: "已暂停",
        archived: "已归档"
      },
      feedbackType: {
        worthwhile: "值得看",
        not_worthwhile: "不值得看",
        more_like_this: "多来一点这类内容",
        less_like_this: "少来一点这类内容",
        opened: "已打开",
        clicked: "已点击"
      },
      feedbackTargetType: {
        digest: "报告",
        recommended_item: "推荐项",
        topic_update: "主题更新"
      },
      askAnchorType: {
        digest: "报告",
        topic: "主题",
        history: "历史",
        search: "搜索"
      },
      notificationChannel: {
        email: "邮件",
        slack: "Slack",
        telegram: "Telegram",
        webhook: "Webhook"
      },
      notificationStatus: {
        pending: "待发送",
        sent: "已发送",
        failed: "失败"
      },
      itemType: {
        pr: "PR",
        issue: "Issue",
        repo: "仓库",
        topic: "主题",
        release: "Release"
      },
      eventType: {
        repo_metadata_refreshed: "仓库元信息刷新",
        pr_opened: "PR 新开",
        pr_merged: "PR 已合并",
        issue_opened: "Issue 新开",
        issue_hot: "Issue 升温",
        release_published: "发布新版本",
        repo_entered_trending: "进入热榜",
        repo_left_trending: "跌出热榜"
      }
    },
    actions: {
      runPipeline: "运行主链路",
      runWeeklyDigest: "生成周报",
      runMonthlyDigest: "生成月报",
      running: "运行中...",
      createWatch: "创建监控",
      save: "保存中...",
      ask: "开始追问",
      asking: "追问中...",
      worthwhile: "值得看",
      notWorthwhile: "不值得看"
    },
    today: {
      productLabel: "GitHub 技术情报 Agent",
      title: "今日",
      intro: "先添加至少一个仓库监控、主题监控或趋势监控，再运行主链路。",
      disabledReason: "请先创建至少一个启用中的监控对象，再运行主链路。",
      recommendedItems: "推荐阅读",
      continueWithAsk: "继续追问",
      recentFeedback: "最近反馈",
      noFeedback: "还没有反馈记录。",
      recentDelivery: "最近交付",
      noDelivery: "还没有交付记录。",
      openDelivery: "查看交付",
      preferenceProfile: "偏好画像",
      noPreferenceProfile: "还没有偏好画像。",
      feedbackCount: (count) => `反馈数 ${count}`,
      itemTypeWeight: (label, value) => `类型 ${label} · ${value}`,
      repoWeight: (label, value) => `仓库 ${label} · ${value}`,
      renderedMarkdown: "渲染后的 Markdown",
      noDigest: "还没有报告",
      noDigestHint: "先创建监控，启动 worker，然后在这里运行主链路。",
      goToWatches: "前往监控",
      feedbackRecord: (feedbackType, targetType, createdAt) => `${feedbackType} · ${targetType} · ${createdAt}`,
      deliveryRecord: (channel, targetAddress, status) => `${channel} · ${targetAddress} · ${status}`
    },
    watches: {
      addWatch: "新增监控",
      currentWatches: "当前监控",
      noWatches: "还没有监控对象。",
      defaultTopicName: "AI 智能体",
      type: "类型",
      name: "名称",
      repo: "仓库",
      scope: "范围",
      repoBindings: "仓库绑定",
      aliases: "别名",
      keywords: "关键词",
      optionalDisplayName: "可选显示名",
      repoPlaceholder: "owner/repo",
      scopePlaceholder: "global",
      repoBindingsPlaceholder: "owner/repo, owner/repo",
      aliasesPlaceholder: "temporal, async context",
      keywordsPlaceholder: "temporal, proposal",
      priority: (priority) => `优先级 ${priority}`
    },
    topics: {
      productLabel: "主题监控",
      title: "主题",
      intro: "规则会把跨仓库信号聚合成主题级摘要。",
      noTopics: "还没有主题",
      noTopicsHint: "先在监控页创建 TopicWatch，才能开始聚合跨仓库信号。",
      watchDescription: (name) => `${name} 的主题监控。`,
      systemDescription: "用于 AI Coding Agent 相关变化的系统主题。",
      repoBindingsAndEvidences: (repoBindings, evidences) => `${repoBindings} 个仓库绑定 · ${evidences} 条证据`,
      noTopicUpdates: "还没有主题更新。添加仓库绑定后再运行主链路。"
    },
    trends: {
      productLabel: "趋势情报",
      title: "趋势",
      intro: "查看趋势快照的日级 diff、亮点、名次变化和热门仓库。",
      highlights: "亮点",
      topSnapshotItems: "快照头部仓库",
      noStructuralDiff: "暂时还没有结构性 diff。",
      noTrendDiff: "还没有趋势 diff",
      noTrendDiffHint: "先创建 TrendWatch，再运行主链路以生成趋势快照。",
      compare: (snapshotDate, comparedToDate) => `${snapshotDate} 对比 ${comparedToDate}`
    },
    history: {
      title: "历史",
      search: "搜索",
      searchPlaceholder: "报告标题或摘要",
      type: "类型",
      noHistory: "还没有历史记录。"
    },
    delivery: {
      title: "交付",
      fallbackDigestTitle: "报告交付",
      noDeliveryRecords: "还没有交付记录。",
      deliveryMeta: (channel, targetAddress, status) => `${channel} · ${targetAddress} · ${status}`,
      deliveryAttempts: (attempts, createdAt) => `尝试 ${attempts} 次 · 创建于 ${createdAt}`
    },
    ask: {
      historyTitle: "追问历史",
      noHistory: "还没有追问记录。",
      followUpTitle: "继续追问",
      question: "问题",
      questionPlaceholder: "今天最值得看的 3 个 PR 是什么？",
      failed: "追问失败",
      deterministic: {
        noContext: "当前还没有可用上下文。先生成一份报告，或者给 TopicWatch 绑定至少一个仓库。",
        suggestedFirstReads: "### 建议先看",
        noRecommendations: "当前报告里还没有推荐对象。",
        evidence: "### 可追溯依据",
        topicPerspective: "### 主题视角总结",
        noTopicUpdates: "当前没有命中的主题更新。",
        trendConclusion: "### 趋势结论",
        noTrendDiff: "- 当前还没有趋势 diff。",
        currentConclusion: "### 当前结论",
        digestFallbackLabel: "报告",
        windowEnd: (value) => `- 窗口截止 ${value}`
      }
    },
    digest: {
      topStories: "重点变化",
      repoSummary: "仓库摘要",
      topicSummary: "主题摘要",
      trendSummary: "趋势摘要",
      recommendedReading: "推荐阅读",
      dailyTitle: (dateLabel) => `日报 · ${dateLabel}`,
      rangedTitle: (typeLabel, start, end) => `${typeLabel} · ${start} 至 ${end}`,
      dailySummary: (dateLabel) => `${dateLabel} 的 workspace 摘要。`,
      rangedSummary: (typeLabel, start, end) => `${start} 至 ${end} 的 workspace ${typeLabel}。`,
      topStorySummary: (eventType, repo) => `${repo} 中发生了 ${eventType}`,
      repoItemSummary: (eventType, score) => `${eventType}（${score}）`,
      recommendedReason: (score, eventType) => `重要性分数 ${score}，来源于 ${eventType}`,
      recommendedReasonWithPreference: (score, preference, eventType) =>
        `重要性分数 ${score}，偏好加成 ${preference}，来源于 ${eventType}`
    },
    topic: {
      matchedSignals: (topicName, count) => `${topicName} 在当前窗口命中了 ${count} 条信号。`,
      noMatchedSignals: (topicName) => `${topicName} 在当前窗口没有命中信号。`,
      highlight: (title, eventType, repoFullName) => `${title} -> ${eventType}${repoFullName ? ` @ ${repoFullName}` : ""}`
    },
    trend: {
      newEntries: (repos) => `新上榜：${repos.slice(0, 3).join("、")}`,
      fastRisers: (items) =>
        `上升最快：${items
          .slice(0, 3)
          .map((item) => `${item.repoFullName} ${item.from}->${item.to}`)
          .join("、")}`,
      leftTrending: (repos) => `掉榜：${repos.slice(0, 3).join("、")}`
    },
    api: {
      invalidRequest: "请求参数不合法。",
      internalServerError: "服务器内部错误。",
      topicWatchExists: "同名主题监控已存在。",
      watchCreateFailed: "创建监控失败。",
      topicCreateFailed: "创建主题失败。",
      digestNotFound: "未找到报告。",
      noDigestFound: "还没有报告。",
      topicNotFound: "未找到主题。",
      feedbackPersistFailed: "保存反馈失败。",
      noActiveWatches: "当前没有启用中的仓库、主题或趋势监控。",
      pipelineRunFailed: "运行主链路失败。",
      workspaceBootstrapMissing: "默认 workspace 或用户不存在，请先执行 pnpm db:seed。"
    },
    llm: {
      renderDigestSystemPrompt: [
        "你正在润色一份 GitHub 监控摘要。",
        "必须严格保留输入 markdown 里的事实、标题、排名和 URL。",
        "只改善可读性与表达，不得新增事实。",
        "只返回 markdown。"
      ].join(" "),
      askSystemPrompt: [
        "你在回答关于 GitHub 监控 workspace 的追问。",
        "只能使用提供的 retrieval context。",
        "不得补充上下文里不存在的仓库、PR、日期、排名或证据。",
        "如果上下文不足，请直接说明。",
        "只返回简洁的 markdown。"
      ].join(" "),
      questionLabel: "问题",
      anchorTypeLabel: "锚点类型",
      anchorIdLabel: "锚点 ID",
      retrievalContextLabel: "检索上下文 JSON",
      targetLanguage: "简体中文"
    }
  }
};

export function getMessages(locale?: string | null): MessageCatalog {
  return catalogs[resolveSupportedLocale(locale)];
}
