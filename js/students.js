/**
 * students.js — 学生记忆系统（增删改查、拼音排序、下拉补全）
 * 依赖：config.js, storage.js
 * 挂载：window.App.students
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;
    var S = window.App.storage;

    var MODULE = {};

    // 运行时状态
    var dropdownActiveIndex = -1;
    var dropdownItems = [];

    // ========== 姓名规范化 ==========

    function normalizeStudentName(name) {
        return String(name || "").replace(/\s+/g, "").trim();
    }

    // ========== 拼音排序 ==========

    function getStudentSurnameInfo(name) {
        var cleanName = normalizeStudentName(name);
        if (!cleanName) return { surname: "", pinyin: "" };

        var compoundKeys = Object.keys(C.STUDENT_COMPOUND_SURNAME_PINYIN);
        var compoundSurname = null;
        for (var i = 0; i < compoundKeys.length; i++) {
            if (cleanName.indexOf(compoundKeys[i]) === 0) {
                compoundSurname = compoundKeys[i];
                break;
            }
        }
        if (compoundSurname) {
            return { surname: compoundSurname, pinyin: C.STUDENT_COMPOUND_SURNAME_PINYIN[compoundSurname] };
        }

        var surname = cleanName.charAt(0);
        return { surname: surname, pinyin: C.STUDENT_SURNAME_PINYIN[surname] || "" };
    }

    function compareStudentProfilesBySurnamePinyin(a, b) {
        var infoA = getStudentSurnameInfo(a && a.name || "");
        var infoB = getStudentSurnameInfo(b && b.name || "");

        if (infoA.pinyin && infoB.pinyin && infoA.pinyin !== infoB.pinyin) {
            return infoA.pinyin.localeCompare(infoB.pinyin, "en", { sensitivity: "base" });
        }

        var surnameCompare = C.STUDENT_PINYIN_COLLATOR.compare(infoA.surname || "", infoB.surname || "");
        if (surnameCompare !== 0) return surnameCompare;

        var nameCompare = C.STUDENT_PINYIN_COLLATOR.compare(a && a.name || "", b && b.name || "");
        if (nameCompare !== 0) return nameCompare;

        return ((b && b.updatedAt) || 0) - ((a && a.updatedAt) || 0);
    }

    function sortStudentProfilesBySurnamePinyin(profiles) {
        return (Array.isArray(profiles) ? profiles.slice() : []).sort(compareStudentProfilesBySurnamePinyin);
    }

    // ========== 学生档案 CRUD ==========

    MODULE.getProfiles = function () {
        try {
            var raw = S.getStudents();
            if (!Array.isArray(raw)) return [];
            return sortStudentProfilesBySurnamePinyin(
                raw.filter(function (item) { return item && normalizeStudentName(item.name); })
                    .map(function (item) {
                        return {
                            name: normalizeStudentName(item.name),
                            grade: item.grade || "初中",
                            gender: item.gender || "男",
                            subject: item.subject || "数学",
                            createdAt: item.createdAt || item.updatedAt || Date.now(),
                            updatedAt: item.updatedAt || Date.now()
                        };
                    })
            );
        } catch (e) {
            return [];
        }
    };

    MODULE.saveProfiles = function (profiles) {
        var cleaned = [];
        var seen = {};
        (Array.isArray(profiles) ? profiles : []).forEach(function (item) {
            var name = normalizeStudentName(item && item.name);
            if (!name || seen[name]) return;
            seen[name] = true;
            cleaned.push({
                name: name,
                grade: item.grade || "初中",
                gender: item.gender || "男",
                subject: item.subject || "数学",
                createdAt: item.createdAt || Date.now(),
                updatedAt: item.updatedAt || Date.now()
            });
        });
        S.saveStudents(sortStudentProfilesBySurnamePinyin(cleaned).slice(0, 300));
    };

    MODULE.findProfile = function (name) {
        var normalized = normalizeStudentName(name);
        if (!normalized) return null;
        var profiles = MODULE.getProfiles();
        for (var i = 0; i < profiles.length; i++) {
            if (normalizeStudentName(profiles[i].name) === normalized) return profiles[i];
        }
        return null;
    };

    // ========== 表单操作 ==========

    function setSelectValueIfExists(id, value) {
        var el = document.getElementById(id);
        if (!el || !value) return;
        var exists = false;
        var options = el.options || [];
        for (var i = 0; i < options.length; i++) {
            if (options[i].value === value) { exists = true; break; }
        }
        if (exists) el.value = value;
    }

    MODULE.applyProfileToForm = function (profile) {
        if (!profile) return;
        var nameInput = document.getElementById("studentName");
        if (nameInput) nameInput.value = profile.name || "";
        setSelectValueIfExists("studentGender", profile.gender);
        setSelectValueIfExists("grade", profile.grade);
        setSelectValueIfExists("subject", profile.subject);
        updateStudentMemoryButtons();
        MODULE.renderDropdown();
    };

    function getStudentDropdownProfiles() {
        var input = document.getElementById("studentName");
        var keyword = normalizeStudentName(input ? input.value : "");
        var profiles = MODULE.getProfiles();
        if (!keyword || MODULE.findProfile(keyword)) return profiles;

        var matched = profiles.filter(function (profile) {
            return normalizeStudentName(profile.name).indexOf(keyword) >= 0;
        });
        return matched.length ? matched : profiles;
    }

    // ========== 下拉 UI ==========

    function setDropdownActiveIndex(index) {
        var dropdown = document.getElementById("studentMemoryDropdown");
        if (!dropdown || !dropdownItems.length) return;
        var max = dropdownItems.length - 1;
        dropdownActiveIndex = Math.max(0, Math.min(index, max));
        var items = dropdown.querySelectorAll(".student-memory-item");
        items.forEach(function (item, idx) {
            var active = idx === dropdownActiveIndex;
            if (active) item.classList.add("active");
            else item.classList.remove("active");
            item.setAttribute("aria-selected", active ? "true" : "false");
            if (active) item.scrollIntoView({ block: "nearest" });
        });
    }

    MODULE.renderDropdown = function () {
        var dropdown = document.getElementById("studentMemoryDropdown");
        if (!dropdown) return;
        var profiles = getStudentDropdownProfiles();
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
            metaSpan.textContent = [profile.grade, profile.gender, profile.subject].filter(Boolean).join("｜");

            item.appendChild(nameSpan);
            item.appendChild(metaSpan);

            item.addEventListener("mousedown", function (e) { e.preventDefault(); });
            item.addEventListener("mouseenter", function () { setDropdownActiveIndex(index); });
            item.addEventListener("click", function () {
                MODULE.applyProfileToForm(profile);
                hideDropdown();
                var nameInput = document.getElementById("studentName");
                if (nameInput) nameInput.focus();
            });

            dropdown.appendChild(item);
        });
    };

    function renderStudentMemoryList() {
        var listEl = document.getElementById("studentMemoryList");
        if (listEl) {
            listEl.innerHTML = "";
            MODULE.getProfiles().forEach(function (profile) {
                var option = document.createElement("option");
                option.value = profile.name;
                var label = [profile.grade, profile.gender, profile.subject].filter(Boolean).join("｜");
                option.label = label;
                option.textContent = label;
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

    function handleStudentNameMemoryChange() {
        var input = document.getElementById("studentName");
        var profile = MODULE.findProfile(input ? input.value : "");
        if (profile) MODULE.applyProfileToForm(profile);
        else updateStudentMemoryButtons();
        MODULE.renderDropdown();
    }

    // ========== 保存 & 删除 ==========

    MODULE.upsertProfile = function (showAlert) {
        var name = normalizeStudentName((document.getElementById("studentName") || {}).value || "");
        if (!name || name === "这位同学") {
            if (showAlert) alert("请输入学生姓名后再保存");
            return false;
        }
        var gender = (document.getElementById("studentGender") || {}).value || "男";
        var grade = (document.getElementById("grade") || {}).value || "初中";
        var subject = (document.getElementById("subject") || {}).value || "数学";
        var profiles = MODULE.getProfiles();
        var idx = -1;
        for (var i = 0; i < profiles.length; i++) {
            if (normalizeStudentName(profiles[i].name) === name) { idx = i; break; }
        }
        var now = Date.now();
        var profile = {
            name: name,
            gender: gender,
            grade: grade,
            subject: subject,
            createdAt: idx >= 0 ? profiles[idx].createdAt : now,
            updatedAt: now
        };
        if (idx >= 0) profiles.splice(idx, 1);
        profiles.push(profile);
        MODULE.saveProfiles(profiles);
        renderStudentMemoryList();
        if (showAlert) alert("✅ 已保存学生：" + name + "（" + grade + "｜" + gender + "｜" + subject + "）");
        return true;
    };

    MODULE.deleteProfile = function () {
        var name = normalizeStudentName((document.getElementById("studentName") || {}).value || "");
        var profile = MODULE.findProfile(name);
        if (!profile) { alert("当前姓名还没有保存记录"); return; }
        if (!confirm("确定删除"" + profile.name + ""的学生记忆吗？")) return;
        var profiles = MODULE.getProfiles().filter(function (item) {
            return normalizeStudentName(item.name) !== normalizeStudentName(profile.name);
        });
        MODULE.saveProfiles(profiles);
        renderStudentMemoryList();
        alert("✅ 已删除该学生记忆");
    };

    function updateStudentMemoryButtons() {
        var deleteBtn = document.getElementById("deleteStudentBtn");
        if (!deleteBtn) return;
        var name = (document.getElementById("studentName") || {}).value || "";
        deleteBtn.disabled = !MODULE.findProfile(name);
    }

    // ========== 初始化 & 事件绑定 ==========

    MODULE.init = function () {
        renderStudentMemoryList();
        var input = document.getElementById("studentName");
        if (input) {
            input.addEventListener("focus", showDropdown);
            input.addEventListener("click", showDropdown);
            input.addEventListener("change", handleStudentNameMemoryChange);
            input.addEventListener("input", function () {
                var profile = MODULE.findProfile(input.value);
                if (profile) MODULE.applyProfileToForm(profile);
                else updateStudentMemoryButtons();
                showDropdown();
            });
            input.addEventListener("keydown", function (e) {
                var dropdown = document.getElementById("studentMemoryDropdown");
                var isOpen = dropdown && dropdown.classList.contains("show");
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (!isOpen) showDropdown();
                    else setDropdownActiveIndex(dropdownActiveIndex + 1);
                } else if (e.key === "ArrowUp") {
                    if (isOpen) {
                        e.preventDefault();
                        setDropdownActiveIndex(dropdownActiveIndex - 1);
                    }
                } else if (e.key === "Enter" && isOpen && dropdownActiveIndex >= 0 && dropdownItems[dropdownActiveIndex]) {
                    e.preventDefault();
                    MODULE.applyProfileToForm(dropdownItems[dropdownActiveIndex]);
                    hideDropdown();
                } else if (e.key === "Escape") {
                    hideDropdown();
                }
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
