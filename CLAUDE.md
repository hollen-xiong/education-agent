# 教培助手 · CLAUDE.md

## 项目概述

**教培助手** 是一个面向教培老师的课后反馈生成工具，通过 DeepSeek API（deepseek-chat）自动生成真实老师风格的微信反馈文案。当前为单文件 HTML 应用（`正式版.html`，约 200KB / 3440 行），无需构建工具，直接在浏览器中打开使用。

- **当前版本：** 正式版 2.0
- **API：** DeepSeek Chat API (`deepseek-chat`)
- **运行方式：** 纯静态 HTML，浏览器直接打开
- **数据存储：** localStorage（无后端）

---

## 文件结构

```
教培助手/
├── 正式版.html                    # 主应用（单文件）
├── 正式版_backup_20250607.html    # 2025-06-07 备份
└── CLAUDE.md                      # 本文档
```

---

## 功能清单

| 功能模块 | 描述 | 涉及代码行 |
|---------|------|-----------|
| ① 学生信息 | 姓名、性别、年级、科目，支持记忆和下拉补全 | L744-791, L1020-1448 |
| ② 本节课内容 | 日期、核心知识点输入 | L794-832 |
| ③ 学生优点 | 多选 checkbox，可自定义添加 | L835-843, L1461-1474 |
| ④ 学生缺点 | 多选 checkbox，可自定义添加 | L846-854, L1475-1488 |
| ⑤ 选填补充 | 作业布置、真实情况记录(4条)、正确率滑块 | L858-892, L1541-1546 |
| 高级选项 | 下次课关注点、寄语、改进意见 | L894-931, L1489-1524 |
| 问候语控制 | 启用/关闭问候语，选择称呼和时间 | L936-953, L3399-3420 |
| 字数/表达/语气 | 字数档位、真实/生动模式、鼓励/批评/平和 | L954-975, L1552-1898 |
| 一键生成 | 调用 DeepSeek API 生成反馈 | L979-980, L3346-3393 |
| 快速生成 | 按学生类型+方向快速生成 | L808-830, L2044-2215 |
| 二次修改 | 短一点/长一点/自然点/口语点/鼓励点/严厉点/加表情 | L981-989, L3167-3344 |
| 历史去重 | 基于短语频率和句子相似度的重复检测 | L1703-1829 |
| 场景识别 | 从关键词自动推断教学场景 | L2226-2274 |
| 后处理 | 生硬表达替换、段落去重、作业行修复 | L2734-2884 |
| 校验 | 结构完整性、字数、人称、语气、作业格式 | L2928-2977 |
| 复制 | 一键复制反馈内容 | L998, L3395 |

---

## 代码架构（当前）

```
正式版.html
├── <style> (L7-726)        — CSS (~720行)，内联样式
├── <body> (L728-1006)      — HTML 结构 (~280行)
└── <script> (L1008-3437)   — JavaScript (~2430行)，包含：
    ├── 常量定义 (L1009-1116)       — localStorage key、默认数据、拼音字典
    ├── 学生记忆系统 (L1118-1448)    — 姓名存储、拼音排序、下拉UI
    ├── 列表渲染 (L1450-1540)        — 优点/缺点/建议/寄语的 checkbox 渲染
    ├── Prompt 构建 (L1552-2453)     — 系统提示词/用户提示词生成
    ├── 后处理 (L2455-2884)          — 文本清洗、生硬表达替换
    ├── 校验 (L2897-2977)            — 反馈质量检查
    ├── API 调用 (L2718-2732)        — DeepSeek fetch 封装
    ├── 生成流程 (L2979-3016)        — 带重试的生成 pipeline
    ├── 快速生成 (L2044-2215)        — 快捷模式
    ├── 二次修改 (L3167-3344)        — 改写按钮逻辑
    └── 初始化 (L3422-3437)          — init() 入口
```

---

## 优化方案（按优先级排列）

