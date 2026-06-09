"""
server/database.py — 数据库初始化
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def init_db(app):
    """初始化数据库，创建所有表"""
    # 确保模型已导入
    import server.models  # noqa: F401
    db.init_app(app)
    with app.app_context():
        db.create_all()
        # 迁移：添加 stage_records 列（如果不存在）
        _migrate_add_column(app, "students", "stage_records", "TEXT DEFAULT '[]'")


def _migrate_add_column(app, table, column, col_def):
    """安全添加列——忽略已存在错误"""
    try:
        db.session.execute(
            db.text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
        )
        db.session.commit()
    except Exception:
        db.session.rollback()


def seed_defaults(app):
    """首次运行时写入默认数据到 custom_lists 和 settings"""
    from server.models import CustomList, Setting

    defaults = {
        "highlights": [
            "基础题型基本过关", "讲过的方法能用出来", "能独立完成中档题",
            "解题思路清晰，能讲出来", "带着问题来上课", "状态比之前好一些",
            "学习态度端正", "笔记整理得不错", "作业完成情况良好",
            "课上互动比较积极", "课堂专注度较好", "主动订正错题",
            "答题步骤比之前规范", "正确率较高"
        ],
        "weakpoints": [
            "基础知识点有遗忘", "讲过的题型还不能独立写出", "公式应用不熟",
            "做题正确率不稳定", "中难题需要提醒思路", "题目信息提取困难",
            "听懂了但是还是无法独自解题", "依赖老师提示", "计算容易出错",
            "审题不够细心", "解题步骤不够规范", "做题速度偏慢",
            "课后缺乏复习巩固", "错题未订正", "缺乏举一反三的能力",
            "作业完成度不达标", "有些自满", "不够自信",
            "课上互动不积极", "上课有些犯困"
        ],
        "suggestions": [
            "巩固基础概念", "强化计算能力", "突破中高难度题",
            "整理错题，自己总结方法", "注意休息，保证睡眠",
            "加强审题训练", "规范解题步骤", "按要求完成作业"
        ],
        "encouragements": [
            "学生课上表现一般，课后要多下功夫。",
            "整体状态还可以，后面继续保持。",
            "继续努力，慢慢来，一步一步把问题解决。",
            "总体而言有进步，继续往前走。",
            "课后要认真完成老师布置的任务，不要松懈。",
            "这节课状态是可以的，后面保持住。"
        ]
    }

    with app.app_context():
        for list_type, items in defaults.items():
            existing = CustomList.query.filter_by(list_type=list_type).count()
            if existing == 0:
                for i, item in enumerate(items):
                    db.session.add(CustomList(list_type=list_type, value=item, sort_order=i))

        # 默认设置
        if not Setting.query.get("greeting_enabled"):
            db.session.add(Setting(key="greeting_enabled", value="true"))
        if not Setting.query.get("greeting_target"):
            db.session.add(Setting(key="greeting_target", value="家长"))

        db.session.commit()
