"""
server/routes/settings.py — 应用设置 API
"""
from flask import request, jsonify
from server.database import db
from server.models import Setting
from server.routes import settings_bp


@settings_bp.route("", methods=["GET"])
def get_settings():
    """获取所有设置"""
    settings = Setting.query.all()
    return jsonify({s.key: s.value for s in settings})


@settings_bp.route("", methods=["PUT"])
def update_settings():
    """更新设置（键值对批量更新）"""
    data = request.get_json(silent=True) or {}
    updated = []
    for key, value in data.items():
        setting = Setting.query.get(key)
        if setting:
            setting.value = str(value)
        else:
            setting = Setting(key=key, value=str(value))
            db.session.add(setting)
        updated.append(key)
    db.session.commit()
    return jsonify({"updated": updated, "message": "设置已保存"}), 200
