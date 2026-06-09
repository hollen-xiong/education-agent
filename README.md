# 教培助手 v3.1

面向教培老师的 AI 课后反馈生成器。输入学生信息、课堂内容和表现，自动生成真实老师风格的微信反馈文案。

## 功能

- **AI 生成反馈** — DeepSeek Chat API，模仿真实老师微信口吻
- **📋 批量模式** — 一次录入多位学生，并行生成所有反馈
- **3 种语气 × 2 种表达** — 鼓励/批评/平和 × 真实/生动
- **7 种二次修改** — 短一点/长一点/自然点/口语点/鼓励点/严厉点/加表情
- **学生记忆系统** — 拼音排序、下拉补全、学习历史
- **阶段成绩追踪** — 各学段成绩，含高中物理典型模板
- **历史去重** — 检测近期反馈避免重复表达
- **数据导入导出** — JSON 格式，含学生学习历史
- **SQLite 持久化** — 数据存服务器端，不丢失

## 快速开始

### 方式一：源码运行

```bash
pip install -r server/requirements.txt
python -m server.app
# 浏览器打开 http://127.0.0.1:5000
```

### 方式二：独立 exe（无需 Python）

从 [Releases](https://github.com/hollen-xiong/education-agent/releases) 下载 `jiaopei_zhushou_v3.1.exe`，双击运行后访问 `http://127.0.0.1:5000`。数据库自动保存在 exe 同目录的 `data/` 文件夹。

### 配置 API Key

点击右上角 ⚙️ **服务器设置** → 填入 DeepSeek API Key → 保存

> 获取 Key: [platform.deepseek.com](https://platform.deepseek.com)

## 批量模式

1. 点击 **📋 批量模式** 开关
2. **➕ 添加学生** 手动添加，或 **📋 从已保存学生加载** 从数据库导入
3. 填写公共的课堂内容、优缺点
4. 点击 **✨ 批量生成反馈（N名学生）**
5. 逐条查看和复制结果

## 技术栈

```
前端: HTML + CSS (变量体系) + Vanilla JS (8 模块)
后端: Python Flask + SQLAlchemy
数据库: SQLite (5 表)
AI:    DeepSeek Chat API
部署:  Waitress (exe) / PyInstaller 打包
```

## 项目结构

```
教培助手/
├── index.html                  # 前端页面
├── css/app.css                 # 样式（CSS 变量）
├── js/
│   ├── config.js               # 常量、默认数据、拼音字典、快速预设
│   ├── api-client.js           # HTTP API 客户端
│   ├── api.js                  # 生成流程编排
│   ├── prompts.js              # Prompt 构建 wrapper（调后端）
│   ├── postprocess.js          # 后处理与校验
│   ├── students.js             # 学生记忆系统
│   ├── ui.js                   # DOM 渲染、事件、批量模式
│   ├── app.js                  # 入口
│   └── storage.js              # 旧 localStorage 模块（不再加载）
├── run.py                      # PyInstaller 打包入口
├── 教培助手.spec                # PyInstaller 构建配置
├── server/
│   ├── app.py                  # Flask 入口 + CORS
│   ├── config.py               # 服务器配置
│   ├── database.py             # 数据库初始化 + 种子数据
│   ├── models.py               # 数据模型 (5 表)
│   ├── routes/
│   │   ├── __init__.py         # 蓝图注册
│   │   ├── students.py         # 学生 CRUD + 学习记录 + 导入导出
│   │   ├── lists.py            # 优点/缺点/建议/寄语
│   │   ├── feedback.py         # 反馈历史
│   │   ├── ai.py               # AI 生成代理（含批量生成）
│   │   └── settings.py         # 应用设置
│   ├── services/
│   │   ├── deepseek.py         # DeepSeek API 封装 + Key 验证
│   │   └── prompt_builder.py   # Prompt 模板构建（Python）
│   ├── requirements.txt
│   ├── start.bat / start.sh
│   └── data/                   # SQLite 数据库 (gitignore)
├── CLAUDE.md                   # 开发规范（AI 使用）
└── 正式版.html                  # 原始 v2.0 单文件（备份）
```

## 数据库表

| 表 | 用途 |
|----|------|
| `students` | 学生档案 (name, gender, grade, subject, notes, tags, stage_records) |
| `sessions` | 上课记录 (关联 student, date, knowledge, performance, correctness, feedback) |
| `custom_lists` | 优点/缺点/建议/寄语 |
| `feedback_history` | 反馈历史（去重用） |
| `settings` | 键值对（api_key 等） |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/students` | 学生列表（支持 ?search=） |
| POST | `/api/students` | 新增/更新学生 (upsert by name) |
| DELETE | `/api/students/<id>` | 删除学生 |
| GET | `/api/students/<id>/sessions` | 学习历史 |
| POST | `/api/students/<id>/sessions` | 添加学习记录 |
| GET | `/api/students/export` | 导出所有数据 |
| POST | `/api/students/import` | 导入数据 |
| GET | `/api/lists/<type>` | 获取列表 |
| POST | `/api/ai/generate` | AI 生成反馈 |
| POST | `/api/ai/generate-quick` | 快速生成 |
| POST | `/api/ai/batch-generate` | **批量生成**（最多5并发/20人） |
| POST | `/api/ai/revise` | 二次修改 |
| POST | `/api/ai/validate-key` | 验证 API Key |
| GET/PUT | `/api/settings` | 应用设置 |

## 打包

```bash
pyinstaller --clean --noconfirm 教培助手.spec
# 输出: dist/教培助手_v3.1.exe (~20MB)
```

## License

MIT
