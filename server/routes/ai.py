"""
server/routes/ai.py — AI 生成 API（代理转发 DeepSeek + Python 构建 Prompt）
"""
from flask import request, jsonify
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


@ai_bp.route("/validate-key", methods=["POST"])
def check_key():
    """验证 API Key 有效性"""
    data = request.get_json(silent=True) or {}
    key = data.get("api_key", "").strip()
    result = validate_api_key(key)
    return jsonify(result)
