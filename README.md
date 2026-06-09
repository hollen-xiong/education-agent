# 教培助手 v3.0

面向教培老师的 AI 课后反馈生成器。输入学生信息、课堂内容和表现，自动生成真实老师风格的微信反馈文案。

## 功能

- **AI 生成反馈** — 基于 DeepSeek Chat API，模仿真实老师微信口吻
- **3 种语气 × 2 种表达** — 鼓励/批评/平和 × 真实/生动
- **7 种二次修改** — 短一点/长一点/自然点/口语点/鼓励点/严厉点/加表情
- **学生记忆系统** — 拼音排序、下拉补全、学习历史
- **阶段成绩追踪** — 记录各学段成绩和薄弱点
- **历史去重** — 检测近期反馈避免重复表达
- **数据导入导出** — JSON 格式，支持迁移和备份
- **SQLite 持久化** — 数据存服务器端，不丢失

## 技术栈

```
前端: HTML + CSS + Vanilla JS (8 模块)
后端: Python Flask + SQLAlchemy
数据库: SQLite
AI: DeepSeek Chat API
部署: Waitress (Windows) / Gunicorn (Linux)
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r server/requirements.txt
```

### 2. 启动服务端

```bash
python -m server.app
```

### 3. 打开浏览器

访问 **http://127.0.0.1:5000**

### 4. 配置 API Key

点击右上角 ⚙️ 服务器设置 → 填入 DeepSeek API Key → 保存

> 获取 Key: [platform.deepseek.com](https://platform.deepseek.com)

## 项目结构

```
教培助手/
├── index.html               # 前端页面
├── css/app.css              # 样式
├── js/
│   ├── config.js            # 常量与默认数据
│   ├── api-client.js        # HTTP API 客户端
│   ├── api.js               # 生成流程编排
│   ├── prompts.js           # Prompt 构建 wrapper
│   ├── postprocess.js       # 后处理与校验
│   ├── students.js          # 学生记忆系统
│   ├── ui.js                # DOM 渲染与事件
│   └── app.js               # 入口
├── server/
│   ├── app.py               # Flask 入口
│   ├── config.py            # 服务器配置
│   ├── database.py          # 数据库初始化
│   ├── models.py            # 数据模型 (5 表)
│   ├── routes/
│   │   ├── students.py      # 学生 CRUD + 学习记录
│   │   ├── lists.py         # 优点/缺点/建议/寄语
│   │   ├── feedback.py      # 反馈历史
│   │   ├── ai.py            # AI 生成代理
│   │   └── settings.py      # 应用设置
│   ├── services/
│   │   ├── deepseek.py      # DeepSeek API 封装
│   │   └── prompt_builder.py # Prompt 模板构建
│   ├── requirements.txt
│   ├── start.bat            # Windows 启动
│   └── start.sh             # Linux/Mac 启动
└── 正式版.html               # 原始单文件版（备份）
```

## 数据库表

| 表名 | 用途 |
|------|------|
| `students` | 学生档案 (name, gender, grade, subject, notes, tags, stage_records) |
| `sessions` | 上课记录 (关联 student, date, knowledge, performance, correctness, feedback) |
| `custom_lists` | 优点/缺点/建议/寄语 |
| `feedback_history` | 反馈历史（去重用） |
| `settings` | 键值对设置（api_key 等） |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/students` | 学生列表 |
| POST | `/api/students` | 新增/更新学生 |
| GET | `/api/students/<id>/sessions` | 学习历史 |
| GET | `/api/lists/<type>` | 优点/缺点/建议/寄语 |
| GET | `/api/feedback/history` | 反馈历史 |
| POST | `/api/ai/generate` | AI 生成反馈 |
| POST | `/api/ai/revise` | 二次修改 |
| GET/PUT | `/api/settings` | 应用设置 |

## License

MIT
