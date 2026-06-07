"""
server/routes/ — API 路由蓝图
"""
from flask import Blueprint

students_bp   = Blueprint("students",  __name__, url_prefix="/api/students")
lists_bp      = Blueprint("lists",     __name__, url_prefix="/api/lists")
feedback_bp   = Blueprint("feedback",  __name__, url_prefix="/api/feedback")
ai_bp         = Blueprint("ai",        __name__, url_prefix="/api/ai")
settings_bp   = Blueprint("settings",  __name__, url_prefix="/api/settings")

# 延迟导入避免循环依赖
def register_routes():
    from server.routes import students, lists, feedback, ai, settings
