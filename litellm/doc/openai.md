下面给你一套**企业内自建 LiteLLM Proxy（含 Postgres）**的 Docker Compose 指南：**数据库数据目录映射到本地**、可用 Admin UI（`/ui`）做模型/Key 管理、并且按官方要求配置 **Master Key + Salt Key**。

> 说明：LiteLLM 的 Admin UI 要求 **已设置 master key 且已连接 DB** 才能正常使用。([LiteLLM][1])
> Salt Key 用于加密/解密你存进 DB 的上游厂商 API Key，**必须在加模型前设置，且之后不要更改**（否则已加密数据不可恢复）。([LiteLLM][2])

---

## 目录结构（建议）

```text
litellm-stack/
  docker-compose.yml
  .env
  litellm_config.yaml        # 可选：用配置文件预置模型（也可完全用 UI 加）
  data/
    postgres/                # 本地持久化 DB 文件目录（映射到容器）
```

---

## 1) 新建 `.env`（强烈建议用随机强密钥）

在 `litellm-stack/.env` 写入（示例值请替换）：

```bash
# Proxy 管理员 master key（用于管理 UI / 生成 virtual keys；必须 sk- 开头）
LITELLM_MASTER_KEY="sk-change-me-very-strong"

# DB 加密用 salt key（必须在加模型前设置；后续不要改）
LITELLM_SALT_KEY="sk-change-me-salt-very-strong"

# Admin UI 登录账号（建议显式设置，避免默认值不明确）
UI_USERNAME="admin"
UI_PASSWORD="change-me-strong-password"
```

* 官方 quick start 明确要求设置 `LITELLM_MASTER_KEY` 和 `LITELLM_SALT_KEY` 后再启动。([LiteLLM][3])
* UI 文档也给了 `UI_USERNAME/UI_PASSWORD` 的设置方式。([LiteLLM][1])

---

## 2) 写 `docker-compose.yml`（Postgres 数据映射本地）

在 `litellm-stack/docker-compose.yml` 写入：

```yaml
services:
  db:
    image: postgres:16
    container_name: litellm_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: litellm
      POSTGRES_USER: llmproxy
      POSTGRES_PASSWORD: change-me-db-password
    ports:
      - "5432:5432"
    volumes:
      # ✅ 映射到本地目录（持久化）
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d litellm -U llmproxy"]
      interval: 2s
      timeout: 5s
      retries: 20

  litellm:
    image: docker.litellm.ai/berriai/litellm:main-stable
    container_name: litellm_proxy
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - .env
    environment:
      # DB 连接（容器内用服务名 db）
      DATABASE_URL: "postgresql://llmproxy:change-me-db-password@db:5432/litellm"

      # 允许在 Admin UI 中添加/管理模型（存 DB）
      STORE_MODEL_IN_DB: "True"

      # 可选：如果你用配置文件预置模型，就挂载并启用下面两行
      # （不想用配置文件就保持注释，完全通过 /ui 添加模型也行）
      # LITELLM_CONFIG: "/app/config.yaml"
    ports:
      - "4000:4000"
    # 可选：启用配置文件
    volumes:
      - ./litellm_config.yaml:/app/config.yaml:ro
    command: ["--config", "/app/config.yaml"]
    healthcheck:
      test: ["CMD-SHELL", "python3 -c \"import urllib.request; urllib.request.urlopen('http://localhost:4000/health/liveliness')\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

要点说明：

* LiteLLM 官方仓库的 compose 示例里就包含 `DATABASE_URL`、`STORE_MODEL_IN_DB=True`、并通过 `.env` 注入 master/salt key；我这里只是把 Postgres 的 **named volume 改成了本地目录 bind mount**，满足你“文件映射本地”。([GitHub][4])
* `STORE_MODEL_IN_DB=True` 的用途：允许你在 `/ui` 里直接加模型并存入 DB（不用重启改 config）。([GitHub][4])
* 你的本地 `./data/postgres` 需要可写：Linux 上如果遇到权限问题，常见处理是 `sudo chown -R 999:999 data/postgres`（Postgres 容器默认用户常为 999）。

---

## 3) （可选）写 `litellm_config.yaml`（先预置一个模型，验证链路）

如果你打算先用配置文件跑通（之后也可以改成全 UI 管理），示例：

```yaml
model_list:
  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: "os.environ/DEEPSEEK_API_KEY"

general_settings:
  # 也可以不写在这里，完全靠 .env 的 LITELLM_MASTER_KEY
  master_key: "os.environ/LITELLM_MASTER_KEY"
  database_url: "os.environ/DATABASE_URL"
  store_model_in_db: true
```

* `general_settings.master_key / database_url` 的意义与要求在官方教程里写得很清楚。([LiteLLM][3])
* 如果你不想把上游 key 放进 compose/env，可以继续用 `os.environ/XXX` 注入。

> 注意：只要你准备把模型凭证存 DB（UI 添加模型会存），就务必提前设好 `LITELLM_SALT_KEY` 且不要再改。([LiteLLM][2])

---

## 4) 启动

在 `litellm-stack/` 下执行：

```bash
mkdir -p data/postgres
docker compose up -d
docker compose ps
```

打开：

* Admin UI：`http://localhost:4000/ui` ([LiteLLM][1])
* Swagger（根路径）：`http://localhost:4000/`（UI 文档里也提到可从 Swagger 找到 UI 入口）([LiteLLM][1])

---

## 5) 快速验证（Chat Completions）

用 master key 先测一条请求（模型名按你配置的来）：

```bash
curl -X POST 'http://localhost:4000/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-change-me-very-strong' \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role":"user","content":"ping"}]
  }'
```

官方教程也用同样方式验证 `/chat/completions`。([LiteLLM][3])

---

## 6) 企业内网常用加固建议（很实用）

* **不要把 4000/5432 直接暴露到公网**；放内网或前置反向代理（Nginx/Traefik）并加 SSO/ACL。
* **备份**：你现在 DB 数据在 `./data/postgres`，直接做目录级备份即可；上线后建议用外部托管 Postgres（或至少定时 pg_dump）。
* **高并发**：官方部署文档提示 1000+ RPS 时建议引入 Redis 以避免 DB 连接耗尽/死锁，并给了相关配置方向。([LiteLLM][5])

---

如果你告诉我你希望“**全 UI 管理模型**”还是“**GitOps（配置文件管理模型）**”，以及预计 QPS 大概区间，我可以把 compose 再补成一套更接近生产的版本（加 Redis、把端口只暴露给内部网络、加 Prometheus 指标采集等）。

[1]: https://docs.litellm.ai/docs/proxy/ui "Quick Start | liteLLM"
[2]: https://docs.litellm.ai/docs/proxy/security_encryption_faq?utm_source=chatgpt.com "LiteLLM Self-Hosted Security & Encryption FAQ"
[3]: https://docs.litellm.ai/docs/proxy/docker_quick_start "Getting Started Tutorial | liteLLM"
[4]: https://raw.githubusercontent.com/BerriAI/litellm/main/docker-compose.yml "raw.githubusercontent.com"
[5]: https://docs.litellm.ai/docs/proxy/deploy "Docker, Helm, Terraform | liteLLM"
