"""
server/routes/lists.py — 自定义列表 API（优点/缺点/建议/寄语）
"""
from flask import request, jsonify
from server.database import db
from server.models import CustomList
from server.routes import lists_bp

VALID_TYPES = {"highlights", "weakpoints", "suggestions", "encouragements"}


@lists_bp.route("/<list_type>", methods=["GET"])
def get_list(list_type):
    """获取指定类型的列表"""
    if list_type not in VALID_TYPES:
        return jsonify({"error": f"无效类型: {list_type}"}), 400
    items = CustomList.query.filter_by(list_type=list_type)\
        .order_by(CustomList.sort_order).all()
    return jsonify([item.to_dict() for item in items])


@lists_bp.route("/<list_type>", methods=["POST"])
def add_item(list_type):
    """添加一项到列表"""
    if list_type not in VALID_TYPES:
        return jsonify({"error": f"无效类型: {list_type}"}), 400
    data = request.get_json(silent=True) or {}
    value = (data.get("value") or "").strip()
    if not value:
        return jsonify({"error": "value 不能为空"}), 400

    existing = CustomList.query.filter_by(list_type=list_type, value=value).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    max_order = db.session.query(db.func.max(CustomList.sort_order))\
        .filter_by(list_type=list_type).scalar() or 0
    item = CustomList(list_type=list_type, value=value, sort_order=max_order + 1)
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@lists_bp.route("/<list_type>/<int:item_id>", methods=["DELETE"])
def delete_item(list_type, item_id):
    """从列表中删除一项"""
    if list_type not in VALID_TYPES:
        return jsonify({"error": f"无效类型: {list_type}"}), 400
    item = db.session.get(CustomList, item_id)
    if not item or item.list_type != list_type:
        return jsonify({"error": "项不存在"}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "已删除"}), 200
