"""
server/routes/ai.py — AI 生成 API（代理转发 DeepSeek）
"""
from flask import request, jsonify
from server.models import Setting
from server.services.deepseek import call_deepseek, validate_api_key
from server.routes import ai_bp


def _get_api_key():
    """从数据库获取 API Key"""
    setting = Setting.query.get("api_key")
    return setting.value if setting else ""


@ai_bp.route("/generate", methods=["POST"])
def generate():
    """生成反馈——前端传来 messages[]，后端转发 DeepSeek"""
    api_key = _get_api_key()
    if not api_key:
        return jsonify({"error": "请先在设置页配置 DeepSeek API Key"}), 400

    data = request.get_json(silent=True) or {}
    messages = data.get("messages")
    temperature = data.get("temperature", 0.42)

    if not messages or not isinstance(messages, list):
        return jsonify({"error": "messages 不能为空"}), 400

    try:
        content = call_deepseek(api_key, messages, temperature)
        return jsonify({"content": content, "ok": True})
    except Exception as e:
        return jsonify({"error": str(e), "ok": False}), 500


@ai_bp.route("/revise", methods=["POST"])
def revise():
    """二次修改——与 generate 相同逻辑"""
    return generate()


@ai_bp.route("/validate-key", methods=["POST"])
def check_key():
    """验证 API Key 有效性"""
    data = request.get_json(silent=True) or {}
    api_key = data.get("api_key", "").strip()
    result = validate_api_key(api_key)
    return jsonify(result)
