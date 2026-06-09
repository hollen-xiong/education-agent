# 教培助手 · CLAUDE.md

## 项目概述

**教培助手** 是一个面向教培老师的课后反馈生成工具，通过 DeepSeek API 自动生成真实老师风格的微信反馈文案。当前为 Flask + 前端模块化架构。

- **当前版本：** v3.1
- **API：** DeepSeek Chat API (`deepseek-chat`)
- **运行方式：** `python -m server.app`（或双击 `jiaopei_zhushou_v3.1.exe`）
- **数据存储：** SQLite（服务器端持久化）
- **部署：** Flask + Waitress + PyInstaller 打包

---

## 文件结构

```
教培助手/
├── index.html                    # 前端页面
├── css/app.css                   # 样式表（CSS 变量体系）
├── js/
│   ├── config.js                 # 常量、默认数据、拼音字典、快速预设
│   ├── api-client.js             # HTTP API 客户端（替代 localStorage）
│   ├── api.js                    # 生成流程编排
│   ├── prompts.js                # Prompt 构建 wrapper（调后端）
│   ├── postprocess.js            # 后处理与校验
│   ├── students.js               # 学生记忆系统
│   ├── ui.js                     # DOM 渲染、事件、批量模式
│   ├── app.js                    # 入口
│   └── storage.js                # 旧 localStorage 模块（不再加载）
├── run.py                        # PyInstaller 打包入口
├── 教培助手.spec                  # PyInstaller 配置
├── server/
│   ├── app.py                    # Flask 入口 + CORS + 静态文件
│   ├── config.py                 # 服务器配置（DB路径、API URL）
│   ├── database.py               # 数据库初始化 + 种子数据
│   ├── models.py                 # 5 张表：Student, Session, CustomList, FeedbackHistory, Setting
│   ├── routes/
│   │   ├── __init__.py           # 蓝图注册
│   │   ├── students.py           # 学生 CRUD + 学习记录 + 导入导出
│   │   ├── lists.py              # 优点/缺点/建议/寄语
│   │   ├── feedback.py           # 反馈历史
│   │   ├── ai.py                 # AI 生成代理（含批量生成）
│   │   └── settings.py           # 应用设置
│   ├── services/
│   │   ├── deepseek.py           # DeepSeek API 封装 + Key 验证
│   │   └── prompt_builder.py     # Prompt 模板构建（Python，所有中文引号无问题）
│   ├── requirements.txt
│   ├── start.bat / start.sh
│   └── data/                     # SQLite 数据库（gitignore）
├── 正式版.html                    # 原始 v2.0 单文件（备份，不再使用）
└── CLAUDE.md                     # 本文档
```

---

## 功能清单（v3.1）

| 功能 | 说明 |
|------|------|
| 学生信息 | 姓名/性别/年级/科目，记忆 + 下拉补全 + 拼音排序 |
| 阶段成绩 | 各学段成绩记录，支持可视化 |
| 本节课内容 | 日期、核心知识点 |
| 学生优点/缺点 | 多选 checkbox，含物理学科专用条目 |
| 选填补充 | 作业、真实情况(4条)、正确率滑块 |
| 高级选项 | 下次课关注点、寄语、改进建议 |
| 问候语 | 启用/关闭，选择称呼(爸爸/妈妈/家长)和时间 |
| 参数控制 | 字数档位、真实/生动模式、鼓励/批评/平和 |
| 一键生成 | 调用后端 DeepSeek API 生成反馈 |
| 快速生成 | 按学生类型+方向快速生成（含物理4种类型） |
| **批量模式** | 一次录入多位学生，并行生成所有反馈 |
| 二次修改 | 短一点/长一点/自然点/口语点/鼓励点/严厉点/加表情 |
| 历史去重 | 短语频率 + 句子相似度检测 |
| 后处理 | 生硬表达替换、段落去重、作业行修复 |
| 复制 | 一键复制反馈 / 批量逐条复制 |
| 导入导出 | JSON 格式，含学生学习历史 |
| API Key 管理 | 服务器端存储 + 在线验证 |
| PyInstaller | 打包为独立 exe，双击运行 |

---

## 数据库表

| 表 | 用途 |
|----|------|
| `students` | 学生档案 (name, gender, grade, subject, notes, tags, stage_records) |
| `sessions` | 上课记录 (关联 student, date, knowledge, performance, correctness, feedback) |
| `custom_lists` | 优点/缺点/建议/寄语 |
| `feedback_history` | 反馈历史（去重用） |
| `settings` | 键值对（api_key 等） |

---

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
| POST | `/api/ai/batch-generate` | **批量生成**（ThreadPoolExecutor，最多5并发/20人） |
| POST | `/api/ai/revise` | 二次修改 |
| POST | `/api/ai/validate-key` | 验证 API Key |
| GET/PUT | `/api/settings` | 应用设置 |

---

## 开发规范

### 命名约定
- **SQLite 列名 / JSON 字段：** snake_case，如 `student_name`、`stage_records`
- **CSS class：** kebab-case，如 `.card-header`、`.batch-progress-bar`
- **JS 函数：** camelCase，如 `getFormData()`、`onBatchGenerate()`
- **JS 常量：** UPPER_SNAKE_CASE，如 `MODULE.DEFAULT_HIGHLIGHTS`
- **DOM ID：** camelCase，如 `generateBtn`、`batchStudentTable`
- **Python 函数：** snake_case，如 `build_messages()`、`validate_api_key()`

### 关键入口点
- **前端数据收集：** `ui.js → MODULE.getFormData()`
- **Prompt 构建：** `server/services/prompt_builder.py → build_messages()`
- **API 调用：** `server/services/deepseek.py → call_deepseek()`
- **后处理：** `js/postprocess.js → PP.process() / PP.validate()`
- **批量生成：** `js/ui.js → onBatchGenerate()` → `api-client.js → batchGenerate()` → `server/routes/ai.py → batch_generate()`

### Prompt 修改原则
- 所有 prompt 模板在 `server/services/prompt_builder.py`
- 修改 Prompt 后测试 3 语气 × 2 表达 = 6 种组合
- 生硬表达替换表在 `postprocess.js` 的 `polishAwkwardPhrases()`
- 字数范围在 `config.js` 的 `getWordCountRange()` 和后端 `prompt_builder.py` 中需同步

### 打包
```bash
pyinstaller --clean --noconfirm 教培助手.spec
# 输出: dist/教培助手_v3.1.exe (~20MB)
```
- 数据库自动保存在 exe 同目录的 `data/` 文件夹
- 打包后 `sys.frozen = True`，`sys._MEIPASS` 是 bundle 目录

---

## 技术债务

| 债务 | 严重度 | 说明 |
|------|--------|------|
| 拼音字典硬编码 | 中 | 400+ 姓氏在 config.js |
| storage.js 残留 | 低 | 旧 localStorage 模块未删除（已不加载） |
| 批量进度非实时 | 低 | 批量生成等待后端全部完成后才更新 UI |

---

## v3.2 待办（按优先级）

- [ ] 多模型支持（切换 DeepSeek/GLM/Qwen）
- [ ] 反馈模板保存（优点+缺点组合一键载入）
- [ ] 暗色模式（利用现有 CSS 变量体系）
- [ ] Ctrl+Enter 快捷键生成
- [ ] 反馈导出为 PDF/CSV
- [ ] PWA 离线支持

---

> **本文档更新于 2026-06-09，对应 v3.1（批量模式 + 物理模板 + PyInstaller 打包）**

---

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
