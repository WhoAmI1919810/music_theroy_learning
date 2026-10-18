(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || !script.src) return;
  var root = new URL(".", script.src);
  var current = window.location.pathname;
  var rootElement = document.documentElement;
  var THEME_KEY = "music-site-theme";
  var themeButton = null;

  function sectionFromPath(path) {
    if (path.indexOf("/harmony_atlas/docs/books/") >= 0) return "harmony-books";
    if (path.indexOf("/harmony_atlas/docs/") >= 0) return "harmony-manual";
    if (path.indexOf("/harmony_atlas/app/") >= 0) return "harmony-app";
    if (path.indexOf("/counterpoint_atlas/docs/books/") >= 0) return "counterpoint-books";
    if (path.indexOf("/counterpoint_atlas/docs/") >= 0) return "counterpoint-manual";
    if (path.indexOf("/counterpoint_atlas/tutorial/") >= 0) return "counterpoint-tutorial";
    if (path.indexOf("/counterpoint_atlas/app/") >= 0) return "counterpoint-app";
    if (path.indexOf("/orchestration_atlas/docs/books/") >= 0) return "orchestration-books";
    if (path.indexOf("/orchestration_atlas/docs/") >= 0) return "orchestration-manual";
    if (path.indexOf("/orchestration_atlas/app/") >= 0) return "orchestration-app";
    return "home";
  }

  function savedTheme() {
    try {
      var value = window.localStorage.getItem(THEME_KEY);
      if (value === "light" || value === "dark") return value;
    } catch (error) {}
    var initial = rootElement.getAttribute("data-theme");
    return initial === "dark" ? "dark" : "light";
  }

  var initialTheme = savedTheme();
  rootElement.setAttribute("data-theme", initialTheme);
  rootElement.style.colorScheme = initialTheme;
  if (!rootElement.getAttribute("data-site-section")) {
    rootElement.setAttribute("data-site-section", sectionFromPath(current));
  }
  if (!document.querySelector('link[rel~="icon"]')) {
    var icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23efb45b'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-size='20' font-family='serif' fill='%2317120b'%3EM%3C/text%3E%3C/svg%3E";
    document.head.appendChild(icon);
  }
  var groups = [
    {
      label: "总览",
      links: [
        ["工作台", "index.html"]
      ]
    },
    {
      label: "和声",
      links: [
        ["推演台", "harmony_atlas/app/"],
        ["理论手册", "harmony_atlas/docs/和声学手册.html"],
        ["教材证据", "harmony_atlas/docs/books/"]
      ]
    },
    {
      label: "配器",
      links: [
        ["推演台", "orchestration_atlas/app/"],
        ["理论手册", "orchestration_atlas/docs/配器法手册.html"],
        ["教材证据", "orchestration_atlas/docs/books/"]
      ]
    },
    {
      label: "复调",
      links: [
        ["教程", "counterpoint_atlas/tutorial/"],
        ["推演台", "counterpoint_atlas/app/"],
        ["理论手册", "counterpoint_atlas/docs/复调音乐手册.html"],
        ["教材证据", "counterpoint_atlas/docs/books/"]
      ]
    }
  ];

  var css = [
    ":root{--music-site-nav-height:46px}",
    "html{scroll-padding-top:calc(var(--music-site-nav-height) + 10px)}:target{scroll-margin-top:calc(var(--music-site-nav-height) + 10px)}",
    ".site-nav{position:sticky;top:0;z-index:120;background:var(--theme-nav-bg,rgba(11,17,24,.96));border-bottom:1px solid var(--theme-nav-border,rgba(180,200,224,.22));box-shadow:var(--theme-nav-shadow,0 8px 24px rgba(0,0,0,.28));color:var(--theme-nav-text,#edf3fa);font:12px/1.4 'Segoe UI','Microsoft YaHei',sans-serif;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}",
    ".site-nav-inner{width:min(calc(100% - 24px),1180px);margin:0 auto;display:flex;align-items:center;gap:7px;min-height:var(--music-site-nav-height)}",
    ".site-nav button,.site-nav summary{appearance:none;border:1px solid var(--theme-nav-border,rgba(180,200,224,.22));border-radius:8px;background:color-mix(in srgb,var(--theme-nav-panel,#101a26) 82%,transparent);color:var(--theme-nav-muted,#c8d4e1);font:inherit;padding:7px 10px;cursor:pointer}",
    ".site-nav button:hover,.site-nav summary:hover,.site-nav a:hover{color:var(--theme-nav-text,#fff);border-color:color-mix(in srgb,var(--theme-gold,#eeb15b) 62%,var(--theme-nav-border,rgba(180,200,224,.22)));background:var(--theme-nav-hover,rgba(255,255,255,.04))}",
    ".site-nav .site-back{white-space:nowrap}",
    ".site-home{display:inline-flex;align-items:center;padding:7px 4px;color:var(--theme-gold,#eeb15b);text-decoration:none;white-space:nowrap}",
    ".site-jump{position:relative}",
    ".site-jump summary{list-style:none;white-space:nowrap}.site-jump summary::-webkit-details-marker{display:none}.site-jump summary:after{content:' ▾';color:var(--theme-gold,#eeb15b)}",
    ".site-jump-panel{position:fixed;top:calc(var(--music-site-nav-height) + 8px);left:12px;right:12px;z-index:130;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;width:min(760px,calc(100vw - 24px));margin:0 auto;padding:15px;border:1px solid var(--theme-nav-border,rgba(180,200,224,.28));border-radius:12px;background:var(--theme-nav-panel,#101a26);box-shadow:var(--theme-nav-shadow,0 22px 55px rgba(0,0,0,.5))}",
    ".site-jump-group b{display:block;margin:0 0 7px;color:var(--theme-gold,#eeb15b);font-size:10px;letter-spacing:.08em}.site-jump-group a{display:block;padding:6px 7px;border-radius:6px;color:var(--theme-nav-muted,#c8d4e1);text-decoration:none}.site-jump-group a[aria-current='page']{background:var(--theme-nav-active,rgba(238,177,91,.16));color:var(--theme-nav-text,#fff)}",
    ".site-context{margin-left:auto;color:var(--theme-nav-muted,#8494a9);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".site-theme-toggle{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.site-theme-icon{color:var(--theme-gold,#eeb15b);font-size:14px;line-height:1}.site-theme-label{line-height:1}.site-theme-toggle[aria-pressed='true']{border-color:color-mix(in srgb,var(--theme-teal,#69d7c1) 46%,var(--theme-nav-border,rgba(180,200,224,.22)));background:color-mix(in srgb,var(--theme-teal,#69d7c1) 10%,var(--theme-nav-panel,#101a26))}",
    "@media(max-width:620px){:root{--music-site-nav-height:44px}.site-nav-inner{width:calc(100% - 16px);gap:4px}.site-nav button,.site-nav summary{padding:6px 8px;font-size:11px}.site-home{font-size:11px;padding:6px 2px}.site-context{display:none}.site-theme-toggle{margin-left:auto;padding:6px 7px!important}.site-theme-icon{font-size:13px}.site-jump-panel{left:8px;right:8px;width:auto;grid-template-columns:1fr 1fr;max-height:calc(100vh - var(--music-site-nav-height) - 16px);max-height:calc(100dvh - var(--music-site-nav-height) - 16px);overflow:auto}}",
    "@media(max-width:380px){.site-home{display:none}.site-jump-panel{grid-template-columns:1fr}}",
    "@media print{.site-nav{display:none!important}}"
  ].join("");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function url(path) { return new URL(path, root).href; }
  if (!document.querySelector("link[data-site-theme-css], link[href$='site-theme.css']")) {
    var themeLink = document.createElement("link");
    themeLink.rel = "stylesheet";
    themeLink.href = url("site-theme.css");
    themeLink.setAttribute("data-site-theme-css", "");
    document.head.appendChild(themeLink);
  }
  function isCurrent(href) {
    try {
      var a = new URL(href).pathname.replace(/\/index\.html$/, "/");
      var b = current.replace(/\/index\.html$/, "/");
      return a === b;
    } catch (error) { return false; }
  }
  function contextLabel() {
    if (current.indexOf("/harmony_atlas/") >= 0) return "和声系统";
    if (current.indexOf("/orchestration_atlas/") >= 0) return "配器系统";
    if (current.indexOf("/counterpoint_atlas/") >= 0) return "复调系统";
    return "音乐理论工作台";
  }

  var nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "全站导航");
  var inner = document.createElement("div");
  inner.className = "site-nav-inner";

  var back = document.createElement("button");
  back.type = "button";
  back.className = "site-back";
  back.textContent = "← 返回上一页";
  back.addEventListener("click", function () {
    var referrer = document.referrer;
    var sameOrigin = false;
    try { sameOrigin = referrer && new URL(referrer).origin === window.location.origin; } catch (error) {}
    if (sameOrigin && window.history.length > 1) window.history.back();
    else window.location.href = url("index.html");
  });

  var home = document.createElement("a");
  home.className = "site-home";
  home.href = url("index.html");
  home.textContent = "工作台";

  var details = document.createElement("details");
  details.className = "site-jump";
  var summary = document.createElement("summary");
  summary.textContent = "页面跳转";
  details.appendChild(summary);
  var panel = document.createElement("div");
  panel.className = "site-jump-panel";
  groups.forEach(function (group) {
    var box = document.createElement("div");
    box.className = "site-jump-group";
    var title = document.createElement("b");
    title.textContent = group.label;
    box.appendChild(title);
    group.links.forEach(function (item) {
      var link = document.createElement("a");
      link.href = url(item[1]);
      link.textContent = item[0];
      if (isCurrent(link.href)) link.setAttribute("aria-current", "page");
      box.appendChild(link);
    });
    panel.appendChild(box);
  });
  details.appendChild(panel);

  var context = document.createElement("span");
  context.className = "site-context";
  context.textContent = contextLabel();

  themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.className = "site-theme-toggle";
  var themeIcon = document.createElement("span");
  themeIcon.className = "site-theme-icon";
  themeIcon.setAttribute("aria-hidden", "true");
  var themeLabel = document.createElement("span");
  themeLabel.className = "site-theme-label";
  themeButton.appendChild(themeIcon);
  themeButton.appendChild(themeLabel);

  function applyTheme(theme, persist) {
    theme = theme === "dark" ? "dark" : "light";
    rootElement.setAttribute("data-theme", theme);
    rootElement.style.colorScheme = theme;
    document.body.classList.toggle("mtv-light", theme === "light");
    var nextLabel = theme === "dark" ? "浅色" : "深色";
    var nextTitle = theme === "dark" ? "切换到浅色模式" : "切换到深色模式";
    themeIcon.textContent = theme === "dark" ? "☀" : "☾";
    themeLabel.textContent = nextLabel;
    themeButton.title = nextTitle;
    themeButton.setAttribute("aria-label", nextTitle);
    themeButton.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1119" : "#f5efe4");
    if (persist) {
      try { window.localStorage.setItem(THEME_KEY, theme); } catch (error) {}
    }
    try {
      window.dispatchEvent(new CustomEvent("site-theme-change", { detail: { theme: theme } }));
    } catch (error) {}
  }

  themeButton.addEventListener("click", function () {
    applyTheme(rootElement.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
  });
  window.addEventListener("storage", function (event) {
    if (event.key === THEME_KEY && (event.newValue === "light" || event.newValue === "dark")) {
      applyTheme(event.newValue, false);
    }
  });

  inner.appendChild(back);
  inner.appendChild(home);
  inner.appendChild(details);
  inner.appendChild(context);
  inner.appendChild(themeButton);
  nav.appendChild(inner);

  var skip = document.body.querySelector(".skip");
  if (skip) skip.insertAdjacentElement("afterend", nav);
  else document.body.insertBefore(nav, document.body.firstChild);

  applyTheme(initialTheme, false);

  document.addEventListener("click", function (event) {
    if (details.open && !details.contains(event.target)) details.open = false;
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") details.open = false;
  });
  var lastScrollY = window.scrollY;
  window.addEventListener("scroll", function () {
    if (details.open && Math.abs(window.scrollY - lastScrollY) > 4) details.open = false;
    lastScrollY = window.scrollY;
  }, { passive: true });
})();
