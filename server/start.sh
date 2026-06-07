#!/bin/bash
set -e
echo "========================================"
echo "  教培助手 v3.0 · 服务端启动"
echo "========================================"
echo ""

cd "$(dirname "$0")/.."

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装"
    exit 1
fi

# 安装依赖
echo "[1/2] 检查 Python 依赖..."
pip3 install -r server/requirements.txt -q

# 启动
echo "[2/2] 启动服务端..."
echo ""
python3 -m server.app
