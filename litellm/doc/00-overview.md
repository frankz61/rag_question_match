# LiteLLM 企业级 API 网关概述

## 什么是 LiteLLM Proxy

LiteLLM Proxy 是一个统一的 LLM API 网关，将 100+ LLM 提供商（OpenAI、Claude、DeepSeek、Qwen 等）统一为 **OpenAI 兼容格式**，并提供企业级功能：

- **统一 API 格式** - 所有模型使用 OpenAI 格式调用
- **API Key 管理** - 分级密钥体系（Master → Team → User）
- **预算控制** - 全局/团队/用户级预算限制
- **限流策略** - RPM/TPM/并发数控制
- **智能路由** - 延迟/成本路由、故障回退
- **审计日志** - 请求记录、Token 统计、费用追踪
- **Admin UI** - 可视化管理界面

---

## 快速开始

### 1. 准备环境

```bash
# 克隆或进入项目目录
cd litellm_workspace

# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入必要的配置
# - POSTGRES_PASSWORD
# - LITELLM_MASTER_KEY
# - LITELLM_SALT_KEY
# - 各 LLM 提供商的 API Key
```

### 2. 启动服务

```bash
# 创建数据目录
mkdir -p data/postgres

# 启动服务
docker compose up -d

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f litellm
```

### 3. 访问服务

| 服务 | 地址 |
|------|------|
| API 端点 | `http://localhost:4000` |
| Admin UI | `http://localhost:4000/ui` |
| 健康检查 | `http://localhost:4000/health` |
| API 文档 | `http://localhost:4000/` (Swagger) |

### 4. 测试调用

```bash
# 使用 Master Key 测试
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-master-key" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

---

## 项目结构

```
litellm_workspace/
├── docker-compose.yml     # Docker 编排配置
├── config.yaml            # 模型与路由配置
├── .env                   # 环境变量（不提交到 Git）
├── .env.example           # 环境变量模板
├── data/
│   └── postgres/          # 数据库持久化目录
├── scripts/
│   └── backup.sh          # 数据库备份脚本
└── doc/
    ├── 00-overview.md         # 本文档
    ├── 01-deployment.md       # 部署指南
    ├── 02-model-config.md     # 模型配置
    ├── 03-key-management.md   # Key 管理
    ├── 04-budget-ratelimit.md # 预算与限流
    ├── 05-audit-logging.md    # 审计日志
    └── 06-admin-ui-guide.md   # Admin UI 指南
```

---

## 核心配置文件说明

### docker-compose.yml

定义两个服务：
- `db` - PostgreSQL 数据库，存储 Key、预算、日志
- `litellm` - LiteLLM Proxy 网关服务

### config.yaml

定义：
- 模型列表（model_list）
- 路由策略（router_settings）
- 回退配置（fallbacks）

### .env

敏感配置：
- 数据库密码
- Master Key / Salt Key
- 各 LLM 提供商 API Key

---

## 下一步

1. [部署指南](01-deployment.md) - 详细部署步骤
2. [模型配置](02-model-config.md) - 添加和管理模型
3. [Key 管理](03-key-management.md) - 创建和分配 API Key
4. [预算与限流](04-budget-ratelimit.md) - 配置预算和限流
5. [审计日志](05-audit-logging.md) - 查看使用记录
6. [Admin UI 指南](06-admin-ui-guide.md) - 管理界面使用
