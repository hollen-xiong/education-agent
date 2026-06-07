"""
server/models.py — SQLAlchemy 数据模型
"""
import json
from datetime import datetime, timezone
from server.database import db


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False, index=True)
    gender = db.Column(db.String(4), default="男")
    grade = db.Column(db.String(10), default="初中")
    subject = db.Column(db.String(10), default="数学")
    notes = db.Column(db.Text, default="")
    _tags = db.Column("tags", db.Text, default="[]")

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    sessions = db.relationship("Session", backref="student", lazy="dynamic",
                               cascade="all, delete-orphan", order_by="Session.created_at.desc()")

    @property
    def tags(self):
        try:
            return json.loads(self._tags or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @tags.setter
    def tags(self, value):
        self._tags = json.dumps(value or [], ensure_ascii=False)

    def to_dict(self, include_sessions=False):
        result = {
            "id": self.id,
            "name": self.name,
            "gender": self.gender,
            "grade": self.grade,
            "subject": self.subject,
            "notes": self.notes,
            "tags": self.tags,
            "session_count": self.sessions.count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sessions:
            result["sessions"] = [s.to_dict() for s in self.sessions.limit(50).all()]
        return result


class Session(db.Model):
    __tablename__ = "sessions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    date = db.Column(db.String(20))
    knowledge = db.Column(db.Text)
    performance = db.Column(db.Text)
    _highlights = db.Column("highlights", db.Text, default="[]")
    _weaknesses = db.Column("weaknesses", db.Text, default="[]")
    correctness = db.Column(db.Integer)
    feedback = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def highlights(self):
        try:
            return json.loads(self._highlights or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @highlights.setter
    def highlights(self, value):
        self._highlights = json.dumps(value or [], ensure_ascii=False)

    @property
    def weaknesses(self):
        try:
            return json.loads(self._weaknesses or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @weaknesses.setter
    def weaknesses(self, value):
        self._weaknesses = json.dumps(value or [], ensure_ascii=False)

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "date": self.date,
            "knowledge": self.knowledge,
            "performance": self.performance,
            "highlights": self.highlights,
            "weaknesses": self.weaknesses,
            "correctness": self.correctness,
            "feedback": self.feedback,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CustomList(db.Model):
    __tablename__ = "custom_lists"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    list_type = db.Column(db.String(20), nullable=False, index=True)
    value = db.Column(db.Text, nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (db.UniqueConstraint("list_type", "value"),)

    def to_dict(self):
        return {
            "id": self.id,
            "list_type": self.list_type,
            "value": self.value,
            "sort_order": self.sort_order,
        }


class FeedbackHistory(db.Model):
    __tablename__ = "feedback_history"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_name = db.Column(db.String(50))
    subject = db.Column(db.String(10))
    tone = db.Column(db.String(20))
    _scenes = db.Column("scenes", db.Text, default="[]")
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def scenes(self):
        try:
            return json.loads(self._scenes or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @scenes.setter
    def scenes(self, value):
        self._scenes = json.dumps(value or [], ensure_ascii=False)

    def to_dict(self):
        return {
            "id": self.id,
            "student_name": self.student_name,
            "subject": self.subject,
            "tone": self.tone,
            "scenes": self.scenes,
            "text": self.text,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Setting(db.Model):
    __tablename__ = "settings"

    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {"key": self.key, "value": self.value}
