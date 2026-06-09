"""
Prompt 构建——在 Python 后端处理，彻底解决 JS Unicode 引号冲突问题
"""
import json
import random
from server.database import db
from server.models import FeedbackHistory, Setting

HISTORY_LIMIT = 12
HISTORY_PHRASE_CANDIDATES = [
    "课上表现良好", "学习态度端正", "继续加油", "继续保持",
    "这一点先保持", "这一点可以保持", "后续还需要", "还需要继续巩固",
    "基础题型基本过关", "知识点基本都过关", "需要提醒思路", "中档偏上的题目", "状态还可以",
    "课后要多下功夫", "要引起重视", "整体表现不错", "掌握得还可以", "这部分内容",
    "后面继续", "不要松懈", "目前主要问题", "作业完成度不达标",
    "有待提高", "基础知识点有遗忘", "计算细节", "审题细节", "基础分一定要守住"
]


def get_feedback_history():
    items = FeedbackHistory.query.order_by(
        FeedbackHistory.created_at.desc()
    ).limit(HISTORY_LIMIT).all()
    return [{"text": i.text, "student_name": i.student_name} for i in items]


def build_messages(form_data):
    """主入口：根据 formData 构建 messages 数组"""
    return _build_initial_messages(form_data)


def build_quick_messages(form_data):
    """快速生成入口"""
    return _build_quick_messages(form_data)


def build_revision_messages(revise_type, current_text, form_data):
    """二次修改入口"""
    return _build_revision_messages(revise_type, current_text, form_data)


# ========== 内部实现 ==========

def _get_api_key():
    s = Setting.query.get("api_key")
    return s.value if s else ""


def _get_expression_mode(fd=None):
    return fd.get("expressionMode", "real") if fd and isinstance(fd, dict) else "real"


def _get_tone_mode(fd=None):
    return fd.get("toneMode", "neutral") if fd and isinstance(fd, dict) else "neutral"


def _get_word_count_range(fd=None):
    val = 300
    if fd and isinstance(fd, dict):
        val = int(fd.get("wordCount", 300))
    ranges = {150: (125, 165), 200: (175, 215), 250: (225, 265),
              300: (270, 315), 350: (315, 365), 400: (360, 420)}
    return ranges.get(val, (270, 315))


def _pick_random(items):
    return random.choice(items) if items else ""


