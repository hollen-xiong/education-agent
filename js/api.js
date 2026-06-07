/**
 * api.js — 生成流程编排（通过后端 API 代理调用 DeepSeek）
 * 依赖：config.js, api-client.js, prompts.js, postprocess.js
 * 挂载：window.App.api
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;
    var AC = window.App.apiClient;
    var PM = window.App.prompts;
    var PP = window.App.postprocess;

    var MODULE = {};

    function escapeRegExp(str) {
        return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function formatDateForTitle(dateStr) {
        var m = String(dateStr || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return parseInt(m[2], 10) + "月" + parseInt(m[3], 10) + "日";
        var d = new Date(dateStr || Date.now());
        if (!isNaN(d.getTime())) return (d.getMonth() + 1) + "月" + d.getDate() + "日";
        return (new Date().getMonth() + 1) + "月" + new Date().getDate() + "日";
    }

    /** 主生成流程（最多 3 次重试） */
    MODULE.generateFeedback = async function (formData) {
        var messages = await PM.buildInitialMessages(formData);
        var lastFeedback = "";
        var lastReport = null;
        var temps = PM.getTemperatureByMode();
        var firstTemp = temps[0], retryTemp = temps[1];

        for (var attempt = 0; attempt < 3; attempt++) {
            var temp = attempt === 0 ? firstTemp : retryTemp;
            try {
                lastFeedback = await AC.generateFeedback(messages, temp);
            } catch (e) {
                if (attempt === 2) throw e;
                continue;
            }
            lastFeedback = PP.process(lastFeedback, formData);

            if (!formData.enableGreeting) {
                var tp = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈");
                if (!tp.test(lastFeedback)) {
                    lastFeedback = formData.studentName + formatDateForTitle(formData.date) + formData.subject + "课后反馈\n" + lastFeedback;
                }
            } else {
                var tp2 = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈\\s*\\n?", "g");
                lastFeedback = lastFeedback.replace(tp2, "");
            }

            lastReport = PP.validate(lastFeedback, formData);
            var historyReport = await PP.getHistoricalRepeatReport(lastFeedback, formData);
            if (historyReport.severe && attempt === 0) {
                lastReport.ok = false;
                lastReport.issues.push("历史重复度偏高：" + historyReport.message);
            }
            if (lastReport.ok) return lastFeedback;

            var onlyHistory = lastReport.issues.length > 0 && lastReport.issues.every(function (i) { return i.indexOf("历史重复") >= 0; });
            if (attempt === 1 && onlyHistory) return lastFeedback;

            var wc = PM.getWordCountRange();
            var minW = wc[0], maxW = wc[1];
            messages = await PM.buildInitialMessages(formData).concat([
                { role: "assistant", content: lastFeedback },
                { role: "user", content: "上一版未通过校验：" + lastReport.issues.join("；") + "。请重新生成……正文" + minW + "~" + maxW + "字；严格基于白名单。" }
            ]);
        }
        throw new Error("生成内容未通过校验：" + (lastReport && lastReport.issues ? lastReport.issues.join("；") : "内容不符合要求"));
    };

    /** 快速生成（最多 2 次重试） */
    MODULE.generateQuickFeedback = async function (formData) {
        var messages = PM.buildQuickMessages(formData);
        var lastFeedback = "";
        var lastReport = null;

        for (var attempt = 0; attempt < 2; attempt++) {
            try {
                lastFeedback = await AC.generateFeedback(messages, attempt === 0 ? 0.55 : 0.38);
            } catch (e) {
                if (attempt === 1) throw e;
                continue;
            }
            lastFeedback = PP.process(lastFeedback, formData, { rounds: 1 });

            if (!formData.enableGreeting) {
                var tp = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈");
                if (!tp.test(lastFeedback)) {
                    lastFeedback = formData.studentName + formatDateForTitle(formData.date) + formData.subject + "课后反馈\n" + lastFeedback;
                }
            } else {
                var tp2 = new RegExp("^" + escapeRegExp(formData.studentName) + escapeRegExp(formatDateForTitle(formData.date)) + escapeRegExp(formData.subject) + "课后反馈\\s*\\n?", "g");
                lastFeedback = lastFeedback.replace(tp2, "");
            }

            lastFeedback = PP.ensureHomeworkLine(lastFeedback, formData);
            lastReport = PP.validate(lastFeedback, formData);
            if (lastReport.ok) return lastFeedback;

            var wc = PM.getWordCountRange();
            messages = PM.buildQuickMessages(formData).concat([
                { role: "assistant", content: lastFeedback },
                { role: "user", content: "上一版有问题：" + lastReport.issues.join("；") + "。请修正。" }
            ]);
        }
        return lastFeedback || "";
    };

    /** 二次修改 */
    MODULE.reviseFeedback = async function (type, currentText, formData) {
        var messages = PM.buildRevisionMessages(type, currentText, formData);
        var revised = await AC.reviseFeedback(messages);
        revised = PP.process(revised, formData, { rounds: 1 });
        revised = preserveOriginalRevisionSections(revised, currentText);
        revised = PP.ensureHomeworkLine(revised, formData);

        if (type === "emoji") {
            var bodyText = getDisplayBody(revised, formData);
            var maxC = getTextLen(bodyText) >= 320 ? 4 : 3;
            revised = ensureWechatEmojiCount(revised, formData, 2, maxC);
            revised = PP.ensureHomeworkLine(revised, formData);
        }
        return revised;
    };

    // ========== 辅助 ==========
    function hasSection(text, sn) {
        return new RegExp("(^|\n)" + escapeRegExp(sn) + "[:：]").test(PP.normalizeText(text || ""));
    }
    function preserveOriginalRevisionSections(text, originalText) {
        var r = PP.normalizeText(text || "");
        if (hasSection(originalText, "改进建议")) return r;
        r = r.replace(/\n?改进建议[:：][\s\S]*?(?=\n(?:本周作业|作业)[:：]|$)/g, "").replace(/\n\s*\n+/g, "\n").trim();
        return PP.normalizeText(r);
    }
    function getTextLen(t) { return (t || "").replace(/\s+/g, "").length; }
    function getDisplayBody(text, fd) {
        var lines = PP.normalizeText(text).split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
        if (!lines.length) return "";
        var first = lines[0], sn = fd && fd.studentName || "", dt = fd && fd.date, sj = fd && fd.subject || "";
        var title = sn + formatDateForTitle(dt) + sj + "课后反馈";
        var gp = new RegExp("^" + escapeRegExp(sn) + "(爸爸|妈妈|家长)(上午|下午|晚上)好，这是" + escapeRegExp(sn) + escapeRegExp(formatDateForTitle(dt)) + escapeRegExp(sj) + "课程反馈$");
        return (gp.test(first) || first === title) ? lines.slice(1).join("\n") : lines.join("\n");
    }
    function ensureWechatEmojiCount(text, fd, minC, maxC) {
        var r = PP.limitWechatEmojis(text, maxC);
        var cnt = PP.countWechatEmojis(r);
        if (cnt >= minC) return r;
        var lines = r.split("\n");
        var candidates = lines.map(function (l, i) { return { line: l, idx: i }; }).filter(function (x) {
            var cl = x.line.trim();
            return cl && cl.length >= 8 && !/^本周作业[:：]/.test(cl);
        });
        if (!candidates.length) return r;
        var tokens = C.WECHAT_EMOJI_TOKENS.filter(function (t) { return r.indexOf(t) < 0; });
        while (cnt < minC && tokens.length) {
            var tk = tokens.shift();
            var tgt = candidates[cnt % candidates.length];
            var raw = lines[tgt.idx];
            lines[tgt.idx] = /[。！？!?]$/.test(raw) ? raw.replace(/([。！？!?])$/, tk + "$1") : raw + tk;
            cnt++;
        }
        return PP.limitWechatEmojis(lines.join("\n"), maxC);
    }

    window.App.api = MODULE;
})();
