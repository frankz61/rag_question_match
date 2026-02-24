#!/bin/bash
# ============================================
# LiteLLM 数据库恢复脚本
# ============================================

set -e

# 配置
BACKUP_DIR="./backups"
CONTAINER_NAME="litellm_db"
DB_NAME="litellm"
DB_USER="litellm"

echo "============================================"
echo "LiteLLM 数据库恢复"
echo "时间: $(date)"
echo "============================================"

# 检查参数
if [ -z "$1" ]; then
    echo "用法: $0 <备份文件>"
    echo ""
    echo "可用的备份文件:"
    ls -lh "$BACKUP_DIR"/litellm_backup_*.sql.gz 2>/dev/null || echo "（无备份文件）"
    exit 1
fi

BACKUP_FILE="$1"

# 检查文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo "错误: 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

# 确认恢复
echo "警告: 此操作将覆盖当前数据库中的所有数据!"
echo "备份文件: $BACKUP_FILE"
read -p "确定要继续吗? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "已取消恢复操作"
    exit 0
fi

# 停止 LiteLLM 服务
echo "停止 LiteLLM 服务..."
docker compose stop litellm

# 解压备份文件（如果是压缩的）
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "解压备份文件..."
    TEMP_FILE="/tmp/litellm_restore_$$.sql"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# 恢复数据库
echo "正在恢复数据库..."
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$RESTORE_FILE"

# 清理临时文件
if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
    rm "$TEMP_FILE"
fi

# 启动 LiteLLM 服务
echo "启动 LiteLLM 服务..."
docker compose start litellm

echo ""
echo "============================================"
echo "恢复完成!"
echo "============================================"
