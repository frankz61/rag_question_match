# 模型配置与路由策略

## 模型配置方式

LiteLLM 支持两种模型配置方式：

1. **配置文件**（config.yaml）- 适合固定模型配置，支持 GitOps
2. **Admin UI**（数据库存储）- 适合动态管理，无需重启

---

## config.yaml 模型配置

### 基本格式

```yaml
model_list:
  - model_name: 模型别名       # 客户端调用时使用的名称
    litellm_params:
      model: provider/model   # 实际模型标识
      api_key: os.environ/KEY # API Key（从环境变量读取）
      api_base: https://...   # API 地址（可选）
    model_info:
      description: "模型描述"  # 可选
```

### 支持的模型提供商

#### OpenAI

```yaml
- model_name: gpt-4
  litellm_params:
    model: openai/gpt-4
    api_key: os.environ/OPENAI_API_KEY
```

#### Anthropic Claude

```yaml
- model_name: claude-3-opus
  litellm_params:
    model: claude-3-opus-20240229
    api_key: os.environ/ANTHROPIC_API_KEY
```

#### DeepSeek

```yaml
- model_name: deepseek-chat
  litellm_params:
    model: openai/deepseek-chat
    api_key: os.environ/DEEPSEEK_API_KEY
    api_base: https://api.deepseek.com
```

#### 阿里云 Qwen

```yaml
- model_name: qwen-max
  litellm_params:
    model: openai/qwen-max
    api_key: os.environ/QWEN_API_KEY
    api_base: https://dashscope.aliyuncs.com/compatible-mode/v1
```

#### Azure OpenAI

```yaml
- model_name: azure-gpt-4
  litellm_params:
    model: azure/gpt-4-deployment-name
    api_key: os.environ/AZURE_API_KEY
    api_base: https://your-resource.openai.azure.com
    api_version: 2024-02-15-preview
```

#### 本地 Ollama

```yaml
- model_name: llama2
  litellm_params:
    model: ollama/llama2
    api_base: http://host.docker.internal:11434
```

---

## 路由策略

### 策略类型

在 `router_settings.routing_strategy` 中配置：

| 策略 | 说明 |
|------|------|
| `simple-shuffle` | 简单随机轮询 |
| `least-busy` | 最少繁忙优先 |
| `latency-based-routing` | 基于延迟的智能路由（推荐） |
| `cost-based-routing` | 基于成本的路由 |

### 配置示例

```yaml
router_settings:
  routing_strategy: latency-based-routing
```

---

## 回退机制（Fallbacks）

当主模型失败时，自动切换到备用模型。

### 配置格式

```yaml
router_settings:
  fallbacks:
    - 主模型: [备用模型1, 备用模型2]
```

### 配置示例

```yaml
router_settings:
  fallbacks:
    # GPT-4 失败时，依次尝试 Claude、DeepSeek
    - gpt-4: [claude-3-opus, deepseek-chat]
    
    # GPT-3.5 失败时，依次尝试 Qwen、DeepSeek
    - gpt-3.5-turbo: [qwen-turbo, deepseek-chat]
    
    # DeepSeek 失败时，切换到 Qwen
    - deepseek-chat: [qwen-max]
```

### 触发条件

回退会在以下情况触发：
- 模型返回错误（5xx、429 等）
- 请求超时
- API 不可用

---

## 重试配置

```yaml
router_settings:
  num_retries: 2      # 重试次数
  retry_after: 5      # 重试间隔（秒）
  timeout: 120        # 请求超时（秒）
```

---

## 模型别名

为模型创建简短别名：

```yaml
router_settings:
  model_group_alias:
    gpt4: gpt-4
    gpt35: gpt-3.5-turbo
    claude: claude-3-sonnet
```

客户端可使用别名调用：
```bash
curl ... -d '{"model": "gpt4", ...}'
```

---

## 模型级限流

为单个模型设置限流：

```yaml
model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: os.environ/OPENAI_API_KEY
      rpm: 100        # 每分钟请求数
      tpm: 100000     # 每分钟 Token 数
```

---

## 通过 Admin UI 管理模型

1. 访问 `http://localhost:4000/ui`
2. 使用 Master Key 登录
3. 进入 Models 页面
4. 点击 Add Model 添加新模型

**注意**：通过 UI 添加的模型存储在数据库中，需要确保：
- `STORE_MODEL_IN_DB=True`
- `LITELLM_SALT_KEY` 已正确设置（用于加密 API Key）

---

## 配置生效

### 修改 config.yaml 后

```bash
docker compose restart litellm
```

### 通过 Admin UI 修改

立即生效，无需重启。

---

## 验证模型配置

### 查看已配置模型

```bash
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

### 测试特定模型

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "测试"}]
  }'
```

---

## 下一步

- [Key 管理](03-key-management.md) - 创建和分配 API Key
- [预算与限流](04-budget-ratelimit.md) - 配置预算和限流策略
