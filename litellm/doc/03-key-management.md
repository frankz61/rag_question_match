# API Key 管理规范

## Key 层级结构

LiteLLM 采用分级 Key 管理体系：

```
Master Key（管理员）
├── Team Key（团队级）
│   ├── User Key 1
│   └── User Key 2
└── Team Key 2
    └── User Key 3
```

---

## Key 类型与权限

| Key 类型 | 权限 | 用途 |
|----------|------|------|
| Master Key | 完全管理权限 | 管理员操作、创建其他 Key |
| Team Key | 团队预算管理 | 团队管理员、创建团队内 Key |
| User Key | 普通调用权限 | 最终用户、受预算/限流约束 |

---

## Master Key

### 配置方式

在 `.env` 中设置：
```bash
LITELLM_MASTER_KEY=sk-your-strong-master-key
```

### 注意事项

- 必须以 `sk-` 开头
- 使用强随机字符串
- 仅管理员持有
- 不要分发给普通用户

### 生成强 Master Key

```bash
openssl rand -hex 32 | sed 's/^/sk-/'
```

---

## 创建 User Key

### 方式一：通过 API

```bash
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "dev-user-1",
    "max_budget": 100,
    "budget_duration": "30d",
    "models": ["gpt-4", "deepseek-chat"],
    "tpm_limit": 100000,
    "rpm_limit": 60
  }'
```

**响应示例**：
```json
{
  "key": "sk-generated-user-key-xxxxx",
  "key_alias": "dev-user-1",
  "max_budget": 100,
  "expires": "2024-03-01T00:00:00Z"
}
```

### 方式二：通过 Admin UI

1. 访问 `http://localhost:4000/ui`
2. 使用 Master Key 登录
3. 进入 "Virtual Keys" 页面
4. 点击 "Create New Key"
5. 填写配置：
   - Key Alias（名称）
   - Max Budget（预算上限）
   - Budget Duration（预算周期）
   - Models（允许的模型）
   - TPM/RPM Limit（限流）

---

## Key 配置参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `key_alias` | string | Key 的名称/别名 |
| `max_budget` | float | 预算上限（美元） |
| `budget_duration` | string | 预算周期（如 30d、7d、1h） |
| `models` | array | 允许调用的模型列表 |
| `tpm_limit` | int | 每分钟 Token 限制 |
| `rpm_limit` | int | 每分钟请求数限制 |
| `max_parallel_requests` | int | 最大并发请求数 |
| `expires` | datetime | Key 过期时间 |
| `metadata` | object | 自定义元数据 |

---

## 创建 Team

### 通过 API

```bash
curl -X POST 'http://localhost:4000/team/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "team_alias": "研发部",
    "max_budget": 1000,
    "budget_duration": "30d",
    "models": ["gpt-4", "deepseek-chat", "qwen-max"]
  }'
```

### 为 Team 创建 Key

```bash
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "dev-team-user-1",
    "team_id": "team-xxxxx",
    "max_budget": 100
  }'
```

---

## 查询 Key

### 查看所有 Key

```bash
curl 'http://localhost:4000/key/list' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

### 查看 Key 详情

```bash
curl 'http://localhost:4000/key/info?key=sk-user-key-xxxxx' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

---

## 更新 Key

```bash
curl -X POST 'http://localhost:4000/key/update' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "sk-user-key-xxxxx",
    "max_budget": 200,
    "rpm_limit": 120
  }'
```

---

## 删除/禁用 Key

```bash
curl -X POST 'http://localhost:4000/key/delete' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "keys": ["sk-user-key-xxxxx"]
  }'
```

---

## Key 分发最佳实践

### 1. 按团队/项目分配

```
研发部 Team (预算 $1000/月)
├── 后端组 Key (预算 $500/月)
├── 前端组 Key (预算 $300/月)
└── 测试组 Key (预算 $200/月)
```

### 2. 限制模型访问

```bash
# 普通用户只能用便宜模型
"models": ["gpt-3.5-turbo", "deepseek-chat", "qwen-turbo"]

# 高级用户可以用高级模型
"models": ["gpt-4", "claude-3-opus", "gpt-3.5-turbo"]
```

### 3. 设置合理的限流

```bash
# 普通用户
"rpm_limit": 30,
"tpm_limit": 50000

# 高频用户
"rpm_limit": 100,
"tpm_limit": 200000
```

### 4. 定期轮换 Key

- 定期更换用户 Key
- 泄露后立即删除并重新生成
- 离职员工及时删除 Key

---

## Salt Key 说明

Salt Key 用于加密存储在数据库中的上游 API Key。

**重要**：
- 首次设置后**不要更改**
- 更改会导致已存储的 API Key 无法解密
- 建议备份 Salt Key

配置方式：
```bash
LITELLM_SALT_KEY=sk-your-32-char-salt-key
```

---

## 下一步

- [预算与限流](04-budget-ratelimit.md) - 详细的预算和限流配置
- [审计日志](05-audit-logging.md) - 查看 Key 使用记录