def _build_initial_messages(fd):
    """构建主生成的 system + user messages"""
    student_name = fd.get("studentName", "这位同学")
    gender = fd.get("gender", "男")
    grade = fd.get("grade", "初中")
    subject = fd.get("subject", "数学")
    knowledge = fd.get("knowledge", "本节课内容")
    homework = fd.get("homework", "")
    next_focus = fd.get("nextFocus", "")
    correctness = fd.get("correctness")
    selected_highlights = fd.get("selectedHighlights", [])
    selected_weak = fd.get("selectedWeak", [])
    selected_suggestion = fd.get("selectedSuggestion", "")
    should_gen_suggestion = bool(selected_suggestion)
    selected_encouragement = fd.get("selectedEncouragement", "")
    enable_greeting = fd.get("enableGreeting", True)
    date = fd.get("date", "")
    real_notes = fd.get("realNotes", "")

    pronoun = "她" if gender == "女" else "他"
    has_homework = bool(homework and homework.strip())
    has_next_focus = bool(next_focus and next_focus.strip())
    include_improve = should_gen_suggestion and (len(selected_weak) > 0 or selected_suggestion)

    teacher_role = f"{grade}{subject}资深老师"
    correctness_text = f"正确率约{correctness}%" if correctness is not None else "未填写正确率"

    grade_hint = ("语气可以适当鼓励，但不要反复使用「不错」「很好」这类单薄评价；指出问题时语气温和但具体。"
                  if grade == "初中" else
                  "语气更偏向高考/学业水平要求，可以适当强调逻辑严谨性和知识迁移能力。")

    expression_mode = fd.get("expressionMode", "real")
    tone_mode = fd.get("toneMode", "neutral")

    min_words, max_words = _get_word_count_range(fd)
    teaching_content_range = "45~75字" if expression_mode == "vivid" else "35~60字"
    teaching_content_count = "2~3个" if expression_mode == "vivid" else "2个左右"

    # 系统提示词
    system_prompt = f"""你是一位{teacher_role}，正在给家长写课后反馈。你的风格需要高度模仿一位有多年教学经验、说话直接、不爱说套话的老师。

【核心风格要求】语言直接、简洁；像老师口述记录；允许直接指出问题；使用「我」第一人称；不要标准化分段；收尾简洁；允许口语化短句。

{_get_expression_instruction(expression_mode, fd)}
{_get_anti_stiff()}
{_get_real_teacher_corpus(grade, subject)}
{_get_scene_hints(fd)}
{_get_style_variation()}
{_get_history_block()}

【自然表达要求】
1. 禁止使用生硬句式：「倒是」「这点不错」「这点很好」「公式默写倒是全对」「整体来看」「总体而言」「存在一定问题」
2. 如果要表达「公式默写全对」，优先写成「公式默写这块没有问题，说明基础记忆是过关的」或「公式记忆这部分不用太担心」
3. 不要机械写成「优点+这点不错」。要写出优点背后的意义，或者直接接后续要求
4. 每次生成都要在不新增事实的前提下变换表达顺序和连接词，避免像复制粘贴
5. 不要把所有勾选项逐条罗列，优点最多展开2个，问题最多展开2个，其余可以合并概括
6. 学生表现段优先写成自然段，不要写成「第一、第二、第三」的清单
7. 同一件事只写一次，不要前后换个说法重复一遍
8. 语句要像老师顺手发微信，少写「说明其具备较好基础」「反映出存在不足」这类评语腔
9. 宁可少写一点，也不要为了凑字反复解释同一个问题
10. 允许把老师的判断写出来，但必须有事实支撑

【学科与年级适配】{grade_hint}

【表扬条件】{_get_praise_rule(correctness)}

【语气调节】{_get_tone_instruction(tone_mode)}

【字数要求】正文总字数控制在{min_words}~{max_words}字之间（只统计「教学内容、学生表现、改进建议」，不包含问候语、标题行和本周作业）。

【事实铁律】反馈中出现的所有具体事实必须严格来自事实白名单。严禁编造任何不在白名单内的具体数字、题号、次数、迟到、未带资料等细节。

【自动识别情景】{_infer_scenes(fd)}

【固定结构】（正文目标{min_words}~{max_words}字，不输出标题行！直接输出教学内容、学生表现等）
教学内容：围绕核心知识点扩展{teaching_content_count}个紧密相关的子内容，{teaching_content_range}，不要写成教材目录。
学生表现：占正文的主要部分，至少达到{int(min_words * 0.52)}字以上；自然段表达，不要机械罗列优缺点。
{('改进建议：25~45字，只针对白名单中的薄弱点，别重复学生表现里已经说过的话。' if include_improve else '')}
{('本周作业：必须作为最后一行单独输出，不改写、不扩写、不并入学生表现。' if has_homework else '')}

【绝对禁止】
1. 新增白名单外的具体错题次数、分数、迟到、作业未写等细节
2. 禁止套话如「家校配合」「持续赋能」
3. 禁止机械列优点/缺点清单
4. 禁止输出标题行

【人称代词】统一使用「{pronoun}」

{_get_tone_examples(tone_mode)}

【语气差异要求】
- 鼓励模式：优先写进步、状态、主动性和可保持的地方，问题放在后半段，语气温和但不虚夸
- 平和模式：优点和问题都写，语气客观，像日常给家长同步情况
- 批评模式：优先写主要问题和后果，语气更直接，最后给具体要求
- 不管哪种语气，都必须严格基于事实白名单

【写作核心】教学内容段落必须基于「{knowledge}」扩展出{teaching_content_count}个紧密相关的子知识点，控制在{teaching_content_range}；学生表现段要像真实老师微信反馈，不能僵硬。直接输出反馈正文，不要任何解释。"""

    if not enable_greeting:
        system_prompt += f"\n【特别注意】由于家长关闭了问候语，反馈正文的第一行必须是标题行，格式为「{student_name}{_format_date(date)}{subject}课后反馈」，独占一行，标题行不计入总字数。"
    else:
        system_prompt += "\n【格式】绝对禁止输出任何标题行，直接输出「教学内容：」、「学生表现：」等段落。"

    user_prompt = _build_user_prompt(fd)
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]


