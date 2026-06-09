/**
 * ui.js — DOM 渲染、事件绑定、表单交互
 * 依赖：所有其他模块 + api-client.js
 * 挂载：window.App.ui
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;
    var AC = window.App.apiClient;
    var ST = window.App.students;
    var PM = window.App.prompts;
    var API = window.App.api;
    var PP = window.App.postprocess;

    var MODULE = {};

    // 运行时状态
    var highlightsList = [], weakPointsList = [], suggestionList = [], encouragementsList = [];
    var lastGeneratedFormData = null;

    // 暴露给外部（postprocess 和 api 需要）
    window.App._state = {
        get highlightsList() { return highlightsList; },
        set highlightsList(v) { highlightsList = v; },
        get weakPointsList() { return weakPointsList; },
        set weakPointsList(v) { weakPointsList = v; },
        get suggestionList() { return suggestionList; },
        set suggestionList(v) { suggestionList = v; },
        get encouragementsList() { return encouragementsList; },
        set encouragementsList(v) { encouragementsList = v; },
        get lastGeneratedFormData() { return lastGeneratedFormData; },
        set lastGeneratedFormData(v) { lastGeneratedFormData = v; }
    };

    // ========== 列表工具 ==========

    function mergeDefaultItems(savedList, defaultList) {
        var base = Array.isArray(savedList) ? savedList.filter(Boolean) : [];
        defaultList.forEach(function (item) {
            if (item && base.indexOf(item) < 0) base.push(item);
        });
        return base;
    }

    function loadLists() {
        try {
            AC.getHighlights().then(function (v) { highlightsList = mergeDefaultItems(v, C.DEFAULT_HIGHLIGHTS); MODULE.renderHighlights(); });
            AC.getWeakPoints().then(function (v) { weakPointsList = mergeDefaultItems(v, C.DEFAULT_WEAKPOINTS); MODULE.renderWeakPoints(); });
            AC.getSuggestions().then(function (v) { suggestionList = mergeDefaultItems(v, C.DEFAULT_SUGGESTIONS); MODULE.renderSuggestions(); });
            AC.getEncouragements().then(function (v) { encouragementsList = mergeDefaultItems(v, C.DEFAULT_ENCOURAGEMENTS); MODULE.renderEncouragements(); });
        } catch (e) {
            highlightsList = C.DEFAULT_HIGHLIGHTS.slice();
            weakPointsList = C.DEFAULT_WEAKPOINTS.slice();
            suggestionList = C.DEFAULT_SUGGESTIONS.slice();
            encouragementsList = C.DEFAULT_ENCOURAGEMENTS.slice();
        }
    }

    // ========== 渲染函数 ==========

    function bindCheckboxStyle() {
        document.querySelectorAll(".checkbox-option").forEach(function (opt) {
            var cb = opt.querySelector('input[type="checkbox"]');
            if (cb) {
                var update = function () { cb.checked ? opt.classList.add("selected") : opt.classList.remove("selected"); };
                cb.removeEventListener("change", update);
                cb.addEventListener("change", function () { update(); clearRequiredErrors(); });
                update();
            }
        });
    }

    function bindRadioStyle() {
        document.querySelectorAll(".radio-option").forEach(function (opt) {
            var radio = opt.querySelector('input[type="radio"]');
            if (radio) {
                var update = function () { radio.checked ? opt.classList.add("selected") : opt.classList.remove("selected"); };
                radio.removeEventListener("change", update);
                radio.addEventListener("change", update);
                update();
            }
        });
        document.querySelectorAll(".temp-option, .tone-option").forEach(function (opt) {
            var radio = opt.querySelector('input[type="radio"]');
            if (radio) {
                var update = function () { radio.checked ? opt.classList.add("selected") : opt.classList.remove("selected"); };
                radio.removeEventListener("change", update);
                radio.addEventListener("change", update);
                update();
            }
        });
    }

    MODULE.renderHighlights = function () {
        var container = document.getElementById("highlightsCheckboxArea");
        if (!container) return;
        container.innerHTML = "";
        highlightsList.forEach(function (item, idx) {
            var label = document.createElement("label"); label.className = "checkbox-option";
            var cb = document.createElement("input"); cb.type = "checkbox"; cb.value = item; cb.className = "highlight-cb";
            label.appendChild(cb); label.appendChild(document.createTextNode(item));
            var removeSpan = document.createElement("span"); removeSpan.innerText = " ✕"; removeSpan.style.cursor = "pointer"; removeSpan.style.marginLeft = "8px";
            removeSpan.onclick = function (e) {
                e.stopPropagation();
                highlightsList.splice(idx, 1);
                AC.saveHighlights(highlightsList);
                MODULE.renderHighlights();
            };
            label.appendChild(removeSpan);
            container.appendChild(label);
        });
        bindCheckboxStyle();
    };

    MODULE.renderWeakPoints = function () {
        var container = document.getElementById("weakPointsCheckboxArea");
        if (!container) return;
        container.innerHTML = "";
        weakPointsList.forEach(function (item, idx) {
            var label = document.createElement("label"); label.className = "checkbox-option";
            var cb = document.createElement("input"); cb.type = "checkbox"; cb.value = item; cb.className = "weak-cb";
            label.appendChild(cb); label.appendChild(document.createTextNode(item));
            var removeSpan = document.createElement("span"); removeSpan.innerText = " ✕"; removeSpan.style.cursor = "pointer";
            removeSpan.onclick = function (e) {
                e.stopPropagation();
                weakPointsList.splice(idx, 1);
                AC.saveWeakPoints(weakPointsList);
                MODULE.renderWeakPoints();
            };
            label.appendChild(removeSpan);
            container.appendChild(label);
        });
        bindCheckboxStyle();
    };

    MODULE.renderSuggestions = function () {
        var selectEl = document.getElementById("suggestionSelect");
        if (selectEl) {
            var prev = selectEl.value;
            selectEl.innerHTML = '<option value="">-- 不生成改进建议 --</option>';
            suggestionList.forEach(function (s) {
                var opt = document.createElement("option");
                opt.value = s; opt.textContent = s;
                selectEl.appendChild(opt);
            });
            if (prev && suggestionList.indexOf(prev) >= 0) selectEl.value = prev;
            else selectEl.value = "";
        }
        var tagsContainer = document.getElementById("suggestionTagsArea");
        if (tagsContainer) {
            tagsContainer.innerHTML = "";
            suggestionList.forEach(function (s, idx) {
                var div = document.createElement("div"); div.className = "tag";
                div.innerHTML = s + ' <span class="remove" data-idx="' + idx + '">✕</span>';
                tagsContainer.appendChild(div);
            });
            document.querySelectorAll("#suggestionTagsArea .remove").forEach(function (btn) {
                btn.onclick = function () {
                    var idx = parseInt(btn.getAttribute("data-idx"));
                    if (!isNaN(idx)) { suggestionList.splice(idx, 1); AC.saveSuggestions(suggestionList); MODULE.renderSuggestions(); }
                };
            });
        }
    };

    MODULE.renderEncouragements = function () {
        var container = document.getElementById("encouragementArea");
        if (!container) return;
        container.innerHTML = "";
        encouragementsList.forEach(function (item, idx) {
            var div = document.createElement("div"); div.className = "encouragement-item";
            var radio = document.createElement("input"); radio.type = "radio"; radio.name = "encouragementRadio"; radio.value = item; radio.id = "enc_" + idx;
            var label = document.createElement("label"); label.htmlFor = "enc_" + idx; label.innerText = item;
            var removeSpan = document.createElement("span"); removeSpan.innerText = " ✕"; removeSpan.style.cursor = "pointer";
            removeSpan.onclick = function (e) {
                e.stopPropagation();
                encouragementsList.splice(idx, 1);
                AC.saveEncouragements(encouragementsList);
                MODULE.renderEncouragements();
            };
            div.appendChild(radio); div.appendChild(label); div.appendChild(removeSpan);
            container.appendChild(div);
            radio.addEventListener("change", function () {
                document.querySelectorAll(".encouragement-item").forEach(function (el) { el.classList.remove("selected"); });
                if (radio.checked) div.classList.add("selected");
            });
        });
    };

    // ========== 添加项 ==========

    function addHighlight() {
        var val = document.getElementById("newHighlightInput").value.trim();
        if (val && highlightsList.indexOf(val) < 0) {
            highlightsList.push(val); AC.addHighlight(val); MODULE.renderHighlights();
            document.getElementById("newHighlightInput").value = "";
        } else alert("请输入有效优点");
    }
    function addWeakPoint() {
        var val = document.getElementById("newWeakInput").value.trim();
        if (val && weakPointsList.indexOf(val) < 0) {
            weakPointsList.push(val); AC.addWeakPoint(val); MODULE.renderWeakPoints();
            document.getElementById("newWeakInput").value = "";
        } else alert("请输入有效缺点");
    }
    function addSuggestion() {
        var val = document.getElementById("newSuggestionInput").value.trim();
        if (val && suggestionList.indexOf(val) < 0) {
            suggestionList.push(val); AC.addSuggestion(val); MODULE.renderSuggestions();
            document.getElementById("newSuggestionInput").value = "";
        } else alert("请输入改进方向");
    }
    function addEncouragement() {
        var val = document.getElementById("newEncouragementInput").value.trim();
        if (val && encouragementsList.indexOf(val) < 0) {
            encouragementsList.push(val); AC.addEncouragement(val); MODULE.renderEncouragements();
            document.getElementById("newEncouragementInput").value = "";
        } else alert("请输入寄语");
    }

    // ========== 表单数据收集 ==========

    function collectRealNotesFromInputs() {
        var inputs = Array.from(document.querySelectorAll(".real-note-input"));
        if (inputs.length > 0) {
            return PP.getRealNotesList(inputs.map(function (input) { return input.value; }));
        }
        var oldInput = document.getElementById("realNotes");
        return PP.getRealNotesList(oldInput ? oldInput.value : "");
    }

    // ========== 阶段成绩 ==========

    MODULE.addStageRecord = function (grade, subject, score, notes) {
        var area = document.getElementById("stageRecordsArea");
        if (!area) return;
        var row = document.createElement("div");
        row.className = "stage-record-row existing";
        row.innerHTML =
            '<span class="stage-tag">' + (grade || "") + '</span>' +
            '<span class="stage-tag">' + (subject || "") + '</span>' +
            '<span class="stage-tag score">' + (score || "-") + '分</span>' +
            '<span class="stage-notes-text">' + (notes || "") + '</span>' +
            '<button class="mini-memory-btn danger" onclick="this.parentElement.remove()" style="padding:2px 8px;">✕</button>';
        area.appendChild(row);
    };

    function _getInputRowValues() {
        var row = document.querySelector(".stage-record-row:not(.existing)");
        if (!row) return null;
        var grade = (row.querySelector(".stage-grade") || {}).value || "";
        var subject = (row.querySelector(".stage-subject") || {}).value || "";
        var score = (row.querySelector(".stage-score") || {}).value || "";
        var notes = (row.querySelector(".stage-notes") || {}).value || "";
        if (!grade) return null;
        return { grade: grade, subject: subject || "数学", score: score ? parseInt(score) : null, notes: notes };
    }

    function _collectStageRecords() {
        var records = [];
        document.querySelectorAll("#stageRecordsArea .stage-record-row.existing").forEach(function (row) {
            var tags = row.querySelectorAll(".stage-tag");
            if (tags.length >= 3) {
                var grade = (tags[0] || {}).textContent || "";
                var subject = (tags[1] || {}).textContent || "";
                var scoreText = (tags[2] || {}).textContent || "";
                var score = parseInt(scoreText);
                var notesEl = row.querySelector(".stage-notes-text");
                var notes = notesEl ? notesEl.textContent : "";
                if (grade) {
                    records.push({
                        grade: grade,
                        subject: subject || "数学",
                        score: isNaN(score) ? null : score,
                        notes: notes || ""
                    });
                }
            }
        });
        return records;
    }

    /** 渲染已有阶段成绩 */
    MODULE.renderStageRecords = function (records) {
        var area = document.getElementById("stageRecordsArea");
        if (!area) return;
        // 清除已有记录行（保留输入行）
        area.querySelectorAll(".stage-record-row.existing").forEach(function (r) { r.remove(); });
        (records || []).forEach(function (r) {
            MODULE.addStageRecord(r.grade, r.subject, r.score, r.notes);
        });
    };

    // ========== 导入导出 ==========

    async function exportData() {
        try {
            await AC.exportAll();
        } catch (e) {
            alert("导出失败：" + (e.message || "未知错误"));
        }
    }

    async function importData(file) {
        try {
            var result = await AC.importAll(file);
            alert("✅ " + result.message);
            // 刷新学生列表
            if (window.App.students && window.App.students.renderDropdown) {
                window.App.students.renderDropdown();
            }
        } catch (e) {
            alert("导入失败：" + (e.message || "未知错误"));
        }
    }

    MODULE.getFormData = function () {
        var studentName = (document.getElementById("studentName").value || "").trim() || "这位同学";
        var gender = document.getElementById("studentGender").value;
        var grade = document.getElementById("grade").value;
        var subject = document.getElementById("subject").value;
        var dateEl = document.getElementById("date");
        var date = dateEl.value;
        if (!date) { var d = new Date(); date = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
        var knowledge = (document.getElementById("knowledge").value || "").trim() || "本节课内容";
        var homework = (document.getElementById("homework").value || "").trim();
        var nextFocus = (document.getElementById("nextFocus") || {}).value || "";
        var nextFocusVal = typeof nextFocus === "string" ? nextFocus.trim() : "";
        var realNotesList = collectRealNotesFromInputs();
        var realNotes = realNotesList.join("；");
        var correctness = null;
        if (document.getElementById("enableCorrectnessCheckbox").checked) {
            correctness = parseInt(document.getElementById("correctnessSlider").value);
        }
        var selectedHighlights = Array.from(document.querySelectorAll(".highlight-cb:checked")).map(function (cb) { return cb.value; });
        var selectedWeak = Array.from(document.querySelectorAll(".weak-cb:checked")).map(function (cb) { return cb.value; });
        var selectedSuggestion = document.getElementById("suggestionSelect").value;
        var shouldGenerateSuggestion = (selectedSuggestion && selectedSuggestion !== "");
        var selectedEncouragement = "";
        var checkedRadio = document.querySelector('input[name="encouragementRadio"]:checked');
        if (checkedRadio) selectedEncouragement = checkedRadio.value;
        var greetingTarget = document.getElementById("greetingTarget").value;
        var greetingTime = document.getElementById("greetingTime").value;
        var enableGreeting = document.getElementById("enableGreetingCheckbox").checked;
        return {
            studentName: studentName, gender: gender, grade: grade, date: date, subject: subject,
            knowledge: knowledge, homework: homework, nextFocus: nextFocusVal,
            performance: "", interaction: "",
            correctness: correctness,
            selectedHighlights: selectedHighlights, selectedWeak: selectedWeak,
            selectedSuggestion: selectedSuggestion, shouldGenerateSuggestion: shouldGenerateSuggestion,
            realNotes: realNotes, realNotesList: realNotesList,
            selectedEncouragement: selectedEncouragement,
            greetingTarget: greetingTarget, greetingTime: greetingTime, enableGreeting: enableGreeting,
            stage_records: _collectStageRecords()
        };
    };

    // ========== 表单校验 ==========

    function clearRequiredErrors() {
        document.querySelectorAll(".field-error").forEach(function (el) { el.classList.remove("field-error"); });
        document.querySelectorAll(".required-section.has-error").forEach(function (el) { el.classList.remove("has-error"); });
        var box = document.getElementById("requiredErrorMessage");
        if (box) { box.style.display = "none"; box.innerText = ""; }
    }

    function markRequiredError(target, groupName) {
        if (target) target.classList.add("field-error");
        var section = groupName
            ? document.querySelector('.required-section[data-required-group="' + groupName + '"]')
            : (target ? target.closest(".required-section") : null);
        if (section) section.classList.add("has-error");
    }

    function validateRequiredFields(formData) {
        clearRequiredErrors();
        var issues = [];
        var studentNameInput = document.getElementById("studentName");
        var knowledgeInput = document.getElementById("knowledge");
        var studentNameRaw = (studentNameInput ? studentNameInput.value : "").trim();
        var knowledgeRaw = (knowledgeInput ? knowledgeInput.value : "").trim();

        if (!studentNameRaw) { issues.push("学生信息：请填写学生姓名"); markRequiredError(studentNameInput, "student"); }
        if (!knowledgeRaw) { issues.push("本节课内容：请填写核心知识点或课堂内容"); markRequiredError(knowledgeInput, "knowledge"); }
        if (!Array.isArray(formData.selectedHighlights) || formData.selectedHighlights.length === 0) {
            issues.push("学生优点：请至少勾选 1 个优点");
            markRequiredError(document.getElementById("highlightsCheckboxArea"), "highlights");
        }
        if (!Array.isArray(formData.selectedWeak) || formData.selectedWeak.length === 0) {
            issues.push("学生缺点：请至少勾选 1 个缺点/问题点");
            markRequiredError(document.getElementById("weakPointsCheckboxArea"), "weakpoints");
        }
        var box = document.getElementById("requiredErrorMessage");
        if (issues.length && box) {
            box.style.display = "block";
            box.innerHTML = "⚠️ 生成前请先补全必填项：<br>" + issues.map(function (item) { return "• " + item; }).join("<br>");
            var firstError = document.querySelector(".field-error, .required-section.has-error");
            if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return { ok: issues.length === 0, issues: issues };
    }

    function validateQuickRequiredFields() {
        clearRequiredErrors();
        var issues = [];
        var studentNameInput = document.getElementById("studentName");
        var knowledgeInput = document.getElementById("knowledge");
        var studentNameRaw = (studentNameInput ? studentNameInput.value : "").trim();
        var knowledgeRaw = (knowledgeInput ? knowledgeInput.value : "").trim();
        if (!studentNameRaw) { issues.push("学生信息：请填写学生姓名"); markRequiredError(studentNameInput, "student"); }
        if (!knowledgeRaw) { issues.push("本节课内容：请填写核心知识点或课堂内容"); markRequiredError(knowledgeInput, "knowledge"); }
        var box = document.getElementById("requiredErrorMessage");
        if (issues.length && box) {
            box.style.display = "block";
            box.innerHTML = "⚠️ 快速生成前请先补全：<br>" + issues.map(function (item) { return "• " + item; }).join("<br>");
            var firstError = document.querySelector(".field-error, .required-section.has-error");
            if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return { ok: issues.length === 0, issues: issues };
    }

    // ========== 反馈操作 ==========

    function copyFeedback() {
        var text = document.getElementById("feedbackContent").innerText;
        if (text && text.indexOf("点击上方按钮") < 0) {
            navigator.clipboard.writeText(text).then(function () { alert("✅ 已复制"); }).catch(function () { alert("复制失败"); });
        } else alert("没有可复制的内容");
    }

    function setDefaultDate() {
        var inp = document.getElementById("date");
        if (inp && !inp.value) {
            var d = new Date();
            inp.value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        }
    }

    async function loadApiKey() {
        var k = await AC.getApiKey();
        if (k) document.getElementById("apiKeyInput").value = k;
    }

    async function saveSettings() {
        var key = document.getElementById("apiKeyInput").value.trim();
        var serverUrl = document.getElementById("serverUrlInput").value.trim();
        var msgEl = document.getElementById("settingsMsg");
        var btn = document.getElementById("saveSettingsBtn");
        var orig = btn ? btn.innerText : "保存";

        if (btn) { btn.innerText = "验证中..."; btn.disabled = true; }
        if (msgEl) msgEl.innerText = "";

        try {
            if (serverUrl) AC.setBaseUrl(serverUrl);
            if (key) {
                var result = await AC.validateApiKey(key);
                if (result.ok) {
                    await AC.saveApiKey(key);
                    if (msgEl) { msgEl.style.color = "#166534"; msgEl.innerText = "✅ " + result.message; }
                } else {
                    if (msgEl) { msgEl.style.color = "#dc2626"; msgEl.innerText = result.message; }
                    if (btn) { btn.innerText = orig; btn.disabled = false; }
                    return;
                }
            }
            if (msgEl) { msgEl.style.color = "#166534"; msgEl.innerText = "✅ 设置已保存（需重启后端以应用新 API Key）"; }
            checkConnection();
        } catch (e) {
            if (msgEl) { msgEl.style.color = "#dc2626"; msgEl.innerText = "❌ " + (e.message || "未知错误"); }
        } finally {
            if (btn) { btn.innerText = orig; btn.disabled = false; }
        }
    }

    async function checkConnection() {
        var statusEl = document.getElementById("connectionStatus");
        if (!statusEl) return;
        statusEl.innerText = "🟡 检测中...";
        statusEl.style.background = "#fef3c7"; statusEl.style.color = "#92400e";
        try {
            var health = await AC.healthCheck();
            if (health.ok) {
                statusEl.innerHTML = "🟢 已连接";
                statusEl.style.background = "#dcfce7"; statusEl.style.color = "#166534";
            } else {
                statusEl.innerHTML = "🔴 后端异常 (" + health.status + ")";
                statusEl.style.background = "#fee2e2"; statusEl.style.color = "#dc2626";
            }
        } catch (e) {
            statusEl.innerHTML = "🔴 后端未连接";
            statusEl.style.background = "#fee2e2"; statusEl.style.color = "#dc2626";
        }
    }

    async function clearFeedbackHistory() {
        var history = await AC.getFeedbackHistory();
        var count = Array.isArray(history) ? history.length : 0;
        if (count === 0) { alert("当前没有历史反馈记录"); return; }
        if (confirm("确定清空最近" + count + "条历史反馈记录吗？")) {
            await AC.clearFeedbackHistory();
            alert("✅ 历史反馈记录已清空");
        }
    }

    // ========== 问候语 ==========

    function toggleGreetingControls() {
        var enabled = document.getElementById("enableGreetingCheckbox").checked;
        var targetSel = document.getElementById("greetingTarget");
        var timeSel = document.getElementById("greetingTime");
        if (targetSel && timeSel) {
            targetSel.disabled = !enabled;
            timeSel.disabled = !enabled;
            if (!enabled) { targetSel.classList.add("disabled-select"); timeSel.classList.add("disabled-select"); }
            else { targetSel.classList.remove("disabled-select"); timeSel.classList.remove("disabled-select"); }
        }
        AC.saveGreetingSwitch(enabled);
    }

    async function initGreetingSwitch() {
        var saved = await AC.getGreetingSwitch();
        var cb = document.getElementById("enableGreetingCheckbox");
        if (cb) {
            cb.checked = saved;
            toggleGreetingControls();
            cb.addEventListener("change", toggleGreetingControls);
        }
    }

    // ========== 正确率滑块 ==========

    function initCorrectnessSlider() {
        var slider = document.getElementById("correctnessSlider");
        var span = document.getElementById("correctnessValue");
        if (slider && span) slider.addEventListener("input", function () { span.innerText = slider.value + "%"; });
        var checkbox = document.getElementById("enableCorrectnessCheckbox");
        var area = document.getElementById("correctnessSliderArea");
        if (checkbox && area) checkbox.addEventListener("change", function () { area.style.display = checkbox.checked ? "block" : "none"; });
    }

    // ========== 生成流程 ==========

    function formatDateForTitle(dateStr) {
        var match = String(dateStr || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) return parseInt(match[2], 10) + "月" + parseInt(match[3], 10) + "日";
        var d = new Date(dateStr || Date.now());
        if (!isNaN(d.getTime())) return (d.getMonth() + 1) + "月" + d.getDate() + "日";
        var today = new Date();
        return (today.getMonth() + 1) + "月" + today.getDate() + "日";
    }

    function getReportReviewItems(report, options) {
        options = options || {};
        var issues = Array.isArray(report.issues) ? report.issues : [];
        var warnings = Array.isArray(report.warnings) ? report.warnings : [];
        if (options.ignoreLengthWarnings) {
            warnings = warnings.filter(function (item) { return !/^总字数偏少/.test(item || "") && !/^总字数偏多/.test(item || "") && !/^学生表现不足/.test(item || ""); });
        }
        return issues.concat(warnings);
    }

    function saveFeedbackHistoryEntry(feedback, formData) {
        var cleanText = PP.stripForHistory(feedback || "");
        if (!cleanText || cleanText.length < 30) return;
        AC.saveFeedbackHistoryEntry({
            time: Date.now(),
            student_name: formData.studentName || "",
            subject: formData.subject || "",
            tone: PM.getToneMode(),
            scenes: PM.inferSceneTags(formData),
            text: cleanText
        });

        // 记录到学生档案
        if (formData.studentName && formData.studentName !== "这位同学") {
            AC.addStudentSession(formData.studentName, {
                date: formData.date || "",
                knowledge: formData.knowledge || "",
                performance: cleanText.substring(0, 200),
                highlights: formData.selectedHighlights || [],
                weaknesses: formData.selectedWeak || [],
                correctness: formData.correctness,
                feedback: cleanText.substring(0, 500),
                tags: PM.inferSceneTags(formData).slice(0, 5)
            });
        }
    }

    async function onGenerate() {
        var formData = MODULE.getFormData();
        var requiredReport = validateRequiredFields(formData);
        if (!requiredReport.ok) return;

        var apiKey = await AC.getApiKey();
        if (!apiKey) { alert("请先配置 DeepSeek API Key"); return; }
        var btn = document.getElementById("generateBtn");
        var resultDiv = document.getElementById("feedbackContent");
        var qualityEl = document.getElementById("qualityReport");
        var original = btn.innerText;
        btn.innerText = "⚡ 生成中...";
        btn.disabled = true;
        resultDiv.innerText = "📡 正在调用AI生成反馈...";
        if (qualityEl) { qualityEl.style.display = "none"; qualityEl.innerText = ""; }
        try {
            ST.upsertProfile(false);
            var feedback = await API.generateFeedback(formData, apiKey);
            var finalText = feedback;
            if (formData.enableGreeting) {
                var greeting = formData.studentName + formData.greetingTarget + formData.greetingTime + "好，这是" + formData.studentName + formatDateForTitle(formData.date) + formData.subject + "课程反馈";
                finalText = greeting + "\n" + feedback;
            }
            resultDiv.innerText = finalText;
            lastGeneratedFormData = formData;
            var finalReport = PP.validate(feedback, formData);
            var historyReport = PP.getHistoricalRepeatReport(feedback, formData);
            saveFeedbackHistoryEntry(feedback, formData);
            if (qualityEl) {
                qualityEl.style.display = "block";
                var reviewItems = getReportReviewItems(finalReport);
                if (historyReport.severe) reviewItems.push("历史重复度偏高：" + historyReport.message);
                var okAll = finalReport.ok && !historyReport.severe && reviewItems.length === 0;
                qualityEl.className = "quality-report " + (okAll ? "ok" : "warn");
                if (reviewItems.length) {
                    qualityEl.innerText = "⚠️ 生成完成，建议看一下：" + reviewItems.join("；") + "；历史检验：" + historyReport.message;
                } else {
                    qualityEl.innerText = "✅ 校验通过：正文字数" + finalReport.totalLen + "，学生表现" + finalReport.performanceLen + "字；历史检验：" + historyReport.message;
                }
            }
        } catch (err) {
            resultDiv.innerText = "❌ 生成失败：" + (err.message || "未知错误");
            if (qualityEl) { qualityEl.style.display = "block"; qualityEl.className = "quality-report warn"; qualityEl.innerText = "错误详情：" + (err.message || "未知错误"); }
        } finally {
            btn.innerText = original;
            btn.disabled = false;
        }
    }

    async function onQuickGenerate() {
        var baseFormData = MODULE.getFormData();
        var requiredReport = validateQuickRequiredFields();
        if (!requiredReport.ok) return;
        var apiKey = await AC.getApiKey();
        if (!apiKey) { alert("请先配置 DeepSeek API Key"); return; }

        var formData = PM.buildQuickFormData(baseFormData);
        var btn = document.getElementById("quickGenerateBtn");
        var resultDiv = document.getElementById("feedbackContent");
        var qualityEl = document.getElementById("qualityReport");
        var original = btn ? btn.innerText : "快速生成";
        if (resultDiv) {
            resultDiv.innerText = "📡 正在调用 AI 快速生成反馈...";
            resultDiv.closest(".result-card").scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (qualityEl) { qualityEl.style.display = "none"; qualityEl.innerText = ""; }
        try {
            if (btn) { btn.innerText = "生成中..."; btn.disabled = true; }
            ST.upsertProfile(false);
            var feedback = await API.generateQuickFeedback(formData, apiKey);
            var finalText = feedback;
            if (formData.enableGreeting) {
                var greeting = formData.studentName + formData.greetingTarget + formData.greetingTime + "好，这是" + formData.studentName + formatDateForTitle(formData.date) + formData.subject + "课程反馈";
                finalText = greeting + "\n" + feedback;
            }
            if (resultDiv) resultDiv.innerText = finalText;
            lastGeneratedFormData = formData;
            var finalReport = PP.validate(feedback, formData);
            var historyReport = PP.getHistoricalRepeatReport(feedback, formData);
            saveFeedbackHistoryEntry(feedback, formData);
            if (qualityEl) {
                qualityEl.style.display = "block";
                var reviewItems = getReportReviewItems(finalReport);
                if (historyReport.severe) reviewItems.push("历史重复度偏高：" + historyReport.message);
                var okAll = finalReport.ok && !historyReport.severe && reviewItems.length === 0;
                qualityEl.className = "quality-report " + (okAll ? "ok" : "warn");
                if (reviewItems.length) {
                    qualityEl.innerText = "⚠️ 快速生成完成，建议看一下：" + reviewItems.join("；") + "；历史检验：" + historyReport.message;
                } else {
                    qualityEl.innerText = "✅ 快速生成完成：正文字数" + finalReport.totalLen + "，学生表现" + finalReport.performanceLen + "字；历史检验：" + historyReport.message;
                }
            }
        } catch (err) {
            if (resultDiv) resultDiv.innerText = "❌ 快速生成失败：" + (err.message || "未知错误");
            if (qualityEl) {
                qualityEl.style.display = "block";
                qualityEl.className = "quality-report warn";
                qualityEl.innerText = "错误详情：" + (err.message || "未知错误");
            }
            alert("快速生成失败：" + (err.message || "未知错误"));
        } finally {
            if (btn) { btn.innerText = original; btn.disabled = false; }
        }
    }

    // ========== 二次修改 ==========

    function getCurrentFeedbackText() {
        var resultDiv = document.getElementById("feedbackContent");
        return PP.normalizeText(resultDiv ? resultDiv.innerText : "");
    }

    function isValidFeedbackForRevision(text) {
        if (!text) return false;
        if (/点击上方按钮生成反馈|正在调用AI生成反馈|生成失败/.test(text)) return false;
        return text.length >= 20;
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
        var greetingPattern = new RegExp("^" + PP.escapeRegExp(studentName) + "(爸爸|妈妈|家长)(上午|下午|晚上)好，这是" + PP.escapeRegExp(studentName) + PP.escapeRegExp(formatDateForTitle(date)) + PP.escapeRegExp(subject) + "课程反馈$");
        if (greetingPattern.test(first) || first === title) return lines.slice(1).join("\n");
        return lines.join("\n");
    }

    function setRevisionButtonsDisabled(disabled) {
        document.querySelectorAll(".revise-btn").forEach(function (btn) { btn.disabled = disabled; });
    }

    function getRevisionLengthChange(beforeText, afterText, formData) {
        var beforeLen = getTextLengthForCount(getDisplayBodyForValidation(beforeText, formData));
        var afterLen = getTextLengthForCount(getDisplayBodyForValidation(afterText, formData));
        var diff = afterLen - beforeLen;
        if (diff >= 10) return "总字数增多" + diff + "字";
        if (diff <= -10) return "总字数减少" + Math.abs(diff) + "字";
        return "总字数基本不变";
    }

    function getRevisionToneChange(type) {
        var map = {
            shorter: "内容更精简", longer: "内容更完整", natural: "语句更自然",
            wechat: "更像老师微信口吻", emoji: "已加入微信表情（2-5个）",
            encourage: "语气偏鼓励", strict: "语气更严厉"
        };
        return map[type] || "表达已调整";
    }

    async function reviseCurrentFeedback(type) {
        var apiKey = await AC.getApiKey();
        if (!apiKey) { alert("请先配置 DeepSeek API Key"); return; }

        var resultDiv = document.getElementById("feedbackContent");
        var qualityEl = document.getElementById("qualityReport");
        var currentText = getCurrentFeedbackText();
        if (!isValidFeedbackForRevision(currentText)) {
            alert("请先生成一版反馈，再使用二次修改按钮");
            return;
        }

        var clickedBtn = document.querySelector('.revise-btn[data-revise-type="' + type + '"]');
        var originalText = clickedBtn ? clickedBtn.innerText : "二次修改";
        try {
            setRevisionButtonsDisabled(true);
            if (clickedBtn) clickedBtn.innerText = "修改中...";
            if (qualityEl) {
                qualityEl.style.display = "block";
                qualityEl.className = "quality-report warn";
                qualityEl.innerText = "正在根据当前反馈做二次修改，请稍候...";
            }

            var formData = lastGeneratedFormData || MODULE.getFormData();
            var revised = await API.reviseFeedback(type, currentText, formData, apiKey);
            resultDiv.innerText = revised;

            if (qualityEl) {
                var bodyForCheck = getDisplayBodyForValidation(revised, formData);
                var report = PP.validate(bodyForCheck, formData);
                var revisionIssues = getReportReviewItems(report, { ignoreLengthWarnings: true });
                var doneMessage = "✅ 二次修改完成，" + getRevisionLengthChange(currentText, revised, formData) + "；" + getRevisionToneChange(type);
                qualityEl.style.display = "block";
                qualityEl.className = "quality-report " + (revisionIssues.length ? "warn" : "ok");
                qualityEl.innerText = revisionIssues.length
                    ? doneMessage + "；建议再看一下：" + revisionIssues.join("；")
                    : doneMessage;
            }
        } catch (err) {
            if (qualityEl) {
                qualityEl.style.display = "block";
                qualityEl.className = "quality-report warn";
                qualityEl.innerText = "❌ 二次修改失败：" + (err.message || "未知错误");
            }
            alert("二次修改失败：" + (err.message || "未知错误"));
        } finally {
            if (clickedBtn) clickedBtn.innerText = originalText;
            setRevisionButtonsDisabled(false);
        }
    }

    // ========== 初始化 ==========

    MODULE.init = function () {
        loadLists();
        MODULE.renderHighlights();
        MODULE.renderWeakPoints();
        MODULE.renderSuggestions();
        MODULE.renderEncouragements();
        initCorrectnessSlider();
        bindRadioStyle();
        bindCheckboxStyle();
        setDefaultDate();
        loadApiKey();
        initGreetingSwitch();
        ST.init();

        ["studentName", "knowledge"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener("input", clearRequiredErrors);
        });

        document.getElementById("addHighlightBtn").onclick = addHighlight;
        document.getElementById("addWeakBtn").onclick = addWeakPoint;
        document.getElementById("addSuggestionBtn").onclick = addSuggestion;
        document.getElementById("addEncouragementBtn").onclick = addEncouragement;

        document.getElementById("generateBtn").onclick = onGenerate;
        // 连接检测 + 设置弹窗
        checkConnection();
        var saveSettingsBtn = document.getElementById("saveSettingsBtn");
        if (saveSettingsBtn) saveSettingsBtn.onclick = saveSettings;

        // 导入导出按钮
        var exportBtn = document.getElementById("exportDataBtn");
        if (exportBtn) exportBtn.onclick = exportData;
        var importBtn = document.getElementById("importDataBtn");
        var importFile = document.getElementById("importFileInput");
        if (importBtn && importFile) {
            importBtn.onclick = function () { importFile.click(); };
            importFile.onchange = function () {
                if (importFile.files && importFile.files[0]) {
                    importData(importFile.files[0]);
                    importFile.value = "";
                }
            };
        }

        // 阶段成绩 "添加" 按钮事件
        var addSrBtn = document.querySelector("#stageRecordsArea .mini-memory-btn");
        if (addSrBtn) {
            addSrBtn.onclick = function () {
                var vals = _getInputRowValues();
                if (vals) {
                    MODULE.addStageRecord(vals.grade, vals.subject, vals.score, vals.notes);
                    // 清空输入
                    var row = document.querySelector(".stage-record-row:not(.existing)");
                    if (row) {
                        var inputs = row.querySelectorAll("input, select");
                        inputs.forEach(function (inp) { if (inp.type !== "button") inp.value = ""; });
                    }
                }
            };
        }
        document.getElementById("copyFeedbackBtn").onclick = copyFeedback;
        document.getElementById("clearHistoryBtn").onclick = clearFeedbackHistory;

        var quickBtn = document.getElementById("quickGenerateBtn");
        if (quickBtn) quickBtn.onclick = onQuickGenerate;

        document.querySelectorAll(".revise-btn").forEach(function (btn) {
            btn.onclick = function () { reviseCurrentFeedback(btn.getAttribute("data-revise-type")); };
        });

        ["newHighlightInput", "newWeakInput", "newSuggestionInput", "newEncouragementInput"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener("keypress", function (e) {
                if (e.key === "Enter") {
                    if (id === "newHighlightInput") addHighlight();
                    else if (id === "newWeakInput") addWeakPoint();
                    else if (id === "newSuggestionInput") addSuggestion();
                    else if (id === "newEncouragementInput") addEncouragement();
                }
            });
        });

        document.querySelectorAll(".temp-option, .tone-option").forEach(function (opt) {
            var radio = opt.querySelector("input");
            if (radio && radio.checked) opt.classList.add("selected");
        });
    };

    window.App.ui = MODULE;
})();
