/**
 * students.js — 学生记忆系统（API 后端版本）
 * 依赖：config.js, api-client.js
 * 挂载：window.App.students
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;
    var AC = window.App.apiClient;

    var MODULE = {};
    var dropdownActiveIndex = -1;
    var dropdownItems = [];

    // ========== 姓名规范化 ==========
    function normalizeStudentName(name) {
        return String(name || "").replace(/\s+/g, "").trim();
    }

    // ========== 拼音排序 ==========
    function getPinyinFromName(name) {
        var clean = normalizeStudentName(name);
        if (!clean) return "";
        var compoundKeys = Object.keys(C.STUDENT_COMPOUND_SURNAME_PINYIN);
        for (var i = 0; i < compoundKeys.length; i++) {
            if (clean.indexOf(compoundKeys[i]) === 0) {
                return C.STUDENT_COMPOUND_SURNAME_PINYIN[compoundKeys[i]] || "";
            }
        }
        return C.STUDENT_SURNAME_PINYIN[clean.charAt(0)] || clean.charAt(0);
    }

    // ========== CRUD ==========

    MODULE.getProfiles = async function () {
        try {
            var raw = await AC.getStudents();
            if (!Array.isArray(raw)) return [];
            return raw;
        } catch (e) { return []; }
    };

    MODULE.saveProfiles = async function (profiles) {
        return await AC.saveStudents(profiles);
    };

    MODULE.findProfile = async function (name) {
        return await AC.findStudent(name);
    };

    // ========== 表单操作 ==========
    function setSelectValueIfExists(id, value) {
        var el = document.getElementById(id);
        if (!el || !value) return;
        var options = el.options || [];
        for (var i = 0; i < options.length; i++) {
            if (options[i].value === value) return (el.value = value);
        }
    }

    MODULE.applyProfileToForm = async function (profile) {
        if (!profile) return;
        var nameInput = document.getElementById("studentName");
        if (nameInput) nameInput.value = profile.name || "";
        setSelectValueIfExists("studentGender", profile.gender);
        setSelectValueIfExists("grade", profile.grade);
        setSelectValueIfExists("subject", profile.subject);
        var notesEl = document.getElementById("studentNotes");
        if (notesEl) notesEl.value = profile.notes || "";
        MODULE.renderSessionHistory(profile.name);
        updateStudentMemoryButtons();
        MODULE.renderDropdown();
    };

    async function getStudentDropdownProfiles() {
        var input = document.getElementById("studentName");
        var keyword = normalizeStudentName(input ? input.value : "");
        var profiles = await MODULE.getProfiles();
        if (!keyword || await MODULE.findProfile(keyword)) return profiles;
        return profiles.filter(function (p) {
            return normalizeStudentName(p.name).indexOf(keyword) >= 0;
        });
    }

    // ========== 下拉 UI ==========
    MODULE.renderDropdown = async function () {
        var dropdown = document.getElementById("studentMemoryDropdown");
        if (!dropdown) return;
        var profiles = await getStudentDropdownProfiles();
        dropdownItems = profiles;
        dropdownActiveIndex = profiles.length ? 0 : -1;
        dropdown.innerHTML = "";

        if (!profiles.length) {
            var empty = document.createElement("div");
            empty.className = "student-memory-empty";
            empty.textContent = "暂无已保存学生";
            dropdown.appendChild(empty);
            return;
        }

        profiles.forEach(function (profile, index) {
            var item = document.createElement("button");
            item.type = "button";
            item.className = "student-memory-item" + (index === 0 ? " active" : "");
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", index === 0 ? "true" : "false");
            item.dataset.index = String(index);

            var nameSpan = document.createElement("span");
            nameSpan.className = "student-memory-name";
            nameSpan.textContent = profile.name;

            var metaSpan = document.createElement("span");
            metaSpan.className = "student-memory-meta";
            var sessionCount = (profile.session_count) ? profile.session_count + "次课" : "";
            var tags = (profile.tags && profile.tags.length) ? " " + profile.tags.slice(0, 2).map(function (t) { return "#" + t; }).join(" ") : "";
            metaSpan.textContent = [profile.grade, profile.gender, profile.subject, sessionCount, tags].filter(Boolean).join("｜");

            item.appendChild(nameSpan);
            item.appendChild(metaSpan);
            item.addEventListener("mousedown", function (e) { e.preventDefault(); });
            item.addEventListener("mouseenter", function () { setDropdownActiveIndex(index); });
            item.addEventListener("click", function () {
                MODULE.applyProfileToForm(profile);
                hideDropdown();
                var ni = document.getElementById("studentName");
                if (ni) ni.focus();
            });
            dropdown.appendChild(item);
        });
    };

    function setDropdownActiveIndex(index) {
        var dropdown = document.getElementById("studentMemoryDropdown");
        if (!dropdown || !dropdownItems.length) return;
        dropdownActiveIndex = Math.max(0, Math.min(index, dropdownItems.length - 1));
        var items = dropdown.querySelectorAll(".student-memory-item");
        items.forEach(function (item, idx) {
            var active = idx === dropdownActiveIndex;
            if (active) item.classList.add("active"); else item.classList.remove("active");
            item.setAttribute("aria-selected", active ? "true" : "false");
            if (active) item.scrollIntoView({ block: "nearest" });
        });
    }

    async function renderStudentMemoryList() {
        var listEl = document.getElementById("studentMemoryList");
        if (listEl) {
            listEl.innerHTML = "";
            var profiles = await MODULE.getProfiles();
            profiles.forEach(function (profile) {
                var option = document.createElement("option");
                option.value = profile.name;
                option.textContent = [profile.grade, profile.gender, profile.subject].filter(Boolean).join("｜");
                listEl.appendChild(option);
            });
        }
        MODULE.renderDropdown();
        updateStudentMemoryButtons();
    }

    function showDropdown() {
        var dropdown = document.getElementById("studentMemoryDropdown");
        var input = document.getElementById("studentName");
        if (!dropdown || !input) return;
        MODULE.renderDropdown();
        dropdown.classList.add("show");
        input.setAttribute("aria-expanded", "true");
    }

    function hideDropdown() {
        var dropdown = document.getElementById("studentMemoryDropdown");
        var input = document.getElementById("studentName");
        if (!dropdown || !input) return;
        dropdown.classList.remove("show");
        input.setAttribute("aria-expanded", "false");
    }

    // ========== 保存 & 删除 ==========
    MODULE.upsertProfile = async function (showAlert) {
        var name = normalizeStudentName((document.getElementById("studentName") || {}).value || "");
        if (!name || name === "这位同学") {
            if (showAlert) alert("请输入学生姓名后再保存");
            return false;
        }
        var gender = (document.getElementById("studentGender") || {}).value || "男";
        var grade = (document.getElementById("grade") || {}).value || "初中";
        var subject = (document.getElementById("subject") || {}).value || "数学";
        var notes = (document.getElementById("studentNotes") || {}).value || "";

        // 保留已有 sessions 和 tags
        var existing = await MODULE.findProfile(name);
        var profile = {
            name: name, gender: gender, grade: grade, subject: subject, notes: notes,
            tags: existing ? (existing.tags || []) : [],
        };

        await AC.saveStudents([profile]);
        await renderStudentMemoryList();
        if (showAlert) alert("✅ 已保存学生：" + name + "（" + grade + "｜" + gender + "｜" + subject + "）");
        MODULE.renderSessionHistory(name);
        return true;
    };

    MODULE.deleteProfile = async function () {
        var name = normalizeStudentName((document.getElementById("studentName") || {}).value || "");
        var profile = await MODULE.findProfile(name);
        if (!profile) { alert("当前姓名还没有保存记录"); return; }
        var sc = profile.session_count || 0;
        if (!confirm("确定删除"" + profile.name + ""的学生记忆吗？\n（包含 " + sc + " 条学习记录）")) return;

        try {
            await fetch("/api/students/" + profile.id, { method: "DELETE" });
            await renderStudentMemoryList();
            MODULE.renderSessionHistory("");
            alert("✅ 已删除该学生记忆");
        } catch (e) {
            alert("删除失败：" + e.message);
        }
    };

    async function updateStudentMemoryButtons() {
        var deleteBtn = document.getElementById("deleteStudentBtn");
        if (!deleteBtn) return;
        var name = (document.getElementById("studentName") || {}).value || "";
        var profile = await MODULE.findProfile(name);
        deleteBtn.disabled = !profile;
    }

    // ========== 学习历史渲染 ==========
    MODULE.renderSessionHistory = async function (studentName) {
        var container = document.getElementById("studentSessionHistory");
        if (!container) return;
        var data = await AC.getStudentSessions(studentName);
        if (!data || !data.sessions || !data.sessions.length) {
            container.innerHTML = '<div class="session-history-empty">暂无该学生的学习记录，生成反馈后会自动记录。</div>';
            return;
        }

        var recent = data.sessions.slice(0, 5);
        var tagsHtml = "";
        if (data.profile && data.profile.tags && data.profile.tags.length) {
            tagsHtml = '<div class="session-tags">' +
                data.profile.tags.map(function (t) { return '<span class="session-tag">#' + t + '</span>'; }).join("") +
                '</div>';
        }

        var avgCorrectness = "N/A";
        if (data.sessions.length > 0) {
            var sum = 0, cnt = 0;
            data.sessions.forEach(function (s) {
                if (s.correctness !== null && s.correctness !== undefined) { sum += s.correctness; cnt++; }
            });
            if (cnt > 0) avgCorrectness = Math.round(sum / cnt) + "%";
        }

        container.innerHTML =
            '<div class="session-summary">' +
            '<span>📊 共 ' + data.sessionCount + ' 次课</span>' +
            '<span>📈 均正确率 ' + avgCorrectness + '</span>' +
            '</div>' + tagsHtml +
            '<div class="session-list">' +
            recent.map(function (s) {
                var dateStr = s.date || "";
                var m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
                if (m) dateStr = m[2] + "月" + m[3] + "日";
                var kw = (s.knowledge || "").length > 25 ? (s.knowledge || "").substring(0, 25) + "..." : (s.knowledge || "未记录");
                var cr = s.correctness !== null && s.correctness !== undefined
                    ? '<span class="session-correctness">' + s.correctness + '%</span>' : "";
                return '<div class="session-item"><div class="session-item-header">' +
                    '<span class="session-date">' + dateStr + '</span>' +
                    '<span class="session-knowledge">' + kw + '</span>' + cr +
                    '</div><div class="session-item-body">' + (s.performance || "").substring(0, 120) + '</div></div>';
            }).join("") +
            '</div>';
    };

    // ========== 初始化 ==========
    MODULE.init = function () {
        renderStudentMemoryList();
        var input = document.getElementById("studentName");
        if (input) {
            input.addEventListener("focus", showDropdown);
            input.addEventListener("click", showDropdown);
            input.addEventListener("input", async function () {
                var profile = await MODULE.findProfile(input.value);
                if (profile) MODULE.applyProfileToForm(profile);
                else updateStudentMemoryButtons();
                showDropdown();
            });
            input.addEventListener("keydown", function (e) {
                var dropdown = document.getElementById("studentMemoryDropdown");
                var isOpen = dropdown && dropdown.classList.contains("show");
                if (e.key === "ArrowDown") { e.preventDefault(); if (!isOpen) showDropdown(); else setDropdownActiveIndex(dropdownActiveIndex + 1); }
                else if (e.key === "ArrowUp") { if (isOpen) { e.preventDefault(); setDropdownActiveIndex(dropdownActiveIndex - 1); } }
                else if (e.key === "Enter" && isOpen && dropdownActiveIndex >= 0 && dropdownItems[dropdownActiveIndex]) {
                    e.preventDefault(); MODULE.applyProfileToForm(dropdownItems[dropdownActiveIndex]); hideDropdown();
                }
                else if (e.key === "Escape") { hideDropdown(); }
            });
            input.addEventListener("blur", function () {
                setTimeout(function () { hideDropdown(); }, 120);
                if (normalizeStudentName(input.value)) MODULE.upsertProfile(false);
                updateStudentMemoryButtons();
            });
        }
        document.addEventListener("click", function (e) {
            var wrapper = document.querySelector(".student-name-wrapper");
            if (wrapper && !wrapper.contains(e.target)) hideDropdown();
        });

        var saveBtn = document.getElementById("saveStudentBtn");
        if (saveBtn) saveBtn.onclick = function () { MODULE.upsertProfile(true); };
        var deleteBtn = document.getElementById("deleteStudentBtn");
        if (deleteBtn) deleteBtn.onclick = MODULE.deleteProfile;

        ["studentGender", "grade", "subject"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener("change", function () {
                var nameEl = document.getElementById("studentName");
                if (normalizeStudentName(nameEl ? nameEl.value : "")) MODULE.upsertProfile(false);
            });
        });
    };

    window.App.students = MODULE;
})();
