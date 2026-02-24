#!/bin/bash
# ============================================
# LiteLLM 数据库备份脚本
# ============================================

set -e

# 配置
BACKUP_DIR="./backups"
CONTAINER_NAME="litellm_db"
DB_NAME="litellm"
DB_USER="litellm"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/litellm_backup_$TIMESTAMP.sql"
COMPRESSED_FILE="$BACKUP_FILE.gz"

echo "============================================"
echo "LiteLLM 数据库备份"
echo "时间: $(date)"
echo "============================================"

# 执行备份
echo "正在备份数据库..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# 压缩备份文件
echo "正在压缩备份文件..."
gzip "$BACKUP_FILE"

# 显示备份信息
BACKUP_SIZE=$(ls -lh "$COMPRESSED_FILE" | awk '{print $5}')
echo "备份完成: $COMPRESSED_FILE"
echo "文件大小: $BACKUP_SIZE"

# 清理旧备份
echo "清理 $RETENTION_DAYS 天前的旧备份..."
find "$BACKUP_DIR" -name "litellm_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 显示当前备份列表
echo ""
echo "当前备份文件:"
ls -lh "$BACKUP_DIR"/litellm_backup_*.sql.gz 2>/dev/null || echo "（无备份文件）"

echo ""
echo "============================================"
echo "备份完成!"
echo "============================================"