def _build_user_prompt(fd):
    """构建用户提示词"""
    student_name = fd.get("studentName", "这位同学")
    gender = fd.get("gender", "男")
    grade = fd.get("grade", "初中")
    subject = fd.get("subject", "数学")
    knowledge = fd.get("knowledge", "本节课内容")
    homework = fd.get("homework", "")
    next_focus = fd.get("nextFocus", "")
    correctness = fd.get("correctness")
    selected_highlights = fd.get("selectedHighlights", [])
    selected_weak = fd.get("selectedWeak", [])
    selected_suggestion = fd.get("selectedSuggestion", "")
    selected_encouragement = fd.get("selectedEncouragement", "")
    enable_greeting = fd.get("enableGreeting", True)
    date = fd.get("date", "")
    expression_mode = fd.get("expressionMode", "real")
    tone_mode = fd.get("toneMode", "neutral")
    min_words, max_words = _get_word_count_range(fd)

    has_homework = bool(homework and homework.strip())
    has_next_focus = bool(next_focus and next_focus.strip())
    include_improve = bool(selected_suggestion)
    correctness_text = f"正确率约{correctness}%" if correctness is not None else "未填写正确率"

    parts = [
        f"学生：{student_name}（{gender}）",
        f"年级：{grade} | 科目：{subject}",
        f"教学内容核心：{knowledge}",
        f"优点：{'、'.join(selected_highlights) if selected_highlights else '无明显突出优点'}",
        f"薄弱点：{'、'.join(selected_weak) if selected_weak else '无明确薄弱点'}",
        f"正确率：{correctness_text}",
    ]
    if include_improve:
        parts.append(f"改进方向：{selected_suggestion}")
    else:
        parts.append("不生成改进建议")
    if has_homework:
        parts.append(f"作业：{homework}（必须单独成最后一行，写成「本周作业：{homework}」）")
    else:
        parts.append("不生成作业段落")
    if selected_encouragement:
        parts.append(f"寄语参考：{selected_encouragement}（保留核心意思即可，可以自然改写）")
    parts.append(f"当前语气模式：{tone_mode}")
    parts.append(f"学生表现至少{int(min_words * 0.52)}字")
    parts.append(f"输出完整反馈{'（第一行必须是标题行）' if not enable_greeting else '（不要标题行）'}")

    return "\n".join(parts)


def _get_expression_instruction(mode, fd):
    weak_count = len(fd.get("selectedWeak", []))
    highlight_count = len(fd.get("selectedHighlights", []))
    real_notes = fd.get("realNotes", "")
    real_note_count = len([n for n in real_notes.split("；") if n.strip()]) if real_notes else 0

    fact_hint = (
        f"本次有{real_note_count}条真实记录，每条都是独立事实，优先分散写自然，不要把两条强行揉成一句因果。"
        if real_note_count > 0 else
        "本次没有额外真实记录，表达要克制，只能围绕勾选项做概括判断。"
    )

    if mode == "vivid":
        return f"""【表达模式·生动】
- 表达可以比真实模式更顺一点、有一点起伏，但仍然是老师发给家长的微信，不是作文
- 可以先下判断，再解释原因，例如「这节课主要卡在……」「现在不是完全不会，而是……」
- 优点不要只写「不错」，要写出它说明什么；问题不要只罗列，要写出后面为什么要盯
- 允许使用「能看出来」「现在卡点在」「这块后面要盯住」「基础分不能丢」等老师口吻
- 可以有一两句短句，让文字更像真人表达
- 不要煽情，不要鸡汤，不要使用「潜力无限、未来可期、持续赋能」这类空话
- {fact_hint}
- 本次勾选了{highlight_count}个优点、{weak_count}个薄弱点，不需要全部平均展开，抓主要矛盾写"""
    else:
        return f"""【表达模式·真实】
- 表达要像老师真实发给家长的微信：朴素、直接、短句多，不追求文采
- 不要把所有勾选的优点和缺点平均展开，只抓最主要的1个优点和1~2个问题
- 少用形容词，多写教学判断，例如「这块先按基础题过关处理」「讲过的题还要再练一遍」
- 可以使用「这节课看下来」「目前先把……处理好」「后面我会继续盯一下」等自然口吻
- 不要写得太圆滑，不要每一句都像总结报告
- 禁止比喻、煽情、漂亮话，整体要自然、克制、像人写的
- {fact_hint}
- 本次勾选了{highlight_count}个优点、{weak_count}个薄弱点，不需要全部平均展开，重点写家长最需要知道的部分"""


def _get_anti_stiff():
    return """【通用反僵硬要求】
- 所有语气模式都要自然，不允许写成AI评语、工作总结或「先优点后缺点」的固定模板
- 少用「整体来看、总体而言、此外、同时、该生、较好地、存在一定问题、有待提高」
- 不要使用「这一点先保持」，这句话很容易显得生硬
- 优先使用真实老师常用表达：「从作业来看」「课上看下来」「这部分」「现在的问题是」「我暂时不太担心」「要引起重视」「先把会的题做对」
- 问题要写得具体，不要只写「需要加强」
- 不要连续三句都用同一种句式，不要每句都以「学生……」开头
- 允许适当使用口语化短句
- 教学内容段不要写成教材目录；学生表现段不要写成优缺点清单"""


