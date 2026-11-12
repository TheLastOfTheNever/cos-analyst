(function () {
  const nav = document.querySelector(".links, .site-nav");
  if (!nav) return;

  const inPages = window.location.pathname.toLowerCase().includes("/pages/");
  const prefix = inPages ? "" : "pages/";
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = inPages ? "../css/academy-navigation.css" : "css/academy-navigation.css";
  document.head.appendChild(stylesheet);
  const platformLinks = [
    ["Профессия", "Профессия и задачи SOC-аналитика.", "profession.html"],
    ["Лаборатория", "Учебная среда для практики.", "lab.html"],
    ["Портфолио", "Проекты и учебные отчёты.", "portfolio.html"],
    ["Блоги", "Подборка материалов о SOC и безопасности.", "APIBLOGS.html"]
  ];
  const categories = [
    {
      label: "Мониторинг и СЗИ",
      page: "monitoring.html",
      topics: [
        ["SOC и SIEM", "Сбор, нормализация и корреляция событий.", "siem"],
        ["PT SIEM / PT Senat", "Архитектура и работа аналитика в SIEM.", "pt-siem"],
        ["KUMA", "События, нормализация и правила.", "kuma"],
        ["Sandbox", "Изолированный анализ подозрительных файлов.", "sandbox"],
        ["SAST", "Статический анализ исходного кода.", "sast"],
        ["Периметр Гарда", "Мониторинг сетевых и веб-событий.", "garda"],
        ["ADS и СКУД", "События контроля физического доступа.", "ads"],
        ["Сети", "Адресация, маршрутизация и сегментация.", "network-basics"],
        ["Протоколы", "DNS, HTTP(S), почта, удалённый доступ и журналы.", "protocol-basics"],
        ["Wireshark, Zeek и Suricata", "Инструменты анализа и сетевого обнаружения.", "network-tools"],
        ["Управление уязвимостями", "Сканирование, приоритизация и исправления.", "vulnerabilities"]
      ]
    },
    {
      label: "Угрозы и атаки",
      page: "threats.html",
      topics: [
        ["DoS", "Признаки отказа в обслуживании и влияние на сервис.", "dos"],
        ["DDoS", "Распределённая нагрузка и признаки в телеметрии.", "ddos"],
        ["Фишинг", "Проверка письма, ссылок и вложений.", "phishing"],
        ["Вредоносное ПО", "Классы угроз и безопасный первичный разбор.", "malware"],
        ["Антифрод", "Сигналы подозрительных действий и транзакций.", "antifraud"],
        ["Ransomware", "Признаки шифрования и эскалация.", "ransomware"],
        ["Lateral movement", "Аномальные перемещения между узлами.", "lateral-movement"],
        ["APT", "Длительные целевые кампании и контекст.", "apt"],
        ["Социальная инженерия", "Манипуляции и безопасная проверка сообщений.", "social-engineering"]
      ]
    },
    {
      label: "Анализ и автоматизация",
      page: "analysis.html",
      topics: [
        ["Алерты", "Жизненный цикл, приоритеты и триаж.", "alerts"],
        ["Корреляция", "Как правила связывают события.", "correlation"],
        ["Нормализация", "Поля события и обработка ошибок разбора.", "normalization"],
        ["AD CS: ESC1 и ESC8/ESC16", "Контекст сертификатов и проверка детектов.", "adcs"],
        ["IoC и Threat Intelligence", "Контекст индикаторов и ограничения репутации.", "ioc"],
        ["Анализ файлов", "Хеши, метаданные и безопасная эскалация.", "file-analysis"],
        ["Python в SOC", "Идеи автоматизации без передачи секретов.", "python"],
        ["SOAR и плейбуки", "Контролируемая автоматизация реагирования.", "soar"],
        ["Автоматизация триажа", "Границы автоматической приоритизации алертов.", "triage-automation"],
        ["Интеграции и API", "Проверяемая связь SIEM, EDR и тикет-систем.", "integrations"],
        ["MITRE ATT&CK", "Справочная таксономия тактик и техник.", "mitre"],
        ["DFIR", "Сохранение следов и передача расследования.", "dfir"],
        ["ML и метрики", "Контекст моделей, MTTD/MTTR и отчётность.", "metrics"]
      ]
    }
  ];
  let keyboardNavigation = false;
  let suppressFocusOpen = false;
  let hoverReady = false;
  let closeTimer = null;

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || hoverReady) return;
    hoverReady = true;
    const target = event.target;
    const group = target && typeof target.closest === "function"
      ? target.closest(".nav-category")
      : null;
    if (group && nav.contains(group)) openMenu(group);
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" || event.key.startsWith("Arrow")) keyboardNavigation = true;
  });
  document.addEventListener("pointerdown", () => {
    keyboardNavigation = false;
  });

  nav.replaceChildren();

  function closeMenus(except) {
    window.clearTimeout(closeTimer);
    nav.querySelectorAll(".nav-category.is-open").forEach((group) => {
      if (group !== except) {
        group.classList.remove("is-open");
        group.querySelector("button").setAttribute("aria-expanded", "false");
      }
    });
  }

  function openMenu(group) {
    const button = group.querySelector("button");
    if (!button) return;
    closeMenus(group);
    group.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    positionPanel(group);
  }

  function scheduleClose(group) {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      const panel = group.querySelector(".nav-category-panel");
      if (!group.matches(":hover") && !panel.matches(":hover") && !group.contains(document.activeElement)) {
        group.classList.remove("is-open");
        group.querySelector("button").setAttribute("aria-expanded", "false");
      }
    }, 220);
  }

  function positionPanel(group) {
    const button = group.querySelector("button");
    const panel = group.querySelector(".nav-category-panel");
    const rect = button.getBoundingClientRect();
    const panelWidth = Math.min(380, window.innerWidth - 24);
    const panelHeight = Math.min(window.innerHeight * 0.7, 620);
    panel.style.top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - panelHeight - 12)) + "px";
    panel.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12)) + "px";
  }

  function bindMenuGroup(group, button, panel) {
    group.addEventListener("wheel", (event) => {
      if (!group.classList.contains("is-open")) return;
      event.preventDefault();
      panel.scrollTop += event.deltaY;
      panel.scrollLeft += event.deltaX;
    }, { passive: false });

    button.addEventListener("click", () => {
      const shouldOpen = !group.classList.contains("is-open");
      closeMenus(group);
      group.classList.toggle("is-open", shouldOpen);
      button.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen) positionPanel(group);
    });

    group.addEventListener("mouseenter", () => {
      if (hoverReady && window.matchMedia("(hover: hover) and (pointer: fine)").matches) openMenu(group);
    });
    group.addEventListener("mouseleave", () => {
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        scheduleClose(group);
      }
    });
    panel.addEventListener("mouseenter", () => {
      window.clearTimeout(closeTimer);
    });
    panel.addEventListener("mouseleave", () => {
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        scheduleClose(group);
      }
    });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        group.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
        suppressFocusOpen = true;
        button.focus();
        window.setTimeout(() => {
          suppressFocusOpen = false;
        }, 0);
      }
    });
    group.addEventListener("focusin", () => {
      if (!keyboardNavigation || suppressFocusOpen) return;
      openMenu(group);
    });
    group.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!group.contains(document.activeElement) && !group.matches(":hover")) {
          group.classList.remove("is-open");
          button.setAttribute("aria-expanded", "false");
        }
      }, 0);
    });
  }

  const platformGroup = document.createElement("div");
  platformGroup.className = "nav-category nav-platform";
  const platformButton = document.createElement("button");
  platformButton.className = "nav-category-toggle nav-category-menu-button";
  platformButton.type = "button";
  platformButton.setAttribute("aria-haspopup", "true");
  platformButton.setAttribute("aria-expanded", "false");
  platformButton.setAttribute("aria-controls", "academy-menu-platform");
  platformButton.setAttribute("aria-label", "Показать разделы сайта");
  platformButton.innerHTML = '<span class="nav-category-button-label">Разделы сайта</span><span class="nav-category-arrow" aria-hidden="true">▾</span>';
  const platformPanel = document.createElement("div");
  platformPanel.className = "nav-category-panel";
  platformPanel.id = "academy-menu-platform";
  const platformHeading = document.createElement("p");
  platformHeading.className = "nav-category-heading";
  platformHeading.textContent = "Разделы сайта";
  platformPanel.appendChild(platformHeading);
  const currentPage = window.location.pathname.split("/").pop().toLowerCase();
  platformLinks.forEach(([title, description, href]) => {
    const item = document.createElement("a");
    item.className = "nav-category-card";
    item.href = prefix + href;
    item.innerHTML = "<strong></strong><span></span>";
    item.querySelector("strong").textContent = title;
    item.querySelector("span").textContent = description;
    if (currentPage === href.toLowerCase()) {
      item.classList.add("active");
      item.setAttribute("aria-current", "page");
    }
    platformPanel.appendChild(item);
  });
  platformGroup.append(platformButton, platformPanel);
  nav.appendChild(platformGroup);
  bindMenuGroup(platformGroup, platformButton, platformPanel);

  categories.forEach((category, index) => {
    const group = document.createElement("div");
    group.className = "nav-category";

    const link = document.createElement("a");
    const queryTopic = new URLSearchParams(window.location.search).get("topic");
    const isLegacyMonitoringPage = category.page === "monitoring.html"
      && ["networks.html", "protocols.html", "program.html"].includes(currentPage);
    const isCurrentPage = currentPage === category.page
      || category.topics.some(([, , slug]) => slug === queryTopic);
    link.className = "nav-category-link" + (isCurrentPage || isLegacyMonitoringPage ? " active" : "");
    link.href = prefix + category.page;
    link.textContent = category.label;
    if (isCurrentPage) link.setAttribute("aria-current", "page");

    const button = document.createElement("button");
    button.className = "nav-category-toggle";
    button.type = "button";
    button.setAttribute("aria-label", "Показать темы: " + category.label);
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "academy-menu-" + index);
    button.innerHTML = '<span class="nav-category-arrow" aria-hidden="true">▾</span>';

    const panel = document.createElement("div");
    panel.className = "nav-category-panel";
    panel.id = "academy-menu-" + index;

    const heading = document.createElement("p");
    heading.className = "nav-category-heading";
    heading.textContent = category.label;
    panel.appendChild(heading);

    const openLink = document.createElement("a");
    openLink.className = "nav-category-card nav-category-overview";
    openLink.href = prefix + category.page;
    openLink.innerHTML = "<strong>Открыть раздел</strong><span>Перейти ко всем материалам</span>";
    panel.appendChild(openLink);

    category.topics.forEach(([title, description, slug]) => {
      const card = document.createElement("a");
      card.className = "nav-category-card";
      card.href = prefix + "topic.html?topic=" + encodeURIComponent(slug);
      card.innerHTML = "<strong></strong><span></span>";
      card.querySelector("strong").textContent = title;
      card.querySelector("span").textContent = description;
      panel.appendChild(card);
    });

    group.append(link, button, panel);
    nav.appendChild(group);

    bindMenuGroup(group, button, panel);
  });

  const virtualMachineLink = document.createElement("a");
  virtualMachineLink.href = prefix + "VirtMachine.html";
  virtualMachineLink.textContent = "Виртуальная машина";
  if (currentPage === "virtmachine.html") {
    virtualMachineLink.className = "active";
    virtualMachineLink.setAttribute("aria-current", "page");
  }
  nav.appendChild(virtualMachineLink);

  const linkedLessons = new Set();
  categories.forEach((category) => {
    category.topics.forEach(([title, , slug]) => {
      const lesson = document.querySelector(".lesson[id='" + slug + "']");
      if (!lesson || linkedLessons.has(slug)) return;
      linkedLessons.add(slug);
      const link = document.createElement("a");
      link.className = "btn ghost topic-page-link";
      link.href = prefix + "topic.html?topic=" + encodeURIComponent(slug);
      link.textContent = "Отдельный материал: " + title;
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.appendChild(link);
      lesson.appendChild(actions);
    });
  });

  nav.addEventListener("click", (event) => {
    const target = event.target;
    const clickedLink = target && typeof target.closest === "function" ? target.closest("a") : null;
    if (clickedLink) closeMenus();
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) closeMenus();
  });
  window.addEventListener("resize", () => closeMenus());
  window.addEventListener("scroll", (event) => {
    if (event.target instanceof Node && nav.contains(event.target)) return;
    closeMenus();
  }, true);
})();
