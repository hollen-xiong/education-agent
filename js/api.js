/**
 * api.js — DeepSeek API 封装、重试逻辑、生成/修改流程
 * 依赖：config.js, prompts.js, postprocess.js, storage.js
 * 挂载：window.App.api
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;
    var S = window.App.storage;
    var PM = window.App.prompts;
    var PP = window.App.postprocess;

    var MODULE = {};

    /** 底层 API 调用 */
    MODULE.callDeepSeek = async function (apiKey, messages, temperature) {
        var response = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
            body: JSON.stringify({
                model: C.DEEPSEEK_MODEL,
                messages: messages,
                temperature: temperature,
                max_tokens: 2000
            })
        });
        if (!response.ok) throw new Error("API错误(" + response.status + ")");
        var result = await response.json();
        return PP.normalizeText((result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) || "");
    };

    function escapeRegExp(str) {
        return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function formatDateForTitle(dateStr) {
        var match = String(dateStr || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) return parseInt(match[2], 10) + "月" + parseInt(match[3], 10) + "日";
        var d = new Date(dateStr || Date.now());
        if (!isNaN(d.getTime())) return (d.getMonth() + 1) + "月" + d.getDate() + "日";
        var today = new Date();
        return (today.getMonth() + 1) + "月" + today.getDate() + "日";
    }

    /** 主生成流程（带最多 3 次重试） */
    MODULE.generateFeedback = async function (formData, apiKey) {
        var messages = PM.buildInitialMessages(formData);
        var lastFeedback = "";
        var lastReport = null;
        var temps = PM.getTemperatureByMode();
        var firstTemp = temps[0];
        var retryTemp = temps[1];

        for (var attempt = 0; attempt < 3; attempt++) {
            var temp = attempt === 0 ? firstTemp : retryTemp;
            lastFeedback = await MODULE.callDeepSeek(apiKey, messages, temp);
            lastFeedback = PP.process(lastFeedback, formData);

            // 标题行处理
            if (!formData.enableGreeting) {
                var titlePattern = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈");
                if (!titlePattern.test(lastFeedback)) {
                    lastFeedback = formData.studentName + formatDateForTitle(formData.date) + formData.subject + "课后反馈\n" + lastFeedback;
                }
            } else {
                var titlePattern2 = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈\\s*\\n?", "g");
                lastFeedback = lastFeedback.replace(titlePattern2, "");
            }

            lastReport = PP.validate(lastFeedback, formData);
            var historyReport = PP.getHistoricalRepeatReport(lastFeedback, formData);
            if (historyReport.severe && attempt === 0) {
                lastReport.ok = false;
                lastReport.issues.push("历史重复度偏高：" + historyReport.message);
            }
            if (lastReport.ok) return lastFeedback;

            var onlyHistoryIssue = lastReport.issues.length > 0 && lastReport.issues.every(function (issue) { return issue.indexOf("历史重复") >= 0; });
            if (attempt === 1 && onlyHistoryIssue) return lastFeedback;

            var wordCountRange = PM.getWordCountRange();
            var minW = wordCountRange[0];
            var maxW = wordCountRange[1];
            messages = PM.buildInitialMessages(formData).concat([
                { role: "assistant", content: lastFeedback },
                { role: "user", content: "上一版未通过校验：" + lastReport.issues.join("；") + "。请重新生成，必须满足：" + (!formData.enableGreeting ? "第一行必须是标题行'" + formData.studentName + formatDateForTitle(formData.date) + formData.subject + "课后反馈'；" : "不要输出任何标题行；") + "正文总字数" + minW + "~" + maxW + "字（不含问候语、标题行和本周作业）；学生表现至少" + Math.floor(minW * 0.52) + "字；严格基于白名单；保证性别代词正确；" + (formData.correctness !== null && formData.correctness < 90 ? "绝对不要出现"值得表扬""非常棒"。" : "正确率≥90%，可以使用"值得表扬"但不要编造其他事实。") + (formData.nextFocus ? "下节课关注点作为规划参考自然融入，不要硬贴原句或放在段尾；" : "") + "真实记录如果有多条，必须当成独立事实分散融入，不能强行合并成一句因果；历史重复提醒：如果上一版与历史反馈重复，请保留事实但更换句式、顺序和连接词，避开高频表达。直接输出反馈，避免"倒是""这点不错""这点很好""这一点先保持""整体来看""存在一定问题""反映出""体现了""具备较好"等生硬表达；按真实老师文风写，先说课堂事实和判断，再说具体要求，不要像AI模板；如果有作业，必须把"本周作业："单独放在最后一行，作业不参与正文扩写。" }
            ]);
        }
        throw new Error("生成内容未通过校验：" + ((lastReport && lastReport.issues && lastReport.issues.join("；")) || "内容不符合要求") + "，请稍后重试或调整输入信息。");
    };

    /** 快速生成流程（最多 2 次重试） */
    MODULE.generateQuickFeedback = async function (formData, apiKey) {
        var messages = PM.buildQuickMessages(formData);
        var lastFeedback = "";
        var lastReport = null;

        for (var attempt = 0; attempt < 2; attempt++) {
            lastFeedback = await MODULE.callDeepSeek(apiKey, messages, attempt === 0 ? 0.55 : 0.38);
            lastFeedback = PP.process(lastFeedback, formData, { rounds: 1 });

            if (!formData.enableGreeting) {
                var titlePattern = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈");
                if (!titlePattern.test(lastFeedback)) {
                    lastFeedback = formData.studentName + formatDateForTitle(formData.date) + formData.subject + "课后反馈\n" + lastFeedback;
                }
            } else {
                var titlePattern2 = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈\\s*\\n?", "g");
                lastFeedback = lastFeedback.replace(titlePattern2, "");
            }

            lastFeedback = PP.ensureHomeworkLine(lastFeedback, formData);
            lastReport = PP.validate(lastFeedback, formData);
            if (lastReport.ok) return lastFeedback;

            var wordCountRange = PM.getWordCountRange();
            var minW = wordCountRange[0];
            var maxW = wordCountRange[1];
            messages = PM.buildQuickMessages(formData).concat([
                { role: "assistant", content: lastFeedback },
                { role: "user", content: "上一版有这些问题：" + lastReport.issues.join("；") + "。请保持快速生成的快捷风格，但修正格式和字数：正文" + minW + "~" + maxW + "字；必须有教学内容和学生表现；" + (formData.homework ? "作业最后一行原样保留。" : "不要生成作业。") + "不要输出学霸、学渣、普通学生这些内部标签。直接输出完整反馈。" }
            ]);
        }
        return lastFeedback || "";
    };

    /** 二次修改流程 */
    MODULE.reviseFeedback = async function (type, currentText, formData, apiKey) {
        var revised = await MODULE.callDeepSeek(apiKey, PM.buildRevisionMessages(type, currentText, formData), 0.35);
        revised = PP.process(revised, formData, { rounds: 1 });
        revised = preserveOriginalRevisionSections(revised, currentText);
        revised = PP.ensureHomeworkLine(revised, formData);

        if (type === "emoji") {
            var emojiBodyText = getDisplayBodyForValidation(revised, formData);
            var emojiMaxCount = getTextLengthForCount(emojiBodyText) >= 320 ? 4 : 3;
            revised = ensureWechatEmojiCountForRevision(revised, formData, 2, emojiMaxCount);
            revised = PP.ensureHomeworkLine(revised, formData);
        }

        return revised;
    };

    // ========== 二次修改辅助函数 ==========

    function hasSection(text, sectionName) {
        var normalized = PP.normalizeText(text || "");
        var pattern = new RegExp("(^|\n)" + escapeRegExp(sectionName) + "[:：]");
        return pattern.test(normalized);
    }

    function removeUnexpectedSuggestionSection(text, originalText) {
        var result = PP.normalizeText(text || "");
        if (hasSection(originalText, "改进建议")) return result;
        result = result
            .replace(/\n?改进建议[:：][\s\S]*?(?=\n(?:本周作业|作业)[:：]|$)/g, "")
            .replace(/\n\s*\n+/g, "\n")
            .trim();
        return PP.normalizeText(result);
    }

    function preserveOriginalRevisionSections(text, originalText) {
        return removeUnexpectedSuggestionSection(text, originalText);
    }

    function getTextLengthForCount(text) {
        return (text || "").replace(/\s+/g, "").length;
    }

    function getDisplayBodyForValidation(text, formData) {
        var lines = PP.normalizeText(text).split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
        if (!lines.length) return "";
        var first = lines[0];
        var studentName = formData && formData.studentName || "";
        var date = formData && formData.date;
        var subject = formData && formData.subject || "";
        var title = studentName + formatDateForTitle(date) + subject + "课后反馈";
        var greetingPattern = new RegExp("^" + escapeRegExp(studentName) + "(爸爸|妈妈|家长)(上午|下午|晚上)好，这是" + escapeRegExp(studentName) + escapeRegExp(formatDateForTitle(date)) + escapeRegExp(subject) + "课程反馈$");
        if (greetingPattern.test(first) || first === title) {
            return lines.slice(1).join("\n");
        }
        return lines.join("\n");
    }

    function isGreetingOrTitleLine(line, index, formData) {
        if (index !== 0) return false;
        var cleanLine = String(line || "").trim();
        var title = (formData && formData.studentName || "") + formatDateForTitle(formData && formData.date) + (formData && formData.subject || "") + "课后反馈";
        var greetingPattern = new RegExp("^" + escapeRegExp(formData && formData.studentName || "") + "(爸爸|妈妈|家长)(上午|下午|晚上)好，这是" + escapeRegExp(formData && formData.studentName || "") + escapeRegExp(formatDateForTitle(formData && formData.date)) + escapeRegExp(formData && formData.subject || "") + "课程反馈$");
        return cleanLine === title || greetingPattern.test(cleanLine);
    }

    function isGoodEmojiTargetLine(line, index, formData) {
        var cleanLine = String(line || "").trim();
        if (!cleanLine || cleanLine.length < 8) return false;
        if (isGreetingOrTitleLine(cleanLine, index, formData)) return false;
        if (/^本周作业[:：]/.test(cleanLine)) return false;
        return true;
    }

    function appendWechatEmojiToLine(line, token) {
        var raw = String(line || "");
        if (!raw.trim()) return raw;
        if (/[。！？!?]$/.test(raw)) return raw.replace(/([。！？!?])$/, token + "$1");
        return raw + token;
    }

    function pickFallbackWechatEmojiTokens(formData, currentText) {
        var used = {};
        var matches = String(currentText || "").match(C.WECHAT_EMOJI_REGEX) || [];
        matches.forEach(function (t) { used[t] = true; });
        var weakCount = Array.isArray(formData && formData.selectedWeak) ? formData.selectedWeak.length : 0;
        var highlightCount = Array.isArray(formData && formData.selectedHighlights) ? formData.selectedHighlights.length : 0;
        var correctness = formData && formData.correctness;
        var preferred = [];
        var add = function (token) { if (preferred.indexOf(token) < 0) preferred.push(token); };

        if (correctness !== null && correctness !== undefined && Number(correctness) >= 90) add("[强]");
        if (highlightCount > 0) add("[愉快]");
        if (weakCount > 0 || (correctness !== null && correctness !== undefined && Number(correctness) < 85)) add("[加油]");
        if (weakCount >= 2 || (correctness !== null && correctness !== undefined && Number(correctness) < 75)) add("[擦汗]");
        if (highlightCount >= weakCount && highlightCount > 0) add("[庆祝]");
        add("[加油]");
        add("[玫瑰]");
        add("[强]");
        add("[愉快]");

        var result = preferred.filter(function (token) { return !used[token]; });
        C.WECHAT_EMOJI_TOKENS.forEach(function (token) {
            if (!used[token] && result.indexOf(token) < 0) result.push(token);
        });
        return result;
    }

    function ensureWechatEmojiCountForRevision(text, formData, minCount, maxCount) {
        var result = PP.limitWechatEmojis(text, maxCount);
        var currentCount = PP.countWechatEmojis(result);
        if (currentCount >= minCount) return result;

        var lines = result.split("\n");
        var candidates = lines
            .map(function (line, index) { return { line: line, index: index }; })
            .filter(function (item) { return isGoodEmojiTargetLine(item.line, item.index, formData); });
        if (!candidates.length) return result;

        var priorityCandidates = candidates.slice().sort(function (a, b) {
            var score = function (item) {
                var line = item.line || "";
                if (/学生表现[:：]/.test(line)) return 0;
                if (/改进建议[:：]/.test(line)) return 1;
                if (/教学内容[:：]/.test(line)) return 2;
                return 3;
            };
            return score(a) - score(b);
        });
        var tokensToAdd = pickFallbackWechatEmojiTokens(formData, result);

        while (currentCount < minCount && tokensToAdd.length) {
            var token = tokensToAdd.shift();
            var target = priorityCandidates[currentCount % priorityCandidates.length];
            lines[target.index] = appendWechatEmojiToLine(lines[target.index], token);
            currentCount += 1;
        }

        return PP.limitWechatEmojis(lines.join("\n"), maxCount);
    }

    window.App.api = MODULE;
})();
