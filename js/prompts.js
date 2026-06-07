/**
 * prompts.js — Prompt 构建引擎
 * 依赖：config.js, storage.js, postprocess.js
 * 挂载：window.App.prompts
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;
    var AC = window.App.apiClient;
    var PP = window.App.postprocess;

    var MODULE = {};

    // ========== 表达模式与温度 ==========

    MODULE.getExpressionMode = function () {
        var el = document.querySelector('input[name="tempMode"]:checked');
        return el ? el.value : "real";
    };

    MODULE.getToneMode = function () {
        var el = document.querySelector('input[name="toneStyle"]:checked');
        return el ? el.value : "neutral";
    };

    MODULE.getTemperatureByMode = function () {
        var mode = MODULE.getExpressionMode();
        if (mode === "vivid") return [0.62, 0.46];
        return [0.42, 0.32];
    };

    MODULE.getWordCountRange = function () {
        var el = document.getElementById("wordCountSelect");
        var val = parseInt(el ? el.value : "300", 10);
        if (val === 150) return [125, 165];
        if (val === 200) return [175, 215];
        if (val === 250) return [225, 265];
        if (val === 300) return [270, 315];
        if (val === 350) return [315, 365];
        if (val === 400) return [360, 420];
        return [270, 315];
    };

    // ========== 工具 ==========

    function pickRandom(items) {
        if (!Array.isArray(items) || items.length === 0) return "";
        return items[Math.floor(Math.random() * items.length)];
    }

    function formatDateForTitle(dateStr) {
        var match = String(dateStr || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) return parseInt(match[2], 10) + "月" + parseInt(match[3], 10) + "日";
        var d = new Date(dateStr || Date.now());
        if (!isNaN(d.getTime())) return (d.getMonth() + 1) + "月" + d.getDate() + "日";
        var today = new Date();
        return (today.getMonth() + 1) + "月" + today.getDate() + "日";
    }

    function formatRealNotesForPrompt(formData) {
        var list = PP.getRealNotesList(formData);
        if (!list.length) return "无额外具体事件记录";
        return list.map(function (item, idx) { return (idx + 1) + ". " + item; }).join("\n");
    }

    function normalizeHomeworkText(homework) {
        return String(homework || "").replace(/\s+/g, " ").trim();
    }

    // ========== Prompt 模块 ==========

    MODULE.getExpressionModeInstruction = function (formData) {
        var mode = MODULE.getExpressionMode();
        var weakCount = Array.isArray(formData && formData.selectedWeak) ? formData.selectedWeak.length : 0;
        var highlightCount = Array.isArray(formData && formData.selectedHighlights) ? formData.selectedHighlights.length : 0;
        var realNoteCount = PP.getRealNotesList(formData).length;
        var hasNotes = realNoteCount > 0;
        var factDensityHint = hasNotes
            ? "本次有" + realNoteCount + "条真实记录，每条都是独立事实，优先分散写自然，不要把两条强行揉成一句因果。"
            : "本次没有额外真实记录，表达要克制，只能围绕勾选项做概括判断。";

        if (mode === "vivid") {
            return "【表达模式·生动】\n- 表达可以比真实模式更顺一点、有一点起伏，但仍然是老师发给家长的微信，不是作文。\n- 可以先下判断，再解释原因，例如"这节课主要卡在……""现在不是完全不会，而是……"。\n- 优点不要只写"不错"，要写出它说明什么；问题不要只罗列，要写出后面为什么要盯。\n- 允许使用"能看出来""现在卡点在""这块后面要盯住""基础分不能丢"等老师口吻。\n- 可以有一两句短句，让文字更像真人表达。\n- 不要煽情，不要鸡汤，不要使用"潜力无限、未来可期、持续赋能"这类空话。\n- " + factDensityHint + "\n- 本次勾选了" + highlightCount + "个优点、" + weakCount + "个薄弱点，不需要全部平均展开，抓主要矛盾写。";
        }

        return "【表达模式·真实】\n- 表达要像老师真实发给家长的微信：朴素、直接、短句多，不追求文采。\n- 不要把所有勾选的优点和缺点平均展开，只抓最主要的1个优点和1~2个问题。\n- 少用形容词，多写教学判断，例如"这块先按基础题过关处理""讲过的题还要再练一遍"。\n- 可以使用"这节课看下来""目前先把……处理好""后面我会继续盯一下"等自然口吻。\n- 不要写得太圆滑，不要每一句都像总结报告。\n- 禁止比喻、煽情、漂亮话，整体要自然、克制、像人写的。\n- " + factDensityHint + "\n- 本次勾选了" + highlightCount + "个优点、" + weakCount + "个薄弱点，不需要全部平均展开，重点写家长最需要知道的部分。";
    };

    MODULE.getAntiStiffInstruction = function () {
        return "【通用反僵硬要求】\n- 所有语气模式都要自然，不允许写成AI评语、工作总结或"先优点后缺点"的固定模板。\n- 少用"整体来看、总体而言、此外、同时、该生、较好地、存在一定问题、有待提高、反映出、体现了、具备较强能力、仍需进一步提升"。\n- 不要使用"这一点先保持"，这句话很容易显得生硬；需要肯定时可以写"继续保持""这个习惯继续保持""这块先不用太担心"。\n- 优先使用真实老师常用表达："从作业来看""课上看下来""这部分""现在的问题是""我暂时不太担心""要引起重视""先把会的题做对"。\n- 问题要写得具体，不要只写"需要加强"；比如写成"方法能听懂，但自己做题时还落不下来""讲过的题型如果还错，就要反思课后有没有整理"。\n- 不要连续三句都用同一种句式，不要每句都以"学生……"开头。\n- 允许适当使用口语化短句，例如"这块不能放松。""先不急着拔高。""别在会做的题上丢分。"\n- 教学内容段不要写成教材目录；学生表现段不要写成优缺点清单。";
    };

    MODULE.getRealTeacherCorpusInstruction = function (formData) {
        var subject = (formData && formData.subject) || "科目";
        var grade = (formData && formData.grade) || "";
        return "【真实老师文风提炼】\n- 参考真实反馈的写法：先给课堂或作业事实，再给教学判断，最后给一句具体要求；不要先铺一堆泛泛评价。\n- 可以直接写"从作业来看""课上小测情况一般""这部分内容比较强调计算""学校进度偏快""时间关系课上没怎么练习"等朴素表达。\n- 可以写老师自己的判断，例如"我暂时也不太担心""这点要引起重视""这部分短期内问题不大""后面会继续复习这部分"，但必须基于白名单事实。\n- 真实反馈里常见的节奏是：本次内容/作业情况 → 正确率或具体卡点 → 为什么要注意 → 后续怎么做。不要写成"学生表现优秀，学习态度端正，综合能力提升明显"。\n- 允许出现适度口语化判断："题目计算量较大""有点支支吾吾""这类题就不要错了""不能总拿粗心当理由"，但不能新增白名单没有的行为。\n- " + grade + subject + "反馈要贴近学科：数学多写计算、题型分辨、分类讨论、错题整理；物理多写模型、公式应用、单位、图像、物理量含义和信息提取。\n- 如果事实少，就少写，不要硬扩写；宁愿短一点，也不要把一句话拆成很多空泛总结。";
    };

    MODULE.getSceneWritingHints = function (formData) {
        var highlights = ((formData && formData.selectedHighlights) || []).join("、");
        var weak = ((formData && formData.selectedWeak) || []).join("、");
        var notes = PP.getRealNotesList(formData).concat([formData && formData.homework, formData && formData.nextFocus, formData && formData.knowledge]).filter(Boolean).join("；");
        var all = highlights + "；" + weak + "；" + notes;
        var hints = [];
        var add = function (text) { if (text && hints.indexOf(text) < 0) hints.push(text); };

        if (/期中|期末|考试|一模|二模|复习|考前|月考/.test(all)) add("考试/复习场景：多写会做的题别丢分、讲过多次的题型不要再错、基础分先守住；不要空喊加油。");
        if (/计算|化简|符号|步骤|书写|单位|数量级|cm|m|答题步骤比之前规范|解题步骤不够规范/.test(all)) add("计算/步骤场景：具体写计算、符号、单位或步骤哪里不稳；如果步骤比之前规范，就写成进步点，但仍提醒继续稳住。");
        if (/遗忘|忘记|没想起来|复述.*不出来|说不出来|前面.*忘|基础知识点有遗忘|课后缺乏复习巩固/.test(all)) add("遗忘/复习场景：写成课后复习没跟上、讲过内容要回头看；不要只写"记忆不牢"。");
        if (/作业.*(没|未|空|一半|不达标|支支吾吾)|完成度不达标|作业完成情况良好/.test(all)) add("作业场景：作业好就肯定课后落实；作业不达标就直接提醒完成质量和课后落实，不要绕成"自主学习意识不足"。");
        if (/错题未订正|主动订正错题|错题|订正|复盘/.test(all)) add("错题订正场景：主动订正要肯定；未订正要提醒错题不能只改答案，要重新独立写一遍。");
        if (/题型|模型|分不清|有序|无序|速度角|位移角|挡板|插空|分组|分类讨论|举一反三|迁移/.test(all)) add("题型/迁移场景：写具体模型、题型边界或举一反三不足，而不是泛泛写"逻辑能力有待加强"。");
        if (/带着问题|学校.*没懂|校内.*问题|主动问|答疑/.test(all)) add("带问题上课场景：肯定这个习惯，因为上课效率会高；后面提醒课后要独立再写一遍。");
        if (/听懂|方法会|方法能接上|无法独自解题|独自解题|不敢下笔|依赖老师提示|依赖提示|等老师/.test(all)) add("听懂但独立困难场景：重点写"听懂和真正掌握不是一回事"，要训练自己起步和完整写出来。");
        if (/互动比较积极|课上互动不积极|课堂专注度|犯困|走神|专注/.test(all)) add("课堂状态/互动场景：积极就写成课堂配合和问题暴露比较好；不积极或犯困就提醒上课要更主动，别把问题藏住。");
        if (/进度.*快|新课|学校进度|已经开始新章节/.test(all)) add("学校进度快场景：写前面内容要及时回顾，否则新课一来容易越积越多。");
        if (/自满|飘|放松|松懈|骄傲/.test(all)) add("考后自满场景：不要把成绩和问题强行写成因果，分开写状态要收回来、细节要稳住。");
        if (/不够自信|不敢下笔|怕错|犹豫/.test(all)) add("不够自信场景：语气别压太重，写"不是完全不会"，鼓励先动笔，再减少提示。");
        return hints.length ? "【本次场景写法提示】\n- " + hints.slice(0, 6).join("\n- ") : "【本次场景写法提示】按真实课堂事实自然展开，不额外加戏。";
    };

    MODULE.getStyleVariation = function (formData) {
        var openings = [
            "从作业或课上练习的实际情况切入，不要先写空泛总评",
            "先写本节课处理了什么问题，再带出学生掌握情况",
            "先写一个家长最该知道的卡点，再补一句可保持的地方",
            "先写考试/复习背景下最需要稳住的部分，再说后续安排",
            "先用一句老师判断开头，例如"这部分短期内问题不大"或"现在主要卡在……""
        ];
        var praiseWays = [
            "表扬要落到具体习惯或题型上，例如"带着问题来上课效率会高很多""基础题型能自己写出来"",
            "肯定优点时可以接一句教学判断，如"说明前面讲过的方法没有丢""这部分暂时不用太担心"",
            "少堆"不错、很好、值得肯定"，用"这块过关了""这个习惯继续保持"更自然",
            "如果只是普通表现，不要强行拔高；写成"状态还可以"即可"
        ];
        var problemWays = [
            "问题要像老师指出课堂卡点："方法能听懂，但自己算还不稳""题型边界还分不清"",
            "写薄弱点时说明为什么重要："考试里会实打实扣分""讲过多次的题就不要再错"",
            "可以直接提醒"要引起重视""不能总拿粗心当理由"，但只能基于白名单事实",
            "后续要求要具体："把错题再独立写一遍""先把基础题型练熟""回头看一下笔记""
        ];
        var rhythmWays = [
            "长短句交替，允许一两句很短的老师口吻，比如"这块不能放松。"",
            "少用连接词堆叠，不要连续"此外/同时/后续"",
            "一句话只解决一个意思，不把多个真实记录硬揉成因果",
            "不要每句都完整铺开，保留真实微信反馈的简洁感"
        ];
        var styleId = Math.random().toString(36).slice(2, 8);
        return "【本次表达变化指令｜" + styleId + "】\n- 结构变化：" + pickRandom(openings) + "。\n- 表扬写法：" + pickRandom(praiseWays) + "。\n- 问题写法：" + pickRandom(problemWays) + "。\n- 句式节奏：" + pickRandom(rhythmWays) + "。\n- 同一事实不要每次都写成同一句话；可以换连接词、换先后顺序、换句长，但不得新增事实。";
    };

    MODULE.getToneInstruction = function () {
        var tone = MODULE.getToneMode();
        if (tone === "encourage") {
            return "【语气倾向·鼓励】\n- 适用场景：学生有进步、基础题过关、愿意提问、愿意尝试，或正确率一般但态度能跟上。\n- 表达方式：先肯定具体变化，再提醒一个最要紧的问题。可以写"最近状态不错""这部分不用太担心""继续保持"，但不要无依据拔高。\n- 鼓励不是鸡汤，最好落到具体动作：把题再独立写一遍、把计算细节稳住、别在会做的题上丢分。\n- 禁止：不要把普通表现写成"非常棒"；不要连续堆叠"不错、很好、值得表扬"。正确率低于90%时仍禁止"非常棒""值得表扬"。";
        }
        if (tone === "critical") {
            return "【语气倾向·批评】\n- 适用场景：作业完成差、讲过内容遗忘快、课后不复习、低级错误多、态度松懈、自满。\n- 表达方式：先点主要问题，再说明后果，最后给明确要求。可以写"要引起重视""听懂和掌握不是一回事""不能总拿粗心当理由"。\n- 批评要像老师提醒家长，不要绕成漂亮话；但不辱骂、不上升人格，只批评白名单事实。\n- 禁止：不自行编造迟到、没写作业、玩游戏、家长督促等细节，除非白名单明确提供。";
        }
        return "【语气倾向·平和】\n- 适用场景：有优点也有问题，整体表现正常，需要给家长同步真实情况。\n- 表达方式：像日常反馈一样写"这节课做了什么—哪里能跟上—哪里还不稳—后面怎么处理"。\n- 可以有老师自己的判断，如"我暂时不太担心""现在先不急着拔高""这块短期内问题不大"，但必须基于事实。\n- 禁止：不要写成模板化总结，不要每句都用"整体来看""此外"。";
    };

    MODULE.getToneExampleBlock = function (formData) {
        var tone = MODULE.getToneMode();
        var encourageExamples = "【本次只参考：鼓励型真实风格示例】\n示例1（正确率高 + 基础题过关）：学生表现：这节课进行得很顺利，基础题都能自己写出来，说明前面讲过的方法没有丢。解题思路也比较清楚，不需要老师提示。后面主要把计算细节和步骤规范再稳一稳，别在会做的题上丢分。最近状态不错，继续保持。\n示例2（带着问题来上课）：学生表现：这次是带着学校里没弄懂的问题来的，上课的效率会高很多，这点非常棒。课上把题目涉及到的知识点拆开以后，能看出来他对题目的理解更进一步了。课后要把题目再独立写一遍，不能只停留在听懂。把问题都弄懂了，成绩自然就上去了。\n示例3（不够自信但愿意尝试）：学生表现：一开始做题不太敢下笔，总担心自己思路不对。课上带着他把条件一步步列出来以后，其实能往下推，说明也不是完全不会。后面要多独立解题，不能一直等老师提示，这样才能有进步。学习的态度很好，自信一点。\n示例4（有进步但还不稳定）：学生表现：学生最近的状态明显要好了一点，做题的正确率有进步，讲过的题目和基础题都能动手做了。但还是有点不稳定，需要继续刷题巩固，把正确率稳下来后，我们就开始攻克中档题，一步一步来，继续加油。\n示例5（学习态度端正）：学生表现：课上的表现很不错，积极配合老师，学习态度端正。保持这个学习的劲头，成绩一定会上去的，加油！";

        var neutralExamples = "【本次只参考：平和型真实风格示例】\n示例1（基础薄弱但态度正常）：学生表现：这节课看下来，基础部分还能跟着走，但有些知识点反应不算快。课堂状态正常，能听讲，也能配合完成练习。现在先不急着拔高，先把基础题型和常用方法练熟，后面再慢慢加综合题。\n示例2（方法会但计算不稳）：学生表现：方法层面不是完全不会，课上讲到关键步骤时能接上。但一到自己算，容易在化简、符号和步骤上出问题，正确率就被拉下来了。后面重点不是再讲很多新方法，而是把已经会的方法真正算对、写完整。\n示例3（考后有些自满）：学生表现：期中考得不错之后，状态上有点放松，课上主动性没有之前那么高。知识点和方法不是没有基础，但做题时细节不够稳，容易把会的题做错。接下来要把状态收回来，基础分不能因为松懈丢掉。\n示例4（知识点遗忘较多）：学生表现：最近上新课，导致前面讲解的知识点和题型遗忘较多，一些以前能轻松拿下的题目，现在有点动不了手。课后要注意巩固，不要学了忘，忘了学的。学习态度没什么大问题，多下点功夫就好。\n示例5（题型分辨不清）：学生表现：学习有点停留在表面，自认为懂了但其实学得很浅。一些模型例如速度角和位移角在具体的题目里就分不清用哪个了，课上除了按部就班的记笔记做题外，还要多思考，多提问。\n示例6（复习阶段，守基础分）：学生表现：现在临近考试，最需要注意的是稳定性。基础题型基本能做出来，但计算、审题和步骤规范还不能完全放松。难题能拿多少是多少，先把会做的题做对，把基础分守住。";

        var criticalExamples = "【本次只参考：批评型真实风格示例】\n示例1（作业完成差 + 明确要求）：学生表现：这次作业完成度不达标，没有按照老师的要求完成任务，一周的时间其实绰绰有余。要端正学习态度，学习作业太多也能理解，但还是要积极完成老师的作业。\n示例2（课后不复习）：学生表现：课后的复习巩固明显不够，上次讲过的例题这次再让他复述，还是说不出来。听懂和真正掌握不是一回事，课后如果不自己过一遍，很快就会忘，这点要引起重视。\n示例3（低级错误多）：学生表现：这节课的练习学生不是完全不会做，但低级错误比较多，尤其是审题和计算，这里错一点那里错一点，导致正确率偏低。如果考试还这样，那成绩自然就不理想。不能觉得自己会了只是粗心而已，要引起重视！\n示例4（有些自满，需要收状态）：学生表现：前面考得还可以之后，状态有点飘，上课的专注度明显比不上之前了。学习是一个漫长的过程，考得好的确可以开心一下，但千万不要骄傲自满。后面好好调整，尽快把心收回来。\n示例5（真实反馈参考：讲过多次还错）：学生表现：这类题最近已经练过几次，但这次独立做的时候还是没能写出来。如果只是听懂，课后不重新整理，过一周还是会忘。讲过多次的题型如果还出错，就需要反思一下课后有没有真正按要求老师进行归纳总结。";

        if (tone === "encourage") return encourageExamples;
        if (tone === "critical") return criticalExamples;
        return neutralExamples;
    };

    // ========== 场景识别 ==========

    MODULE.inferSceneTags = function (formData) {
        var tags = [];
        var highlights = ((formData && formData.selectedHighlights) || []).join("、");
        var weak = ((formData && formData.selectedWeak) || []).join("、");
        var realNotesList = PP.getRealNotesList(formData);
        var notes = realNotesList.concat([formData && formData.homework, formData && formData.nextFocus]).filter(Boolean).join("；");
        var all = highlights + "；" + weak + "；" + notes;
        var compact = all.replace(/\s+/g, "");
        var add = function (tag) { if (tag && tags.indexOf(tag) < 0) tags.push(tag); };

        if (/基础题型基本过关|讲过的方法能用出来/.test(highlights)) add("基础题型基本过关，可以肯定方法掌握，但不要夸张拔高");
        if (/能独立完成中档题|解题思路清晰/.test(highlights)) add("思路比较清楚，能逐步过渡到中档题或完整表达训练");
        if (/带着问题来上课|主动问|主动提问|答疑/.test(highlights + notes)) add("能带着问题上课，课堂效率较高，课后要独立再写一遍");
        if (/状态比之前好一些/.test(highlights)) add("状态有改善，适合鼓励但不要夸张");
        if (/学习态度端正/.test(highlights)) add("学习态度正常，可作为保底肯定但不要过度拔高");
        if (/笔记整理得不错|笔记.*(不错|完整|清楚|认真)|整理.*笔记/.test(highlights + notes)) add("笔记整理有可保持的地方，但要转化成做题稳定性");
        if (/作业完成情况良好/.test(highlights)) add("课后落实情况较好，可以自然肯定作业完成情况");
        if (/课上互动比较积极|课堂专注度较好/.test(highlights)) add("课堂配合和专注度较好，可以写成上课能跟住、愿意回应");
        if (/主动订正错题/.test(highlights + notes)) add("能主动订正错题，说明有复盘意识，但要提醒不能只改答案");
        if (/答题步骤比之前规范/.test(highlights + notes)) add("答题步骤有进步，可以肯定规范性变好，同时提醒继续稳住");
        if (/正确率较高/.test(highlights) || (formData && formData.correctness !== null && formData.correctness >= 85)) add("正确率较高，整体掌握不错，但仍要看是否稳定");

        if (/基础知识点有遗忘|课后缺乏复习巩固|遗忘|忘记|没想起来|前面.*忘/.test(all)) add("讲过内容有遗忘，课后复习和回顾需要加强");
        if (/讲过的题型还不能独立写出|讲过.*不能独立|讲过.*不会写|讲过.*还错/.test(all)) add("讲过题型还不能独立写出，要回到题型方法和独立复现");
        if (/公式应用不熟|公式.*应用不熟|公式.*不会用|公式.*代不进去/.test(all)) add("公式记忆可能有基础，但题目应用还不够熟练");
        if (/做题正确率不稳定/.test(all) || (formData && formData.correctness !== null && formData.correctness >= 60 && formData.correctness < 85)) add("正确率中等或不稳定，需要提升稳定性");
        if (/中难题需要提醒思路|中档题需要提醒思路|需要提醒|依赖老师提示|依赖提示|不靠提示|不能独立/.test(all)) add("中难题或完整题需要减少提示，训练独立起步和完整表达");
        if (/题目信息提取困难|读不懂题目意思|信息提取|读题.*困难|条件.*找不到/.test(all)) add("题目阅读和信息提取能力需要加强");
        if (/听懂了但是还是无法独自解题|听懂.*无法.*独自|听懂.*不会做|听懂.*做不出|方法会了?但.*(做不出来|算不出来|落不下来)|方法能听懂/.test(compact)) add("听懂方法到独立做对之间有断层，重点写落笔、计算和完整步骤");
        if (/计算容易出错|计算.*错|化简.*错|符号.*错|低级错误/.test(all)) add("会做的题容易因为计算细节丢分");
        if (/审题不够细心|审题.*(不细|漏看)|条件.*漏/.test(all)) add("审题细节不稳，容易漏条件或看错要求");
        if (/解题步骤不够规范|步骤.*(跳步|漏写|不规范)|符号.*漏|化简.*跳/.test(all)) add("大题步骤、符号和书写规范会影响得分，需要单独提醒");
        if (/做题速度偏慢|速度慢|来不及|时间不够/.test(all)) add("做题速度偏慢，需要提高熟练度和时间分配");
        if (/错题未订正|错题.*没.*订正|没有订正错题|订正.*不到位/.test(all)) add("错题订正不到位，需要重新独立写一遍，而不是只看答案");
        if (/缺乏举一反三的能力|举一反三|迁移能力|换个问法|变式/.test(all)) add("知识点迁移和变式能力偏弱，需要从同类题归纳方法");
        if (/作业完成度不达标|作业.*(没写|没完成|只做了一半|质量差|不达标)/.test(all)) add("课后任务落实不到位，需要明确提醒作业质量和完成度");
        if (/课上互动不积极|上课有些犯困|犯困|走神|互动.*不积极|不主动问|不太主动|积极性一般/.test(all)) add("课堂状态或互动不够理想，需要更主动暴露问题");
        if (/有些自满|自满|有点飘|飘了|考得不错.*飘|考好.*放松|松懈|骄傲/.test(all)) add("阶段性表现后有些自满，表达时要提醒把状态收回来");
        if (/不够自信|没信心|不敢下笔|怕错|犹豫|总等老师|等提示/.test(all)) add("信心不足或依赖提示，需要鼓励独立尝试，语气不要压太重");
        if (/学校进度.*快|进度.*偏快|新章节|新课/.test(all)) add("学校进度较快时，提醒前面内容要及时回顾，避免新旧内容断层");
        if (/速度角|位移角|小船渡河|左右手|楞次|变压器|圆锥曲线|导数|数列|排列组合|二项式|直线方程/.test(all + (formData && formData.knowledge || ""))) add("出现具体模型或章节时，优先围绕具体题型写，不要泛泛写能力问题");
        if (/物理量|字母|单位|数量级|cm|m|图像|读图|信息.*多|干扰条件/.test(all)) add("物理题要提醒模型、单位、图像和信息提取，写得具体一点");
        if (/手机搜题|搜题/.test(all)) add("作业如果借助搜题，要提醒暴露真实问题，不能把错题藏起来");
        if (formData && formData.correctness !== null && formData.correctness < 60) add("正确率偏低，需要优先巩固基础");
        if (/期中|期末|一模|二模|考试|考前|复习|月考/.test(all + (formData && formData.knowledge || ""))) add("考试或复习阶段，表达时要强调基础分、稳定性和讲过题型不要再错");
        return tags.slice(0, 10);
    };

    // ========== 事实白名单 ==========

    MODULE.buildFactWhitelist = function (formData) {
        var facts = [];
        var push = function (label, value) {
            if (Array.isArray(value)) {
                value.filter(Boolean).forEach(function (v, i) { facts.push(label + (i + 1) + "：" + v); });
            } else if (value !== undefined && value !== null && String(value).trim()) {
                facts.push(label + "：" + String(value).trim());
            }
        };
        push("学生姓名", formData && formData.studentName);
        push("学生性别", formData && formData.gender);
        push("日期", formatDateForTitle(formData && formData.date));
        push("科目", formData && formData.subject);
        push("教学内容", formData && formData.knowledge);
        if (formData && formData.correctness !== null) push("正确率", "约" + formData.correctness + "%");
        push("优点白名单", formData && formData.selectedHighlights);
        push("缺点白名单", formData && formData.selectedWeak);
        var realNoteItems = PP.getRealNotesList(formData);
        push("真实记录", realNoteItems.length ? realNoteItems : "无额外具体事件记录");
        push("自动识别情景", MODULE.inferSceneTags(formData).join("；") || "常规课后反馈");
        push("下节课关注点", formData && formData.nextFocus);
        push("改进方向", (formData && formData.shouldGenerateSuggestion) ? formData.selectedSuggestion : "不生成改进建议");
        push("寄语", formData && formData.selectedEncouragement);
        push("作业", formData && formData.homework);
        return facts;
    };

    MODULE.buildFactPrompt = function (formData) {
        var facts = MODULE.buildFactWhitelist(formData).join("\n");
        var praiseRule = (formData && formData.correctness !== null && formData.correctness >= 90)
            ? "【表扬允许】本次正确率≥90%，可以在反馈中适当使用"值得表扬"、"非常棒"、"继续加油"等正面肯定词，但仍禁止编造其他事实。"
            : "【表扬禁止】本次正确率低于90%，绝对禁止出现"值得表扬"、"非常棒"等词。";
        return "【事实白名单】\n" + facts + "\n\n" + praiseRule + "\n\n【绝对禁止】不得新增白名单外的具体错题次数、分数、迟到、作业未写等细节；不得编造任何不在白名单中的事件。";
    };

    // ========== 历史提示 ==========

    MODULE.getHistoryPromptBlock = async function (formData) {
        var history = await AC.getFeedbackHistory();
        var avoidItems = (function () {
            if (history.length < 3) return [];
            return C.HISTORY_PHRASE_CANDIDATES
                .map(function (phrase) {
                    var count = history.reduce(function (sum, item) { return sum + ((item.text || "").indexOf(phrase) >= 0 ? 1 : 0); }, 0);
                    return { phrase: phrase, count: count };
                })
                .filter(function (item) { return item.count >= 2; })
                .sort(function (a, b) { return b.count - a.count; })
                .slice(0, 8);
        })();
        if (history.length === 0) {
            return "【历史重复提醒】暂无历史反馈记录，本次正常生成。";
        }
        var avoidText = avoidItems.length
            ? avoidItems.map(function (item) { return "" + item.phrase + "（近" + history.length + "条出现" + item.count + "次）"; }).join("、")
            : "暂无明显高频重复句";
        return "【历史重复提醒】本地已保存最近" + history.length + "条反馈。本次要尽量避开近期高频表达：" + avoidText + "。\n处理方式：不要删事实，只换表达顺序、连接词和句式；尤其避免连续使用"课上表现良好、学习态度端正、继续加油、后续还需要"这类模板句。";
    };

    // ========== 主 Prompt 构建 ==========

    MODULE.buildInitialMessages = async function (formData) {
        var studentName = (formData && formData.studentName) || "这位同学";
        var date = formData && formData.date;
        var subject = (formData && formData.subject) || "科目";
        var grade = (formData && formData.grade) || "初中";
        var gender = (formData && formData.gender) || "男";
        var knowledge = (formData && formData.knowledge) || "本节课内容";
        var homework = (formData && formData.homework) || "";
        var nextFocus = (formData && formData.nextFocus) || "";
        var correctness = formData && formData.correctness;
        var selectedHighlights = (formData && formData.selectedHighlights) || [];
        var selectedWeak = (formData && formData.selectedWeak) || [];
        var selectedSuggestion = formData && formData.selectedSuggestion;
        var shouldGenerateSuggestion = formData && formData.shouldGenerateSuggestion;
        var selectedEncouragement = formData && formData.selectedEncouragement;
        var enableGreeting = formData && formData.enableGreeting;

        var hasHomework = homework && homework.trim() !== "";
        var hasNextFocus = nextFocus && nextFocus.trim() !== "";
        var sceneTags = MODULE.inferSceneTags(formData);
        var sceneText = sceneTags.join("；") || "常规课后反馈";
        var includeImprove = shouldGenerateSuggestion && (selectedWeak.length > 0 || selectedSuggestion);
        var pronoun = gender === "男" ? "他" : "她";
        var teacherRole = grade + subject + "资深老师";
        var gradeHint = grade === "初中" ? "语气可以适当鼓励，但不要反复使用"不错""很好"这类单薄评价；指出问题时语气温和但具体。" : "语气更偏向高考/学业水平要求，可以适当强调逻辑严谨性和知识迁移能力。";
        var correctnessText = correctness !== null && correctness !== undefined ? "正确率约" + correctness + "%" : "未填写正确率";
        var realNotesText = formatRealNotesForPrompt(formData);
        var praiseInstruction = (correctness !== null && correctness !== undefined && correctness >= 90)
            ? "本次正确率较高（≥90%），允许在反馈中自然使用"值得表扬"、"非常棒"等肯定词，但依然不能编造其他事实。"
            : "本次正确率低于90%，绝对禁止使用"值得表扬"、"非常棒"等词，保持客观指出不足即可。";
        var toneInstruction = MODULE.getToneInstruction();
        var expressionModeInstruction = MODULE.getExpressionModeInstruction(formData);
        var antiStiffInstruction = MODULE.getAntiStiffInstruction();
        var realTeacherCorpusInstruction = MODULE.getRealTeacherCorpusInstruction(formData);
        var sceneWritingHints = MODULE.getSceneWritingHints(formData);
        var expressionMode = MODULE.getExpressionMode();
        var teachingContentRange = expressionMode === "vivid" ? "45~75字" : "35~60字";
        var teachingContentCount = expressionMode === "vivid" ? "2~3个" : "2个左右";
        var wordCountRange = MODULE.getWordCountRange();
        var minWords = wordCountRange[0];
        var maxWords = wordCountRange[1];
        var wordTarget = "正文总字数控制在" + minWords + "~" + maxWords + "字之间（只统计"教学内容、学生表现、改进建议"，不包含问候语、标题行和本周作业）。";
        var styleVariation = MODULE.getStyleVariation(formData);
        var historyPrompt = await MODULE.getHistoryPromptBlock(formData);
        var toneExampleBlock = MODULE.getToneExampleBlock(formData);

        var systemPrompt = "你是一位" + teacherRole + "，正在给家长写课后反馈。你的风格需要高度模仿一位有多年教学经验、说话直接、不爱说套话的老师。\n\n【核心风格要求】语言直接、简洁；像老师口述记录；允许直接指出问题；使用"我"第一人称；不要标准化分段；收尾简洁；允许口语化短句。\n\n【表达模式】\n" + expressionModeInstruction + "\n\n" + antiStiffInstruction + "\n\n" + realTeacherCorpusInstruction + "\n\n" + sceneWritingHints + "\n\n" + styleVariation + "\n\n" + historyPrompt + "\n\n【自然表达要求】\n1. 禁止使用生硬句式："倒是""这点不错""这点很好""公式默写倒是全对""整体来看""总体而言""存在一定问题"。\n2. 如果要表达"公式默写全对"，优先写成"公式默写这块没有问题，说明基础记忆是过关的"或"公式记忆这部分不用太担心"。\n3. 不要机械写成"优点+这点不错"。要写出优点背后的意义，或者直接接后续要求。\n4. 每次生成都要在不新增事实的前提下变换表达顺序和连接词，避免像复制粘贴。\n5. 不要把所有勾选项逐条罗列，优点最多展开2个，问题最多展开2个，其余可以合并概括。\n6. 学生表现段优先写成自然段，不要写成"第一、第二、第三"的清单。\n7. 同一件事只写一次，尤其是"下次课/后续会盯""基础分/稳定性""步骤规范/计算细节""课后任务/不要松懈"，不要前后换个说法重复一遍。\n8. 语句要像老师顺手发微信：可以写"能听懂，但自己做还不稳""这块先收一收""先把会的题做对""我暂时不太担心""要引起重视"，少写"说明其具备较好基础""反映出存在不足"这类评语腔。\n9. 宁可少写一点，也不要为了凑字反复解释同一个问题。每个事实说清楚即可，不要铺垫太多。\n10. 允许把老师的判断写出来，但必须有事实支撑；不要为了自然去编造"忘带笔记本、迟到、游戏、家长督促"等白名单外细节。\n\n【学科与年级适配】" + gradeHint + "\n\n【表扬条件】" + praiseInstruction + "\n\n【语气调节】" + toneInstruction + "\n\n【字数要求】" + wordTarget + "\n\n【事实铁律】反馈中出现的所有具体事实（如正确率、错题类型、行为表现、作业完成情况等）必须严格来自【事实白名单】。严禁编造任何不在白名单内的具体数字、题号、次数、迟到、未带资料等细节。如果白名单没有提供具体数据，只能使用概括性语言（如"这部分还需要巩固""计算细节要注意"）。\n\n【课上真实记录使用规则】\n- 课上真实记录最多4条，每条都是独立事实，不默认存在因果关系。\n- 可以把不同真实记录分散融入学生表现段，不必连续写在同一句里。\n- 除非用户明确写了"因为/所以/导致/因此"，否则不要用"所以、导致、因此"把两条记录强行连成因果。\n- 例如"期中考完有点飘"和"方法会了但算不出来"应分别表达为状态需要收回来、方法落地和计算还不稳，而不是揉成一句模板话。\n- 真实记录不是寄语，也不是必须原样出现；保留事实意思即可，表达要自然。\n\n【自动识别情景】" + sceneText + "\n请根据这些情景组织"学生表现"段，不要机械罗列优点和缺点；情景只用于确定写作重点，不能当作额外事实去编造细节。\n\n【下节课关注点】" + (hasNextFocus ? nextFocus : "未填写") + "\n若填写了下节课关注点，它只是"后续教学规划参考"，不是寄语，也不是固定尾句。\n写法要求：可以把它融入问题分析或后续训练安排里，用一句自然的话带过；不要求原文出现；不要连续写两句"下次课/后续/我会……"的同义提醒；如果正文里已经有近似表达，绝对不要再补原句。\n\n【固定结构】（正文目标" + minWords + "~" + maxWords + "字，不输出标题行！直接输出教学内容、学生表现等，不要输出"xxx课程反馈"作为独立一行。）\n教学内容：围绕核心知识点扩展" + teachingContentCount + "个紧密相关的子内容，" + teachingContentRange + "，不要写成教材目录。\n学生表现：占正文的主要部分，至少达到" + Math.floor(minWords * 0.52) + "字以上；自然段表达，不要机械罗列优缺点。若有寄语，只保留核心意思自然改写，不要把寄语当固定尾巴硬贴。\n" + (includeImprove ? "改进建议：25~45字，只针对白名单中的薄弱点，别重复学生表现里已经说过的话。\n" : "") + (hasHomework ? "本周作业：必须作为最后一行单独输出，格式固定为"本周作业：用户填写的作业"，不改写、不扩写、不并入学生表现，且不计入正文字数。\n" : "") + "\n【绝对禁止】\n1. 新增白名单外的具体错题次数、分数、迟到、作业未写等细节。\n2. 禁止套话如"家校配合""持续赋能"。\n3. 禁止机械列优点/缺点清单。\n4. 禁止输出标题行（如"xx月xx日xx课程反馈"单独一行）。\n\n【人称代词】统一使用"" + pronoun + ""。\n\n【风格示例调用规则】当前选择什么语气，就只参考对应语气的示例，不要把三种语气混在一起平均化。\n" + toneExampleBlock + "\n\n【语气差异要求】\n- 鼓励模式：优先写进步、状态、主动性和可保持的地方，问题放在后半段，语气温和但不虚夸。\n- 平和模式：优点和问题都写，语气客观，像日常给家长同步情况。\n- 批评模式：优先写主要问题和后果，语气更直接，最后给具体要求。\n- 不管哪种语气，都必须严格基于事实白名单，不能为了语气效果新增事实。\n\n【写作核心】教学内容段落必须基于"" + knowledge + ""扩展出" + teachingContentCount + "个紧密相关的子知识点，控制在" + teachingContentRange + "；学生表现段要像真实老师微信反馈，不能僵硬。直接输出反馈正文，不要任何解释。";

        if (!enableGreeting) {
            systemPrompt += "\n【特别注意】由于家长关闭了问候语，反馈正文的第一行必须是标题行，格式为"" + studentName + formatDateForTitle(date) + subject + "课后反馈"，独占一行，标题行不计入总字数。标题行之后换行再输出"教学内容："等段落。";
        } else {
            systemPrompt += "\n【格式】绝对禁止输出任何标题行（如"x月x日xx课程反馈"），直接输出"教学内容："、"学生表现："等段落。";
        }

        var userPrompt = MODULE.buildFactPrompt(formData) + "\n【本次生成要求】\n不输出标题行，直接输出教学内容、学生表现等。\n学生：" + studentName + "（" + gender + "）\n年级：" + grade + " | 科目：" + subject + "\n教学内容核心：" + knowledge + " -> 扩展" + teachingContentCount + "个左右子知识，" + teachingContentRange + "，不要写成教材目录。\n表达模式：" + (expressionMode === "vivid" ? "生动：表达更顺一些，但不要作文腔" : "真实：朴素直接，像老师微信") + "\n优点：" + (selectedHighlights.join("、") || "无明显突出优点") + "\n薄弱点：" + (selectedWeak.join("、") || "无明确薄弱点") + "\n真实记录（最多4条独立事实，不能强行合并成因果）：\n" + realNotesText + "\n自动识别情景：" + sceneText + "\n" + sceneWritingHints + "\n" + (hasNextFocus ? "下节课关注点：" + nextFocus + "（这是后续教学规划参考，不是寄语；可以改写，不要求原文出现；如果正文已有同义表达，不要再补原句）" : "下节课关注点：未填写，不要编造") + "\n正确率：" + correctnessText + "\n" + (includeImprove ? "改进方向：" + selectedSuggestion : "不生成改进建议") + "\n" + (selectedEncouragement ? "寄语参考：" + selectedEncouragement + "（保留核心意思即可，可以自然改写；不要硬贴在学生表现段末尾；不要和前文同义重复）" : "") + "\n" + (hasHomework ? "作业：" + homework + "（必须单独成最后一行，固定写成"本周作业：" + homework + ""，不要并入学生表现，也不要改写）" : "不生成作业段落") + "\n" + (hasNextFocus ? "下节课关注点不要单独成段，不要当寄语，不要固定放在最后；如果已经自然写进计划，就不要再写第二遍。" : "不写下节课关注点") + "\n当前语气模式：" + MODULE.getToneMode() + "。只模仿当前语气对应的示例，不要把鼓励、平和、批评三种语气平均化。\n" + await MODULE.getHistoryPromptBlock(formData) + "\n学生表现至少" + Math.floor(minWords * 0.52) + "字。\n不要写"公式默写倒是全对，这点不错/很好""整体来看""此外学生""存在一定问题""这一点先保持"等生硬句；如果出现公式默写全对，改写成"公式默写这块没有问题，说明基础记忆是过关的"。所有语气模式都要自然。\n输出完整反馈" + (!enableGreeting ? "（第一行必须是标题行）" : "（不要标题行）") + "。";

        return [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];
    };

    // ========== 快速生成 ==========

    MODULE.getQuickPreset = function (studentType, direction) {
        var key = (studentType || "普通学生") + "|" + (direction || "表扬鼓励");
        return C.QUICK_PRESETS[key] || C.QUICK_PRESETS["普通学生|表扬鼓励"];
    };

    MODULE.buildQuickFormData = function (baseFormData) {
        var studentTypeEl = document.getElementById("quickStudentType");
        var directionEl = document.getElementById("quickFeedbackDirection");
        var studentType = studentTypeEl ? studentTypeEl.value : "普通学生";
        var direction = directionEl ? directionEl.value : "表扬鼓励";
        var preset = MODULE.getQuickPreset(studentType, direction);
        var hasManualHighlights = Array.isArray(baseFormData && baseFormData.selectedHighlights) && baseFormData.selectedHighlights.length > 0;
        var hasManualWeak = Array.isArray(baseFormData && baseFormData.selectedWeak) && baseFormData.selectedWeak.length > 0;
        var hasManualNotes = Array.isArray(baseFormData && baseFormData.realNotesList) && baseFormData.realNotesList.length > 0;
        var selectedHighlights = hasManualHighlights ? baseFormData.selectedHighlights : preset.highlights;
        var selectedWeak = hasManualWeak ? baseFormData.selectedWeak : preset.weak;
        var realNotesList = hasManualNotes ? baseFormData.realNotesList : preset.realNotes;

        var result = {};
        for (var k in baseFormData) { if (baseFormData.hasOwnProperty(k)) result[k] = baseFormData[k]; }
        result.selectedHighlights = selectedHighlights;
        result.selectedWeak = selectedWeak;
        result.realNotesList = realNotesList;
        result.realNotes = realNotesList.join("；");
        result.quickMode = true;
        result.quickStudentType = studentType;
        result.quickDirection = direction;
        result.quickToneHint = preset.toneHint;
        result.shouldGenerateSuggestion = baseFormData && baseFormData.shouldGenerateSuggestion;
        result.selectedSuggestion = baseFormData && baseFormData.selectedSuggestion;
        return result;
    };

    MODULE.buildQuickMessages = function (formData) {
        var pronoun = (formData && formData.gender === "女") ? "她" : "他";
        var hasHomework = formData && formData.homework && formData.homework.trim() !== "";
        var includeImprove = formData && formData.shouldGenerateSuggestion && formData.selectedSuggestion;
        var wordCountRange = MODULE.getWordCountRange();
        var minWords = wordCountRange[0];
        var maxWords = wordCountRange[1];
        var direction = (formData && formData.quickDirection) || "表扬鼓励";
        var studentType = (formData && formData.quickStudentType) || "普通学生";
        var sceneText = MODULE.inferSceneTags(formData).join("；") || "常规课后反馈";
        var correctnessText = (formData && formData.correctness !== null) ? "正确率约" + formData.correctness + "%" : "未填写正确率";
        var studentName = (formData && formData.studentName) || "这位同学";
        var grade = (formData && formData.grade) || "初中";
        var subject = (formData && formData.subject) || "科目";
        var knowledge = (formData && formData.knowledge) || "本节课内容";
        var enableGreeting = formData && formData.enableGreeting;
        var homework = formData && formData.homework || "";
        var gender = formData && formData.gender || "男";
        var date = formData && formData.date;

        var systemPrompt = "你是一位" + grade + subject + "老师，正在给家长快速生成课后反馈。\n\n这是"快速生成"：用户只给了学生类型和反馈方向，提示词会比较笼统。你可以根据学生类型和本节课内容，合理补充1~2个常见、泛化的课堂事实，例如"基础题能跟上""中档题还需要提示""计算和步骤还不够稳""课后需要把讲过的题重新写一遍"。\n\n但要注意：\n1. 可以轻微泛化，不能编造具体分数、具体题号、迟到、玩手机、没写作业、家长督促、严重态度问题。\n2. "学霸/学渣/普通学生"只是内部生成参考，正文里绝对不要出现这些词。\n3. 最终反馈格式不变：" + (enableGreeting ? "不要输出标题行，直接从"教学内容："开始" : "第一行输出"" + studentName + formatDateForTitle(date) + subject + "课后反馈"") + "。\n4. 必须有"教学内容："和"学生表现："。" + (includeImprove ? "可以有"改进建议："。" : "不要生成"改进建议："。") + (hasHomework ? "最后必须单独输出"本周作业：用户填写的作业"。" : "不要生成作业段落。") + "\n5. 语言像老师顺手发微信，别写成报告，少用"整体来看、总体而言、存在一定问题、反映出、体现了"。\n6. 字数控制在" + minWords + "~" + maxWords + "字左右（不含问候语、标题行和作业）。\n7. 人称统一用"" + pronoun + ""。\n\n输出时不要解释过程，直接输出完整反馈。";

        var userPrompt = "学生：" + studentName + "（" + gender + "）\n年级：" + grade + "\n科目：" + subject + "\n日期：" + formatDateForTitle(date) + "\n本节课内容：" + knowledge + "\n快捷学生类型：" + studentType + "（内部参考，正文不要出现这个词）\n快捷反馈方向：" + direction + "\n快捷语气提示：" + ((formData && formData.quickToneHint) || "按老师真实反馈写") + "\n可用优点方向：" + ((formData && formData.selectedHighlights || []).join("、")) + "\n可用问题方向：" + ((formData && formData.selectedWeak || []).join("、")) + "\n可用课堂事实：" + formatRealNotesForPrompt(formData) + "\n正确率：" + correctnessText + "\n自动识别情景：" + sceneText + "\n" + (includeImprove ? "改进方向：" + formData.selectedSuggestion : "不生成改进建议") + "\n" + (hasHomework ? "作业：" + homework + "（最后一行必须原样写成"本周作业：" + homework + ""）" : "不生成作业段落") + "\n\n请按固定格式生成：\n教学内容：围绕"" + knowledge + ""写2个左右相关子内容，不要写成教材目录。\n学生表现：根据学生类型和反馈方向快速写一段真实老师风格反馈。" + (direction === "批评提醒" ? "问题说具体一点，但不要攻击学生。" : "先肯定具体表现，再温和提醒一个问题。") + "\n" + (includeImprove ? "改进建议：25~45字，针对主要薄弱点。\n" : "") + (hasHomework ? "本周作业：" + homework + "\n" : "") + "\n" + (enableGreeting ? "不要输出标题行。" : "第一行必须是"" + studentName + formatDateForTitle(date) + subject + "课后反馈"。");

        return [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];
    };

    // ========== 二次修改 ==========

    MODULE.buildRevisionInstruction = function (type, formData) {
        var map = {
            shorter: "请把当前反馈压缩得短一点，大约减少20%~30%的字数。保留关键事实、主要问题、作业行和称呼，不要删掉最重要的教学判断。",
            longer: "请把当前反馈适当写长一点，大约增加80~140个中文字。只能围绕已有事实补充教学判断、原因和后续要求，不允许编造新的课堂表现。",
            natural: "请把当前反馈改得更像真实老师发给家长的微信。减少AI味、模板味和书面总结感，多用自然短句，但不要改变事实。",
            encourage: "请让语气多一点鼓励和正向引导。先肯定具体表现，再提醒问题和后续要求。鼓励要落到具体动作上，不要空喊加油，也不要无依据夸大。",
            strict: "请让语气更严厉、更直接一些。重点把问题和后果说清楚，但只批评学习行为和课堂事实，不攻击学生，不使用羞辱性表达。",
            wechat: "请把当前反馈改得更像老师临时随手发给家长的微信：口语一点、短句多一点、少一点栏目感和总结感。可以保留原有标签和换行，但每句话要像真人顺手写出来。不要加表情，不要过分热情，不要编造新事实，不要把作业内容改掉。",
            emoji: "请在当前反馈中自然加入微信自带表情，让语气更像老师发微信给家长。默认只加2-3个表情，反馈特别长时最多4个，不要主动加满5个。只能使用这些表情：[强][偷笑][愉快][加油][玫瑰][叹气][擦汗][尴尬][呲牙][庆祝][好的][耶][敲打][拥抱][囧][失望][裂开][难过]。表情要少而自然，放在真正适合的位置，不要堆表情，不要每段都加，不要改变原文事实和结构。"
        };
        return map[type] || map.natural;
    };

    function hasSection(text, sectionName) {
        var normalized = PP.normalizeText(text || "");
        var escapedName = PP.escapeRegExp(sectionName);
        var pattern = new RegExp("(^|\n)" + escapedName + "[:：]");
        return pattern.test(normalized);
    }

    function getExistingSectionsFromText(text) {
        var sectionNames = ["教学内容", "学生表现", "改进建议", "本周作业"];
        return sectionNames.filter(function (name) { return hasSection(text, name); });
    }

    function buildExistingSectionRule(currentText) {
        var existingSections = getExistingSectionsFromText(currentText);
        if (!existingSections.length) {
            return "不要新增任何段落标签，也不要把内容拆成新的固定栏目。";
        }
        var sectionText = existingSections.map(function (name) { return "" + name + "："; }).join("、");
        return "只保留原文已有标签：" + sectionText + "。原文没有的标签绝对不要新增，尤其是原文没有"改进建议："时，不要为了让语气更严厉而补出改进建议段。";
    }

    MODULE.buildRevisionMessages = function (type, currentText, formData) {
        var pronoun = (formData && formData.gender === "女") ? "她" : "他";
        var sectionRule = buildExistingSectionRule(currentText);
        var homeworkRule = hasSection(currentText, "本周作业") && formData && formData.homework
            ? "如果原文有"本周作业：" + normalizeHomeworkText(formData.homework) + ""，必须保留为最后一行，作业内容不要改写。"
            : "如果原文没有作业，不要新增作业段落。";
        var suggestionRule = hasSection(currentText, "改进建议")
            ? "原文已有"改进建议："时，可以在该段内调整语气，但不要新增新的事实。"
            : "原文没有"改进建议："，本次二次修改绝对不要新增"改进建议："段落，也不要用其他标题变相新增建议段。";
        var factWhitelist = [
            "学生：" + (formData && formData.studentName),
            "性别：" + (formData && formData.gender) + "，全文只能使用"" + pronoun + ""作为第三人称，不要写错人称",
            "年级科目：" + (formData && formData.grade) + (formData && formData.subject),
            "教学内容：" + (formData && formData.knowledge),
            "真实记录：" + formatRealNotesForPrompt(formData),
            "优点：" + ((formData && formData.selectedHighlights || []).join("、") || "无"),
            "问题：" + ((formData && formData.selectedWeak || []).join("、") || "无"),
            "正确率：" + ((formData && formData.correctness !== null) ? formData.correctness + "%" : "未填写"),
            "改进方向：" + ((formData && formData.selectedSuggestion) || "无"),
            "下节课关注点：" + ((formData && formData.nextFocus) || "无"),
            "作业：" + ((formData && formData.homework) || "无")
        ].join("\n");

        return [
            {
                role: "system",
                content: "你是一位真实教培老师，只负责对已经生成好的课后反馈做二次改写。\n核心原则：不新增事实，不改变学生姓名、日期、科目、称呼和作业；严格沿用原文已有栏目结构；原文没有的栏目不要新增；不要解释修改过程，直接输出完整反馈。"
            },
            {
                role: "user",
                content: "【二次修改要求】\n" + MODULE.buildRevisionInstruction(type, formData) + "\n" + (type === "wechat" ? "\n【微信随手感额外要求】\n- 少用完整总结句，多用老师自然判断，比如"这块先不用太担心""现在主要卡在……""后面我会继续盯一下"。\n- 不要写成正式报告，不要为了口语化而加"哈、呀、哦"这类语气词。\n- 保留家长能看懂的重点：本节课讲了什么、哪里还行、哪里要改、后面怎么做。" : "") + (type === "emoji" ? "\n【加表情额外要求】\n- 只允许使用：[强][偷笑][愉快][加油][玫瑰][叹气][擦汗][尴尬][呲牙][庆祝][好的][耶][敲打][拥抱][囧][失望][裂开][难过]，不要使用其他 emoji 或符号表情。\n- 表情总数默认控制在2-3个；反馈特别长时最多4个；不要主动加满5个。放在自然停顿处，不要每句话都加，不要每段都加。\n- 优点、进步、正确率高可用[强][愉快][庆祝][好的][耶]；继续努力可用[加油]；鼓励和安抚可用[拥抱][玫瑰]；比较轻松的提醒可少量用[偷笑][呲牙]；问题明显、状态不好或有点尴尬时可用[叹气][擦汗][尴尬][囧][失望][裂开][难过]；需要稍微提醒时可少量用[敲打]，但不要过度。\n- 加表情只是让微信感更强，不要改事实，不要新增栏目，不要改变作业内容。" : "") + "\n【必须遵守】\n1. 保留第一行称呼或标题行，不要擅自改称呼。\n2. " + sectionRule + "\n3. " + homeworkRule + "\n4. " + suggestionRule + "\n5. 不允许新增迟到、玩手机、没写作业、家长督促等原文和白名单里没有的事实。\n6. 不要写成AI总结，不要出现"整体来看、总体而言、此外、存在一定问题、有待提高、反映出、体现了"等模板词。\n7. 如果正确率低于90%，不要使用"非常棒""值得表扬"等过强夸奖。\n\n【事实白名单】\n" + factWhitelist + "\n\n【当前反馈】\n" + currentText + "\n\n请直接输出二次修改后的完整反馈。"
            }
        ];
    };

    window.App.prompts = MODULE;
})();
