"""
server/routes/students.py — 学生管理 API
"""
from flask import request, jsonify
from server.database import db
from server.models import Student, Session
from server.routes import students_bp


@students_bp.route("", methods=["GET"])
def list_students():
    """获取学生列表，支持搜索"""
    search = request.args.get("search", "").strip()
    query = Student.query
    if search:
        query = query.filter(Student.name.contains(search))
    students = query.order_by(Student.updated_at.desc()).limit(300).all()
    return jsonify([s.to_dict() for s in students])


@students_bp.route("/<int:student_id>", methods=["GET"])
def get_student(student_id):
    """获取单个学生详情（含学习历史）"""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({"error": "学生不存在"}), 404
    return jsonify(student.to_dict(include_sessions=True))


@students_bp.route("", methods=["POST"])
def upsert_student():
    """新增或更新学生（按 name 去重）"""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").replace(" ", "").strip()
    if not name:
        return jsonify({"error": "姓名不能为空"}), 400

    student = Student.query.filter_by(name=name).first()
    if student:
        # 更新
        student.gender = data.get("gender", student.gender)
        student.grade = data.get("grade", student.grade)
        student.subject = data.get("subject", student.subject)
        student.notes = data.get("notes", student.notes)
        if data.get("tags") is not None:
            student.tags = data["tags"]
    else:
        student = Student(
            name=name,
            gender=data.get("gender", "男"),
            grade=data.get("grade", "初中"),
            subject=data.get("subject", "数学"),
            notes=data.get("notes", ""),
            tags=data.get("tags", []),
        )
        db.session.add(student)

    db.session.commit()
    return jsonify(student.to_dict()), 200


@students_bp.route("/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    """删除学生及其所有学习记录"""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({"error": "学生不存在"}), 404
    db.session.delete(student)
    db.session.commit()
    return jsonify({"message": "已删除"}), 200


# ---- 学习记录 ----

@students_bp.route("/<int:student_id>/sessions", methods=["GET"])
def list_sessions(student_id):
    """获取学生学习历史"""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({"error": "学生不存在"}), 404
    sessions = student.sessions.order_by(Session.created_at.desc()).limit(50).all()
    return jsonify({
        "student": student.to_dict(),
        "sessions": [s.to_dict() for s in sessions],
        "count": len(sessions),
    })


@students_bp.route("/<int:student_id>/sessions", methods=["POST"])
def add_session(student_id):
    """添加一条学习记录"""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({"error": "学生不存在"}), 404

    data = request.get_json(silent=True) or {}
    session = Session(
        student_id=student_id,
        date=data.get("date", ""),
        knowledge=data.get("knowledge", ""),
        performance=data.get("performance", ""),
        highlights=data.get("highlights", []),
        weaknesses=data.get("weaknesses", []),
        correctness=data.get("correctness"),
        feedback=data.get("feedback", ""),
    )
    db.session.add(session)

    # 更新学生标签
    if data.get("tags"):
        existing_tags = set(student.tags)
        for t in data["tags"]:
            if t:
                existing_tags.add(t)
        student.tags = list(existing_tags)

    # 更新学生备注
    if data.get("notes"):
        student.notes = (student.notes + "；" + data["notes"]) if student.notes else data["notes"]

    db.session.commit()
    return jsonify(session.to_dict()), 201
