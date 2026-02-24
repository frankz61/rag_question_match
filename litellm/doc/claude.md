# LiteLLM Docker Compose 搭建指南

给你一个完整的 LiteLLM 部署方案,包含数据库持久化:

## 📁 项目结构

```bash
litellm/
├── docker-compose.yml
├── .env
├── config.yaml
└── data/
    └── postgres/    # 数据库数据目录(自动创建)
```

## 📝 docker-compose.yml

```yaml
version: '3.8'

services:
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    container_name: litellm
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://litellm:${POSTGRES_PASSWORD}@postgres:5432/litellm
      - LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
      - LITELLM_SALT_KEY=${LITELLM_SALT_KEY}
      - UI_USERNAME=${UI_USERNAME}
      - UI_PASSWORD=${UI_PASSWORD}
      # 可选:启用详细日志
      - LITELLM_LOG=DEBUG
    volumes:
      - ./config.yaml:/app/config.yaml:ro
    command: ["--config", "/app/config.yaml", "--port", "4000", "--detailed_debug"]
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - litellm-network

  postgres:
    image: postgres:16-alpine
    container_name: litellm-postgres
    environment:
      - POSTGRES_DB=litellm
      - POSTGRES_USER=litellm
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      # 数据持久化到本地
      - ./data/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"  # 可选:暴露数据库端口用于管理
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U litellm"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - litellm-network

networks:
  litellm-network:
    driver: bridge
```

## 🔐 .env 文件

```bash
# 数据库密码
POSTGRES_PASSWORD=your_secure_postgres_password_here

# LiteLLM Master Key (用于 API 认证)
LITELLM_MASTER_KEY=sk-1234567890abcdef

# Salt Key (用于加密,必须32字符)
LITELLM_SALT_KEY=your-32-character-salt-key-here

# Web UI 登录凭证
UI_USERNAME=admin
UI_PASSWORD=your_admin_password
```

## ⚙️ config.yaml 配置文件

```yaml
model_list:
  # OpenAI 配置示例
  - model_name: gpt-4
    litellm_params:
      model: gpt-4
      api_key: os.environ/OPENAI_API_KEY
  
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: gpt-3.5-turbo
      api_key: os.environ/OPENAI_API_KEY

  # Claude 配置示例
  - model_name: claude-3-opus
    litellm_params:
      model: claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

  # 本地模型示例 (Ollama)
  - model_name: llama2
    litellm_params:
      model: ollama/llama2
      api_base: http://host.docker.internal:11434

# 通用设置
litellm_settings:
  # 启用数据库缓存
  cache: true
  cache_params:
    type: "redis"  # 或使用内存缓存
  
  # 日志设置
  success_callback: ["langfuse"]  # 可选
  failure_callback: ["langfuse"]
  
  # 速率限制
  rpm: 100
  tpm: 10000

# Router 设置
router_settings:
  routing_strategy: simple-shuffle  # 或 latency-based-routing
  model_group_alias:
    gpt-4: gpt-4
    gpt-3.5: gpt-3.5-turbo
```

## 🚀 使用步骤

### 1. 创建项目目录

```bash
mkdir -p litellm/data/postgres
cd litellm
```

### 2. 创建配置文件

创建 `.env`、`config.yaml` 和 `docker-compose.yml` 文件(使用上面的内容)

### 3. 生成安全密钥

```bash
# 生成 32 字符的 Salt Key
openssl rand -hex 16

# 或使用 Python
python3 -c "import secrets; print(secrets.token_hex(16))"
```

### 4. 设置环境变量

编辑 `.env` 文件,填入你的密钥和密码。

### 5. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f litellm

# 查看所有容器状态
docker-compose ps
```

### 6. 访问服务

- **API 端点**: `http://localhost:4000`
- **Web UI**: `http://localhost:4000/ui` (使用 .env 中的用户名密码登录)
- **健康检查**: `http://localhost:4000/health`

## 🔧 进阶配置

### 添加 Redis 缓存(可选)

```yaml
# 在 docker-compose.yml 中添加
  redis:
    image: redis:7-alpine
    container_name: litellm-redis
    volumes:
      - ./data/redis:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - litellm-network
```

然后在 `config.yaml` 中配置:

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: "redis"
    host: redis
    port: 6379
```

### 数据库备份脚本

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

docker exec litellm-postgres pg_dump -U litellm litellm > \
  "$BACKUP_DIR/litellm_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "备份完成!"
```

## 📊 管理命令

```bash
# 停止服务
docker-compose down

# 停止并删除数据
docker-compose down -v

# 重启服务
docker-compose restart litellm

# 查看 PostgreSQL 数据
docker exec -it litellm-postgres psql -U litellm -d litellm

# 更新镜像
docker-compose pull
docker-compose up -d
```

## 🔍 测试 API

```bash
# 健康检查
curl http://localhost:4000/health

# 测试调用 (需要替换 LITELLM_MASTER_KEY)
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234567890abcdef" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## ⚠️ 注意事项

1. **数据持久化**: `./data/postgres` 目录包含所有数据库文件,务必定期备份
2. **权限问题**: 如果遇到权限错误,运行 `sudo chown -R 999:999 ./data/postgres`
3. **防火墙**: 生产环境不要暴露 PostgreSQL 端口(删除 `5432:5432` 映射)
4. **密钥安全**: `.env` 文件不要提交到 Git,加入 `.gitignore`
5. **资源限制**: 可以在服务中添加 `deploy.resources` 限制内存和 CPU

这个配置提供了完整的数据持久化和易于管理的部署方案!