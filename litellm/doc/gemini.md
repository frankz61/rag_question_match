这是一份专为企业生产环境设计的 LiteLLM 部署指南。

这份指南包含了 **Docker Compose** 编排、**PostgreSQL 数据库**（用于持久化 Key 和日志）、以及**本地文件映射**。同时，我也把之前讨论的 **DeepSeek** 和 **阿里云 Qwen** 的配置直接融入了进去。

### 部署架构图

* **LiteLLM 容器**：处理 API 请求，读取 `config.yaml`。
* **Postgres 容器**：存储 API Key、用户余额、审计日志。
* **本地映射**：数据库文件存在宿主机，配置文件在宿主机，确保重启不丢数据。

---

### 第一步：创建项目目录

在你的服务器上创建一个文件夹，结构如下：

```text
litellm-gateway/
├── docker-compose.yml   # 启动编排文件
├── config.yaml          # 模型路由配置文件
└── pg_data/             # (自动生成) 数据库持久化目录

```

### 第二步：编写配置文件 (`config.yaml`)

这个文件是网关的“大脑”。请将以下内容保存为 `config.yaml`。
*注意替换其中的 `api_key`。*

```yaml
general_settings:
  master_key: sk-admin-password-1234  # 【重要】這是 Admin UI 的登录密码，也是超级 Key
  database_url: "postgresql://llm_user:llm_password@db:5432/litellm_db" # 连接到下方的 db 服务

model_list:
  # --- 场景 1: 阿里云 Qwen (通义千问) ---
  - model_name: qwen-max
    litellm_params:
      model: openai/qwen-max  # 映射名
      api_key: "sk-aliyun-xxxxxxxx"
      api_base: "https://dashscope.aliyuncs.com/compatible-mode/v1"

  # --- 场景 2: DeepSeek (深度求索) ---
  - model_name: deepseek-chat
    litellm_params:
      model: openai/deepseek-chat
      api_key: "sk-deepseek-xxxxxxxx"
      api_base: "https://api.deepseek.com"

  # --- 场景 3: 视觉模型 (Qwen-VL) ---
  - model_name: qwen-vl
    litellm_params:
      model: openai/qwen-vl-max
      api_key: "sk-aliyun-xxxxxxxx"
      api_base: "https://dashscope.aliyuncs.com/compatible-mode/v1"

# (可选) 路由回退设置：如果 deepseek 挂了，自动切 qwen
router_settings:
  fallbacks:
    - deepseek-chat: ["qwen-max"]

```

### 第三步：编写 Docker Compose (`docker-compose.yml`)

将以下内容保存为 `docker-compose.yml`。这里配置了数据库的持久化映射。

```yaml
version: "3.4"

services:
  # 1. 数据库服务 (PostgreSQL)
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: llm_user
      POSTGRES_PASSWORD: llm_password
      POSTGRES_DB: litellm_db
    volumes:
      # 【关键】将数据库文件映射到本地当前目录下的 pg_data 文件夹
      - ./pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U llm_user -d litellm_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 2. LiteLLM 网关服务
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    restart: always
    ports:
      - "4000:4000"
    volumes:
      # 【关键】将本地的 config.yaml 挂载进去
      - ./config.yaml:/app/config.yaml
    environment:
      # 数据库连接串 (注意 host 是 'db')
      - DATABASE_URL=postgresql://llm_user:llm_password@db:5432/litellm_db
      # 设置 Master Key (也可以在 config.yaml 里设，环境变量优先级更高)
      - LITELLM_MASTER_KEY=sk-admin-password-1234
      # 开启详细日志以便调试
      - LITELLM_LOG=INFO
    command: [ "--config", "/app/config.yaml", "--detailed_debug"]
    depends_on:
      db:
        condition: service_healthy

```

### 第四步：启动服务

在目录下执行标准命令：

```bash
docker-compose up -d

```

**检查是否成功：**

1. 查看日志：`docker-compose logs -f litellm`
2. 等待看到类似 `Uvicorn running on http://0.0.0.0:4000` 的字样。
3. 如果报错“Database connection failed”，通常是数据库还没初始化完，等待几秒后它会自动重试。

### 第五步：验证与使用

#### 1. 访问 Admin UI (管理后台)

* **地址：** `http://IP地址:4000/ui`
* **登录密码：** 使用你在 yaml 里设置的 `sk-admin-password-1234`。
* **功能：** 你可以在这里创建新的 API Key（例如给研发部创建一个 `sk-dev-team`），并设置预算上限。

#### 2. 测试 API 调用 (OpenAI 格式)

在你的终端测试一下调用是否通畅：

```bash
curl http://127.0.0.1:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-admin-password-1234" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "你好，测试一下网关连通性"}
    ]
  }'

```

如果成功返回了 DeepSeek 的回复，说明搭建完成。

### 进阶：如何更新配置？

由于我们采用了**配置文件映射**的方式，当你需要添加新模型时：

1. 在宿主机直接修改 `config.yaml`。
2. 不需要删除容器，只需要发送重载信号或重启容器：
```bash
docker-compose restart litellm

```



### 常见问题排查

1. **数据库连接错误：**
确保 `config.yaml` 和 `docker-compose.yml` 里的数据库密码（`llm_password`）是一致的。
2. **UI 上看不到日志：**
LiteLLM 的日志写入有时会有延迟，或者需要确保 `DATABASE_URL` 环境变量被正确识别。
3. **Docker 权限问题：**
如果 `pg_data` 文件夹创建失败，可能是宿主机权限问题。可以手动执行 `mkdir pg_data` 建立文件夹。