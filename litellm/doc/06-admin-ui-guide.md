# Admin UI 使用指南

## 概述

LiteLLM 内置 Admin UI 提供可视化管理界面，支持：

- 模型管理
- API Key 管理
- Team 管理
- 预算和限流配置
- 使用统计和日志查看

---

## 访问 Admin UI

### URL

```
http://localhost:4000/ui
```

### 登录凭证

使用 Master Key 登录：
- 方式一：直接输入 Master Key
- 方式二：使用 UI_USERNAME/UI_PASSWORD（如已配置）

---

## 主要功能模块

### 1. Dashboard（仪表盘）

显示概览信息：
- 总请求数
- 总费用
- 活跃 Key 数量
- 近期使用趋势

### 2. Models（模型管理）

#### 查看模型列表

显示所有已配置的模型：
- 模型名称
- 提供商
- 状态

#### 添加新模型

1. 点击 "Add Model"
2. 填写配置：
   - Model Name（客户端使用的名称）
   - LiteLLM Model（实际模型标识，如 `openai/gpt-4`）
   - API Key（上游 API Key）
   - API Base（API 地址，可选）
3. 点击 "Save"

#### 编辑/删除模型

- 点击模型行进入详情
- 可修改配置或删除

### 3. Virtual Keys（API Key 管理）

#### 查看 Key 列表

显示所有 Key：
- Key 名称/别名
- 预算/已用
- 限流配置
- 状态

#### 创建新 Key

1. 点击 "Create New Key"
2. 填写配置：
   - Key Alias（名称）
   - Max Budget（预算上限）
   - Budget Duration（预算周期）
   - Models（允许的模型，留空则允许全部）
   - TPM Limit（Token 限流）
   - RPM Limit（请求限流）
   - Max Parallel Requests（并发限制）
   - Expires（过期时间）
3. 点击 "Create"
4. **复制生成的 Key**（仅显示一次）

#### 管理 Key

- 查看 Key 详情和使用统计
- 更新预算/限流配置
- 禁用或删除 Key

### 4. Teams（团队管理）

#### 创建 Team

1. 点击 "Create New Team"
2. 填写配置：
   - Team Name（团队名称）
   - Max Budget（团队预算）
   - Models（允许的模型）
3. 点击 "Create"

#### 管理 Team

- 查看团队成员（Key）
- 调整团队预算
- 查看团队使用统计

### 5. Usage（使用统计）

#### 费用统计

- 按时间范围查看
- 按 Key/Team/Model 分组
- 导出报表

#### 请求日志

- 查看最近请求
- 按状态筛选（成功/失败）
- 查看请求详情

### 6. Settings（设置）

- 查看当前配置
- 测试模型连接

---

## 常用操作流程

### 为新用户创建 Key

1. 进入 "Virtual Keys"
2. 点击 "Create New Key"
3. 设置：
   - Key Alias: `user-张三`
   - Max Budget: `100`
   - Budget Duration: `30d`
   - Models: `gpt-3.5-turbo, deepseek-chat`
   - RPM Limit: `30`
4. 点击 "Create"
5. 将生成的 Key 发送给用户

### 为团队设置预算

1. 进入 "Teams"
2. 点击 "Create New Team"
3. 设置：
   - Team Name: `研发部`
   - Max Budget: `1000`
   - Budget Duration: `30d`
4. 点击 "Create"
5. 记录 Team ID
6. 创建 Key 时指定 Team ID

### 查看月度费用

1. 进入 "Usage"
2. 选择时间范围（本月）
3. 查看总费用和分项统计
4. 可导出为 CSV

### 处理预算超限

1. 进入 "Virtual Keys"
2. 找到超限的 Key
3. 点击编辑
4. 增加 Max Budget 或重置预算周期
5. 保存

---

## UI 配置

### 设置 UI 登录账号

在 `.env` 中配置：

```bash
UI_USERNAME=admin
UI_PASSWORD=your_secure_password
```

### 禁用 UI（安全考虑）

如果不需要 UI，可以通过环境变量禁用：

```bash
DISABLE_ADMIN_UI=True
```

---

## 常见问题

### UI 无法访问

1. 确认服务已启动：`docker compose ps`
2. 确认端口映射正确
3. 检查防火墙设置

### 登录失败

1. 确认使用正确的 Master Key
2. 如果使用 UI_USERNAME/UI_PASSWORD，确认已正确配置
3. 检查 .env 文件是否被正确加载

### 添加模型失败

1. 确认 `STORE_MODEL_IN_DB=True`
2. 确认 `LITELLM_SALT_KEY` 已设置
3. 检查数据库连接

### 统计数据不显示

1. 确认数据库连接正常
2. 确认有请求记录
3. 刷新页面或清除缓存

---

## 安全建议

### 1. 保护 Master Key

- 不要在浏览器中保存
- 定期更换
- 仅管理员使用

### 2. 访问控制

- 仅在内网访问 UI
- 使用 VPN 或堡垒机
- 不要将 UI 端口暴露到公网

### 3. 操作审计

- 重要操作（创建/删除 Key）记录在案
- 定期检查 Key 列表
- 清理不再使用的 Key

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 快速搜索 |
| `Esc` | 关闭弹窗 |

---

## 相关文档

- [Key 管理](03-key-management.md) - API 方式管理 Key
- [预算与限流](04-budget-ratelimit.md) - 预算配置详解
- [审计日志](05-audit-logging.md) - 日志查询详解
