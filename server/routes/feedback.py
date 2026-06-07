"""
server/routes/feedback.py — 反馈历史 API
"""
from flask import request, jsonify
from server.database import db
from server.models import FeedbackHistory
from server.routes import feedback_bp

HISTORY_LIMIT = 12


@feedback_bp.route("/history", methods=["GET"])
def get_history():
    """获取反馈历史"""
    limit = request.args.get("limit", HISTORY_LIMIT, type=int)
    items = FeedbackHistory.query.order_by(
        FeedbackHistory.created_at.desc()
    ).limit(min(limit, 50)).all()
    return jsonify([item.to_dict() for item in items])


@feedback_bp.route("/history", methods=["POST"])
def add_history():
    """添加反馈记录"""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text or len(text) < 30:
        return jsonify({"error": "反馈文本不能为空或过短"}), 400

    item = FeedbackHistory(
        student_name=data.get("student_name", ""),
        subject=data.get("subject", ""),
        tone=data.get("tone", ""),
        scenes=data.get("scenes", []),
        text=text,
    )
    db.session.add(item)

    # 保持上限
    total = FeedbackHistory.query.count()
    if total > HISTORY_LIMIT:
        oldest = FeedbackHistory.query.order_by(
            FeedbackHistory.created_at.asc()
        ).limit(total - HISTORY_LIMIT).all()
        for old in oldest:
            db.session.delete(old)

    db.session.commit()
    return jsonify(item.to_dict()), 201


@feedback_bp.route("/history", methods=["DELETE"])
def clear_history():
    """清空反馈历史"""
    FeedbackHistory.query.delete()
    db.session.commit()
    return jsonify({"message": "已清空"}), 200
