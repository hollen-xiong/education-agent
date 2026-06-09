"""
server/routes/ai.py — AI 生成 API（代理转发 DeepSeek + Python 构建 Prompt）
"""
import concurrent.futures
from flask import request, jsonify, current_app, copy_current_request_context
from server.models import Setting
from server.services.deepseek import call_deepseek, validate_api_key
from server.services.prompt_builder import (
    build_messages, build_quick_messages, build_revision_messages
)
from server.routes import ai_bp


def _get_api_key():
    setting = Setting.query.get("api_key")
    return setting.value if setting else ""


@ai_bp.route("/generate", methods=["POST"])
def generate():
    """生成反馈——前端传来 formData，后端构建 Prompt 并转发 DeepSeek"""
    api_key = _get_api_key()
    if not api_key:
        return jsonify({"error": "请先在设置页配置 DeepSeek API Key"}), 400

    data = request.get_json(silent=True) or {}

    # 支持两种模式：前端传来 messages[] 或 formData
    if data.get("messages"):
        messages = data["messages"]
    else:
        messages = build_messages(data)

    temperature = data.get("temperature", 0.42)
    try:
        content = call_deepseek(api_key, messages, temperature)
        return jsonify({"content": content, "ok": True})
    except Exception as e:
        return jsonify({"error": str(e), "ok": False}), 500


@ai_bp.route("/generate-quick", methods=["POST"])
def generate_quick():
    """快速生成"""
    api_key = _get_api_key()
    if not api_key:
        return jsonify({"error": "请先配置 API Key"}), 400

    data = request.get_json(silent=True) or {}
    messages = build_quick_messages(data)
    temperature = data.get("temperature", 0.55)

    try:
        content = call_deepseek(api_key, messages, temperature)
        return jsonify({"content": content, "ok": True})
    except Exception as e:
        return jsonify({"error": str(e), "ok": False}), 500


@ai_bp.route("/revise", methods=["POST"])
def revise():
    """二次修改"""
    api_key = _get_api_key()
    if not api_key:
        return jsonify({"error": "请先配置 API Key"}), 400

    data = request.get_json(silent=True) or {}
    revise_type = data.get("type", "natural")
    current_text = data.get("currentText", "")
    form_data = data.get("formData", {})

    messages = build_revision_messages(revise_type, current_text, form_data)
    try:
        content = call_deepseek(api_key, messages, 0.35)
        return jsonify({"content": content, "ok": True})
    except Exception as e:
        return jsonify({"error": str(e), "ok": False}), 500


@ai_bp.route("/batch-generate", methods=["POST"])
def batch_generate():
    """批量生成反馈——多个学生并行调用 DeepSeek"""
    api_key = _get_api_key()
    if not api_key:
        return jsonify({"error": "请先在设置页配置 DeepSeek API Key"}), 400

    data = request.get_json(silent=True) or {}
    students = data.get("students", [])
    shared = data.get("shared", {})

    if not isinstance(students, list) or len(students) == 0:
        return jsonify({"error": "请提供至少一个学生信息"}), 400

    # 限制单次批量不超过 20 人
    if len(students) > 20:
        return jsonify({"error": "单次批量最多 20 名学生"}), 400

    results = []
    app = current_app._get_current_object()  # 获取真实 app 对象，供线程使用

    def generate_one(index, student):
        """为单个学生生成反馈（在线程中运行，需要 app context）"""
        try:
            with app.app_context():
                # 合并学生信息和共享参数
                form_data = dict(shared)
                form_data["studentName"] = student.get("name", "")
                form_data["gender"] = student.get("gender", shared.get("gender", "男"))
                form_data["grade"] = student.get("grade", shared.get("grade", "初中"))
                form_data["subject"] = student.get("subject", shared.get("subject", "数学"))

                messages = build_messages(form_data)
                temperature = data.get("temperature", 0.42)
                content = call_deepseek(api_key, messages, temperature)
                return {
                    "index": index,
                    "student": student.get("name", ""),
                    "content": content,
                    "ok": True,
                    "error": None,
                }
        except Exception as e:
            return {
                "index": index,
                "student": student.get("name", ""),
                "content": "",
                "ok": False,
                "error": str(e),
            }

    # 并行生成（最多 5 个并发）
    max_workers = min(5, len(students))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(generate_one, i, student): i
            for i, student in enumerate(students)
        }
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)

    # 按原始顺序排序
    results.sort(key=lambda r: r.get("index", 0))

    ok_count = sum(1 for r in results if r.get("ok"))
    return jsonify({
        "results": results,
        "total": len(students),
        "ok_count": ok_count,
    })


@ai_bp.route("/validate-key", methods=["POST"])
def check_key():
    """验证 API Key 有效性"""
    data = request.get_json(silent=True) or {}
    key = data.get("api_key", "").strip()
    result = validate_api_key(key)
    return jsonify(result)
