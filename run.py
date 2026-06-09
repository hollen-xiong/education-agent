"""
run.py — 教培助手启动入口（支持 PyInstaller 打包）
"""
import os
import sys
import webbrowser

# 修复 Windows 控制台 GBK 编码问题
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# PyInstaller 打包后，资源文件在 sys._MEIPASS 中
IS_FROZEN = getattr(sys, 'frozen', False)

if IS_FROZEN:
    BUNDLE_DIR = sys._MEIPASS
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))

# 确保 server 包可导入
sys.path.insert(0, BUNDLE_DIR)

# ---- 在导入 server 之前，覆盖数据库路径 ----
if IS_FROZEN:
    exe_dir = os.path.dirname(sys.executable)
    data_dir = os.path.join(exe_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "jiaopei.db").replace("\\", "/")
    os.environ["JIAOPEI_DB_PATH"] = db_path

from server.config import HOST, PORT

if __name__ == "__main__":
    from server.app import create_app

    app = create_app(frozen_dir=BUNDLE_DIR if IS_FROZEN else None)

    print(f"\n  教培助手 v3.1")
    print(f"  本地访问: http://{HOST}:{PORT}")
    if IS_FROZEN:
        print(f"  数据库:   {os.environ.get('JIAOPEI_DB_PATH', '')}")
    print(f"  按 Ctrl+C 停止\n")

    # 自动打开浏览器
    try:
        webbrowser.open(f"http://{HOST}:{PORT}")
    except Exception:
        pass

    # 用 waitress 生产模式启动
    try:
        from waitress import serve
        print("  [Waitress]")
        serve(app, host=HOST, port=PORT)
    except ImportError:
        print("  [Flask]")
        app.run(host=HOST, port=PORT, debug=False)
