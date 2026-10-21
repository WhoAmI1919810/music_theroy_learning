(function () {
  "use strict";

  var input = document.getElementById("termSearch");
  var count = document.getElementById("resultCount");
  var filters = Array.prototype.slice.call(document.querySelectorAll("[data-subject-filter]"));
  var entries = Array.prototype.slice.call(document.querySelectorAll(".term-entry"));
  var groups = Array.prototype.slice.call(document.querySelectorAll(".term-group"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".subject-section"));
  var activeSubject = "all";

  if (!input || !count) return;

  entries.forEach(function (entry) {
    entry.setAttribute("data-index", entry.textContent.toLocaleLowerCase("zh-CN").replace(/\s+/g, " "));
  });

  function apply() {
    var query = input.value.trim().toLocaleLowerCase("zh-CN");
    var visible = 0;
    entries.forEach(function (entry) {
      var subjectMatch = activeSubject === "all" || entry.getAttribute("data-subject") === activeSubject;
      var queryMatch = !query || entry.getAttribute("data-index").indexOf(query) >= 0;
      var show = subjectMatch && queryMatch;
      entry.hidden = !show;
      if (show) visible += 1;
    });
    groups.forEach(function (group) {
      group.hidden = !group.querySelector(".term-entry:not([hidden])");
    });
    sections.forEach(function (section) {
      section.hidden = !section.querySelector(".term-entry:not([hidden])");
    });
    count.textContent = "显示 " + visible + " / " + entries.length + " 个词条";
  }

  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      activeSubject = button.getAttribute("data-subject-filter");
      filters.forEach(function (item) {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      apply();
    });
  });

  input.addEventListener("input", apply);
  input.addEventListener("search", apply);
  document.addEventListener("keydown", function (event) {
    var tag = event.target && event.target.tagName;
    if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
      event.preventDefault();
      input.focus();
    }
    if (event.key === "Escape" && document.activeElement === input) {
      input.value = "";
      apply();
      input.blur();
    }
  });
  apply();
})();