### 🔴 CRITICAL（安全 / 数据风险）

#### C1. API Key 明文存储 → 加密存储
- **位置：** L1013, L3397-3398
- **问题：** API Key 以明文存储在 localStorage，任何能访问该浏览器的人都可以通过 DevTools 读取
- **方案：** 使用 Web Crypto API 进行简单加密（或至少 base64 混淆 + 用户设定解锁密码）
- **风险：** 低（向后兼容，需要迁移逻辑）
- **工作量：** M

#### C2. 添加 API Key 有效性校验
- **位置：** L2718-2732
- **问题：** 仅在调用失败时才知道 Key 无效，没有预校验
- **方案：** 保存 Key 时发送一个轻量请求验证 Key 有效性
- **风险：** 低
- **工作量：** S

#### C3. localStorage 容量溢出保护
- **位置：** L1175-1211, L1703-1726
- **问题：** 学生记忆上限 300、历史上限 12，但没有 catch localStorage 满的情况
- **方案：** 在 setItem 时 try/catch QuotaExceededError，提示用户清理旧数据
- **风险：** 低
- **工作量：** S

---

### 🟠 HIGH（可维护性 / 性能）

#### H1. 代码拆分与模块化
- **位置：** 整个 `<script>` 块（L1008-3437）
- **问题：** 2430 行单一脚本块，缺乏模块边界，依赖全局变量，难以测试和复用
- **方案：**
  ```
  阶段1: 拆分为独立 .js 文件（不引入构建工具）
    - storage.js      — localStorage 读写
    - students.js     — 学生记忆系统
    - prompts.js      — Prompt 构建
    - postprocess.js  — 后处理和校验
    - api.js          — DeepSeek API 封装
    - ui.js           — DOM 渲染和事件
    - app.js          — 主流程和初始化
  
  阶段2: 引入 ES modules + 简单打包（Vite/esbuild）
  ```
- **风险：** 中（需要仔细测试所有交互路径）
- **工作量：** XL

#### H2. 巨型拼音字典外部化
- **位置：** L1020-1058（STUDENT_SURNAME_PINYIN + STUDENT_COMPOUND_SURNAME_PINYIN）
- **问题：** 400+ 姓氏拼音映射硬编码在 JS 中，占用约 3KB，增加解析开销
- **方案：** 移至独立 JSON 文件，按需加载；或使用 Intl.Collator 完全替代自建字典
- **风险：** 低
- **工作量：** S

#### H3. Prompt 模板化与可配置
- **位置：** L1552-2453（约 900 行 prompt 构建逻辑）
- **问题：** Prompt 与 JS 代码深度耦合，修改提示词需要改 JS 代码；难以做 A/B 测试
- **方案：** 将 prompt 模板抽到独立配置对象或 JSON 文件，支持变量插值
- **风险：** 中
- **工作量：** L

#### H4. 减少 DOM 直接操作，引入简单状态管理
- **位置：** 遍布整个脚本
- **问题：** 大量 `document.getElementById` 调用，状态散落在 DOM 属性中（如 `lastGeneratedFormData` 已是全局变量但不完整）
- **方案：** 使用简单的 pub/sub 或 Proxy-based 状态对象，UI 渲染函数从状态派生
- **风险：** 中
- **工作量：** L

#### H5. CSS 重构 — 减少重复，引入 CSS 变量
- **位置：** L7-726
- **问题：** 颜色值（#3b82f6, #eef4ff 等）在 CSS 和 JS 中多次硬编码；`.tone-option`/`.temp-option`/`.radio-option` 样式几乎相同
- **方案：**
  - 用 CSS 自定义属性统一颜色/圆角/间距
  - 合并 `.radio-option`、`.checkbox-option`、`.tone-option`、`.temp-option` 为通用 `.selectable-chip`
- **风险：** 低
- **工作量：** M

---

### 🟡 MEDIUM（UX 改进 / 代码质量）

