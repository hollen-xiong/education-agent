"""
server/services/deepseek.py — DeepSeek API 调用封装
"""
import requests
from server.config import DEEPSEEK_BASE_URL, DEEPSEEK_MODEL


def call_deepseek(api_key, messages, temperature=0.42, max_tokens=2000):
    """
    调用 DeepSeek Chat API
    :param api_key: DeepSeek API Key
    :param messages: OpenAI 格式的 messages 列表
    :param temperature: 温度参数
    :param max_tokens: 最大 token 数
    :return: 模型回复文本
    """
    response = requests.post(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json={
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=120,
    )

    if not response.ok:
        raise Exception(f"DeepSeek API 错误 ({response.status_code}): {response.text[:200]}")

    result = response.json()
    return result.get("choices", [{}])[0].get("message", {}).get("content", "")


def validate_api_key(api_key):
    """验证 API Key 是否有效"""
    if not api_key or len(api_key) < 20:
        return {"ok": False, "message": "密钥格式不正确"}

    try:
        response = requests.get(
            f"{DEEPSEEK_BASE_URL}/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if response.ok:
            return {"ok": True, "message": "API Key 有效"}
        elif response.status_code in (401, 403):
            return {"ok": False, "message": f"API Key 无效 ({response.status_code})，请检查后重试"}
        else:
            return {"ok": True, "message": f"无法验证 ({response.status_code})，已保存但建议测试"}
    except Exception:
        return {"ok": True, "message": "网络不通，已保存但无法在线验证"}
