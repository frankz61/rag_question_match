# LiteLLM 部署指南

## 前置要求

- Docker 20.10+
- Docker Compose V2+
- 至少 2GB 可用内存
- 至少 10GB 磁盘空间（数据库存储）

---

## 部署步骤

### 1. 准备配置文件

```bash
# 进入项目目录
cd litellm_workspace

# 复制环境变量模板
cp .env.example .env
```

### 2. 编辑 .env 文件

**必须配置的项目**：

```bash
# 数据库密码（自定义强密码）
POSTGRES_PASSWORD=your_secure_db_password_here

# Master Key（管理员密钥，必须 sk- 开头）
LITELLM_MASTER_KEY=sk-your-strong-master-key-here

# Salt Key（加密密钥，32字符，设置后不要更改）
LITELLM_SALT_KEY=sk-your-32-char-salt-key-here

# Admin UI 登录密码
UI_USERNAME=admin
UI_PASSWORD=your_admin_ui_password
```

**按需配置的 LLM API Key**：

```bash
# 根据实际使用的模型配置对应的 Key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
QWEN_API_KEY=sk-...
```

### 3. 创建数据目录

```bash
mkdir -p data/postgres
```

### 4. 启动服务

```bash
# 启动所有服务
docker compose up -d

# 查看启动状态
docker compose ps

# 等待服务就绪（约 30-60 秒）
docker compose logs -f litellm
```

**成功标志**：看到 `Uvicorn running on http://0.0.0.0:4000`

### 5. 验证服务

```bash
# 健康检查
curl http://localhost:4000/health

# 测试 API 调用
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "ping"}]
  }'
```

---

## 服务管理

### 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f litellm
docker compose logs -f db

# 重启服务
docker compose restart litellm

# 停止服务
docker compose down

# 停止并删除数据（谨慎！）
docker compose down -v
```

### 更新配置

**修改 config.yaml 后**：
```bash
docker compose restart litellm
```

**修改 .env 后**：
```bash
docker compose down
docker compose up -d
```

### 更新镜像

```bash
docker compose pull
docker compose up -d
```

---

## 目录权限问题

如果遇到数据库启动失败，可能是目录权限问题：

```bash
# Linux/Mac
sudo chown -R 999:999 data/postgres

# 或者使用 Docker 用户
sudo chown -R 70:70 data/postgres
```

---

## 端口配置

默认端口：
- LiteLLM: 4000
- PostgreSQL: 5432

修改端口（在 .env 中）：
```bash
LITELLM_PORT=8080
POSTGRES_PORT=15432
```

---

## 生产环境建议

### 1. 不暴露数据库端口

编辑 `docker-compose.yml`，移除 PostgreSQL 的端口映射：
```yaml
  db:
    # ports:
    #   - "5432:5432"  # 注释掉
```

### 2. 使用强密钥

生成强随机密钥：
```bash
# Master Key
openssl rand -hex 32 | sed 's/^/sk-/'

# Salt Key（32字符）
openssl rand -hex 16
```

### 3. 定期备份

使用备份脚本：
```bash
./scripts/backup.sh
```

### 4. 日志级别

生产环境建议使用 INFO 级别：
```bash
LITELLM_LOG=INFO
```

---

## 故障排查

### 服务无法启动

1. 检查端口是否被占用：
```bash
netstat -tlnp | grep 4000
```

2. 检查 Docker 日志：
```bash
docker compose logs litellm
```

### 数据库连接失败

1. 确认数据库服务正常：
```bash
docker compose ps db
```

2. 检查数据库健康状态：
```bash
docker compose logs db
```

### API 调用返回 401

1. 检查 Authorization Header 格式
2. 确认使用正确的 API Key
3. 确认 Key 未过期或超出预算

---

## 下一步

- [模型配置](02-model-config.md) - 添加更多模型
- [Key 管理](03-key-management.md) - 创建用户 Key
