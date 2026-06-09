"""
run.py — 一对一反馈助手 启动入口（支持 PyInstaller 打包）
"""
import os
import sys
import signal
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


def _graceful_shutdown(signum, frame):
    print("\n")
    print("  " + "=" * 44)
    print("  |  服务器已停止。                         |")
    print("  |  关闭此窗口即可。                       |")
    print("  " + "=" * 44)
    print("\n")
    sys.exit(0)


if __name__ == "__main__":
    from server.app import create_app

    app = create_app(frozen_dir=BUNDLE_DIR if IS_FROZEN else None)

    # 注册 Ctrl+C 信号处理
    signal.signal(signal.SIGINT, _graceful_shutdown)
    signal.signal(signal.SIGTERM, _graceful_shutdown)

    print("\n")
    print("  " + "=" * 44)
    print("  |                                           |")
    print("  |     一对一反馈助手 v3.1                    |")
    print("  |                                           |")
    print(f"  |  浏览器访问: http://{HOST}:{PORT}              |")
    print("  |                                           |")
    print("  |  按 Ctrl+C 或 关闭此窗口 即可停止          |")
    print("  |                                           |")
    print("  " + "=" * 44)
    print("\n")

    # 自动打开浏览器
    try:
        webbrowser.open(f"http://{HOST}:{PORT}")
    except Exception:
        pass

    # 用 waitress 生产模式启动
    try:
        from waitress import serve
        serve(app, host=HOST, port=PORT)
    except ImportError:
        app.run(host=HOST, port=PORT, debug=False)