#### M1. 加载状态与骨架屏
- **问题：** API 调用期间只有文字提示"正在调用AI生成反馈..."，用户等待体验差
- **方案：** 添加简单的加载动画或骨架屏，显示预估等待时间
- **工作量：** S

#### M2. 错误信息中文化与友好化
- **位置：** L2730, L3387, L3395
- **问题：** 部分错误信息是英文（`API错误(500)`），用户难以理解
- **方案：** 建立错误码→中文提示映射表（如 429→"请求太频繁，请稍后重试"）
- **工作量：** S

#### M3. localStorage 版本迁移机制
- **位置：** L1009-1016
- **问题：** Key 后缀已有 v12/v14/v16 版本号，但没有自动迁移逻辑（旧版数据会丢失）
- **方案：** 添加 `MIGRATION_MAP`，在 `init()` 时自动将旧 key 数据迁移到新 key
- **工作量：** M

#### M4. 键盘快捷键
- **问题：** 纯鼠标操作，熟练用户效率低
- **方案：** 添加 Ctrl+Enter 生成、Ctrl+Shift+C 复制等快捷键
- **工作量：** S

#### M5. 响应式优化 — 移动端体验
- **位置：** L528-557（仅 30 行 media query）
- **问题：** 在手机上卡片 padding 偏大，按钮文字可能溢出
- **方案：** 增加更多断点（如 768px 平板），优化触控目标大小（至少 44px）
- **工作量：** M

#### M6. 正文字数统计实时预览
- **问题：** 可编辑的反馈区域没有实时字数统计
- **方案：** 在结果卡片旁添加实时字数显示（“当前 287 字”）
- **工作量：** S

---

### 🟢 LOW（锦上添花）

#### L1. PWA 支持
- **方案：** 添加 manifest.json + Service Worker，让应用可离线使用基础功能
- **工作量：** M

#### L2. 暗色模式
- **方案：** 利用 CSS 变量体系，添加 `prefers-color-scheme: dark` 适配
- **工作量：** M

#### L3. 多模型支持
- **位置：** L1018, L2718-2732
- **问题：** 仅支持 deepseek-chat
- **方案：** 添加模型选择器，支持 DeepSeek/GLM/Qwen 等多个兼容 OpenAI 接口的模型
- **工作量：** L

#### L4. 反馈模板保存
- **方案：** 用户可以将常用的优点+缺点组合保存为"模板"，一键载入
- **工作量：** M

#### L5. 导出功能
- **方案：** 支持将历史反馈导出为 CSV/PDF
- **工作量：** M

#### L6. 使用统计
- **方案：** 记录生成了多少条反馈、消耗了多少 token，提供简单的统计面板
- **工作量：** S

---

## 版本路线图

### v2.1（近期维护，1-2 周）
```
目标：修 bug + 关键安全改进
- [ ] C1: API Key 加密存储
- [ ] C2: API Key 有效性预校验
- [ ] C3: localStorage 溢出保护
- [ ] M2: 错误信息中文化
- [ ] M6: 实时字数统计
- [ ] M4: 键盘快捷键
```

### v2.2（代码质量，2-4 周）
```
目标：不改变功能，提升代码可维护性
- [ ] H2: 拼音字典外部化
- [ ] H5: CSS 重构（变量 + 合并选择器）
- [ ] M3: localStorage 版本迁移
- [ ] M5: 响应式优化
```

### v3.0（架构升级，4-8 周）
```
目标：模块化拆分，引入构建工具
- [ ] H1: 代码拆分（storage / students / prompts / postprocess / api / ui / app）
- [ ] H3: Prompt 模板化
- [ ] H4: 简单状态管理
- [ ] 引入 Vite + ES modules
- [ ] 添加 ESLint + Prettier
```

### v3.1（功能增强，后续）
```
目标：新功能
- [ ] L3: 多模型支持
- [ ] L4: 反馈模板保存
- [ ] L5: 导出功能
- [ ] L1: PWA 支持
- [ ] L2: 暗色模式
- [ ] L6: 使用统计
```