def _get_real_teacher_corpus(grade, subject):
    return f"""【真实老师文风提炼】
- 参考真实反馈的写法：先给课堂或作业事实，再给教学判断，最后给一句具体要求
- 可以直接写「从作业来看」「课上小测情况一般」「这部分内容比较强调计算」等朴素表达
- 可以写老师自己的判断，例如「我暂时也不太担心」「这点要引起重视」，但必须基于白名单事实
- 真实反馈里常见的节奏是：本次内容/作业情况 → 正确率或具体卡点 → 为什么要注意 → 后续怎么做
- {grade}{subject}反馈要贴近学科：数学多写计算、题型分辨、分类讨论、错题整理；物理多写模型、公式应用、单位、图像、物理量含义和信息提取
- 如果事实少，就少写，不要硬扩写；宁愿短一点，也不要把一句话拆成很多空泛总结"""


def _get_scene_hints(fd):
    highlights = "、".join(fd.get("selectedHighlights", []))
    weak = "、".join(fd.get("selectedWeak", []))
    notes = "；".join(filter(None, [fd.get("realNotes", ""), fd.get("homework", ""),
                                      fd.get("nextFocus", ""), fd.get("knowledge", "")]))
    all_text = f"{highlights}；{weak}；{notes}"
    hints = []

    def add(t):
        if t and t not in hints: hints.append(t)

    if any(kw in all_text for kw in ["期中", "期末", "考试", "复习"]):
        add("考试/复习场景：多写会做的题别丢分、讲过多次的题型不要再错、基础分先守住")
    if any(kw in all_text for kw in ["计算", "步骤", "符号"]):
        add("计算/步骤场景：具体写计算、符号、单位或步骤哪里不稳")
    if any(kw in all_text for kw in ["遗忘", "忘记", "复习巩固"]):
        add("遗忘/复习场景：写成课后复习没跟上、讲过内容要回头看")
    if any(kw in all_text for kw in ["作业", "完成度"]):
        add("作业场景：作业好就肯定课后落实；作业不达标就直接提醒")
    if any(kw in all_text for kw in ["互动", "专注", "犯困"]):
        add("课堂状态/互动场景：积极就写成课堂配合好；不积极就提醒上课要更主动")

    if hints:
        return "【本次场景写法提示】\n- " + "\n- ".join(hints[:6])
    return "【本次场景写法提示】按真实课堂事实自然展开，不额外加戏"


def _get_style_variation():
    openings = [
        "从作业或课上练习的实际情况切入，不要先写空泛总评",
        "先写本节课处理了什么问题，再带出学生掌握情况",
        "先写一个家长最该知道的卡点，再补一句可保持的地方",
        "先写考试/复习背景下最需要稳住的部分，再说后续安排",
        "先用一句老师判断开头，例如「这部分短期内问题不大」或「现在主要卡在……」",
    ]
    return f"""【本次表达变化指令】
- 结构变化：{_pick_random(openings)}
- 同一事实不要每次都写成同一句话；可以换连接词、换先后顺序、换句长，但不得新增事实"""


def _get_history_block():
    history = get_feedback_history()
    if not history:
        return "【历史重复提醒】暂无历史反馈记录，本次正常生成。"
    avoid_phrases = []
    for phrase in HISTORY_PHRASE_CANDIDATES:
        count = sum(1 for h in history if phrase in (h.get("text") or ""))
        if count >= 2:
            avoid_phrases.append((phrase, count))
    avoid_phrases.sort(key=lambda x: -x[1])
    avoid_text = "、".join(f"「{p}」（近{len(history)}条出现{c}次）" for p, c in avoid_phrases[:8])
    if not avoid_text:
        avoid_text = "暂无明显高频重复句"
    return f"【历史重复提醒】本地已保存最近{len(history)}条反馈。本次要尽量避开近期高频表达：{avoid_text}。处理方式：不要删事实，只换表达顺序、连接词和句式"


def _get_praise_rule(correctness):
    if correctness is not None and correctness >= 90:
        return "本次正确率较高（≥90%），允许在反馈中自然使用「值得表扬」「非常棒」等肯定词，但依然不能编造其他事实。"
    return "本次正确率低于90%，绝对禁止使用「值得表扬」「非常棒」等词，保持客观指出不足即可。"


