/**
 * api.js — 生成流程编排（Prompt 由后端 Python 构建）
 * 依赖：prompts.js, postprocess.js, api-client.js
 * 挂载：window.App.api
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var PM = window.App.prompts;
    var PP = window.App.postprocess;

    var MODULE = {};

    function formatDateForTitle(dateStr) {
        var m = String(dateStr || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return parseInt(m[2], 10) + "月" + parseInt(m[3], 10) + "日";
        var d = new Date(dateStr || Date.now());
        if (!isNaN(d.getTime())) return (d.getMonth() + 1) + "月" + d.getDate() + "日";
        return (new Date().getMonth() + 1) + "月" + new Date().getDate() + "日";
    }

    function escapeRegExp(str) {
        return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /** 主生成——直接调用后端 API */
    MODULE.generateFeedback = async function (formData) {
        for (var attempt = 0; attempt < 3; attempt++) {
            var result;
            try {
                result = await PM.buildMessages(formData);
            } catch (e) {
                if (attempt === 2) throw e;
                continue;
            }
            if (!result.ok || !result.content) {
                if (attempt === 2) throw new Error("生成失败");
                continue;
            }

            var feedback = result.content;
            feedback = PP.process(feedback, formData);

            if (!formData.enableGreeting) {
                var tp = new RegExp("^" + escapeRegExp(formData.studentName) +
                    escapeRegExp(formatDateForTitle(formData.date)) +
                    escapeRegExp(formData.subject) + "课后反馈");
                if (!tp.test(feedback)) {
                    feedback = formData.studentName + formatDateForTitle(formData.date) +
                        formData.subject + "课后反馈\n" + feedback;
                }
            } else {
                var tp2 = new RegExp("^" + escapeRegExp(formData.studentName) +
                    escapeRegExp(formatDateForTitle(formData.date)) +
                    escapeRegExp(formData.subject) + "课后反馈\\s*\\n?", "g");
                feedback = feedback.replace(tp2, "");
            }

            var report = PP.validate(feedback, formData);
            if (report.ok) return feedback;

            if (attempt === 1 && report.issues.every(function (i) { return i.indexOf("历史重复") >= 0; })) {
                return feedback;
            }
        }
        throw new Error("生成内容未通过校验");
    };

    /** 快速生成 */
    MODULE.generateQuickFeedback = async function (formData) {
        for (var attempt = 0; attempt < 2; attempt++) {
            var result;
            try {
                result = await PM.buildQuickMessages(formData);
            } catch (e) {
                if (attempt === 1) throw e;
                continue;
            }
            if (!result.ok || !result.content) continue;

            var feedback = PP.process(result.content, formData, { rounds: 1 });
            feedback = PP.ensureHomeworkLine(feedback, formData);

            if (!formData.enableGreeting) {
                var tp = new RegExp("^" + escapeRegExp(formData.studentName) +
                    escapeRegExp(formatDateForTitle(formData.date)) +
                    escapeRegExp(formData.subject) + "课后反馈");
                if (!tp.test(feedback)) {
                    feedback = formData.studentName + formatDateForTitle(formData.date) +
                        formData.subject + "课后反馈\n" + feedback;
                }
            }
            var report = PP.validate(feedback, formData);
            if (report.ok) return feedback;
        }
        return "";
    };

    /** 二次修改 */
    MODULE.reviseFeedback = async function (type, currentText, formData) {
        var result = await PM.buildRevisionMessages(type, currentText, formData);
        if (!result.ok || !result.content) throw new Error("修改失败");
        var revised = result.content;
        revised = PP.process(revised, formData, { rounds: 1 });
        revised = PP.ensureHomeworkLine(revised, formData);

        if (type === "emoji") {
            var C = window.App.config;
            var cnt = PP.countWechatEmojis(revised);
            if (cnt < 2 && C.WECHAT_EMOJI_TOKENS) {
                revised = PP.limitWechatEmojis(
                    revised + C.WECHAT_EMOJI_TOKENS.slice(0, 2 - cnt).join(""), 5
                );
            }
        }
        return revised;
    };

    window.App.api = MODULE;
})();