---

## 开发规范

### 命名约定
- **localStorage key：** `feedback_{功能描述}_v{版本号}` 格式，如 `feedback_advantages_v16_common_final`
- **CSS class：** kebab-case，如 `.card-header`、`.editable-feedback`
- **JS 函数：** camelCase，如 `buildFactPrompt()`、`getStudentProfiles()`
- **JS 常量：** UPPER_SNAKE_CASE，如 `STORAGE_HIGHLIGHTS`、`HISTORY_LIMIT`
- **DOM ID：** camelCase，如 `apiKeyInput`、`generateBtn`

### 新增功能 checklist
1. 在 `getFormData()` 中收集新字段
2. 在 `buildInitialMessages()` 中构建对应的 prompt
3. 在 `validateFeedback()` 中添加对应校验
4. 在 `postProcessFeedback()` 中添加对应后处理（如需）
5. 更新 `inferSceneTags()` 的场景识别（如需）
6. 在 `buildRevisionMessages()` 中考虑二次修改兼容

### Prompt 修改原则
- 所有 prompt 修改必须在 `buildInitialMessages()` 或相关函数中进行
- 修改 Prompt 后必须测试 3 种语气 × 2 种表达模式 = 6 种组合
- 新增 "禁止项" 要同时添加到 `polishAwkwardPhrases()` 和 `hasStiffExpression()` 中
- 修改字数范围需同步更新 `getWordCountRange()` 和 `buildInitialMessages()` 中的约束文本

### localStorage 数据迁移
修改 localStorage key 时：
1. 定义新的 `STORAGE_XXX` 常量
2. 在 `init()` 中添加迁移代码：`if (localStorage.getItem(OLD_KEY)) { migrate(OLD_KEY, NEW_KEY); }`
3. 保留旧 key 至少一个版本周期，不要立即删除

### 测试要点
- 至少测试：无问候语模式、有问候语模式、有作业/无作业、快速生成、二次修改各类型、空必填项提交
- 关注边界：极长学生姓名、特殊字符、空真实记录、正确率 0%/100%

---

## 技术债务记录

| 债务 | 严重度 | 位置 | 说明 |
|------|--------|------|------|
| 单文件巨型脚本 | 高 | L1008-3437 | 2430 行 JS 难以维护 |
| 拼音字典硬编码 | 中 | L1020-1058 | ~400 行姓氏数据 |
| 重复的渲染函数 | 中 | L1461-1524 | renderHighlights/WeakPoints/Suggestions/Encouragements 结构雷同 |
| Prompt 硬编码 | 中 | L1552-2453 | ~900 行 prompt 模板嵌在 JS 中 |
| 生硬表达替换表过大 | 中 | L2812-2872 | 60+ 条正则替换规则 |
| CSS 颜色值分散 | 低 | 全局 | 主色 #3b82f6 硬编码 30+ 处 |
| 无离线能力 | 低 | 全局 | 断网后完全不可用 |

---

## API 参考

### DeepSeek API 调用封装
```javascript
// L2718-2732
async function callDeepSeek(apiKey, messages, temperature)
// → fetch POST https://api.deepseek.com/v1/chat/completions
// model: deepseek-chat, max_tokens: 2000
```

### 温度参数
```javascript
// L1552-1557
真实模式: [firstTemp=0.42, retryTemp=0.32]
生动模式: [firstTemp=0.62, retryTemp=0.46]
二次修改: 固定 0.35
快速生成: [first=0.55, retry=0.38]
```

### 重试逻辑
```javascript
// L2979-3016 generateFeedbackWithDeepSeek: 最多 3 次
// L2132-2158 quickGenerate: 最多 2 次
// 每次重试降低温度，并附加校验失败原因到 messages
```

---

> **本文档更新于 2025-06-07，对应 正式版_backup_20250607.html**
