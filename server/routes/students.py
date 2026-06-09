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
        if data.get("stage_records") is not None:
            student.stage_records = data["stage_records"]
    else:
        student = Student(
            name=name,
            gender=data.get("gender", "男"),
            grade=data.get("grade", "初中"),
            subject=data.get("subject", "数学"),
            notes=data.get("notes", ""),
            tags=data.get("tags", []),
            stage_records=data.get("stage_records", []),
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


# ---- 导入导出 ----

@students_bp.route("/export", methods=["GET"])
def export_all():
    """导出所有学生数据（含学习记录）为 JSON"""
    from flask import Response
    students = Student.query.order_by(Student.name).all()
    data = {
        "version": "3.0",
        "exported_at": __import__("datetime").datetime.now().isoformat(),
        "students": [s.to_dict(include_sessions=True) for s in students],
    }
    return Response(
        __import__("json").dumps(data, ensure_ascii=False, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=jiaopei_export.json"}
    )


@students_bp.route("/import", methods=["POST"])
def import_all():
    """导入学生数据——合并模式（同名覆盖，新名追加）"""
    data = request.get_json(silent=True) or {}
    imported = data.get("students", [])
    if not isinstance(imported, list):
        return jsonify({"error": "格式不正确：students 应为数组"}), 400

    created = 0
    updated = 0
    for item in imported:
        name = (item.get("name") or "").replace(" ", "").strip()
        if not name:
            continue
        student = Student.query.filter_by(name=name).first()
        if student:
            # 更新基本信息
            student.gender = item.get("gender", student.gender)
            student.grade = item.get("grade", student.grade)
            student.subject = item.get("subject", student.subject)
            student.notes = item.get("notes", student.notes)
            if item.get("tags") is not None:
                student.tags = item["tags"]
            if item.get("stage_records") is not None:
                student.stage_records = item["stage_records"]
            updated += 1
        else:
            student = Student(
                name=name,
                gender=item.get("gender", "男"),
                grade=item.get("grade", "初中"),
                subject=item.get("subject", "数学"),
                notes=item.get("notes", ""),
                tags=item.get("tags", []),
                stage_records=item.get("stage_records", []),
            )
            db.session.add(student)
            created += 1

        # 导入 sessions
        sessions_data = item.get("sessions", [])
        if isinstance(sessions_data, list) and sessions_data:
            for sd in sessions_data:
                existing = Session.query.filter_by(
                    student_id=student.id,
                    date=sd.get("date", ""),
                    knowledge=sd.get("knowledge", ""),
                ).first()
                if not existing:
                    s = Session(
                        student_id=student.id,
                        date=sd.get("date", ""),
                        knowledge=sd.get("knowledge", ""),
                        performance=sd.get("performance", ""),
                        highlights=sd.get("highlights", []),
                        weaknesses=sd.get("weaknesses", []),
                        correctness=sd.get("correctness"),
                        feedback=sd.get("feedback", ""),
                    )
                    db.session.add(s)

    db.session.commit()
    return jsonify({
        "message": f"导入完成：新增 {created} 名学生，更新 {updated} 名",
        "created": created,
        "updated": updated,
    }), 200