def _get_tone_instruction(tone):
    if tone == "encourage":
        return """【语气倾向·鼓励】
- 先肯定具体变化，再提醒一个最要紧的问题
- 鼓励不是鸡汤，最好落到具体动作
- 禁止：不要把普通表现写成「非常棒」"""
    elif tone == "critical":
        return """【语气倾向·批评】
- 先点主要问题，再说明后果，最后给明确要求
- 批评要像老师提醒家长，不要绕成漂亮话；但不辱骂、不上升人格
- 禁止：不自行编造迟到、没写作业、玩游戏、家长督促等细节"""
    else:
        return """【语气倾向·平和】
- 像日常反馈一样写「这节课做了什么—哪里能跟上—哪里还不稳—后面怎么处理」
- 可以有老师自己的判断，但必须基于事实
- 禁止：不要写成模板化总结"""


def _get_tone_examples(tone):
    if tone == "encourage":
        return "【风格示例】鼓励型：先肯定具体表现，再温和提醒一个问题。例如「这节课进行得很顺利，基础题都能自己写出来，说明前面讲过的方法没有丢。后面主要把计算细节和步骤规范再稳一稳。」"
    elif tone == "critical":
        return "【风格示例】批评型：先点主要问题，再说明后果，最后给明确要求。例如「这次作业完成度不达标。要端正学习态度，积极完成老师的作业。」"
    else:
        return "【风格示例】平和型：客观陈述课堂情况。例如「这节课看下来，基础部分还能跟着走。现在先不急着拔高，先把基础题型和常用方法练熟。」"


def _infer_scenes(fd):
    tags = []
    highlights = "、".join(fd.get("selectedHighlights", []))
    weak = "、".join(fd.get("selectedWeak", []))
    all_text = f"{highlights}；{weak}"
    if "正确率较高" in highlights:
        tags.append("正确率较高")
    if "基础题型基本过关" in highlights:
        tags.append("基础过关")
    if any(kw in all_text for kw in ["遗忘", "忘记"]):
        tags.append("知识点遗忘")
    if any(kw in all_text for kw in ["自满", "飘"]):
        tags.append("状态需调整")
    return "；".join(tags) if tags else "常规课后反馈"


def _format_date(date_str):
    import re
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', str(date_str or ""))
    if m:
        return f"{int(m.group(2))}月{int(m.group(3))}日"
    return ""


def _build_quick_messages(fd):
    """快速生成的 messages"""
    student_name = fd.get("studentName", "这位同学")
    gender = fd.get("gender", "男")
    grade = fd.get("grade", "初中")
    subject = fd.get("subject", "数学")
    knowledge = fd.get("knowledge", "本节课内容")
    pronoun = "她" if gender == "女" else "他"
    min_words, max_words = _get_word_count_range(fd)

    system = f"""你是一位{grade}{subject}老师，正在给家长快速生成课后反馈。
这是「快速生成」：用户只给了学生类型和反馈方向，提示词会比较笼统。
你可以根据学生类型和本节课内容，合理补充1~2个常见、泛化的课堂事实。
注意：
1. 不能编造具体分数、具体题号、迟到、玩手机、没写作业、家长督促、严重态度问题
2. 「学霸/学渣/普通学生」只是内部生成参考，正文里绝对不要出现这些词
3. 必须有「教学内容：」和「学生表现：」
4. 语言像老师顺手发微信，别写成报告
5. 字数控制在{min_words}~{max_words}字左右
6. 人称统一用「{pronoun}」
输出时不要解释过程，直接输出完整反馈。"""

    user = f"学生：{student_name}（{gender}）\n年级：{grade}\n科目：{subject}\n本节课内容：{knowledge}\n请按固定格式生成反馈。"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _build_revision_messages(revise_type, current_text, fd):
    """二次修改"""
    instructions = {
        "shorter": "请把当前反馈压缩得短一点，大约减少20%~30%的字数。保留关键事实。",
        "longer": "请把当前反馈适当写长一点，大约增加80~140个字。只能围绕已有事实。",
        "natural": "请把当前反馈改得更像真实老师发给家长的微信。减少AI味、模板味。",
        "encourage": "请让语气多一点鼓励和正向引导。鼓励要落到具体动作上。",
        "strict": "请让语气更严厉、更直接一些。重点把问题和后果说清楚。",
        "wechat": "请把当前反馈改得更像老师临时随手发给家长的微信：口语一点、短句多一点。",
        "emoji": "请在当前反馈中自然加入微信自带表情[强][愉快][加油][玫瑰]等。默认只加2-3个。",
    }
    instruction = instructions.get(revise_type, instructions["natural"])
    system = "你是一位真实教培老师，只负责对已经生成好的课后反馈做二次改写。不要新增事实，不要改变结构和作业内容。"
    user = f"【二次修改要求】\n{instruction}\n\n【当前反馈】\n{current_text}\n\n请直接输出二次修改后的完整反馈。"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
