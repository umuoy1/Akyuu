# ADR-012｜初始鉴权与 Workspace 模型：先单用户 Personal Workspace，再预留升级点

- 状态：Accepted
- 日期：2026-04-15
- 决策范围：阶段 1 到阶段 3 的鉴权最小方案、workspace 上下文和升级边界
- 关联文档：
  - `docs/prd.md`
  - `docs/architecture/data-model-draft.md`
  - `docs/architecture/system-module-design.md`
  - `IMPLEMENTATION_PLAN.md`

## 背景

数据模型和系统设计文档已经从一开始引入：

- `workspace`
- `app_user`
- `workspace_member`
- API 鉴权入口

但 PRD 的 MVP 和前三阶段目标都不要求团队协作或完整权限体系。  
如果过早实现完整登录、邀请、RBAC，很容易挤占主链路建设时间。

## 决策

### 1. 数据模型从第一天保留 Workspace

即使阶段 1 到阶段 3 先走单用户模式，也必须保留：

- `workspace`
- `app_user`
- `workspace_member`

理由：

- watch、digest、history、score 都已经是 workspace 维度建模
- 未来升级到 TeamSpace 时不需要推翻主键和数据隔离方式

### 2. 阶段 1 到阶段 3 的运行模式是单用户 Personal Workspace

阶段 1 到阶段 3 默认产品运行模式为：

- 一个当前用户
- 一个 personal workspace
- 一个 owner 角色

这意味着：

- `workspace_member.role` 在早期只需实际使用 `owner`
- `admin/member` 仅作为后续升级预留

### 3. 当前用户与当前 Workspace 的解析方式

阶段 1 到阶段 3 不强制接入外部登录提供方。  
API 和 Web 可以通过开发期 bootstrap 方式解析当前上下文，例如：

- 环境变量指定默认用户
- 本地 seed 生成默认用户与 workspace
- 开发态 session / header 注入当前上下文

但无论采用哪种方式，代码层都必须保留显式的：

- `currentUser`
- `currentWorkspace`

上下文对象。

### 4. 端到端接口仍以 Workspace 为作用域

即使当前只有一个 personal workspace，也不允许把 API 设计成全局无 scope：

- watch CRUD 必须挂在 workspace 语义下
- digest / history / feedback 查询必须带 workspace 上下文
- score 和 preference 也必须保留 workspace 粒度

### 5. 鉴权与身份提供方抽象

阶段 1 到阶段 3 冻结为“轻鉴权 + 显式抽象”：

- 允许先不接第三方登录
- 但必须在 API 层保留 auth middleware / adapter 边界
- 不能把“当前用户是谁”写死在业务用例内部

这样后续可以平滑升级到：

- GitHub OAuth
- Email magic link
- SSO / Team auth

### 6. 明确不做的事情

阶段 1 到阶段 3 不做：

- 邀请与成员管理 UI
- 细粒度 RBAC
- 组织级 SSO
- 多用户共享 watchlist

## 结果与影响

### 正面影响

- 不会让鉴权阻塞前三阶段主链路
- 仍然保留了未来升级到团队模式的主数据形态
- 让 API、score、digest 从第一天就围绕 workspace 设计

### 代价

- 开发态身份解析会有临时方案
- 阶段 3 之前不会有完整真实登录体验

## 不在本 ADR 内解决的问题

- 真实登录提供方选型
- 邀请流程
- 团队权限模型
- 计费与 plan 绑定方式

## 后续执行要求

- 阶段 1 建表时，必须同时创建 `workspace`、`app_user`、`workspace_member`
- 阶段 3 写 API 时，必须通过 middleware 或 context 注入当前 workspace
- 如后续要支持多用户共享空间，必须新增 ADR 说明数据迁移与权限策略
