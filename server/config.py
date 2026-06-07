"""
server/config.py — 服务器配置
"""
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# 数据库——确保 data 目录存在
_DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(_DATA_DIR, exist_ok=True)
DATABASE_PATH = os.path.join(_DATA_DIR, "jiaopei.db")
SQLALCHEMY_DATABASE_URI = "sqlite:///" + DATABASE_PATH.replace("\\", "/")

# Flask
SECRET_KEY = os.environ.get("SECRET_KEY", "jiaopei-dev-secret-change-in-production")
DEBUG = os.environ.get("FLASK_DEBUG", "true").lower() == "true"

# DeepSeek
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_MODEL = "deepseek-chat"

# 服务器
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "5000"))
