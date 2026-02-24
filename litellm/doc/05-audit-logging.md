# 审计日志与使用统计

## 概述

LiteLLM 内置审计日志功能，将所有请求记录存储在 PostgreSQL 数据库中，包括：

- 请求/响应详情
- Token 使用统计
- 费用计算
- 错误日志
- Key 使用追踪

---

## 启用审计日志

确保以下配置已设置：

### docker-compose.yml
```yaml
environment:
  DATABASE_URL: "postgresql://..."
  STORE_MODEL_IN_DB: "True"
```

### config.yaml
```yaml
general_settings:
  database_url: os.environ/DATABASE_URL
  store_model_in_db: true
```

---

## 查看使用记录

### 通过 API 查询

#### 查看支出日志

```bash
curl 'http://localhost:4000/spend/logs' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

#### 按时间范围查询

```bash
curl 'http://localhost:4000/spend/logs?start_date=2024-01-01&end_date=2024-01-31' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

#### 按 Key 查询

```bash
curl 'http://localhost:4000/spend/logs?api_key=sk-user-key-xxxxx' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

### 通过 Admin UI

1. 访问 `http://localhost:4000/ui`
2. 使用 Master Key 登录
3. 进入 "Usage" 页面
4. 可按时间、Key、模型筛选

---

## 日志数据结构

每条请求记录包含：

| 字段 | 说明 |
|------|------|
| `request_id` | 请求唯一 ID |
| `api_key` | 使用的 API Key |
| `model` | 调用的模型 |
| `call_type` | 调用类型（chat/completion/embedding） |
| `spend` | 本次费用（美元） |
| `total_tokens` | 总 Token 数 |
| `prompt_tokens` | 输入 Token 数 |
| `completion_tokens` | 输出 Token 数 |
| `startTime` | 请求开始时间 |
| `endTime` | 请求结束时间 |
| `status` | 状态（success/failure） |
| `user` | 用户标识（如有） |
| `team_id` | 团队 ID（如有） |

---

## 统计报表

### 按 Key 统计支出

```bash
curl 'http://localhost:4000/spend/keys' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

响应示例：
```json
[
  {
    "api_key": "sk-user-1",
    "total_spend": 45.23,
    "total_tokens": 1234567
  },
  {
    "api_key": "sk-user-2",
    "total_spend": 23.45,
    "total_tokens": 567890
  }
]
```

### 按模型统计支出

```bash
curl 'http://localhost:4000/spend/models' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

### 按 Team 统计支出

```bash
curl 'http://localhost:4000/spend/teams' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

---

## 请求追踪

### 在请求中添加追踪信息

客户端可以在请求中添加自定义追踪信息：

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-user-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "hello"}],
    "user": "user-123",
    "metadata": {
      "trace_id": "abc-123",
      "session_id": "session-456",
      "project": "my-project"
    }
  }'
```

### 按追踪信息查询

```bash
curl 'http://localhost:4000/spend/logs?user=user-123' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

---

## 错误日志

### 查看失败请求

```bash
curl 'http://localhost:4000/spend/logs?status=failure' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

### 常见错误类型

| 错误 | 说明 |
|------|------|
| `AuthenticationError` | API Key 无效 |
| `RateLimitError` | 触发限流 |
| `BudgetExceeded` | 预算耗尽 |
| `InvalidRequestError` | 请求格式错误 |
| `ServiceUnavailableError` | 上游服务不可用 |

---

## 数据保留

### 默认行为

LiteLLM 默认保留所有日志记录。

### 清理旧日志

可以通过数据库直接清理：

```bash
# 进入数据库容器
docker exec -it litellm_db psql -U litellm -d litellm

# 删除 30 天前的日志
DELETE FROM spend_logs WHERE "startTime" < NOW() - INTERVAL '30 days';
```

### 定期清理脚本

可以在备份脚本中添加清理逻辑（见 `scripts/backup.sh`）。

---

## 导出数据

### 导出为 CSV

```bash
docker exec -it litellm_db psql -U litellm -d litellm \
  -c "COPY (SELECT * FROM spend_logs WHERE \"startTime\" > '2024-01-01') TO STDOUT WITH CSV HEADER" \
  > spend_logs_export.csv
```

### 导出为 JSON

```bash
curl 'http://localhost:4000/spend/logs?start_date=2024-01-01' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  > spend_logs_export.json
```

---

## 合规与安全

### 敏感信息处理

- 默认不记录请求/响应内容
- API Key 在日志中显示为脱敏格式
- 费用和 Token 统计可安全审计

### 开启详细日志（调试用）

在 `.env` 中设置：
```bash
LITELLM_LOG=DEBUG
```

**注意**：DEBUG 级别可能记录敏感信息，仅在调试时使用。

---

## 最佳实践

### 1. 定期审计

- 每周检查异常使用模式
- 关注费用突增的 Key
- 监控错误率

### 2. 数据备份

- 定期备份数据库
- 保留至少 90 天的日志
- 重要数据导出存档

### 3. 访问控制

- 仅管理员可查看审计日志
- 不要将 Master Key 分发给普通用户

---

## 下一步

- [Admin UI 指南](06-admin-ui-guide.md) - 可视化查看日志和统计
