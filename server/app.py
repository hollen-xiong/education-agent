"""
server/app.py — Flask 应用入口
"""
import os
import sys

# 确保 server 包可导入
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from flask_cors import CORS

from server.config import SECRET_KEY, SQLALCHEMY_DATABASE_URI, DEBUG, HOST, PORT
from server.database import db, init_db, seed_defaults
from server.routes import (
    students_bp, lists_bp, feedback_bp,
    ai_bp, settings_bp, register_routes,
)


def create_app():
    app = Flask(__name__, static_folder="../", static_url_path="")
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
    app.config["JSON_AS_ASCII"] = False
    CORS(app)

    # 数据库
    init_db(app)
    seed_defaults(app)

    # 注册路由
    register_routes()
    app.register_blueprint(students_bp)
    app.register_blueprint(lists_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(settings_bp)

    # 静态文件：根路径返回 index.html
    @app.route("/")
    def index():
        from flask import send_from_directory
        return send_from_directory(app.static_folder, "index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    print(f"\n  教培助手服务端已启动")
    print(f"   本地访问: http://{HOST}:{PORT}")
    print(f"   数据库:   {SQLALCHEMY_DATABASE_URI}")
    print(f"   按 Ctrl+C 停止\n")

    # 尝试用 waitress 生产模式启动，失败则用 Flask 开发模式
    try:
        from waitress import serve
        print("   [Waitress 生产模式]")
        serve(app, host=HOST, port=PORT)
    except ImportError:
        print("   [Flask 开发模式]")
        app.run(host=HOST, port=PORT, debug=DEBUG)
