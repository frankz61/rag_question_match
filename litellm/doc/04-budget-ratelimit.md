# 预算控制与限流配置

## 预算控制层级

LiteLLM 支持多级预算控制：

```
全局预算（config.yaml）
└── Team 预算
    └── User Key 预算
```

预算消耗按最细粒度控制，超出任一级别限制都会拒绝请求。

---

## 全局预算配置

在 `config.yaml` 中设置：

```yaml
litellm_settings:
  max_budget: 10000        # 全局月预算上限（美元）
  budget_duration: 30d     # 预算周期
```

---

## Team 预算配置

### 创建 Team 时设置

```bash
curl -X POST 'http://localhost:4000/team/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "team_alias": "研发部",
    "max_budget": 1000,
    "budget_duration": "30d"
  }'
```

### 更新 Team 预算

```bash
curl -X POST 'http://localhost:4000/team/update' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "team-xxxxx",
    "max_budget": 2000
  }'
```

---

## User Key 预算配置

### 创建 Key 时设置

```bash
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "user-1",
    "max_budget": 100,
    "budget_duration": "30d"
  }'
```

### 预算周期格式

| 格式 | 说明 |
|------|------|
| `30d` | 30 天 |
| `7d` | 7 天 |
| `1d` | 1 天 |
| `1h` | 1 小时 |
| `30m` | 30 分钟 |

---

## 查看预算使用情况

### 查看 Key 剩余预算

```bash
curl 'http://localhost:4000/key/info?key=sk-user-key' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

响应示例：
```json
{
  "key": "sk-user-key",
  "max_budget": 100,
  "spend": 45.23,
  "budget_reset_at": "2024-03-01T00:00:00Z"
}
```

### 查看 Team 预算

```bash
curl 'http://localhost:4000/team/info?team_id=team-xxxxx' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

### 通过 Admin UI

访问 `http://localhost:4000/ui` → Usage 页面

---

## 限流配置

### 限流维度

| 参数 | 说明 |
|------|------|
| `rpm_limit` | 每分钟请求数（Requests Per Minute） |
| `tpm_limit` | 每分钟 Token 数（Tokens Per Minute） |
| `max_parallel_requests` | 最大并发请求数 |

### Key 级别限流

创建 Key 时设置：

```bash
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "limited-user",
    "rpm_limit": 60,
    "tpm_limit": 100000,
    "max_parallel_requests": 10
  }'
```

### 模型级别限流

在 `config.yaml` 中为单个模型设置：

```yaml
model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: os.environ/OPENAI_API_KEY
      rpm: 100        # 该模型全局每分钟请求数
      tpm: 100000     # 该模型全局每分钟 Token 数
```

---

## 限流响应

当触发限流时，API 返回 `429 Too Many Requests`：

```json
{
  "error": {
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "type": "rate_limit_error",
    "code": 429
  }
}
```

---

## 预算耗尽响应

当预算耗尽时，API 返回 `400 Bad Request`：

```json
{
  "error": {
    "message": "Budget exceeded for key sk-xxxxx",
    "type": "budget_exceeded",
    "code": 400
  }
}
```

---

## 最佳实践

### 1. 分级预算设置

```
企业全局: $10,000/月
├── 研发部 Team: $5,000/月
│   ├── 核心开发 Key: $2,000/月
│   └── 普通开发 Key: $500/月
├── 产品部 Team: $3,000/月
└── 测试部 Team: $2,000/月
```

### 2. 按用途设置限流

```bash
# 批量处理任务（低频高量）
"rpm_limit": 10,
"tpm_limit": 500000

# 实时对话（高频低量）
"rpm_limit": 100,
"tpm_limit": 50000

# 开发测试（中等配置）
"rpm_limit": 30,
"tpm_limit": 100000
```

### 3. 预留缓冲

- 设置预算时预留 10-20% 缓冲
- 避免月底业务中断

### 4. 监控告警

- 定期检查预算使用情况
- 接近阈值时提前预警
- 通过 Admin UI 查看实时使用量

---

## 费用计算

LiteLLM 会自动按各模型的官方定价计算费用：

| 模型 | 输入价格 | 输出价格 |
|------|----------|----------|
| GPT-4 | $30/1M tokens | $60/1M tokens |
| GPT-3.5 | $0.5/1M tokens | $1.5/1M tokens |
| Claude 3 Opus | $15/1M tokens | $75/1M tokens |
| DeepSeek | 约 $0.14/1M tokens | 约 $0.28/1M tokens |
| Qwen | 按阿里云定价 | 按阿里云定价 |

**注意**：实际价格以各提供商官网为准，LiteLLM 会定期更新定价信息。

---

## 下一步

- [审计日志](05-audit-logging.md) - 查看费用和使用记录
- [Admin UI 指南](06-admin-ui-guide.md) - 可视化管理预算
