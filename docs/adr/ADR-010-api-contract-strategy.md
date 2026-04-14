# ADR-010｜前后端契约策略：Zod Source of Truth，传输模型与领域模型分离

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 3 的 Web/API 契约定义、运行时校验和演进方式
- 关联文档：
  - `docs/architecture/system-module-design.md`
  - `IMPLEMENTATION_PLAN.md`
  - `docs/adr/ADR-002-monorepo-strategy.md`

## 背景

阶段 3 将首次打通：

- Web
- API
- Digest 查询
- Watch CRUD
- History 列表

如果不先冻结契约策略，阶段 3 很容易出现：

- API 请求和响应类型手写重复
- Web 直接依赖数据库或内部 domain row 结构
- 参数校验只在前端或只在后端单侧存在

## 决策

### 1. HTTP 契约以 Zod 为单一真源

所有对外 HTTP API 的请求与响应 schema，统一使用 Zod 定义，并从同一份 schema 推导 TypeScript 类型。

这包括：

- query 参数
- path 参数
- request body
- response body
- 标准错误响应

### 2. 契约位置

阶段 3 的 API 契约统一放在：

- `packages/shared-types/src/contracts/api/v1/`

放在 `shared-types` 的原因：

- 它们是 Web 和 API 共用的传输契约
- 它们不是数据库 row，也不是纯领域对象

### 3. 领域模型与传输模型分离

固定规则：

- `domain-*` 输出领域对象和用例结果
- `apps/api` 负责把领域结果映射为 HTTP DTO
- `apps/web` 只消费 HTTP DTO

禁止：

- Web 直接 import 数据库 schema 类型
- API 直接把数据库 row 原样透传给前端
- 把 domain 内部对象当成稳定对外协议

### 4. API 版本策略

阶段 3 起公开 API 路径统一挂在：

- `/api/v1`

规则：

- 向后兼容的小变更优先新增可选字段
- 明确 breaking change 时，再新增新版本路径或显式废弃策略

### 5. 错误响应规范

阶段 3 的标准错误响应至少包含：

- `code`
- `message`
- `requestId`
- `details`（可选）

这样可以同时支持：

- 前端错误展示
- 后端日志排查
- 用户反馈定位

### 6. 实施边界

- `apps/api` 使用同一份 Zod schema 做输入校验
- `apps/web` 使用从同一 schema 推导的 TS 类型
- typed client 可以是轻量 fetch wrapper，不在本 ADR 冻结具体库

## 结果与影响

### 正面影响

- 前后端契约只有一份定义
- 运行时校验与类型推导一致
- 降低“前后端各写一套类型”导致的漂移

### 代价

- 需要维护 DTO 映射层
- schema 组织需要比直接透传数据更自觉

## 不在本 ADR 内解决的问题

- OpenAPI 是否自动导出
- typed client 的最终实现库
- 外部开放 API 的认证与权限细节

## 后续执行要求

- 阶段 3 新增 API 时，必须先写 Zod 契约，再写 handler
- 领域对象、数据库 schema、HTTP DTO 三者不得混用
- 如果未来引入 GraphQL 或外部公开 SDK，需要新增 ADR 说明与现有 REST 契约的关系
