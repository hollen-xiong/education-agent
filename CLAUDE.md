# CLAUDE.md — 教培助手 开发规范

> 项目文档（架构、API、功能）见 [README.md](README.md)

## 命名约定

| 层 | 风格 | 示例 |
|----|------|------|
| SQLite 列 / JSON 字段 | snake_case | `student_name`, `stage_records` |
| CSS class | kebab-case | `.card-header`, `.batch-progress-bar` |
| JS 函数 / 变量 | camelCase | `getFormData()`, `batchStudents` |
| JS 模块常量 | UPPER_SNAKE_CASE | `MODULE.DEFAULT_HIGHLIGHTS` |
| DOM ID | camelCase | `generateBtn`, `batchStudentTable` |
| Python 函数 | snake_case | `build_messages()`, `validate_api_key()` |

## 关键入口点

- **前端数据收集：** `js/ui.js` → `MODULE.getFormData()`
- **Prompt 构建：** `server/services/prompt_builder.py` → `build_messages(formData)`
- **API 调用：** `server/services/deepseek.py` → `call_deepseek(api_key, messages, temperature)`
- **后处理：** `js/postprocess.js` → `PP.process()` / `PP.validate()`
- **批量生成：** `js/ui.js` → `onBatchGenerate()` → `api-client.js` → `batchGenerate()` → `server/routes/ai.py` → `batch_generate()`

## 新增功能 checklist

1. `js/ui.js` — `getFormData()` 收集新字段
2. `server/services/prompt_builder.py` — `build_messages()` 构建对应 prompt
3. `js/postprocess.js` — `validate()` 校验 / `process()` 后处理（如需）
4. `server/routes/ai.py` — 新端点（如需）
5. `js/api-client.js` — 新 API 方法（如需）
6. `index.html` — UI 元素

## Prompt 修改原则

- 所有 prompt 在 `server/services/prompt_builder.py`
- 修改后测试 3 语气 × 2 表达 = 6 种组合
- 生硬表达替换表在 `js/postprocess.js` 的 `polishAwkwardPhrases()`
- 字数范围需前后端同步：`js/prompts.js` → `getWordCountRange()` 和 `prompt_builder.py`

## 技术债务

| 债务 | 说明 |
|------|------|
| 拼音字典硬编码 | 400+ 姓氏在 `js/config.js` |
| storage.js 残留 | 旧 localStorage 模块未删除（已不加载） |
| 批量进度非实时 | 等待后端全部完成才更新 UI |

## v3.2 待办

- [ ] 多模型支持（DeepSeek/GLM/Qwen）
- [ ] 反馈模板保存
- [ ] 暗色模式
- [ ] Ctrl+Enter 快捷键
- [ ] 反馈导出 PDF/CSV
- [ ] PWA 离线支持

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
