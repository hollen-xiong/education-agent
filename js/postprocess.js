/**
 * postprocess.js — 后处理管道、文本清洗、校验
 * 依赖：config.js, storage.js
 * 挂载：window.App.postprocess
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;
    var AC = window.App.apiClient;

    var MODULE = {};

    // ========== 基础工具函数 ==========

    MODULE.escapeRegExp = function (str) {
        return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    MODULE.normalizeText = function (text) {
        return (text || "")
            .replace(/\r\n/g, "\n")
            .replace(/^```[a-zA-Z]*\s*/g, "")
            .replace(/```$/g, "")
            .replace(/\n\s*\n+/g, "\n")
            .replace(/[ \t]+$/gm, "")
            .trim();
    };

    function getTextLength(text) {
        return (text || "").replace(/\s+/g, "").length;
    }

    function normalizeHomeworkText(homework) {
        return String(homework || "").replace(/\s+/g, " ").trim();
    }

    // ========== 真实记录处理 ==========

    function normalizeRealNotesList(notes) {
        var rawItems = [];
        if (Array.isArray(notes)) {
            rawItems = notes;
        } else if (typeof notes === "string") {
            rawItems = notes.split(/\n|；|;/);
        }
        return rawItems
            .map(function (item) {
                return String(item || "")
                    .replace(/^\s*[（(]?\d+[）).、:：\s-]*/g, "")
                    .replace(/\s+/g, " ")
                    .trim();
            })
            .filter(Boolean)
            .filter(function (item, idx, arr) { return arr.indexOf(item) === idx; })
            .slice(0, 4);
    }

    MODULE.getRealNotesList = function (formData) {
        return normalizeRealNotesList(formData && (formData.realNotesList || formData.realNotes || ""));
    };

    // ========== 日期工具 ==========

    function formatDateForTitle(dateStr) {
        var match = String(dateStr || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) return parseInt(match[2], 10) + "月" + parseInt(match[3], 10) + "日";
        var d = new Date(dateStr || Date.now());
        if (!isNaN(d.getTime())) return (d.getMonth() + 1) + "月" + d.getDate() + "日";
        var today = new Date();
        return (today.getMonth() + 1) + "月" + today.getDate() + "日";
    }

    function formatRealNotesForPrompt(formData) {
        var list = MODULE.getRealNotesList(formData);
        if (!list.length) return "无额外具体事件记录";
        return list.map(function (item, idx) { return (idx + 1) + ". " + item; }).join("\n");
    }

    // ========== 反馈历史去重 ==========

    MODULE.stripForHistory = function (text) {
        return MODULE.normalizeText(text || "")
            .split("\n")
            .filter(function (line, idx) {
                var trimmed = line.trim();
                if (!trimmed) return false;
                if (idx === 0 && /好，这是.*课程反馈$/.test(trimmed)) return false;
                if (idx === 0 && /\d{1,2}月\d{1,2}日.*课后反馈$/.test(trimmed)) return false;
                return true;
            })
            .join("\n")
            .replace(/教学内容：/g, "")
            .replace(/学生表现：/g, "")
            .replace(/改进建议：/g, "")
            .replace(/本周作业：/g, "")
            .trim();
    };

    function countPhraseInHistory(phrase, history) {
        return history.reduce(function (sum, item) {
            return sum + ((item.text || "").indexOf(phrase) >= 0 ? 1 : 0);
        }, 0);
    }

    async function getHistoryAvoidPhrases() {
        var history = await AC.getFeedbackHistory();
        if (history.length < 3) return [];
        return C.HISTORY_PHRASE_CANDIDATES
            .map(function (phrase) { return { phrase: phrase, count: countPhraseInHistory(phrase, history) }; })
            .filter(function (item) { return item.count >= 2; })
            .sort(function (a, b) { return b.count - a.count; })
            .slice(0, 8);
    }

    function extractFeedbackSentences(text) {
        return MODULE.stripForHistory(text || "")
            .replace(/\n/g, "。")
            .split(/[。！？!?；;]/)
            .map(function (s) { return s.trim().replace(/\s+/g, ""); })
            .filter(function (s) { return s.length >= 10 && s.length <= 65; })
            .filter(function (s) { return !/^本周作业/.test(s); });
    }

    function charBigrams(str) {
        var s = (str || "").replace(/[\s，。！？；：,.!?;:]/g, "");
        var set = {};
        for (var i = 0; i < s.length - 1; i++) { set[s.slice(i, i + 2)] = true; }
        return set;
    }

    function sentenceSimilarity(a, b) {
        var A = charBigrams(a), B = charBigrams(b);
        var keysA = Object.keys(A), keysB = Object.keys(B);
        if (keysA.length === 0 || keysB.length === 0) return 0;
        var inter = 0;
        keysA.forEach(function (x) { if (B[x]) inter++; });
        return inter / Math.max(keysA.length, keysB.length);
    }

    MODULE.getHistoricalRepeatReport = async function (feedback, formData) {
        var history = await AC.getFeedbackHistory();
        if (history.length < 2) {
            return { severe: false, message: "历史样本较少，暂不做强重复判断", overusedPhrases: [], similarSentences: [] };
        }
        var clean = MODULE.stripForHistory(feedback || "");
        var overusedPhrases = getHistoryAvoidPhrases()
            .filter(function (item) { return clean.indexOf(item.phrase) >= 0; })
            .map(function (item) { return item.phrase; });

        var currentSentences = extractFeedbackSentences(clean);
        var previousSentences = [];
        history.forEach(function (item) {
            previousSentences = previousSentences.concat(extractFeedbackSentences(item.text || ""));
        });
        var similarSentences = [];
        var maxScore = 0;
        for (var i = 0; i < currentSentences.length; i++) {
            for (var j = 0; j < previousSentences.length; j++) {
                var score = sentenceSimilarity(currentSentences[i], previousSentences[j]);
                if (score > maxScore) maxScore = score;
                if (score >= 0.86) {
                    similarSentences.push(currentSentences[i]);
                    break;
                }
            }
            if (similarSentences.length >= 3) break;
        }
        var severe = overusedPhrases.length >= 3 || similarSentences.length >= 2 || maxScore >= 0.92;
        var message = "历史检验通过，未发现明显重复";
        if (overusedPhrases.length || similarSentences.length) {
            var parts = [];
            if (overusedPhrases.length) parts.push("高频短语：" + overusedPhrases.slice(0, 4).join("、"));
            if (similarSentences.length) parts.push("相似句" + similarSentences.length + "处");
            message = parts.join("；");
        }
        return { severe: severe, message: message, overusedPhrases: overusedPhrases, similarSentences: similarSentences, maxScore: maxScore };
    };

    // ========== 文本清洗（生硬表达替换） ==========

    function polishAwkwardPhrases(feedback, formData) {
        var text = MODULE.normalizeText(feedback || "");
        var replacements = [
            [/公式默写倒是全对[，,。\s]*(这点)?(不错|很好|值得肯定)?[。.]?/g, "公式默写这块没有问题，说明基础记忆是过关的。"],
            [/公式默写(是)?全对[，,。\s]*(这点)?(不错|很好|值得肯定)[。.]?/g, "公式默写这块没有问题，说明基础记忆是过关的。"],
            [/公式默写(是)?全对[，,。\s]*/g, "公式默写这块没有问题，"],
            [/这一点先保持/g, "继续保持"],
            [/这一点可以保持/g, "继续保持"],
            [/这点不错/g, "继续保持"],
            [/这点很好/g, "这部分不用太担心"],
            [/这点值得肯定/g, "继续保持"],
            [/倒是/g, ""],
            [/整体表现不错，继续加油/g, "整体状态还可以，后面继续保持"],
            [/学生整体表现不错，继续加油/g, "学生整体状态还可以，后面继续保持"],
            [/表现良好，继续保持/g, "这节课状态是可以的，后面保持住"],
            [/这点是值得表扬的/g, "继续保持"],
            [/这点是值得肯定的/g, "继续保持"],
            [/整体来看，?/g, ""],
            [/总体而言，?/g, ""],
            [/此外，学生/g, "另外，学生"],
            [/此外，/g, "另外，"],
            [/与此同时，/g, "另外，"],
            [/后续还需要继续/g, "后面还要"],
            [/后续还需要/g, "后面还要"],
            [/目前主要问题在于/g, "现在主要问题是"],
            [/这部分内容/g, "这块内容"],
            [/知识点层面/g, "知识点上"],
            [/存在一定问题/g, "还不够稳"],
            [/有待提高/g, "还要再练"],
            [/掌握得还可以/g, "掌握情况还行"],
            [/学习态度端正/g, "态度是可以的"],
            [/课上表现良好/g, "这节课状态还可以"],
            [/能够较好地/g, "基本能"],
            [/较为/g, "比较"],
            [/该生/g, "学生"],
            [/需要进一步加强/g, "还要再加强"],
            [/需要继续巩固/g, "还要再巩固"],
            [/本次课/g, "这节课"],
            [/方法都会，但一算就错/g, "方法能听懂，但自己落笔时计算和步骤还不稳"],
            [/方法会了但算不出来/g, "方法能听懂，但自己做题时还落不下来"],
            [/明显有点飘/g, "状态有点飘"],
            [/说明其/g, "说明"],
            [/反映出/g, "能看出"],
            [/具备较好/g, "有一定"],
            [/需进一步/g, "还要"],
            [/不依赖提示/g, "不靠提示"],
            [/独自做对一道完整的题/g, "自己把一道完整题做对"],
            [/独自做对一道题/g, "自己把题做对"],
            [/体现了?学生/g, "能看出学生"],
            [/反映出学生/g, "能看出学生"],
            [/反映出/g, "能看出"],
            [/说明其具备/g, "说明有"],
            [/具备较强/g, "有一定"],
            [/学习能力有所提升/g, "状态比之前好一些"],
            [/自主学习意识不足/g, "课后下的功夫还不够"],
            [/知识掌握存在漏洞/g, "有些知识点还没补牢"],
            [/需要进一步提升/g, "还要再练"],
            [/仍需进一步巩固/g, "还要再巩固"],
            [/建议后续/g, "后面"],
            [/后续建议/g, "后面"],
            [/表现较为/g, "表现比较"],
            [/完成情况较为/g, "完成情况比较"]
        ];
        replacements.forEach(function (pair) {
            text = text.replace(pair[0], pair[1]);
        });
        text = text
            .replace(/，。/g, "。")
            .replace(/。。+/g, "。")
            .replace(/，\s*，/g, "，")
            .replace(/学生表现：\s*。/g, "学生表现：")
            .replace(/教学内容：\s*另外，/g, "教学内容：")
            .replace(/学生表现：\s*另外，/g, "学生表现：")
            .replace(/改进建议：\s*另外，/g, "改进建议：")
            .replace(/([。！？])另外，另外，/g, "$1另外，");
        return MODULE.normalizeText(text);
    }

    function hasStiffExpression(feedback) {
        var stiffPatterns = [
            /倒是/, /这点不错/, /这点很好/, /公式默写倒是全对/,
            /整体来看/, /总体而言/, /存在一定问题/, /有待提高/,
            /能够较好地/, /该生/, /综上/, /家校配合/, /持续赋能/,
            /反映出/, /体现了/, /具备较强/, /仍需进一步/, /自主学习意识不足/, /知识掌握存在漏洞/,
            /此外，?学生.{0,18}此外/, /学生表现：学生/
        ];
        return stiffPatterns.some(function (pattern) { return pattern.test(feedback || ""); });
    }

    // ========== 人称检查 ==========

    function hasWrongPronoun(feedback, gender) {
        var text = feedback || "";
        if (gender === "男") {
            return /(^|[，。！？、；：\s])她(?![们人])/.test(text);
        }
        if (gender === "女") {
            return /(^|[，。！？、；：\s])他(?![们人])/.test(text);
        }
        return false;
    }

    // ========== 作业行处理 ==========

    MODULE.ensureHomeworkLine = function (feedback, formData) {
        var text = MODULE.normalizeText(feedback || "");
        var homework = normalizeHomeworkText(formData && formData.homework || "");

        text = text.replace(/\s*(本周作业|作业)[:：]/g, "\n本周作业：");

        if (!homework) {
            return MODULE.normalizeText(
                text.split("\n")
                    .filter(function (line) { return !/^\s*(本周作业|作业)[:：]/.test(line); })
                    .join("\n")
            );
        }

        var lines = text.split("\n")
            .map(function (line) { return line.trim(); })
            .filter(Boolean)
            .filter(function (line) { return !/^\s*(本周作业|作业)[:：]/.test(line); });

        lines.push("本周作业：" + homework);
        return MODULE.normalizeText(lines.join("\n"));
    };

    // ========== 下节课关注点 ==========

    function cleanNextFocusCore(nextFocus) {
        return (nextFocus || "")
            .trim()
            .replace(/^[。！？!?,，\s]+|[。！？!?,，\s]+$/g, "")
            .replace(/^(下次课|下节课|下一次课|后续|接下来|之后|后面)(我会|会|继续|重点)?/g, "")
            .replace(/^(重点看一下|重点看|看一下|看一看|关注一下|关注|重点抓|重点处理|重点巩固|继续盯一下|继续盯|盯一下|盯)/g, "")
            .replace(/^(学生|孩子|同学|他|她)/g, "")
            .replace(/^[，,：:；;\s]+/g, "")
            .trim();
    }

    function formatNextFocusSentence(nextFocus, formData) {
        var raw = (nextFocus || "").trim();
        if (!raw) return "";
        var pronoun = (formData && formData.gender === "女") ? "她" : "他";
        var core = cleanNextFocusCore(raw);
        if (!core) return "";

        if (/独立|独自|自己/.test(core) && /完整|一道|题/.test(core)) {
            return "后面课上会把这类题放到独立练习里，看" + pronoun + "能不能不靠提示把完整步骤写下来。";
        }
        if (/作业|任务|完成/.test(core)) {
            return "下次会先看课后任务落实情况，再根据完成质量决定哪些地方要补。";
        }
        if (/计算|步骤|规范|书写|化简|符号/.test(core)) {
            return "后面课上会把计算和书写规范一起盯，避免会思路但过程丢分。";
        }
        if (/审题|读题|信息提取/.test(core)) {
            return "后面练题时会继续看审题和信息提取，先把题意读准再动笔。";
        }
        if (/错题|复盘|整理/.test(core)) {
            return "下次会结合错题复盘情况，看这些方法有没有真正整理成自己的东西。";
        }
        return "后面课上会围绕\"" + core + "\"继续检查，但会放进具体题目里看，不单独停留在口头要求上。";
    }

    function normalizeFocusForCompare(text) {
        return (text || "")
            .replace(/[\s，。！？、；：,.!?;:]/g, "")
            .replace(/下(?:次|节|一次)课/g, "")
            .replace(/重点看一下|重点看|看一下|看一看|关注一下|关注|重点抓|重点处理|重点巩固/g, "")
            .replace(/后续|接下来|这块|这方面|方面|问题|目前|现在|之后|后面/g, "")
            .replace(/我会继续|会继续|我会|会|继续盯|继续|盯一下|盯|跟进一下|再看/g, "")
            .replace(/学生|孩子|同学|他|她/g, "")
            .replace(/能不能够|能不能|能否独立|能否|是否|可不可以/g, "")
            .replace(/不依赖老师提示|不依赖提示|不靠老师提示|不靠提示|不用提示|不需要提示/g, "")
            .replace(/自己|独立|独自/g, "")
            .replace(/完整的|完整地|完整/g, "")
            .replace(/一(?:道|个)?(?:的)?题目?/g, "题")
            .replace(/题型/g, "题")
            .replace(/[的了着把得地]/g, "")
            .trim();
    }

    function splitFeedbackSentences(text) {
        return (text || "")
            .replace(/\n/g, "。")
            .split(/[。！？!?；;]/)
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
    }

    function charCoverage(a, b) {
        var setA = {}, setB = {};
        (a || "").split("").forEach(function (ch) { setA[ch] = true; });
        (b || "").split("").forEach(function (ch) { setB[ch] = true; });
        var keysA = Object.keys(setA), keysB = Object.keys(setB);
        if (keysA.length === 0 || keysB.length === 0) return 0;
        var inter = 0;
        keysA.forEach(function (ch) { if (setB[ch]) inter++; });
        return inter / Math.min(keysA.length, keysB.length);
    }

    function splitSentencesWithPunctuation(text) {
        var parts = [];
        var re = /[^。！？!?；;]+[。！？!?；;]?/g;
        var match;
        while ((match = re.exec(text || "")) !== null) {
            var chunk = match[0].trim();
            if (chunk) parts.push(chunk);
        }
        return parts;
    }

    function getPerformanceBounds(text) {
        var start = (text || "").indexOf("学生表现：");
        if (start < 0) return null;
        var contentStart = start + "学生表现：".length;
        var markers = ["\n改进建议：", "\n本周作业：", "\n作业："];
        var end = text.length;
        markers.forEach(function (marker) {
            var idx = text.indexOf(marker, contentStart);
            if (idx >= 0 && idx < end) end = idx;
        });
        return { start: contentStart, end: end };
    }

    function isAdviceSentence(sentence) {
        return /(后面|后续|接下来|下次课|下节课|下一次课|目前先|先把|课后|作业|任务|不要松懈|不能放松|会继续|我会|重点抓|重点看|放到|放进|检查|继续看)/.test(sentence || "");
    }

    function normalizeAdviceForCompare(sentence) {
        return normalizeFocusForCompare(sentence)
            .replace(/老师布置的/g, "")
            .replace(/认真|按要求|要求|必须|一定|要|还要|需要|不能|不要|不再|再/g, "")
            .replace(/先把|先|主要|重点|当前|现在/g, "")
            .replace(/这类|这部分|这块|这方面|一点|一下/g, "")
            .replace(/方法|过程|情况|地方/g, "")
            .trim();
    }

    function isNextFocusSentence(sentence) {
        return /(下次课|下节课|下一次课|后续|接下来|我会继续|我会盯|继续盯|课上会继续|后面重点|后面会|后面还要|目前先把|先把|放到独立练习|放进具体题目|不靠提示|不依赖提示)/.test(sentence || "");
    }

    function isDuplicateAdviceSentence(a, b) {
        var A = (a || "").trim();
        var B = (b || "").trim();
        if (!A || !B) return false;
        if (A === B) return true;
        var aIsAdvice = isAdviceSentence(A) || isNextFocusSentence(A);
        var bIsAdvice = isAdviceSentence(B) || isNextFocusSentence(B);
        if (!aIsAdvice || !bIsAdvice) return false;

        var focusA = normalizeFocusForCompare(A);
        var focusB = normalizeFocusForCompare(B);
        if (focusA.length >= 3 && focusB.length >= 3) {
            if (focusA.indexOf(focusB) >= 0 || focusB.indexOf(focusA) >= 0) return true;
            if (charCoverage(focusA, focusB) >= 0.78 && sentenceSimilarity(focusA, focusB) >= 0.18) return true;
            if (sentenceSimilarity(focusA, focusB) >= 0.38) return true;
        }

        var coreA = normalizeAdviceForCompare(A);
        var coreB = normalizeAdviceForCompare(B);
        if (coreA.length >= 3 && coreB.length >= 3) {
            if (coreA.indexOf(coreB) >= 0 || coreB.indexOf(coreA) >= 0) return true;
            if (charCoverage(coreA, coreB) >= 0.8 && sentenceSimilarity(coreA, coreB) >= 0.18) return true;
            if (sentenceSimilarity(coreA, coreB) >= 0.42) return true;
        }
        return false;
    }

    function dedupeStudentPerformanceAdvice(feedback, formData) {
        var text = MODULE.normalizeText(feedback || "");
        var bounds = getPerformanceBounds(text);
        if (!bounds) return dedupeNextFocusSentences(text);
        var before = text.slice(0, bounds.start);
        var performance = text.slice(bounds.start, bounds.end);
        var after = text.slice(bounds.end);
        var sentences = splitSentencesWithPunctuation(performance);
        if (sentences.length <= 1) return dedupeNextFocusSentences(text);

        var kept = [];
        sentences.forEach(function (sentence) {
            var trimmed = sentence.trim();
            if (!trimmed) return;
            var duplicated = kept.some(function (prev) { return isDuplicateAdviceSentence(prev, trimmed); });
            if (!duplicated) kept.push(trimmed);
        });

        return dedupeNextFocusSentences(MODULE.normalizeText(before + kept.join("") + after));
    }

    function dedupeNextFocusSentences(feedback) {
        var text = MODULE.normalizeText(feedback || "");
        for (var i = 0; i < 4; i++) {
            text = text.replace(/((?:下(?:次|节|一次)课|后续|接下来|后面|我会|课上会继续)[^。！？!?]{4,100}[。！？!?])\s*((?:下(?:次|节|一次)课|后续|接下来|后面|我会|课上会继续)[^。！？!?]{4,100}[。！？!?])/g, function (match, first, second) {
                if (isDuplicateAdviceSentence(first, second)) return first;
                return match;
            });
        }
        return MODULE.normalizeText(text);
    }

    function hasNextFocusAlready(feedback, rawFocus) {
        var raw = (rawFocus || "").trim();
        if (!raw) return true;
        var text = MODULE.normalizeText(feedback || "");
        if (text.indexOf(raw) >= 0) return true;
        var rawCore = normalizeFocusForCompare(raw);
        if (!rawCore || rawCore.length < 3) return false;
        return splitFeedbackSentences(text).some(function (sentence) {
            var sentenceCore = normalizeFocusForCompare(sentence);
            if (!sentenceCore || sentenceCore.length < 3) return false;
            if (sentenceCore.indexOf(rawCore) >= 0 || rawCore.indexOf(sentenceCore) >= 0) return true;
            if ((isNextFocusSentence(sentence) || isAdviceSentence(sentence)) && charCoverage(rawCore, sentenceCore) >= 0.72) return true;
            return (isNextFocusSentence(sentence) || isAdviceSentence(sentence)) && sentenceSimilarity(rawCore, sentenceCore) >= 0.26;
        });
    }

    function insertSentenceIntoPerformance(text, sentence) {
        var bounds = getPerformanceBounds(text);
        if (!bounds) return MODULE.normalizeText(text + "\n学生表现：" + sentence);
        var before = text.slice(0, bounds.start);
        var performance = text.slice(bounds.start, bounds.end);
        var after = text.slice(bounds.end);
        var sentences = splitSentencesWithPunctuation(performance);
        if (sentences.length === 0) return MODULE.normalizeText(before + sentence + after);

        var insertIndex = Math.max(1, Math.floor(sentences.length * 0.65));
        var problemIndex = sentences.findIndex(function (s) { return /(问题|不稳|出错|薄弱|规范|计算|审题|正确率|步骤|卡|丢分|提醒|不够|低级错误)/.test(s); });
        if (problemIndex >= 0) insertIndex = Math.min(problemIndex + 1, sentences.length);
        if (sentences.length >= 2) insertIndex = Math.min(insertIndex, sentences.length - 1);

        sentences.splice(insertIndex, 0, sentence);
        return MODULE.normalizeText(before + sentences.join("") + after);
    }

    function ensureNextFocusNaturally(feedback, formData) {
        var text = dedupeStudentPerformanceAdvice(feedback || "", formData);
        var raw = (formData && formData.nextFocus || "").trim();
        if (!raw) return text;
        if (hasNextFocusAlready(text, raw)) return dedupeStudentPerformanceAdvice(text, formData);
        var sentence = formatNextFocusSentence(raw, formData);
        if (!sentence) return text;
        text = insertSentenceIntoPerformance(text, sentence);
        return dedupeStudentPerformanceAdvice(text, formData);
    }

    // ========== 寄语处理 ==========

    function formatEncouragementSentence(encouragement) {
        var text = (encouragement || "").trim();
        if (!text) return "";
        return /[。！？.!?]$/.test(text) ? text : text + "。";
    }

    function polishEncouragementNaturally(feedback, formData) {
        var text = MODULE.normalizeText(feedback || "");
        var raw = (formData && formData.selectedEncouragement || "").trim();
        if (!raw) return text;
        var rawSentence = formatEncouragementSentence(raw);
        if (!rawSentence) return text;
        var seen = false;
        var pattern = new RegExp(MODULE.escapeRegExp(rawSentence) + "\\s*", "g");
        text = text.replace(pattern, function (match) {
            if (seen) return "";
            seen = true;
            return match;
        });
        return MODULE.normalizeText(text);
    }

    // ========== 真实记录融合 ==========

    function polishRealNotesFusion(feedback, formData) {
        var text = MODULE.normalizeText(feedback || "");
        var notes = MODULE.getRealNotesList(formData);
        if (notes.length < 2) return text;
        var allNotes = notes.join("；");
        var pronoun = (formData && formData.gender === "女") ? "她" : "他";

        if (/(期中|期末|考试|考完|考得)/.test(allNotes) && /(飘|松|松懈|放松)/.test(allNotes) && /(方法|思路)/.test(allNotes) && /(算|计算|做不出来|做不对|出错)/.test(allNotes)) {
            var splitSentence = "不过考完之后状态上有点飘，这一点需要先收回来。方法层面" + pronoun + "不是完全不会，但一到自己算就容易出错，还要把思路真正落到步骤和计算上。";
            text = text.replace(/不过?[^。！？!?]{0,24}(期中|期末|考试|考完|考得)[^。！？!?]{0,24}(飘|松懈|放松)[^。！？!?]{0,35}(方法|思路)[^。！？!?]{0,35}(算|计算|做不出来|做不对|出错)[^。！？!?]*[。！？!?]/g, splitSentence);
            text = text.replace(/(期中|期末|考试|考完|考得)[^。！？!?]{0,24}(飘|松懈|放松)[^。！？!?]{0,35}(方法|思路)[^。！？!?]{0,35}(算|计算|做不出来|做不对|出错)[^。！？!?]*[。！？!?]/g, splitSentence);
        }

        return MODULE.normalizeText(text);
    }

    // ========== 后处理管道 ==========

    MODULE.process = function (feedback, formData, options) {
        options = options || {};
        var rounds = Number.isInteger(options.rounds) ? options.rounds : 2;
        var steps = [
            polishAwkwardPhrases,
            polishRealNotesFusion,
            ensureNextFocusNaturally,
            polishEncouragementNaturally,
            dedupeStudentPerformanceAdvice
        ];

        var text = MODULE.normalizeText(feedback || "");
        for (var i = 0; i < Math.max(1, rounds); i++) {
            steps.forEach(function (step) {
                text = step(text, formData);
            });
        }

        text = MODULE.ensureHomeworkLine(text, formData);
        return MODULE.normalizeText(text);
    };

    // ========== 字数统计工具 ==========

    function getCountableFeedbackText(feedback, formData) {
        var homework = normalizeHomeworkText(formData && formData.homework || "");
        var titleLine = (formData && formData.studentName || "") + formatDateForTitle(formData && formData.date) + (formData && formData.subject || "") + "课后反馈";
        return MODULE.normalizeText(feedback || "")
            .split("\n")
            .map(function (line) { return line.trim(); })
            .filter(Boolean)
            .filter(function (line) { return line !== titleLine; })
            .filter(function (line) { return !/^.+好，这是.+课程反馈$/.test(line); })
            .filter(function (line) { return !/^\s*(本周作业|作业)[:：]/.test(line); })
            .join("\n");
    }

    // ========== 反馈校验 ==========

    MODULE.validate = function (feedback, formData) {
        var C2 = window.App.config;
        var totalLen = getTextLength(getCountableFeedbackText(feedback, formData));
        var performanceStart = feedback.indexOf("学生表现：");
        var performanceText = "";
        if (performanceStart >= 0) {
            var rest = feedback.slice(performanceStart + "学生表现：".length);
            var endMarkers = ["\n改进建议：", "\n本周作业：", "\n作业："];
            var end = rest.length;
            endMarkers.forEach(function (m) {
                var idx = rest.indexOf(m);
                if (idx >= 0 && idx < end) end = idx;
            });
            performanceText = rest.slice(0, end).trim();
        }
        var performanceLen = getTextLength(performanceText);
        var wordCountRange = window.App.prompts ? window.App.prompts.getWordCountRange() : [270, 315];
        var minWords = wordCountRange[0];
        var maxWords = wordCountRange[1];
        var issues = [];
        var warnings = [];

        if (feedback.indexOf("教学内容：") < 0) issues.push("缺少教学内容段落");
        if (feedback.indexOf("学生表现：") < 0) issues.push("缺少学生表现段落");
        if (performanceLen < minWords * 0.52) warnings.push("学生表现不足" + Math.floor(minWords * 0.52) + "字（当前" + performanceLen + "字，可点"长一点"补充）");
        if (totalLen < minWords) warnings.push("总字数偏少（当前" + totalLen + "字，目标" + minWords + "~" + maxWords + "，可点"长一点"）");
        if (totalLen > maxWords + 10) warnings.push("总字数偏多（当前" + totalLen + "字，目标最多" + maxWords + "字左右，可点"短一点"）");
        if (formData && !formData.shouldGenerateSuggestion && feedback.indexOf("改进建议：") >= 0) issues.push("不应生成改进建议段落");

        var homework = normalizeHomeworkText(formData && formData.homework || "");
        if (homework) {
            var lines = MODULE.normalizeText(feedback).split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
            var expectedHomeworkLine = "本周作业：" + homework;
            if (lines.indexOf(expectedHomeworkLine) < 0) issues.push("作业必须单独成行，且格式为"本周作业：..."");
            else if (lines[lines.length - 1] !== expectedHomeworkLine) issues.push("作业必须放在最后一行");
        } else if (/\n\s*(本周作业|作业)[:：]/.test(feedback)) {
            issues.push("未填写作业时不应生成作业段落");
        }

        if (/\n(下节课关注点|下次课关注点|下一次课关注点)：/.test(feedback)) issues.push("下节课关注点不能单独成段");
        if (formData && formData.correctness !== null && formData.correctness < 90 && /值得表扬|非常棒|做得很好/.test(feedback)) {
            issues.push("正确率低于90%，禁止使用过度表扬词");
        }
        if (hasStiffExpression(feedback)) {
            issues.push("存在模板化或生硬表达，需要改成更自然的老师口吻");
        }
        if (formData && hasWrongPronoun(feedback, formData.gender)) {
            warnings.push("疑似人称代词错误，请检查他/她是否和性别一致");
        }

        var toneMode = window.App.prompts ? window.App.prompts.getToneMode() : "neutral";
        if (toneMode === "critical" && /非常棒|值得表扬|完成得很好/.test(feedback)) {
            issues.push("批评模式下不应出现过强表扬词");
        }
        if (toneMode === "encourage" && /必须改正|严重|太差|不够重视/.test(feedback)) {
            issues.push("鼓励模式下语气过重");
        }

        return { ok: issues.length === 0, issues: issues, warnings: warnings, totalLen: totalLen, performanceLen: performanceLen };
    };

    // ========== 微信表情工具 ==========

    MODULE.countWechatEmojis = function (text) {
        var matches = String(text || "").match(C.WECHAT_EMOJI_REGEX);
        return matches ? matches.length : 0;
    };

    MODULE.limitWechatEmojis = function (text, maxCount) {
        if (maxCount === undefined) maxCount = 5;
        var count = 0;
        return MODULE.normalizeText(String(text || "").replace(C.WECHAT_EMOJI_REGEX, function (token) {
            count += 1;
            return count <= maxCount ? token : "";
        }));
    };

    window.App.postprocess = MODULE;
})();
