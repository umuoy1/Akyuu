# ADR-001｜运行时基线：Node.js 24 LTS + TypeScript + ESM

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 1 起始工程基线
- 关联文档：
  - `docs/prd.md`
  - `docs/architecture/system-module-design.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

项目当前还没有代码实现，但已经明确了以下约束：

- 默认技术栈是 Node.js `24 LTS`
- 全量 TypeScript
- `pnpm workspace` monorepo
- Web 使用 Next.js
- API 使用 Fastify
- 需要同时支持 Web、API、Scheduler、Worker 四类运行单元

如果不先冻结运行时基线，后续会在模块格式、包导出、构建脚本、工具选择上反复返工。

## 决策

### 1. 统一运行时

整个 monorepo 统一使用：

- Node.js `24 LTS`
- `pnpm` 作为唯一包管理器
- 所有应用与内部包默认运行在 ESM 模式

### 2. 统一语言与编译边界

- 业务代码与内部库代码统一使用 TypeScript
- 默认开启严格类型检查
- 不引入新的 JavaScript 业务源码文件
- 少量工具或配置文件如果必须使用 `.cjs`，只允许用于兼容明确不支持 ESM 的场景

### 3. 包格式约定

- 各 workspace package 默认声明 `type: module`
- 内部包通过 `exports` 明确导出入口
- 不依赖隐式的深层相对路径导入
- 共享 `tsconfig.base.json` 作为全仓基线

### 4. 代码运行约定

- `apps/web` 由 Next.js 管理其自身构建与运行
- `apps/api`、`apps/scheduler`、`apps/worker` 使用 TypeScript 原生源码开发
- 本地开发可以使用轻量 TS 运行器，但该选择不在本 ADR 冻结；只要求不破坏 ESM 与类型边界

### 5. 编码边界

- 不使用 Babel 作为通用编译层
- 不把 CommonJS 作为默认兼容目标
- 不为了单个工具链问题放弃全仓统一 ESM

## 结果与影响

### 正面影响

- 与产品约束和现代 Node.js 生态保持一致
- 包边界、导出方式和运行模型一致，减少跨应用摩擦
- 对 BullMQ、Fastify、Next.js、Octokit 等依赖组合更自然

### 代价

- 一些旧工具需要额外 ESM 适配
- 配置文件格式需要更谨慎
- 某些脚本工具如果不兼容 ESM，需要局部使用 `.cjs`

## 不在本 ADR 内解决的问题

以下问题保留到后续实现或其他 ADR：

- 测试框架的最终选择
- API/Worker 的具体打包工具
- 开发态 TS 运行器的最终选择
- CI 镜像与 Node 版本矩阵策略

## 后续执行要求

- 阶段 1 建仓时，必须先落实 Node 版本文件、根 `package.json`、`pnpm-workspace.yaml`、共享 `tsconfig`
- 新增内部包时，必须遵守 `type: module` 和 `exports` 约定
- 如后续确实需要引入 CommonJS 兼容层，必须通过新 ADR 说明原因与影响
