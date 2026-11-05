(() => {
  "use strict";

  const ADMIN_PASSWORD = "admin1488";
  const STORAGE_KEY = "soc-academy-training-state-v5";
  const SESSION_ROLE_KEY = `${STORAGE_KEY}:active-role`;
  const IN_TAB_LOGIN_KEY = `${STORAGE_KEY}:in-tab-login`;
  const RECENT_USERS_KEY = `${STORAGE_KEY}:recent-users`;
  const TRAY_SETTINGS_KEY = `${STORAGE_KEY}:tray-settings`;
  const LOGIN_HANDOFF_PREFIX = `${STORAGE_KEY}:login-handoff:`;
  const CHANNEL_NAME = "soc-academy-training-v5";
  const EVENT_LIMIT = 500;
  const devices = [
    {
      id: "pc101",
      serial: "SOC-WS-101",
      computer: "WS-101 · Бухгалтерия",
      user: "Анна Смирнова",
      password: "SH101",
      profile: "normal"
    },
    {
      id: "pc102",
      serial: "SOC-WS-102",
      computer: "WS-102 · Отдел продаж",
      user: "Илья Морозов",
      password: "SH102",
      profile: "vpn"
    },
    {
      id: "pc103",
      serial: "SOC-WS-103",
      computer: "WS-103 · Дизайн",
      user: "Мария Волкова",
      password: "SH103",
      profile: "redirect"
    },
    {
      id: "pc104",
      serial: "SOC-WS-104",
      computer: "WS-104 · Ресепшен",
      user: "Денис Кузнецов",
      password: "SH104",
      profile: "miner"
    }
  ];

  const profileNames = {
    normal: "Обычная работа",
    vpn: "VPN-сценарий",
    redirect: "Маршрутизация (не активна)",
    miner: "Нагрузка (не активна)"
  };
  const severityNames = {
    normal: "Штатно",
    suspicious: "Подозрительно",
    dangerous: "Опасно"
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const loginScreen = $("#loginScreen");
  const adminScreen = $("#adminScreen");
  const clientScreen = $("#clientScreen");
  const roleSelect = $("#roleSelect");
  const loginForm = $("#loginForm");
  const loginPassword = $("#loginPassword");
  const loginError = $("#loginError");
  const demoHint = $("#demoHint");
  const toastRegion = $("#toastRegion");
  const adminWindows = $("#adminWindows");
  const clientWindows = $("#clientWindows");
  const clientTaskbarApps = $("#clientTaskbarApps");
  const clientStartButton = $("#clientStartButton");
  const clientStartMenu = $("#clientStartMenu");
  const recentUsers = $("#recentUsers");
  const recentUsersFlyout = $("#recentUsersFlyout");
  const startPowerFlyout = $("#startPowerFlyout");
  const startSettingsFlyout = $("#startSettingsFlyout");
  const startUsersFlyout = $("#startUsersFlyout");
  const calendarPanel = $("#calendarPanel");
  const internetPanel = $("#internetPanel");
  const soundPanel = $("#soundPanel");
  const layoutPanel = $("#layoutPanel");
  const rebootScreen = $("#rebootScreen");
  const shutdownScreen = $("#shutdownScreen");
  const calendarGrid = $("#calendarGrid");

  let selectedDeviceId = devices[0].id;
  let loggedInDeviceId = null;
  let reloginInCurrentTab = sessionStorage.getItem(IN_TAB_LOGIN_KEY) === "true";
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCalendarDate = new Date();
  const traySettings = JSON.parse(sessionStorage.getItem(TRAY_SETTINGS_KEY) || "{}");
  let internetConnected = traySettings.internetConnected !== false;
  let soundMuted = traySettings.soundMuted === true;
  let keyboardLayout = traySettings.keyboardLayout === "EN" ? "EN" : "RU";
  let soundVolume = Number.isInteger(traySettings.soundVolume) ? Math.min(100, Math.max(0, traySettings.soundVolume)) : 65;
  let sharedState = loadSharedState();
  let channel = null;
  let zIndex = 10;

  function makeEvent(deviceId, app, traffic, severity, title, detail, source = "workstation") {
    const device = devices.find(item => item.id === deviceId);
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString("ru-RU"),
      deviceId,
      serial: device ? device.serial : "SOC-ADMIN-01",
      user: device ? device.user : "SOC-аналитик",
      app,
      traffic,
      severity,
      title,
      detail,
      source
    };
  }

  function initialState() {
    return {
      version: 5,
      events: [],
      deviceState: Object.fromEntries(devices.map(device => [device.id, {
        inputLocked: false,
        lockUpdatedAt: 0,
        windows: [],
        windowsUpdatedAt: 0,
        updatedAt: 0
      }]))
    };
  }

  function loadSharedState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const state = initialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    }
    const state = JSON.parse(raw);
    if (!state || state.version !== 5 || !Array.isArray(state.events) || !state.deviceState) {
      throw new Error("Сохранённое состояние учебного SOC имеет неизвестный формат. Очисти данные сайта и перезагрузи страницу.");
    }
    return state;
  }

  function persistState(messageType = "state") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState));
    if (channel) channel.postMessage({ type: messageType, state: sharedState });
  }

  function mergeState(incoming) {
    if (!incoming || incoming.version !== 5 || !Array.isArray(incoming.events) || !incoming.deviceState) return;
    const merged = new Map(sharedState.events.map(item => [item.id, item]));
    for (const item of incoming.events) merged.set(item.id, item);
    sharedState.events = [...merged.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, EVENT_LIMIT);
    for (const device of devices) {
      const incomingDeviceState = incoming.deviceState[device.id];
      const currentDeviceState = sharedState.deviceState[device.id];
      if (!incomingDeviceState) continue;
      if (!currentDeviceState) sharedState.deviceState[device.id] = {
        inputLocked: false, lockUpdatedAt: 0, windows: [], windowsUpdatedAt: 0, updatedAt: 0
      };
      const current = sharedState.deviceState[device.id];
      if ((incomingDeviceState.lockUpdatedAt || 0) >= (current.lockUpdatedAt || 0)) {
        current.inputLocked = Boolean(incomingDeviceState.inputLocked);
        current.lockUpdatedAt = incomingDeviceState.lockUpdatedAt || 0;
      }
      if ((incomingDeviceState.windowsUpdatedAt || 0) >= (current.windowsUpdatedAt || 0)) {
        current.windows = Array.isArray(incomingDeviceState.windows) ? incomingDeviceState.windows : [];
        current.windowsUpdatedAt = incomingDeviceState.windowsUpdatedAt || 0;
      }
      current.updatedAt = Math.max(current.updatedAt || 0, incomingDeviceState.updatedAt || 0);
    }
    refreshOpenApps();
    renderClientScreen();
    renderClientLockStatus();
    for (const device of devices) renderRemoteScreen(device.id);
  }

  function addEvent(event) {
    sharedState.events.unshift(event);
    sharedState.events = sharedState.events.slice(0, EVENT_LIMIT);
    persistState("event");
    refreshOpenApps();
    return event;
  }

  function deviceById(id) {
    return devices.find(device => device.id === id);
  }

  function displayScreen(name) {
    loginScreen.hidden = name !== "login";
    adminScreen.hidden = name !== "admin";
    clientScreen.hidden = name !== "client";
    document.body.classList.toggle("workspace-open", name !== "login");
  }

  function populateRoles() {
    const roles = [{ value: "admin", label: "Технический администратор · SOC-ADMIN-01" }, ...devices.map(device => ({
      value: device.id,
      label: `${device.user} · ${device.computer}`
    }))];
    roleSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Выберите пользователя";
    placeholder.disabled = true;
    placeholder.selected = true;
    roleSelect.append(placeholder);
    for (const role of roles) {
      const option = document.createElement("option");
      option.value = role.value;
      option.textContent = role.label;
      roleSelect.append(option);
    }
    updateDemoHint();
  }

  function updateDemoHint() {
    const device = deviceById(roleSelect.value);
    demoHint.textContent = device
      ? `Демонстрационный пароль для ${device.serial}: ${device.password}`
      : roleSelect.value === "admin"
        ? "Демонстрационный пароль администратора: admin1488"
        : "Выберите пользователя или технического администратора.";
    loginPassword.autocomplete = "off";
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function severityBadge(severity) {
    return `<span class="badge ${severity}">${severityNames[severity] || severityNames.normal}</span>`;
  }

  function refreshClocks() {
    const now = new Date();
    const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const taskbarTime = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const taskbarDate = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    $$("[data-clock]").forEach(clock => { clock.textContent = time; });
    $$("[data-taskbar-time]").forEach(clock => { clock.textContent = taskbarTime; });
    $$("[data-taskbar-date]").forEach(clock => { clock.textContent = taskbarDate; });
    $$("[data-calendar-time]").forEach(clock => { clock.textContent = time; });
    $$("[data-calendar-date]").forEach(date => {
      date.textContent = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    });
  }

  function getRecentUserIds() {
    const raw = sessionStorage.getItem(RECENT_USERS_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) throw new Error("Список недавних пользователей имеет неверный формат.");
    return ids.filter((id, index) => deviceById(id) && ids.indexOf(id) === index).slice(0, 3);
  }

  function renderRecentUsers(container) {
    if (!container) return;
    container.replaceChildren();
    const recentDevices = getRecentUserIds().map(deviceById);
    if (!recentDevices.length) {
      const empty = document.createElement("p");
      empty.className = "recent-users-empty";
      empty.textContent = "Недавно использованных пользователей пока нет.";
      container.append(empty);
      return;
    }
    for (const device of recentDevices) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.startUser = device.id;
      const mark = document.createElement("span");
      mark.className = "recent-user-mark";
      mark.textContent = device.user.split(" ").map(part => part[0]).slice(0, 2).join("");
      const label = document.createElement("span");
      label.textContent = `${device.user} · ${device.computer}`;
      button.append(mark, label);
      container.append(button);
    }
  }

  function rememberRecentUser(deviceId) {
    const recentIds = [deviceId, ...getRecentUserIds().filter(id => id !== deviceId)].slice(0, 3);
    sessionStorage.setItem(RECENT_USERS_KEY, JSON.stringify(recentIds));
    renderRecentUsers(recentUsers);
    renderRecentUsers(recentUsersFlyout);
  }

  function renderCalendar() {
    const monthLabel = calendarMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    $("[data-calendar-month]").textContent = monthLabel;
    calendarGrid.replaceChildren();
    for (const weekday of ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]) {
      const heading = document.createElement("span");
      heading.textContent = weekday;
      calendarGrid.append(heading);
    }

    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(1 - ((firstDay.getDay() + 6) % 7));
    const today = new Date();
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const button = document.createElement("button");
      const sameDate = (left, right) => left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
      button.type = "button";
      button.dataset.calendarDay = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      button.textContent = String(date.getDate());
      button.setAttribute("aria-label", date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }));
      if (date.getMonth() !== calendarMonth.getMonth()) button.classList.add("outside-month");
      if (sameDate(date, today)) button.classList.add("today");
      if (sameDate(date, selectedCalendarDate)) button.classList.add("selected-day");
      calendarGrid.append(button);
    }
  }

  function closeStartFlyouts() {
    startPowerFlyout.hidden = true;
    startSettingsFlyout.hidden = true;
    startUsersFlyout.hidden = true;
    $$("[data-start-panel]").forEach(button => button.setAttribute("aria-expanded", "false"));
  }

  function closeTrayPanels(exceptId = "") {
    for (const panel of [calendarPanel, internetPanel, soundPanel, layoutPanel]) {
      if (panel.id !== exceptId) panel.hidden = true;
    }
    $$("[data-tray-toggle], [data-calendar-toggle]").forEach(button => {
      const isOpen = button.dataset.trayToggle === exceptId
        || (button.hasAttribute("data-calendar-toggle") && exceptId === calendarPanel.id);
      button.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function persistTraySettings() {
    sessionStorage.setItem(TRAY_SETTINGS_KEY, JSON.stringify({
      internetConnected,
      soundMuted,
      keyboardLayout,
      soundVolume
    }));
  }

  function renderTraySettings() {
    $("#internetStatus").textContent = internetConnected ? "Учебное подключение активно" : "Учебное подключение отключено";
    $("[data-tray-action='toggle-internet']").textContent = internetConnected ? "Отключить" : "Подключить";
    $("[data-tray-toggle='internetPanel']").textContent = internetConnected ? "◉" : "◌";
    $("[data-tray-action='toggle-mute']").textContent = soundMuted ? "Включить звук" : "Выключить звук";
    $("[data-tray-toggle='soundPanel']").textContent = soundMuted ? "🔇" : "🔊";
    $("[data-tray-action='toggle-layout']").textContent = keyboardLayout === "RU" ? "Русский · RU" : "English · EN";
    $("[data-tray-toggle='layoutPanel']").textContent = keyboardLayout;
    $("#volumeControl").value = String(soundVolume);
  }

  function beginUserSwitch(role = "") {
    clientStartMenu.hidden = true;
    clientStartButton.setAttribute("aria-expanded", "false");
    closeStartFlyouts();
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.setItem(IN_TAB_LOGIN_KEY, "true");
    loginForm.reset();
    populateRoles();
    roleSelect.value = role;
    updateDemoHint();
    loginError.hidden = true;
    reloginInCurrentTab = true;
    displayScreen("login");
    window.setTimeout(() => loginPassword.focus(), 0);
  }

  function shutDownVirtualMachine() {
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.removeItem(IN_TAB_LOGIN_KEY);
    sessionStorage.removeItem(RECENT_USERS_KEY);
    clientStartMenu.hidden = true;
    shutdownScreen.hidden = false;
    $("#shutdownMessage").textContent = "Выключение виртуальной машины…";
    window.setTimeout(() => {
      window.close();
      window.setTimeout(() => {
        $("#shutdownMessage").textContent = "Виртуальная машина выключена. Эту вкладку можно закрыть.";
        $("[data-close-tab]").hidden = false;
      }, 300);
    }, 500);
  }

  function restartVirtualMachine() {
    clientStartMenu.hidden = true;
    rebootScreen.classList.add("reboot-message");
    rebootScreen.hidden = false;
    $("#rebootMessage").textContent = "Перезагрузка виртуальной машины…";
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    window.setTimeout(() => {
      rebootScreen.classList.remove("reboot-message");
      $("#rebootMessage").textContent = "Завершение работы…";
    }, 650);
    window.setTimeout(() => {
      rebootScreen.hidden = true;
      logout();
    }, 1400);
  }

  function enterAdmin() {
    loggedInDeviceId = null;
    sessionStorage.setItem(SESSION_ROLE_KEY, "admin");
    displayScreen("admin");
    openApp("remote");
  }

  function enterClient(device, recordLogin = true) {
    loggedInDeviceId = device.id;
    sessionStorage.setItem(SESSION_ROLE_KEY, device.id);
    rememberRecentUser(device.id);
    $("#clientHeading").textContent = `${device.computer} · ${device.user}`;
    $("#clientDeviceLabel").textContent = `${device.serial} · ${device.user}`;
    renderClientScreen(device.id);
    displayScreen("client");
    renderClientLockStatus();
    if (recordLogin) {
      addEvent(makeEvent(device.id, "Endpoint", "Система", "normal", "Пользователь вошёл в учебный ПК", "Успешный вход в локальный профиль симуляции.", "user"));
    }
  }

  function openWorkspaceInNewTab(role) {
    const token = crypto.randomUUID();
    const handoffKey = `${LOGIN_HANDOFF_PREFIX}${token}`;
    localStorage.setItem(handoffKey, JSON.stringify({
      role,
      expiresAt: Date.now() + 60_000
    }));

    const destination = new URL(window.location.href);
    destination.searchParams.set("login", token);
    const workspaceWindow = window.open("about:blank", "_blank");
    if (!workspaceWindow) {
      localStorage.removeItem(handoffKey);
      loginError.textContent = "Браузер заблокировал новое окно. Разрешите всплывающие окна для этой страницы и попробуйте снова.";
      loginError.hidden = false;
      return false;
    }

    workspaceWindow.opener = null;
    workspaceWindow.location.replace(destination.href);
    showToast("Рабочее место открыто в новой вкладке.");
    return true;
  }

  function consumeLoginHandoff() {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("login");
    if (!token) return null;

    url.searchParams.delete("login");
    window.history.replaceState(null, "", url.href);
    const handoffKey = `${LOGIN_HANDOFF_PREFIX}${token}`;
    const raw = localStorage.getItem(handoffKey);
    localStorage.removeItem(handoffKey);
    if (!raw) return null;

    const handoff = JSON.parse(raw);
    if (!handoff || handoff.expiresAt < Date.now()) return null;
    if (handoff.role !== "admin" && !deviceById(handoff.role)) return null;
    return handoff.role;
  }

  function logout() {
    loggedInDeviceId = null;
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.setItem(IN_TAB_LOGIN_KEY, "true");
    reloginInCurrentTab = true;
    loginForm.reset();
    loginError.hidden = true;
    populateRoles();
    clientStartMenu.hidden = true;
    closeStartFlyouts();
    closeTrayPanels();
    rebootScreen.hidden = true;
    displayScreen("login");
  }

  function openApp(name) {
    const existing = $(`[data-app-window="${name}"]`, adminWindows);
    if (existing) {
      existing.hidden = false;
      existing.style.zIndex = String(++zIndex);
      return existing;
    }
    const titles = {
      remote: "Remote Access · устройства",
      network: "Network Monitor · события",
      programs: "Programs · инвентаризация",
      notes: "SOC Notes · легенда стенда"
    };
    const windowElement = document.createElement("section");
    windowElement.className = "app-window";
    windowElement.dataset.appWindow = name;
    windowElement.style.zIndex = String(++zIndex);
    windowElement.innerHTML = `
      <div class="window-titlebar" data-drag-handle>
        <span>${titles[name]}</span>
        <span class="window-buttons">
          <button type="button" aria-label="Свернуть" data-minimize-app="${name}">—</button>
          <button type="button" aria-label="Закрыть" data-close-app="${name}">×</button>
        </span>
      </div>
      <div class="window-content" data-app-content></div>`;
    adminWindows.append(windowElement);
    renderApp(name);
    makeDraggable(windowElement);
    windowElement.addEventListener("pointerdown", () => { windowElement.style.zIndex = String(++zIndex); });
    return windowElement;
  }

  function appContent(name) {
    return $("[data-app-content]", $(`[data-app-window="${name}"]`, adminWindows));
  }

  function renderApp(name) {
    const content = appContent(name);
    if (!content) return;
    if (name === "remote") renderRemoteApp(content);
    if (name === "network") renderNetworkApp(content);
    if (name === "programs") renderProgramsApp(content);
    if (name === "notes") renderNotesApp(content);
  }

  function renderRemoteApp(content) {
    content.innerHTML = `
      <h3>Каталог виртуальных устройств</h3>
      <p>Выбери рабочее место. Экран пользователя появится только после учебного подключения.</p>
      <div class="device-grid" data-device-grid></div>`;
    const grid = $("[data-device-grid]", content);
    for (const device of devices) {
      const card = document.createElement("article");
      card.className = `device-card${selectedDeviceId === device.id ? " selected" : ""}`;
      const latestIncident = sharedState.events.find(item => item.deviceId === device.id
        && (item.severity === "suspicious" || item.severity === "dangerous"));
      const activityStatus = latestIncident
        ? `${severityBadge(latestIncident.severity)} ${escapeHtml(latestIncident.title)}`
        : `<span class="status-neutral">Обнаруженных событий нет</span>`;
      card.innerHTML = `
        <h4>${escapeHtml(device.computer)}</h4>
        <p><strong>Серийный номер:</strong> ${escapeHtml(device.serial)}</p>
        <p><strong>Пользователь:</strong> ${escapeHtml(device.user)}</p>
        <p><strong>Профиль:</strong> ${escapeHtml(profileNames[device.profile])}</p>
        <p class="severity-line">${activityStatus}</p>
        <button type="button" data-connect-device="${device.id}">Подключиться</button>`;
      card.addEventListener("click", event => {
        if (event.target.closest("button")) return;
        selectedDeviceId = device.id;
        $$(".device-card", grid).forEach(item => item.classList.remove("selected"));
        card.classList.add("selected");
      });
      grid.append(card);
    }
  }

  function currentFilters(content) {
    return {
      device: $("[data-filter-device]", content)?.value || "",
      program: ($("[data-filter-program]", content)?.value || "").trim().toLowerCase(),
      traffic: $("[data-filter-traffic]", content)?.value || "",
      severity: $("[data-filter-severity]", content)?.value || ""
    };
  }

  function filterControls() {
    return `<div class="filter-row">
      <select aria-label="Фильтр по устройству" data-filter-device>
        <option value="">Все устройства</option>
        ${devices.map(device => `<option value="${device.id}">${escapeHtml(device.serial)}</option>`).join("")}
      </select>
      <input type="search" aria-label="Фильтр по приложению" data-filter-program placeholder="Программа или пользователь">
      <select aria-label="Фильтр по типу трафика" data-filter-traffic>
        <option value="">Весь тип</option><option>HTTPS</option><option>DNS</option><option>VPN</option>
        <option>Маршрутизация</option><option>Процесс</option><option>Приложение</option><option>Система</option>
      </select>
      <select aria-label="Фильтр по уровню" data-filter-severity>
        <option value="">Все уровни</option><option value="normal">Штатно</option>
        <option value="suspicious">Подозрительно</option><option value="dangerous">Опасно</option>
      </select>
    </div>`;
  }

  function filteredEvents(filters) {
    return sharedState.events.filter(event => {
      const deviceMatches = !filters.device || event.deviceId === filters.device;
      const programMatches = !filters.program || `${event.app} ${event.user} ${event.serial}`.toLowerCase().includes(filters.program);
      const trafficMatches = !filters.traffic || event.traffic === filters.traffic;
      const severityMatches = !filters.severity || event.severity === filters.severity;
      return deviceMatches && programMatches && trafficMatches && severityMatches;
    });
  }

  function eventTable(events) {
    if (!events.length) return `<div class="empty-state">По выбранным условиям записей нет.</div>`;
    return `<div class="table-wrap"><table class="event-table">
      <thead><tr><th>Время</th><th>Устройство</th><th>Программа</th><th>Тип</th><th>Уровень</th><th>Событие</th></tr></thead>
      <tbody>${events.map(event => `<tr class="event-row ${event.severity}">
        <td>${escapeHtml(event.time)}</td><td>${escapeHtml(event.serial)}<br>${escapeHtml(event.user)}</td>
        <td>${escapeHtml(event.app)}</td><td>${escapeHtml(event.traffic)}</td>
        <td>${severityBadge(event.severity)}</td><td>${escapeHtml(event.title)}<br><small>${escapeHtml(event.detail)}</small></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function renderNetworkApp(content) {
    const filters = content.dataset.filtersReady === "true" ? currentFilters(content) : { device: "", program: "", traffic: "", severity: "" };
    const events = filteredEvents(filters);
    content.innerHTML = `
      <h3>Синтетические события сети и устройств</h3>
      <p>Поток учебных записей из четырёх виртуальных ПК · ${events.length} совпадений</p>
      ${filterControls()}<div data-event-table>${eventTable(events)}</div>`;
    content.dataset.filtersReady = "true";
    bindFilterControls(content, renderNetworkApp);
  }

  function bindFilterControls(content, render) {
    $$("[data-filter-device], [data-filter-program], [data-filter-traffic], [data-filter-severity]", content)
      .forEach(control => control.addEventListener("input", () => {
        const values = currentFilters(content);
        render(content);
        for (const [attribute, value] of [
          ["data-filter-device", values.device],
          ["data-filter-program", values.program],
          ["data-filter-traffic", values.traffic],
          ["data-filter-severity", values.severity]
        ]) {
          const replacement = $(`[${attribute}]`, content);
          if (replacement) replacement.value = value;
        }
      }));
  }

  function renderProgramsApp(content) {
    const filters = content.dataset.filtersReady === "true" ? currentFilters(content) : { device: "", program: "", traffic: "", severity: "" };
    const launches = sharedState.events
      .filter(item => item.traffic === "Приложение")
      .map(item => ({
        deviceId: item.deviceId,
        name: item.app,
        severity: item.severity,
        note: `${item.time} · ${item.title}`
      }));
    const rows = launches.filter(program => {
      const device = deviceById(program.deviceId);
      return (!filters.device || program.deviceId === filters.device)
        && (!filters.program || `${program.name} ${device.user} ${device.serial}`.toLowerCase().includes(filters.program))
        && (!filters.severity || program.severity === filters.severity);
    });
    content.innerHTML = `
      <h3>Программы на виртуальных устройствах</h3>
      <p>Здесь отображаются только приложения, которые пользователь действительно открыл.</p>
      <div class="filter-row">
        <select aria-label="Фильтр по устройству" data-filter-device>
          <option value="">Все устройства</option>${devices.map(device => `<option value="${device.id}">${escapeHtml(device.serial)}</option>`).join("")}
        </select>
        <input type="search" aria-label="Фильтр по программе" data-filter-program placeholder="Программа или пользователь">
        <select aria-label="Фильтр по уровню" data-filter-severity>
          <option value="">Все уровни</option><option value="normal">Штатно</option><option value="suspicious">Подозрительно</option><option value="dangerous">Опасно</option>
        </select>
      </div>
      <div data-program-table>${rows.length ? `<div class="table-wrap"><table class="event-table">
        <thead><tr><th>Устройство / пользователь</th><th>Программа</th><th>Классификация</th><th>Примечание</th></tr></thead>
        <tbody>${rows.map(program => {
          const device = deviceById(program.deviceId);
          return `<tr class="event-row ${program.severity}"><td>${escapeHtml(device.serial)}<br>${escapeHtml(device.user)}</td><td>${escapeHtml(program.name)}</td><td>${severityBadge(program.severity)}</td><td>${escapeHtml(program.note)}</td></tr>`;
        }).join("")}</tbody></table></div>` : `<div class="empty-state">Пользователи ещё не открывали приложения.</div>`}</div>`;
    content.dataset.filtersReady = "true";
    bindFilterControls(content, renderProgramsApp);
  }

  function renderNotesApp(content) {
    content.innerHTML = `
      <h3>Легенда учебного стенда</h3>
      <ul class="notes-list">
        <li><strong>Штатно:</strong> обычная активность профиля.</li>
        <li><strong>Подозрительно:</strong> попытка VPN на SOC-WS-102.</li>
        <li><strong>Опасно:</strong> синтетические индикаторы перенаправления трафика на SOC-WS-103 и высокой нагрузки на SOC-WS-104.</li>
        <li>Устройство видно только по телеметрии, пока администратор не установит удалённый сеанс.</li>
        <li>Все программы, трафик, предупреждения и удалённые действия виртуальные. Секреты не помещаются в события.</li>
      </ul>`;
  }

  function refreshOpenApps() {
    for (const name of ["network", "programs", "remote"]) {
      if ($(`[data-app-window="${name}"]`, adminWindows)) renderApp(name);
    }
  }

  function makeDraggable(windowElement, onDrop = () => {}, canDrag = () => true) {
    const handle = $("[data-drag-handle]", windowElement);
    if (!handle) return;
    let start = null;
    handle.addEventListener("pointerdown", event => {
      if (event.target.closest("button") || windowElement.classList.contains("maximized") || !canDrag()) return;
      const rect = windowElement.getBoundingClientRect();
      const parent = windowElement.offsetParent.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: rect.left - parent.left, top: rect.top - parent.top };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
      if (!start) return;
      windowElement.style.left = `${Math.max(0, start.left + event.clientX - start.x)}px`;
      windowElement.style.top = `${Math.max(0, start.top + event.clientY - start.y)}px`;
    });
    handle.addEventListener("pointerup", () => {
      if (!start) return;
      start = null;
      onDrop(windowElement);
    });
    handle.addEventListener("pointercancel", () => { start = null; });
  }

  function openRemoteSession(device) {
    const existing = $(`[data-remote-device="${device.id}"]`, adminWindows);
    if (existing) {
      existing.hidden = false;
      existing.style.zIndex = String(++zIndex);
      return;
    }
    const remoteWindow = document.createElement("section");
    remoteWindow.className = "remote-window connecting";
    remoteWindow.dataset.remoteDevice = device.id;
    remoteWindow.style.zIndex = String(++zIndex);
    remoteWindow.innerHTML = `
      <div class="window-titlebar" data-drag-handle>
        <span>Удалённый сеанс · ${escapeHtml(device.serial)} · ${escapeHtml(device.user)}</span>
        <span class="window-buttons"><button type="button" aria-label="Отключиться" data-disconnect="${device.id}">×</button></span>
      </div>
      <div class="window-content">
        <div class="remote-toolbar">
          <button type="button" data-remote-control="${device.id}">Включить управление</button>
          <button type="button" data-remote-app="${device.id}" data-app="browser">Браузер</button>
          <button type="button" data-remote-app="${device.id}" data-app="vpn">VPN Client</button>
          <button type="button" data-remote-app="${device.id}" data-app="program">Программы</button>
          <button type="button" data-remote-lock="${device.id}">Заблокировать ввод</button>
          <button type="button" data-remote-warn="${device.id}">Отправить предупреждение</button>
          <button type="button" data-disconnect="${device.id}">Отключиться</button>
          <span class="connection-pill" data-connection-status>Подключено · только просмотр</span>
        </div>
        <div class="remote-preview">
          <div class="remote-screen">
            <div class="remote-screen-topline"><span>${escapeHtml(device.serial)} · ТРАНСЛЯЦИЯ ЭКРАНА</span><span>Сеанс активен</span></div>
            <div class="remote-screen-icons" aria-hidden="true">
              <div class="remote-screen-icon"><span>🌐</span>Браузер</div>
              <div class="remote-screen-icon"><span>🔐</span>VPN Client</div>
              <div class="remote-screen-icon"><span>📦</span>Программы</div>
            </div>
            <section class="remote-screen-app" data-remote-screen aria-live="polite"></section>
            <div class="remote-screen-taskbar"><span>${escapeHtml(device.computer)} · ${escapeHtml(device.user)}</span><span data-remote-lock-status></span></div>
          </div>
        </div>
      </div>`;
    adminWindows.append(remoteWindow);
    makeDraggable(remoteWindow);
    remoteWindow.addEventListener("pointerdown", () => { remoteWindow.style.zIndex = String(++zIndex); });
    renderRemoteScreen(device.id);
    addEvent(makeEvent(device.id, "Remote Access", "Система", "normal", "Удалённый просмотр начат", "Администратор подключился к виртуальному рабочему столу.", "admin"));
  }

  function isInputLocked(deviceId) {
    return Boolean(sharedState.deviceState[deviceId]?.inputLocked);
  }

  function setInputLocked(deviceId, locked) {
    const deviceState = sharedState.deviceState[deviceId];
    deviceState.inputLocked = locked;
    deviceState.lockUpdatedAt = Date.now();
    deviceState.updatedAt = deviceState.lockUpdatedAt;
    persistState("lock");
    const device = deviceById(deviceId);
    addEvent(makeEvent(
      deviceId,
      "Remote Access",
      "Система",
      "normal",
      locked ? "Ввод пользователя заблокирован" : "Ввод пользователя разблокирован",
      `Учебное действие администратора для ${device.serial}.`,
      "admin"
    ));
    renderClientLockStatus();
    renderRemoteScreen(deviceId);
    const remoteLockButton = $(`[data-remote-lock="${deviceId}"]`, adminWindows);
    if (remoteLockButton) remoteLockButton.textContent = locked ? "Разблокировать ввод" : "Заблокировать ввод";
    showToast(locked ? `Ввод ${device.serial} заблокирован в симуляции.` : `Ввод ${device.serial} разблокирован.`);
  }

  function availablePrograms(device) {
    const profileProgram = device.profile === "normal" ? "Office Suite"
      : device.profile === "vpn" ? "Sales Dashboard"
        : device.profile === "redirect" ? "Route Helper"
          : "Compute Worker";
    return [
      { name: "Browser", action: "browser", severity: "normal" },
      { name: profileProgram, action: "run-profile-program", severity: device.profile === "redirect" || device.profile === "miner" ? "dangerous" : "normal" }
    ];
  }

  function userWindowBodyMarkup(device, userWindow, remote = false) {
    const remoteAttributes = remote ? `data-remote-action="${device.id}"` : "";
    if (userWindow.kind === "browser") {
      if (userWindow.page === "training") {
        return `<div class="browser-address"><span>portal.training.test</span><span>Учебная страница</span></div>
          <h3>Учебный портал SOC Academy</h3><p>Страница открыта локально. Внешние сайты недоступны.</p>
          <button type="button" data-client-command="restricted-site" ${remoteAttributes}>Попробовать открыть запрещённый ресурс</button>`;
      }
      if (userWindow.page === "blocked") {
        const redirected = device.profile === "redirect";
        return `<div class="browser-address"><span>blocked.training.test</span><span>Доступ заблокирован</span></div>
          <h3>${redirected ? "Обнаружено перенаправление" : "Доступ заблокирован"}</h3>
          <p>${redirected ? "Учебная система обнаружила перенаправление запрещённого ресурса." : "Запрещённый ресурс заблокирован учебной симуляцией."} Внешний сайт не загружался.</p>`;
      }
      return `<div class="browser-address"><span>portal.training.test</span><span>Локальный браузер · без интернета</span></div>
        <div class="browser-welcome"><h3>Браузер</h3><p>Открой безопасную учебную страницу или попробуй открыть запрещённый ресурс.</p>
        <button type="button" data-client-command="browse" ${remoteAttributes}>Открыть учебный портал</button>
        <button type="button" data-client-command="restricted-site" ${remoteAttributes}>Открыть запрещённый ресурс</button></div>`;
    }
    if (userWindow.kind === "vpn") {
      return `<div class="program-window-content"><h3>VPN Client</h3>
        <p>${escapeHtml(userWindow.result || "Виртуальный клиент готов. Настоящее подключение не выполняется.")}</p>
        <button type="button" data-client-command="vpn" ${remoteAttributes}>Попытаться подключиться</button></div>`;
    }
    if (userWindow.kind === "programs") {
      return `<div class="program-window-content"><h3>Программы</h3><p>Выбери программу для запуска на этом виртуальном компьютере.</p>
        <div class="program-launch-list">${availablePrograms(device).map(program => `
          <button type="button" data-client-command="${program.action}" data-program-name="${escapeHtml(program.name)}" ${remoteAttributes}>
            <span>📦</span><span>${escapeHtml(program.name)}</span><small>${program.severity === "dangerous" ? "Сценарное приложение профиля" : "Штатное приложение"}</small>
          </button>`).join("")}</div></div>`;
    }
    return `<div class="program-window-content"><h3>${escapeHtml(userWindow.appName)}</h3>
      <p>${escapeHtml(userWindow.result || "Приложение запущено в виртуальном сценарии. Код не исполняется.")}</p></div>`;
  }

  function userWindowMarkup(device, userWindow, remote = false, index = 0) {
    const remoteAction = remote ? `data-remote-window-device="${device.id}" data-window-id="${escapeHtml(userWindow.id)}"` : "";
    const defaultLeft = window.innerWidth <= 800 ? 8 : 135 + (index % 5) * 24;
    const left = Number.isFinite(userWindow.left) ? userWindow.left : defaultLeft;
    const top = Number.isFinite(userWindow.top) ? userWindow.top : 28 + (index % 5) * 20;
    const style = userWindow.maximized ? "" : `left:${left}px;top:${top}px;z-index:${10 + index};`;
    return `<section class="app-window user-app-window${userWindow.maximized ? " maximized" : ""}"
        data-user-window="${escapeHtml(userWindow.id)}" style="${style}" aria-label="${escapeHtml(userWindow.title)}">
      <div class="window-titlebar user-window-titlebar" data-drag-handle>
        <span>${escapeHtml(userWindow.title)}</span>
        <span class="window-buttons">
          <button type="button" aria-label="Свернуть ${escapeHtml(userWindow.title)}" data-user-window-action="minimize" data-window-id="${escapeHtml(userWindow.id)}" ${remoteAction}>—</button>
          <button type="button" aria-label="Развернуть ${escapeHtml(userWindow.title)}" data-user-window-action="maximize" data-window-id="${escapeHtml(userWindow.id)}" ${remoteAction}>□</button>
          <button type="button" aria-label="Закрыть ${escapeHtml(userWindow.title)}" data-user-window-action="close" data-window-id="${escapeHtml(userWindow.id)}" ${remoteAction}>×</button>
        </span>
      </div>
      <div class="user-window-content">${userWindowBodyMarkup(device, userWindow, remote)}</div>
    </section>`;
  }

  function updateDeviceWindows(device, update) {
    const deviceState = sharedState.deviceState[device.id];
    deviceState.windows = update(deviceState.windows || []);
    deviceState.windowsUpdatedAt = Date.now();
    deviceState.updatedAt = deviceState.windowsUpdatedAt;
    persistState("windows");
    renderClientScreen(device.id);
    renderRemoteScreen(device.id);
  }

  function openClientWindow(device, kind, actor, appName = "") {
    const id = kind === "profile-app" ? `profile-${appName}` : kind;
    const title = kind === "browser" ? "Браузер"
      : kind === "vpn" ? "VPN Client"
        : kind === "programs" ? "Программы"
          : appName;
    const existing = (sharedState.deviceState[device.id].windows || []).find(item => item.id === id);
    const userWindow = existing
      ? { ...existing, minimized: false }
      : { id, kind, title, appName, page: "home", result: "", maximized: false, minimized: false };
    updateDeviceWindows(device, windows => [...windows.filter(item => item.id !== id), userWindow]);
    if (!existing) logProgramStart(device, actor, title);
  }

  function renderClientScreen(deviceId = loggedInDeviceId) {
    if (!deviceId || !loggedInDeviceId || deviceId !== loggedInDeviceId) return;
    const device = deviceById(deviceId);
    const windows = sharedState.deviceState[deviceId]?.windows || [];
    clientWindows.innerHTML = windows.filter(item => !item.minimized)
      .map((item, index) => userWindowMarkup(device, item, false, index)).join("");
    clientTaskbarApps.innerHTML = windows.map(item => `<button type="button" class="taskbar-app${item.minimized ? " minimized-app" : " active-app"}"
      data-client-task="${escapeHtml(item.id)}" data-client-minimized="${item.minimized ? "true" : "false"}">${escapeHtml(item.title)}</button>`).join("");
    $$(".user-app-window", clientWindows).forEach(windowElement => {
      makeDraggable(windowElement, movedWindow => {
        const left = Number.parseFloat(movedWindow.style.left);
        const top = Number.parseFloat(movedWindow.style.top);
        updateDeviceWindows(device, windows => windows.map(item => item.id === movedWindow.dataset.userWindow
          ? { ...item, left, top }
          : item));
      });
      windowElement.addEventListener("pointerdown", () => { windowElement.style.zIndex = String(++zIndex); });
    });
    renderClientLockStatus();
  }

  function manageUserWindow(deviceId, windowId, action) {
    const device = deviceById(deviceId);
    if (!device) return;
    if (action === "close") {
      updateDeviceWindows(device, windows => windows.filter(item => item.id !== windowId));
      return;
    }
    updateDeviceWindows(device, windows => windows.map(item => item.id !== windowId ? item : {
      ...item,
      minimized: action === "minimize" ? true : action === "restore" ? false : item.minimized,
      maximized: action === "maximize" ? !item.maximized : action === "restore" ? false : item.maximized
    }));
  }

  function renderRemoteScreen(deviceId) {
    const session = $(`[data-remote-device="${deviceId}"]`, adminWindows);
    const device = deviceById(deviceId);
    if (!session || !device) return;
    const screen = $("[data-remote-screen]", session);
    const windows = sharedState.deviceState[deviceId]?.windows || [];
    if (screen) {
      screen.innerHTML = windows.length
        ? windows.filter(item => !item.minimized).map((item, index) => userWindowMarkup(device, item, true, index)).join("")
        : `<p class="remote-empty-state">Рабочий стол пользователя. Открытых окон нет.</p>`;
      $$(".user-app-window", screen).forEach(windowElement => {
        makeDraggable(windowElement, movedWindow => {
          const left = Number.parseFloat(movedWindow.style.left);
          const top = Number.parseFloat(movedWindow.style.top);
          updateDeviceWindows(device, items => items.map(item => item.id === movedWindow.dataset.userWindow
            ? { ...item, left, top }
            : item));
        }, () => currentRemoteControl(deviceId));
      });
    }
    const lockStatus = $("[data-remote-lock-status]", session);
    if (lockStatus) lockStatus.textContent = isInputLocked(deviceId) ? "Ввод заблокирован" : "";
  }

  function renderClientLockStatus() {
    if (!loggedInDeviceId) return;
    const locked = isInputLocked(loggedInDeviceId);
    $("#clientLockStatus").textContent = locked ? "Ввод заблокирован администратором" : "";
    $("#clientStatus").textContent = locked ? "Администратор временно заблокировал ввод пользователя." : "";
    $$("[data-client-action], [data-client-command], [data-user-window-action]", clientScreen).forEach(button => { button.disabled = locked; });
  }

  function currentRemoteControl(deviceId) {
    const session = $(`[data-remote-device="${deviceId}"]`, adminWindows);
    return session?.dataset.controlMode === "true";
  }

  function logProgramStart(device, actor, appOverride = "") {
    const app = appOverride || (device.profile === "normal" ? "Office Suite"
      : device.profile === "vpn" ? "VPN Client"
        : device.profile === "redirect" ? "Route Helper"
          : "Compute Worker");
    const risky = app === "Route Helper" || app === "Compute Worker";
    addEvent(makeEvent(
      device.id,
      app,
      "Приложение",
      risky ? "dangerous" : "normal",
      `Запущена программа: ${app}`,
      risky ? "Сценарный индикатор; исполняемый код не запускается." : "Виртуальный запуск приложения.",
      actor
    ));
    return app;
  }

  function performClientAction(device, action, actor, bypassLock = false) {
    if (!bypassLock && isInputLocked(device.id)) {
      showToast("Ввод пользователя заблокирован администратором.");
      return;
    }
    if (action === "vpn") {
      const windowId = "vpn";
      if (device.profile === "vpn") {
        addEvent(makeEvent(device.id, "VPN Client", "VPN", "suspicious", "Попытка VPN-подключения", "Подозрительное учебное событие. Реальное VPN-соединение не создавалось.", actor));
        updateAppWindow(device, windowId, window => ({ ...window, result: "Попытка заблокирована: монитор зафиксировал подозрительное подключение. Реальная сеть не использовалась." }));
      } else {
        addEvent(makeEvent(device.id, "VPN Client", "VPN", "normal", "Попытка VPN-подключения", "В этом учебном профиле VPN-сценарий не настроен; соединение не создавалось.", actor));
        updateAppWindow(device, windowId, window => ({ ...window, result: "В этом учебном профиле подключение не настроено. Реальная сеть не использовалась." }));
      }
      return;
    }
    if (action === "browser") {
      addEvent(makeEvent(device.id, "Browser", "DNS", "normal", "Запрос имени учебного портала", "Синтетическое DNS-событие для portal.training.test; запрос не отправлялся.", actor));
      addEvent(makeEvent(device.id, "Browser", "HTTPS", "normal", "Открыта учебная страница", "portal.training.test открыт внутри симуляции; сетевые запросы не выполнялись.", actor));
      updateAppWindow(device, "browser", window => ({ ...window, page: "training" }));
      return;
    }
    if (action === "restricted-site") {
      const redirected = device.profile === "redirect";
      addEvent(makeEvent(
        device.id,
        "Browser",
        redirected ? "Маршрутизация" : "HTTPS",
        redirected ? "dangerous" : "suspicious",
        redirected ? "Обнаружено перенаправление запрещённого ресурса" : "Заблокирована попытка открыть запрещённый ресурс",
        redirected
          ? "Пользователь открыл запрещённый учебный адрес; симулятор обнаружил перенаправление. Внешний запрос не отправлялся."
          : "Пользователь открыл запрещённый учебный адрес; доступ заблокирован локальной симуляцией.",
        actor
      ));
      updateAppWindow(device, "browser", window => ({ ...window, page: "blocked" }));
    }
  }

  function eventForUser(device, title, detail) {
    addEvent(makeEvent(device.id, "Remote Access", "Система", "normal", title, detail, "admin"));
  }

  function handleRemoteControl(deviceId) {
    const session = $(`[data-remote-device="${deviceId}"]`, adminWindows);
    if (!session) return;
    const enabling = session.dataset.controlMode !== "true";
    session.dataset.controlMode = String(enabling);
    const button = $(`[data-remote-control="${deviceId}"]`, session);
    const status = $("[data-connection-status]", session);
    button.textContent = enabling ? "Перейти в режим просмотра" : "Включить управление";
    status.textContent = enabling ? "Подключено · управление включено" : "Подключено · только просмотр";
    session.dataset.controlMode = String(enabling);
    eventForUser(deviceById(deviceId), enabling ? "Удалённое управление включено" : "Оставлен только просмотр", "Состояние виртуального сеанса изменено администратором.");
  }

  function openClientActionPanel(device, action, actor = "user") {
    if (action === "browser") {
      openClientWindow(device, "browser", actor);
    } else if (action === "vpn") {
      openClientWindow(device, "vpn", actor);
    } else if (action === "program") {
      openClientWindow(device, "programs", actor);
    }
  }

  function runClientCommand(deviceId, action, actor, bypassLock = false, programName = "") {
    const device = deviceById(deviceId);
    if (!device) return;
    if (action === "run-profile-program") {
      openClientWindow(device, "profile-app", actor, programName || availablePrograms(device)[1].name);
      return;
    }
    performClientAction(device, action, actor, bypassLock);
  }

  function updateAppWindow(device, windowId, update) {
    updateDeviceWindows(device, windows => windows.map(item => item.id === windowId ? update(item) : item));
  }

  function addAlertWindow(device, title, result) {
    const alertWindow = {
      id: `alert-${Date.now()}`,
      kind: "notification",
      title,
      appName: title,
      result,
      maximized: false,
      minimized: false
    };
    updateDeviceWindows(device, windows => [...windows, alertWindow]);
  }

  document.addEventListener("submit", event => {
    if (event.target !== loginForm) return;
    event.preventDefault();
    const role = roleSelect.value;
    const device = deviceById(role);
    const expectedPassword = device ? device.password : ADMIN_PASSWORD;
    const enteredPassword = loginPassword.value;
    loginPassword.value = "";
    loginError.hidden = true;
    if (enteredPassword !== expectedPassword) {
      loginError.textContent = "Неверный демонстрационный пароль.";
      loginError.hidden = false;
      return;
    }
    if (reloginInCurrentTab) {
      reloginInCurrentTab = false;
      sessionStorage.removeItem(IN_TAB_LOGIN_KEY);
      if (device) enterClient(device);
      else enterAdmin();
      return;
    }
    openWorkspaceInNewTab(device ? device.id : "admin");
  });

  roleSelect.addEventListener("change", updateDemoHint);

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trayControl = target.closest("[data-tray-toggle], [data-calendar-toggle]");
    if (!trayControl && !target.closest(".tray-panel")) closeTrayPanels();
    const lockedSystemControl = target.closest("[data-start-panel], [data-start-action], [data-start-user], [data-tray-toggle], [data-calendar-toggle], [data-calendar-step], [data-calendar-day], [data-tray-action]");
    if (lockedSystemControl && clientScreen.hidden === false && loggedInDeviceId && isInputLocked(loggedInDeviceId)) {
      showToast("Ввод заблокирован администратором.");
      return;
    }
    const startButton = target.closest("#clientStartButton");
    if (!clientStartMenu.hidden && !startButton && !clientStartMenu.contains(target)) {
      clientStartMenu.hidden = true;
      clientStartButton.setAttribute("aria-expanded", "false");
      closeStartFlyouts();
    }
    if (startButton && clientScreen.hidden === false && loggedInDeviceId) {
      if (isInputLocked(loggedInDeviceId)) {
        showToast("Ввод заблокирован администратором.");
        return;
      }
      const isExpanded = startButton.getAttribute("aria-expanded") === "true";
      startButton.setAttribute("aria-expanded", String(!isExpanded));
      clientStartMenu.hidden = isExpanded;
      closeStartFlyouts();
      closeTrayPanels();
      if (!isExpanded) {
        renderRecentUsers(recentUsers);
        renderRecentUsers(recentUsersFlyout);
      }
      return;
    }
    const startPanelButton = target.closest("[data-start-panel]");
    if (startPanelButton && clientScreen.hidden === false && loggedInDeviceId) {
      const panelByName = {
        power: startPowerFlyout,
        settings: startSettingsFlyout,
        users: startUsersFlyout
      };
      const panel = panelByName[startPanelButton.dataset.startPanel];
      if (!panel) return;
      const shouldOpen = panel.hidden;
      closeStartFlyouts();
      panel.hidden = !shouldOpen;
      startPanelButton.setAttribute("aria-expanded", String(shouldOpen));
      if (panel === startUsersFlyout) {
        renderRecentUsers(recentUsersFlyout);
      }
      return;
    }
    const recentUserButton = target.closest("[data-start-user]");
    if (recentUserButton && clientScreen.hidden === false && loggedInDeviceId) {
      beginUserSwitch(recentUserButton.dataset.startUser);
      return;
    }
    const startAction = target.closest("[data-start-action]");
    if (startAction && clientScreen.hidden === false && loggedInDeviceId) {
      if (startAction.dataset.startAction === "all-users") {
        beginUserSwitch();
      } else if (startAction.dataset.startAction === "sign-out") {
        logout();
      } else if (startAction.dataset.startAction === "shutdown") {
        shutDownVirtualMachine();
      } else if (startAction.dataset.startAction === "restart") {
        restartVirtualMachine();
      }
      return;
    }
    const calendarToggle = target.closest("[data-calendar-toggle]");
    if (calendarToggle && clientScreen.hidden === false && loggedInDeviceId) {
      const shouldOpen = calendarPanel.hidden;
      closeTrayPanels(shouldOpen ? calendarPanel.id : "");
      if (shouldOpen) renderCalendar();
      return;
    }
    const trayToggle = target.closest("[data-tray-toggle]");
    if (trayToggle && clientScreen.hidden === false && loggedInDeviceId) {
      const panel = document.getElementById(trayToggle.dataset.trayToggle);
      if (!panel) return;
      const shouldOpen = panel.hidden;
      closeTrayPanels(shouldOpen ? panel.id : "");
      return;
    }
    const calendarStep = target.closest("[data-calendar-step]");
    if (calendarStep && !calendarPanel.hidden) {
      calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(calendarStep.dataset.calendarStep), 1);
      renderCalendar();
      return;
    }
    const calendarDay = target.closest("[data-calendar-day]");
    if (calendarDay && !calendarPanel.hidden) {
      const [year, month, day] = calendarDay.dataset.calendarDay.split("-").map(Number);
      selectedCalendarDate = new Date(year, month, day);
      calendarMonth = new Date(year, month, 1);
      renderCalendar();
      return;
    }
    const trayAction = target.closest("[data-tray-action]");
    if (trayAction) {
      if (trayAction.dataset.trayAction === "toggle-internet") {
        internetConnected = !internetConnected;
        trayAction.setAttribute("aria-pressed", String(!internetConnected));
      } else if (trayAction.dataset.trayAction === "toggle-mute") {
        soundMuted = !soundMuted;
        trayAction.setAttribute("aria-pressed", String(soundMuted));
      } else if (trayAction.dataset.trayAction === "toggle-layout") {
        keyboardLayout = keyboardLayout === "RU" ? "EN" : "RU";
      }
      persistTraySettings();
      renderTraySettings();
      return;
    }
    const closeTabButton = target.closest("[data-close-tab]");
    if (closeTabButton) {
      window.close();
      return;
    }
    const openButton = target.closest("[data-open-app]");
    if (openButton) {
      openApp(openButton.dataset.openApp);
      return;
    }
    const minimizeButton = target.closest("[data-minimize-app]");
    if (minimizeButton) {
      const appWindow = $(`[data-app-window="${minimizeButton.dataset.minimizeApp}"]`, adminWindows);
      if (appWindow) appWindow.hidden = true;
      return;
    }
    const closeButton = target.closest("[data-close-app]");
    if (closeButton) {
      const appWindow = $(`[data-app-window="${closeButton.dataset.closeApp}"]`, adminWindows);
      if (appWindow) appWindow.remove();
      return;
    }
    const connectButton = target.closest("[data-connect-device]");
    if (connectButton) {
      const device = deviceById(connectButton.dataset.connectDevice);
      if (device) openRemoteSession(device);
      return;
    }
    const disconnectButton = target.closest("[data-disconnect]");
    if (disconnectButton) {
      const deviceId = disconnectButton.dataset.disconnect;
      const device = deviceById(deviceId);
      if (device) eventForUser(device, "Удалённый сеанс завершён", "Администратор отключился от виртуального рабочего стола.");
      $(`[data-remote-device="${deviceId}"]`, adminWindows)?.remove();
      return;
    }
    const remoteControlButton = target.closest("[data-remote-control]");
    if (remoteControlButton) {
      handleRemoteControl(remoteControlButton.dataset.remoteControl);
      return;
    }
    const remoteAppButton = target.closest("[data-remote-app]");
    if (remoteAppButton) {
      const deviceId = remoteAppButton.dataset.remoteApp;
      const device = deviceById(deviceId);
      if (!currentRemoteControl(deviceId)) {
        showToast("Включи управление, чтобы открывать приложения на виртуальном ПК.");
        return;
      }
      if (device) openClientActionPanel(device, remoteAppButton.dataset.app, "admin-remote");
      return;
    }
    const remoteLockButton = target.closest("[data-remote-lock]");
    if (remoteLockButton) {
      const deviceId = remoteLockButton.dataset.remoteLock;
      const locked = !isInputLocked(deviceId);
      setInputLocked(deviceId, locked);
      remoteLockButton.textContent = locked ? "Разблокировать ввод" : "Заблокировать ввод";
      return;
    }
    const remoteWarningButton = target.closest("[data-remote-warn]");
    if (remoteWarningButton) {
      const device = deviceById(remoteWarningButton.dataset.remoteWarn);
      addEvent(makeEvent(device.id, "Remote Access", "Система", "normal", "Предупреждение отправлено пользователю", "Учебное сообщение администратора; данные не передавались наружу.", "admin"));
      addAlertWindow(device, "Предупреждение SOC", "Администратор отправил учебное предупреждение.");
      showToast(`Предупреждение отправлено пользователю ${device.user}.`);
      return;
    }
    const userWindowAction = target.closest("[data-user-window-action]");
    if (userWindowAction) {
      const remoteDeviceId = userWindowAction.dataset.remoteWindowDevice;
      const deviceId = remoteDeviceId || loggedInDeviceId;
      if (!deviceId) return;
      if (remoteDeviceId && !currentRemoteControl(remoteDeviceId)) {
        showToast("Удалённый сеанс находится в режиме просмотра.");
        return;
      }
      if (!remoteDeviceId && isInputLocked(deviceId)) {
        showToast("Ввод заблокирован администратором.");
        return;
      }
      manageUserWindow(deviceId, userWindowAction.dataset.windowId, userWindowAction.dataset.userWindowAction);
      return;
    }
    const taskbarClientWindow = target.closest("[data-client-task]");
    if (taskbarClientWindow && clientScreen.hidden === false && loggedInDeviceId) {
      if (isInputLocked(loggedInDeviceId)) {
        showToast("Ввод заблокирован администратором.");
        return;
      }
      const action = taskbarClientWindow.dataset.clientMinimized === "true" ? "restore" : "minimize";
      manageUserWindow(loggedInDeviceId, taskbarClientWindow.dataset.clientTask, action);
      return;
    }
    const remoteActionButton = target.closest("[data-remote-action]");
    if (remoteActionButton) {
      const deviceId = remoteActionButton.dataset.remoteAction;
      const device = deviceById(deviceId);
      if (!currentRemoteControl(deviceId)) {
        showToast("Удалённый сеанс находится в режиме просмотра.");
        return;
      }
      runClientCommand(deviceId, remoteActionButton.dataset.clientCommand || remoteActionButton.dataset.clientAction, "admin-remote", true, remoteActionButton.dataset.programName);
      return;
    }
    const clientActionButton = target.closest("[data-client-action]");
    if (clientActionButton && clientScreen.hidden === false && loggedInDeviceId) {
      clientStartMenu.hidden = true;
      clientStartButton.setAttribute("aria-expanded", "false");
      if (isInputLocked(loggedInDeviceId)) {
        showToast("Ввод заблокирован администратором.");
        return;
      }
      if (["browser", "vpn", "program"].includes(clientActionButton.dataset.clientAction)) {
        openClientActionPanel(deviceById(loggedInDeviceId), clientActionButton.dataset.clientAction);
      } else {
        runClientCommand(loggedInDeviceId, clientActionButton.dataset.clientAction, "user");
      }
      return;
    }
    const clientCommandButton = target.closest("[data-client-command]");
    if (clientCommandButton && clientScreen.hidden === false && loggedInDeviceId) {
      if (isInputLocked(loggedInDeviceId)) {
        showToast("Ввод заблокирован администратором.");
        return;
      }
      runClientCommand(loggedInDeviceId, clientCommandButton.dataset.clientCommand, "user", false, clientCommandButton.dataset.programName);
      return;
    }
    const logoutButton = target.closest("[data-action='logout']");
    if (logoutButton) logout();
  });

  $("#volumeControl").addEventListener("input", event => {
    soundVolume = Number(event.currentTarget.value);
    persistTraySettings();
  });

  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const incoming = JSON.parse(event.newValue);
    mergeState(incoming);
  });

  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", event => {
      if (event.data?.state) mergeState(event.data.state);
    });
  }

  populateRoles();
  renderRecentUsers(recentUsers);
  renderRecentUsers(recentUsersFlyout);
  renderCalendar();
  renderTraySettings();
  const loginRole = consumeLoginHandoff();
  const savedRole = sessionStorage.getItem(SESSION_ROLE_KEY);
  const activeRole = loginRole || (savedRole === "admin" || deviceById(savedRole) ? savedRole : null);
  if (activeRole) sessionStorage.setItem(SESSION_ROLE_KEY, activeRole);
  else sessionStorage.removeItem(SESSION_ROLE_KEY);
  if (activeRole === "admin") enterAdmin();
  else if (activeRole) enterClient(deviceById(activeRole), Boolean(loginRole));
  else displayScreen("login");
  refreshClocks();
  window.setInterval(refreshClocks, 1000);
})();
