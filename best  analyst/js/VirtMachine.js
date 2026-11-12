(() => {
  "use strict";

  const ADMIN_PASSWORD = "admin1488";
  const HOST_SESSION_ID = document.querySelector('meta[name="soc-session-id"]')?.content || "unhosted";
  const STORAGE_KEY = `soc-academy-training-state-v6:${HOST_SESSION_ID}`;
  const SESSION_ROLE_KEY = `${STORAGE_KEY}:active-role`;
  const IN_TAB_LOGIN_KEY = `${STORAGE_KEY}:in-tab-login`;
  const RECENT_USERS_KEY = `${STORAGE_KEY}:recent-users`;
  const TRAY_SETTINGS_KEY = `${STORAGE_KEY}:tray-settings`;
  const LOGIN_HANDOFF_PREFIX = `${STORAGE_KEY}:login-handoff:`;
  const CHANNEL_NAME = `${STORAGE_KEY}:channel`;
  const EVENT_LIMIT = 500;
  const devices = [
    {
      id: "pc101",
      serial: "SOC-WS-101",
      ipAddress: "198.51.100.101",
      computer: "WS-101 · Бухгалтерия",
      user: "Анна Смирнова",
      password: "SH101",
      profile: "normal"
    },
    {
      id: "pc102",
      serial: "SOC-WS-102",
      ipAddress: "198.51.100.102",
      computer: "WS-102 · Отдел продаж",
      user: "Илья Морозов",
      password: "SH102",
      profile: "vpn"
    },
    {
      id: "pc103",
      serial: "SOC-WS-103",
      ipAddress: "198.51.100.103",
      computer: "WS-103 · Дизайн",
      user: "Мария Волкова",
      password: "SH103",
      profile: "redirect"
    },
    {
      id: "pc104",
      serial: "SOC-WS-104",
      ipAddress: "198.51.100.104",
      computer: "WS-104 · Ресепшен",
      user: "Денис Кузнецов",
      password: "SH104",
      profile: "miner"
    }
  ];

  const profileNames = {
    normal: "Обычная работа",
    vpn: "VPN-сценарий",
    redirect: "Контроль маршрутизации",
    miner: "Контроль вычислительной нагрузки"
  };
  const profileApplications = window.SocSiemEngine.profileApplications;
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
  const clientDesktop = $("#clientDesktop");
  const adminDesktop = $("#adminDesktop");
  const adminDesktopIcons = $("#adminDesktopIcons");
  const adminStartButton = $("#adminStartButton");
  const adminStartMenu = $("#adminStartMenu");
  const adminPowerFlyout = $("#adminPowerFlyout");
  const adminSettingsFlyout = $("#adminSettingsFlyout");
  const adminUsersFlyout = $("#adminUsersFlyout");
  const adminUsersList = $("#adminUsersList");
  const adminTaskbarApps = $("#adminTaskbarApps");
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
  const adminCalendarPanel = $("#adminCalendarPanel");
  const adminInternetPanel = $("#adminInternetPanel");
  const adminSoundPanel = $("#adminSoundPanel");
  const adminLayoutPanel = $("#adminLayoutPanel");
  const rebootScreen = $("#clientRebootScreen");
  const shutdownScreen = $("#clientShutdownScreen");
  const adminRebootScreen = $("#adminRebootScreen");
  const adminShutdownScreen = $("#adminShutdownScreen");
  const calendarGrid = $("#calendarGrid");
  const adminCalendarGrid = $("#adminCalendarGrid");

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
  let desktopTheme = traySettings.desktopTheme === "light" ? "light" : "blue";
  let sharedState = loadSharedState();
  let channel = null;
  let zIndex = 10;
  const simulationOwnerId = crypto.randomUUID();
  let hostSessionActive = false;
  let workspaceSessionStarted = false;
  let hostCheckFailures = 0;
  let simulationLeaseTimer = null;
  let simulationAlertTimer = null;
  let nextSimulationAlertSeverity = "suspicious";
  let simulationActivityTimers = new Map();

  function makeEvent(deviceId, app, traffic, severity, title, detail, source = "workstation", metadata = {}) {
    const device = devices.find(item => item.id === deviceId);
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString("ru-RU"),
      deviceId,
      profile: device ? device.profile : "admin",
      profileName: device ? profileNames[device.profile] : "Администратор",
      serial: device ? device.serial : "SOC-ADMIN-01",
      ipAddress: device ? device.ipAddress : "198.51.100.100",
      user: device ? device.user : "SOC-аналитик",
      app,
      traffic,
      severity,
      title,
      detail,
      source,
      ...metadata
    };
  }

  function initialState() {
    return {
      version: 6,
      events: [],
      siemCases: {},
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
    if (!state || state.version !== 6 || !Array.isArray(state.events) || !state.deviceState) {
      throw new Error("Сохранённое состояние учебного SOC имеет неизвестный формат. Очисти данные сайта и перезагрузи страницу.");
    }
    if (!state.siemCases || typeof state.siemCases !== "object" || Array.isArray(state.siemCases)) state.siemCases = {};
    return state;
  }

  function persistState(messageType = "state") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState));
    if (channel) channel.postMessage({ type: messageType, state: sharedState });
  }

  function mergeState(incoming) {
    if (!incoming || incoming.version !== 6 || !Array.isArray(incoming.events) || !incoming.deviceState) return;
    const merged = new Map(sharedState.events.map(item => [item.id, item]));
    for (const item of incoming.events) merged.set(item.id, item);
    sharedState.events = [...merged.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, EVENT_LIMIT);
    if (!sharedState.siemCases) sharedState.siemCases = {};
    for (const [caseId, incomingCase] of Object.entries(incoming.siemCases || {})) {
      const currentCase = sharedState.siemCases[caseId];
      if (!currentCase || (incomingCase.updatedAt || 0) >= (currentCase.updatedAt || 0)) {
        sharedState.siemCases[caseId] = incomingCase;
      }
    }
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

  function initializeRemoteDesktopIcons(session, deviceId) {
    const iconContainer = $("[data-remote-icons]", session);
    if (!iconContainer) return;
    const key = `${STORAGE_KEY}:${deviceId}:remote-icons`;
    const positions = JSON.parse(sessionStorage.getItem(key) || "{}");
    const icons = $$("[data-remote-launch]", iconContainer);
    for (const [index, icon] of icons.entries()) {
      const app = icon.dataset.app;
      const position = positions[app];
      icon.style.left = `${Number.isFinite(position?.left) ? position.left : 6}px`;
      icon.style.top = `${Number.isFinite(position?.top) ? position.top : index * 64}px`;
      icon.addEventListener("pointerdown", event => {
        if (event.button !== 0 || !currentRemoteControl(deviceId)) return;
        const iconRect = icon.getBoundingClientRect();
        const parentRect = iconContainer.getBoundingClientRect();
        const start = {
          x: event.clientX,
          y: event.clientY,
          left: iconRect.left - parentRect.left,
          top: iconRect.top - parentRect.top,
          moved: false
        };
        icon.setPointerCapture(event.pointerId);
        const move = moveEvent => {
          const dx = moveEvent.clientX - start.x;
          const dy = moveEvent.clientY - start.y;
          if (Math.abs(dx) + Math.abs(dy) > 5) start.moved = true;
          const maxLeft = Math.max(0, iconContainer.clientWidth - icon.offsetWidth);
          const maxTop = Math.max(0, iconContainer.clientHeight - icon.offsetHeight);
          icon.style.left = `${Math.max(0, Math.min(maxLeft, start.left + dx))}px`;
          icon.style.top = `${Math.max(0, Math.min(maxTop, start.top + dy))}px`;
        };
        const finish = () => {
          icon.removeEventListener("pointermove", move);
          icon.removeEventListener("pointerup", finish);
          icon.removeEventListener("pointercancel", finish);
          if (start.moved) {
            icon.dataset.dragged = "true";
            const currentPositions = JSON.parse(sessionStorage.getItem(key) || "{}");
            currentPositions[app] = {
              left: Number.parseFloat(icon.style.left),
              top: Number.parseFloat(icon.style.top)
            };
            sessionStorage.setItem(key, JSON.stringify(currentPositions));
          }
        };
        icon.addEventListener("pointermove", move);
        icon.addEventListener("pointerup", finish, { once: true });
        icon.addEventListener("pointercancel", finish, { once: true });
      });
    }
  }

  function addEvent(event) {
    sharedState.events.unshift(event);
    sharedState.events = sharedState.events.slice(0, EVENT_LIMIT);
    persistState("event");
    if (event.deviceId) renderRemoteScreen(event.deviceId);
    refreshOpenApps();
    return event;
  }

  function showProfileActivityOnDesktop(device, app, title, detail, severity = "normal") {
    const kind = app === "Browser" ? "browser"
      : app === "Mail" ? "mail"
        : app === "VPN Client" ? "vpn"
          : "profile-app";
    const appName = kind === "profile-app" ? app : "";
    const id = kind === "profile-app" ? `profile-${appName}` : kind;
    const windowTitle = kind === "browser" ? "Браузер"
      : kind === "mail" ? "Почта"
        : kind === "vpn" ? "VPN Client"
          : appName;
    const existing = (sharedState.deviceState[device.id].windows || []).find(item => item.id === id);
    const userWindow = {
      ...(existing || {}),
      id,
      kind,
      title: windowTitle,
      appName,
      page: kind === "browser" ? "training" : existing?.page || "home",
      result: `${title} — ${detail}`,
      lastActionAt: Date.now(),
      lastActionSeverity: severity,
      maximized: existing?.maximized || false,
      minimized: false
    };
    updateDeviceWindows(device, windows => [...windows.filter(item => item.id !== id), userWindow]);
  }

  function scheduleProfileActivity(device) {
    if (!hostSessionActive || simulationActivityTimers.has(device.id)) return;
    const timerId = window.setTimeout(() => {
      simulationActivityTimers.delete(device.id);
      if (!hostSessionActive || !isSimulationOwner()) return;

      const activities = {
        normal: [
          ["Office Suite", "Приложение", "Сохранён локальный черновик отчёта"],
          ["Browser", "HTTPS", "Проверена внутренняя учебная страница"],
          ["Mail", "Приложение", "Проверено новое внутреннее сообщение"]
        ],
        vpn: [
          ["Sales Dashboard", "HTTPS", "Обновлена учебная сводка продаж"],
          ["Mail", "Приложение", "Проверено сообщение отдела"],
          ["VPN Client", "VPN", "Проверено состояние учебного профиля VPN"]
        ],
        redirect: [
          ["Route Helper", "Маршрутизация", "Проверен штатный учебный маршрут"],
          ["Browser", "DNS", "Обновлена внутренняя страница портала"],
          ["Mail", "Приложение", "Подготовлен внутренний рабочий отчёт"]
        ],
        miner: [
          ["Compute Worker", "Процесс", "Обновлена очередь учебных фоновых задач"],
          ["Browser", "HTTPS", "Проверена внутренняя учебная страница"],
          ["Mail", "Приложение", "Проверена внутренняя почта"]
        ]
      };
      const options = activities[device.profile];
      const [app, traffic, title] = options[Math.floor(Math.random() * options.length)];
      const metric = device.profile === "miner"
        ? `CPU ${Math.floor(8 + Math.random() * 25)}% · RAM ${Math.floor(34 + Math.random() * 35)}%`
        : `задержка ${Math.floor(8 + Math.random() * 55)} мс`;
      const detail = `Автоматическое фоновое действие учебного профиля; ${metric}. Реальные данные и сеть не использовались.`;
      showProfileActivityOnDesktop(device, app, title, detail);
      addEvent(makeEvent(
        device.id,
        app,
        traffic,
        "normal",
        title,
        detail,
        "background-simulation",
        { simulatedMetric: metric }
      ));
      scheduleProfileActivity(device);
    }, Math.floor(2000 + Math.random() * 13000));
    simulationActivityTimers.set(device.id, timerId);
  }

  function scheduleProfileAlert() {
    if (!hostSessionActive || simulationAlertTimer) return;
    simulationAlertTimer = window.setTimeout(() => {
      simulationAlertTimer = null;
      if (!hostSessionActive || !isSimulationOwner()) return;

      const device = devices[Math.floor(Math.random() * devices.length)];
      const findings = profileApplications[device.profile].actions
        .filter(item => item.severity === nextSimulationAlertSeverity);
      if (!findings.length) throw new Error(`В профиле ${device.profile} нет сценариев уровня ${nextSimulationAlertSeverity}.`);
      const finding = findings[Math.floor(Math.random() * findings.length)];
      const detail = `${finding.detail} Сценарный сигнал создан фоновой учебной симуляцией; реальные действия не выполнялись.`;
      showProfileActivityOnDesktop(device, profileApplications[device.profile].name, finding.title, detail, finding.severity);
      addEvent(makeEvent(
        device.id,
        profileApplications[device.profile].name,
        "Процесс",
        finding.severity,
        finding.title,
        detail,
        "background-simulation",
        {
          ruleId: finding.ruleId,
          ruleTitle: finding.ruleTitle,
          ruleDescription: finding.ruleDescription,
          scenarioId: `${device.profile}.profile-workflow`
        }
      ));
      nextSimulationAlertSeverity = nextSimulationAlertSeverity === "suspicious" ? "dangerous" : "suspicious";
      scheduleProfileAlert();
    }, Math.floor(35000 + Math.random() * 10000));
  }

  function isSimulationOwner() {
    const lease = localStorage.getItem(`${STORAGE_KEY}:simulator-lease`);
    if (!lease) return false;
    const [ownerId, expiresAt] = lease.split("|");
    return ownerId === simulationOwnerId && Number(expiresAt) > Date.now();
  }

  function updateSimulationLease() {
    if (!hostSessionActive || !workspaceSessionStarted) return;
    const leaseKey = `${STORAGE_KEY}:simulator-lease`;
    const currentLease = localStorage.getItem(leaseKey);
    const [ownerId, expiresAtText] = (currentLease || "|0").split("|");
    if (ownerId === simulationOwnerId || Number(expiresAtText) <= Date.now()) {
      localStorage.setItem(leaseKey, `${simulationOwnerId}|${Date.now() + 5000}`);
    }

    if (isSimulationOwner()) {
      for (const device of devices) scheduleProfileActivity(device);
      scheduleProfileAlert();
      return;
    }

    for (const timerId of simulationActivityTimers.values()) window.clearTimeout(timerId);
    simulationActivityTimers.clear();
    if (simulationAlertTimer) window.clearTimeout(simulationAlertTimer);
    simulationAlertTimer = null;
  }

  function startHostedSessionMonitoring() {
    if (HOST_SESSION_ID === "unhosted" || simulationLeaseTimer) return;
    const checkSession = async () => {
      try {
        const response = await fetch("/__soc/session", { cache: "no-store" });
        if (!response.ok) throw new Error(`Хост вернул HTTP ${response.status}.`);
        const session = await response.json();
        if (session.sessionId !== HOST_SESSION_ID) {
          stopHostedSession();
          return;
        }
        hostCheckFailures = 0;
        hostSessionActive = true;
        updateSimulationLease();
      } catch (error) {
        hostCheckFailures += 1;
        if (hostCheckFailures >= 2) {
          stopHostedSession();
          loginError.textContent = `Хостинг-сессия завершена: ${error.message} Запусти start-site.bat заново.`;
          loginError.hidden = false;
        }
      }
    };
    simulationLeaseTimer = window.setInterval(checkSession, 1500);
    checkSession();
  }

  function stopHostedSession() {
    hostSessionActive = false;
    if (simulationLeaseTimer) window.clearInterval(simulationLeaseTimer);
    simulationLeaseTimer = null;
    for (const timerId of simulationActivityTimers.values()) window.clearTimeout(timerId);
    simulationActivityTimers.clear();
    if (simulationAlertTimer) window.clearTimeout(simulationAlertTimer);
    simulationAlertTimer = null;
    const leaseKey = `${STORAGE_KEY}:simulator-lease`;
    if (localStorage.getItem(leaseKey)?.startsWith(`${simulationOwnerId}|`)) localStorage.removeItem(leaseKey);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key === STORAGE_KEY || key?.startsWith(`${STORAGE_KEY}:`)) localStorage.removeItem(key);
    }
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key === STORAGE_KEY || key?.startsWith(`${STORAGE_KEY}:`)) sessionStorage.removeItem(key);
    }
    workspaceSessionStarted = false;
    loggedInDeviceId = null;
    displayScreen("login");
  }

  function startWorkspaceSession() {
    workspaceSessionStarted = true;
    startHostedSessionMonitoring();
    updateSimulationLease();
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
    $$("[data-remote-clock]").forEach(clock => {
      clock.textContent = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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

  function closeAdminStartFlyouts() {
    for (const panel of [adminPowerFlyout, adminSettingsFlyout, adminUsersFlyout]) panel.hidden = true;
    $$("[data-admin-start-panel]").forEach(button => button.setAttribute("aria-expanded", "false"));
  }

  function rememberRecentUser(deviceId) {
    const recentIds = [deviceId, ...getRecentUserIds().filter(id => id !== deviceId)].slice(0, 3);
    sessionStorage.setItem(RECENT_USERS_KEY, JSON.stringify(recentIds));
    renderRecentUsers(recentUsers);
    renderRecentUsers(recentUsersFlyout);
  }

  function renderCalendar(grid = calendarGrid) {
    const monthLabel = calendarMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    const panel = grid.closest(".calendar-panel");
    $("[data-calendar-month]", panel).textContent = monthLabel;
    grid.replaceChildren();
    for (const weekday of ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]) {
      const heading = document.createElement("span");
      heading.textContent = weekday;
      grid.append(heading);
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
      grid.append(button);
    }
  }

  function closeStartFlyouts() {
    startPowerFlyout.hidden = true;
    startSettingsFlyout.hidden = true;
    startUsersFlyout.hidden = true;
    $$("[data-start-panel]").forEach(button => button.setAttribute("aria-expanded", "false"));
  }

  function closeTrayPanels(exceptId = "") {
    for (const panel of [calendarPanel, internetPanel, soundPanel, layoutPanel, adminCalendarPanel, adminInternetPanel, adminSoundPanel, adminLayoutPanel]) {
      if (panel.id !== exceptId) panel.hidden = true;
    }
    $$("[data-tray-toggle], [data-calendar-toggle]").forEach(button => {
      const panelId = button.dataset.trayToggle || button.dataset.calendarToggle || calendarPanel.id;
      const isOpen = panelId === exceptId;
      button.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function persistTraySettings() {
    sessionStorage.setItem(TRAY_SETTINGS_KEY, JSON.stringify({
      internetConnected,
      soundMuted,
      keyboardLayout,
      soundVolume,
      desktopTheme
    }));
  }

  function applyDesktopTheme() {
    clientDesktop.classList.toggle("theme-light", desktopTheme === "light");
    adminDesktop.classList.toggle("theme-light", desktopTheme === "light");
    const themeSelect = $("#desktopThemeSelect");
    if (themeSelect) themeSelect.value = desktopTheme;
    $("#adminDesktopThemeSelect").value = desktopTheme;
  }

  function renderTraySettings() {
    $("#internetStatus").textContent = internetConnected ? "Учебное подключение активно" : "Учебное подключение отключено";
    $("[data-admin-internet-status]").textContent = internetConnected ? "Учебное подключение активно" : "Учебное подключение отключено";
    $$("[data-tray-action='toggle-internet']").forEach(button => { button.textContent = internetConnected ? "Отключить" : "Подключить"; });
    $$("[data-tray-toggle='internetPanel'], [data-tray-toggle='adminInternetPanel']").forEach(button => { button.textContent = internetConnected ? "◉" : "◌"; });
    $$("[data-tray-action='toggle-mute']").forEach(button => { button.textContent = soundMuted ? "Включить звук" : "Выключить звук"; });
    $$("[data-tray-toggle='soundPanel'], [data-tray-toggle='adminSoundPanel']").forEach(button => { button.textContent = soundMuted ? "🔇" : "🔊"; });
    $$("[data-tray-action='toggle-layout']").forEach(button => { button.textContent = keyboardLayout === "RU" ? "Русский · RU" : "English · EN"; });
    $$("[data-tray-toggle='layoutPanel'], [data-tray-toggle='adminLayoutPanel']").forEach(button => { button.textContent = keyboardLayout; });
    $("#volumeControl").value = String(soundVolume);
    $("#adminVolumeControl").value = String(soundVolume);
    applyDesktopTheme();
  }

  function beginUserSwitch(role = "") {
    clientStartMenu.hidden = true;
    clientStartButton.setAttribute("aria-expanded", "false");
    closeStartFlyouts();
    adminStartMenu.hidden = true;
    adminStartButton.setAttribute("aria-expanded", "false");
    closeAdminStartFlyouts();
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
    adminStartMenu.hidden = true;
    closeAdminStartFlyouts();
    const activeScreen = loggedInDeviceId ? shutdownScreen : adminShutdownScreen;
    const activeMessage = loggedInDeviceId ? $("#shutdownMessage") : $("#adminShutdownMessage");
    activeScreen.hidden = false;
    activeMessage.textContent = "Выключение виртуальной машины…";
    window.setTimeout(() => {
      window.close();
      window.setTimeout(() => {
        activeMessage.textContent = "Виртуальная машина выключена. Эту вкладку можно закрыть.";
        $("[data-close-tab]", activeScreen).hidden = false;
      }, 300);
    }, 500);
  }

  function restartVirtualMachine() {
    clientStartMenu.hidden = true;
    adminStartMenu.hidden = true;
    closeAdminStartFlyouts();
    const activeScreen = loggedInDeviceId ? rebootScreen : adminRebootScreen;
    const activeMessage = loggedInDeviceId ? $("#rebootMessage") : $("#adminRebootMessage");
    activeScreen.classList.add("reboot-message");
    activeScreen.hidden = false;
    activeMessage.textContent = "Перезагрузка виртуальной машины…";
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    window.setTimeout(() => {
      activeScreen.classList.remove("reboot-message");
      activeMessage.textContent = "Завершение работы…";
    }, 650);
    window.setTimeout(() => {
      activeScreen.hidden = true;
      logout();
    }, 1400);
  }

  function enterAdmin() {
    loggedInDeviceId = null;
    sessionStorage.setItem(SESSION_ROLE_KEY, "admin");
    displayScreen("admin");
    startWorkspaceSession();
    initializeDesktopIcons(adminDesktopIcons, ".desktop-icon[data-open-app]", () => `${STORAGE_KEY}:admin-icons`);
    renderAdminTaskbarApps();
  }

  function enterClient(device, recordLogin = true) {
    loggedInDeviceId = device.id;
    sessionStorage.setItem(SESSION_ROLE_KEY, device.id);
    rememberRecentUser(device.id);
    $("#clientDeviceLabel").textContent = `${device.serial} · ${device.ipAddress} · ${device.user}`;
    renderClientScreen(device.id);
    displayScreen("client");
    initializeDesktopIcons(clientDesktop.querySelector(".client-icons"), ".desktop-icon[data-client-action]", () => `${STORAGE_KEY}:${loggedInDeviceId}:icons`);
    renderClientLockStatus();
    startWorkspaceSession();
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
    adminRebootScreen.hidden = true;
    adminShutdownScreen.hidden = true;
    displayScreen("login");
  }

  function openApp(name) {
    const existing = $(`[data-app-window="${name}"]`, adminWindows);
    if (existing) {
      existing.hidden = false;
      existing.style.zIndex = String(++zIndex);
      renderAdminTaskbarApps();
      return existing;
    }
    const titles = {
      remote: "Remote Access · устройства",
      network: "Network Monitor · события",
      siem: "SIEM · центр наблюдения и расследований",
      programs: "Programs · инвентаризация",
      notes: "SOC Notes · легенда стенда"
    };
    const windowElement = document.createElement("section");
    windowElement.className = `app-window${name === "siem" ? " maximized siem-window" : ""}`;
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
    windowElement.addEventListener("pointerdown", () => {
      windowElement.style.zIndex = String(++zIndex);
      renderAdminTaskbarApps();
    });
    renderAdminTaskbarApps();
    return windowElement;
  }

  function renderAdminTaskbarApps() {
    const appIcons = { remote: "🖥️", network: "📡", siem: "🛡️", programs: "📦", notes: "📝" };
    const appWindows = $$("[data-app-window]", adminWindows);
    const remoteWindows = $$("[data-remote-device]", adminWindows);
    adminTaskbarApps.innerHTML = [
      ...appWindows.map(item => `<button type="button" class="taskbar-app${item.hidden ? " minimized-app" : " active-app"}"
        data-admin-task-app="${escapeHtml(item.dataset.appWindow)}" aria-label="${escapeHtml(item.dataset.appWindow)}">
        ${appIcons[item.dataset.appWindow] || "▣"} ${escapeHtml(item.dataset.appWindow === "network" ? "Network Monitor" : item.dataset.appWindow === "remote" ? "Remote Access" : item.dataset.appWindow === "siem" ? "SIEM" : item.dataset.appWindow === "programs" ? "Programs" : "SOC Notes")}
      </button>`),
      ...remoteWindows.map(item => `<button type="button" class="taskbar-app${item.hidden ? " minimized-app" : " active-app"}"
        data-admin-task-remote="${escapeHtml(item.dataset.remoteDevice)}" aria-label="Удалённый сеанс ${escapeHtml(item.dataset.remoteDevice)}">
        🖥️ ${escapeHtml(deviceById(item.dataset.remoteDevice)?.serial || "ПК")}
      </button>`)
    ].join("");
  }

  function initializeDesktopIcons(container, selector, storageKey) {
    if (!container) return;
    const icons = $$(selector, container);
    const savedPositions = JSON.parse(sessionStorage.getItem(storageKey()) || "{}");
    const rowsPerColumn = Math.max(1, Math.floor(container.clientHeight / 90));
    for (const [index, icon] of icons.entries()) {
      const key = icon.dataset.openApp || icon.dataset.clientAction;
      const saved = savedPositions[key];
      const defaultLeft = 8 + Math.floor(index / rowsPerColumn) * 118;
      const defaultTop = (index % rowsPerColumn) * 90;
      const maxLeft = Math.max(0, container.clientWidth - icon.offsetWidth);
      const maxTop = Math.max(0, container.clientHeight - icon.offsetHeight);
      icon.style.left = `${Math.max(0, Math.min(maxLeft, Number.isFinite(saved?.left) ? saved.left : defaultLeft))}px`;
      icon.style.top = `${Math.max(0, Math.min(maxTop, Number.isFinite(saved?.top) ? saved.top : defaultTop))}px`;
      if (icon.dataset.dragInitialized === "true") continue;
      icon.dataset.dragInitialized = "true";
      let pointerStart = null;
      const selectIcon = () => {
        $$(".desktop-icon", container).forEach(item => item.classList.toggle("selected", item === icon));
      };
      icon.addEventListener("click", selectIcon);
      icon.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        icon.dataset.pointerType = event.pointerType;
        selectIcon();
        const iconRect = icon.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        pointerStart = {
          x: event.clientX,
          y: event.clientY,
          left: iconRect.left - parentRect.left,
          top: iconRect.top - parentRect.top,
          moved: false
        };
        icon.setPointerCapture(event.pointerId);
      });
      icon.addEventListener("pointermove", event => {
        if (!pointerStart) return;
        const dx = event.clientX - pointerStart.x;
        const dy = event.clientY - pointerStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) pointerStart.moved = true;
        const maxLeft = Math.max(0, container.clientWidth - icon.offsetWidth);
        const maxTop = Math.max(0, container.clientHeight - icon.offsetHeight);
        icon.style.left = `${Math.max(0, Math.min(maxLeft, pointerStart.left + dx))}px`;
        icon.style.top = `${Math.max(0, Math.min(maxTop, pointerStart.top + dy))}px`;
      });
      icon.addEventListener("pointerup", () => {
        if (!pointerStart) return;
        if (pointerStart.moved) {
          icon.dataset.dragged = "true";
          const currentPositions = JSON.parse(sessionStorage.getItem(storageKey()) || "{}");
          currentPositions[key] = {
            left: Number.parseFloat(icon.style.left),
            top: Number.parseFloat(icon.style.top)
          };
          sessionStorage.setItem(storageKey(), JSON.stringify(currentPositions));
        }
        pointerStart = null;
      });
      icon.addEventListener("pointercancel", () => { pointerStart = null; });
    }
  }

  function renderAdminUsers() {
    adminUsersList.replaceChildren();
    for (const device of devices) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.adminStartUser = device.id;
      const mark = document.createElement("span");
      mark.className = "recent-user-mark";
      mark.textContent = device.user.split(" ").map(part => part[0]).slice(0, 2).join("");
      const label = document.createElement("span");
      label.textContent = `${device.user} · ${device.computer}`;
      button.append(mark, label);
      adminUsersList.append(button);
    }
  }
  function appContent(name) {
    return $("[data-app-content]", $(`[data-app-window="${name}"]`, adminWindows));
  }

  function renderApp(name) {
    const content = appContent(name);
    if (!content) return;
    if (name === "remote") renderRemoteApp(content);
    if (name === "network") renderNetworkApp(content);
    if (name === "siem") renderSiemApp(content);
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
        <p><strong>Учебный IP:</strong> ${escapeHtml(device.ipAddress)} <small>TEST-NET-2</small></p>
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
      const programMatches = !filters.program || `${event.app} ${event.user} ${event.serial} ${event.ipAddress || ""}`.toLowerCase().includes(filters.program);
      const trafficMatches = !filters.traffic || event.traffic === filters.traffic;
      const severityMatches = !filters.severity || event.severity === filters.severity;
      return deviceMatches && programMatches && trafficMatches && severityMatches;
    });
  }

  function eventTable(events) {
    if (!events.length) return `<div class="empty-state">По выбранным условиям записей нет.</div>`;
    return `<div class="table-wrap"><table class="event-table">
      <thead><tr><th>Время</th><th>Устройство · учебный IP</th><th>Программа</th><th>Тип</th><th>Уровень</th><th>Событие</th></tr></thead>
      <tbody>${events.map(event => `<tr class="event-row ${event.severity}">
        <td>${escapeHtml(event.time)}</td><td>${escapeHtml(event.serial)}<br>${escapeHtml(event.ipAddress || "198.51.100.100")}<br>${escapeHtml(event.user)}</td>
        <td>${escapeHtml(event.app)}</td><td>${escapeHtml(event.traffic)}</td>
        <td>${severityBadge(event.severity)}</td><td>${escapeHtml(event.title)}<br><small>${escapeHtml(event.detail)}</small></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function renderNetworkApp(content) {
    const filters = content.dataset.filtersReady === "true" ? currentFilters(content) : { device: "", program: "", traffic: "", severity: "" };
    const events = filteredEvents(filters);
    content.innerHTML = `
      <h3>Монитор событий и адресации</h3>
      <p>Только фиктивные адреса TEST-NET-2; они не принадлежат реальным хостам и не используются для соединений.</p>
      <div class="network-device-grid">${devices.map(device => `<article class="network-device-card">
        <strong>${escapeHtml(device.serial)}</strong><span>${escapeHtml(device.ipAddress)}</span>
        <small>${escapeHtml(device.user)} · ${escapeHtml(profileNames[device.profile])}</small>
      </article>`).join("")}</div>
      <p>Журнал фоновой активности и действий · ${events.length} совпадений</p>
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
        && (!filters.program || `${program.name} ${device.user} ${device.serial} ${device.ipAddress}`.toLowerCase().includes(filters.program))
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
        <thead><tr><th>Устройство / учебный IP</th><th>Программа</th><th>Классификация</th><th>Примечание</th></tr></thead>
        <tbody>${rows.map(program => {
          const device = deviceById(program.deviceId);
          return `<tr class="event-row ${program.severity}"><td>${escapeHtml(device.serial)}<br>${escapeHtml(device.ipAddress)}<br>${escapeHtml(device.user)}</td><td>${escapeHtml(program.name)}</td><td>${severityBadge(program.severity)}</td><td>${escapeHtml(program.note)}</td></tr>`;
        }).join("")}</tbody></table></div>` : `<div class="empty-state">Пользователи ещё не открывали приложения.</div>`}</div>`;
    content.dataset.filtersReady = "true";
    bindFilterControls(content, renderProgramsApp);
  }

  function renderNotesApp(content) {
    content.innerHTML = `
      <h3>Легенда учебного стенда</h3>
      <ul class="notes-list">
        <li><strong>Штатно:</strong> обычная активность профиля.</li>
        <li><strong>Подозрительно:</strong> жёлтый учебный сигнал, требующий проверки контекста.</li>
        <li><strong>Опасно:</strong> красный учебный сигнал о блокированном рискованном действии.</li>
        <li>Каждый профиль содержит сценарные действия; сигналы появляются только после действий пользователя.</li>
        <li>Устройство видно только по телеметрии, пока администратор не установит удалённый сеанс.</li>
        <li>Все программы, трафик, предупреждения и удалённые действия виртуальные. Секреты не помещаются в события.</li>
      </ul>`;
  }

  function siemAlerts(filters = {}) {
    if (!window.SocSiemEngine) throw new Error("Модуль SIEM не загружен.");
    return window.SocSiemEngine.buildAlerts(sharedState.events, devices, sharedState.siemCases)
      .filter(alert => {
        const deviceMatches = !filters.device || alert.device?.id === filters.device;
        const profileMatches = !filters.profile || alert.device?.profile === filters.profile;
        const severityMatches = !filters.severity || alert.severity === filters.severity;
        const statusMatches = !filters.status || alert.caseRecord.status === filters.status;
        const searchText = `${alert.title} ${alert.description} ${alert.device?.serial || ""} ${alert.device?.ipAddress || ""} ${alert.device?.user || ""} ${alert.device ? profileNames[alert.device.profile] : ""} ${alert.events.map(item => `${item.app} ${item.title} ${item.detail}`).join(" ")}`.toLowerCase();
        const searchMatches = !filters.search || searchText.includes(filters.search);
        return deviceMatches && profileMatches && severityMatches && statusMatches && searchMatches;
      });
  }

  function renderSiemApp(content) {
    const activeSearch = document.activeElement === $("[data-siem-search]", content);
    const searchSelection = activeSearch
      ? [$("[data-siem-search]", content).selectionStart, $("[data-siem-search]", content).selectionEnd]
      : null;
    const filters = content.dataset.filtersReady === "true"
      ? {
        device: $("[data-siem-filter-device]", content)?.value || "",
        profile: $("[data-siem-filter-profile]", content)?.value || "",
        severity: $("[data-siem-filter-severity]", content)?.value || "",
        status: $("[data-siem-filter-status]", content)?.value || "",
        search: ($("[data-siem-search]", content)?.value || "").trim().toLowerCase()
      }
      : { device: "", profile: "", severity: "", status: "", search: "" };
    const alerts = siemAlerts(filters);
    const allAlerts = siemAlerts();
    const selectedAlertId = alerts.some(alert => alert.id === content.dataset.selectedAlert)
      ? content.dataset.selectedAlert
      : alerts[0]?.id || "";
    content.dataset.selectedAlert = selectedAlertId;
    const selected = alerts.find(alert => alert.id === selectedAlertId);
    const counts = {
      total: allAlerts.length,
      events: sharedState.events.length,
      new: allAlerts.filter(alert => alert.caseRecord.status === "new").length,
      normal: allAlerts.filter(alert => alert.severity === "normal").length,
      suspicious: allAlerts.filter(alert => alert.severity === "suspicious").length,
      dangerous: allAlerts.filter(alert => alert.severity === "dangerous").length
    };

    content.innerHTML = `
      <h3>SIEM · обзор учебных сигналов</h3>
      <p>Локальная симуляция на основе общего журнала виртуальных устройств. Сигнал не подтверждает реальную атаку.</p>
      <div class="siem-summary" aria-label="Сводка сигналов">
        <span>Устройства: <strong>${devices.length}</strong></span>
        <span>Учебных событий: <strong>${counts.events}</strong></span>
        <span>Фоновая симуляция: <strong>${hostSessionActive && workspaceSessionStarted ? "активна" : "ожидание входа"}</strong></span>
        <span>Всего: <strong>${counts.total}</strong></span>
        <span>Новые: <strong>${counts.new}</strong></span>
        <span>Штатные: <strong>${counts.normal}</strong></span>
        <span>Жёлтые: <strong>${counts.suspicious}</strong></span>
        <span>Красные: <strong>${counts.dangerous}</strong></span>
      </div>
      <div class="siem-toolbar">
        <select aria-label="Фильтр по устройству" data-siem-filter-device>
          <option value="">Все устройства</option>
          ${devices.map(device => `<option value="${device.id}">${escapeHtml(device.serial)}</option>`).join("")}
        </select>
        <select aria-label="Фильтр по профилю" data-siem-filter-profile>
          <option value="">Все профили</option>
          ${Object.entries(profileNames).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join("")}
        </select>
        <select aria-label="Фильтр по уровню" data-siem-filter-severity>
          <option value="">Все уровни</option>
          <option value="normal">Штатно</option>
          <option value="suspicious">Жёлтый · Подозрительно</option>
          <option value="dangerous">Красный · Опасно</option>
        </select>
        <select aria-label="Фильтр по статусу" data-siem-filter-status>
          <option value="">Все статусы</option>
          <option value="new">Новый</option>
          <option value="in-progress">В работе</option>
          <option value="confirmed">Подтверждённый</option>
          <option value="false-positive">Ложное срабатывание</option>
          <option value="benign-positive">Допустимая активность</option>
        </select>
        <input type="search" aria-label="Поиск сигналов" data-siem-search placeholder="Поиск по устройству, правилу или событию">
      </div>
      <div class="siem-layout">
        <div class="siem-alert-list" aria-label="Список алертов">
          ${alerts.length ? alerts.map(alert => `
            <button type="button" class="siem-alert ${alert.severity}${alert.id === selectedAlertId ? " selected" : ""}"
              data-siem-select="${escapeHtml(alert.id)}" aria-pressed="${alert.id === selectedAlertId}">
              <strong>${escapeHtml(alert.title)}</strong>
              <small>${escapeHtml(alert.device?.serial || "Устройство неизвестно")} · ${escapeHtml(alert.device?.ipAddress || "без IP")} · ${escapeHtml(alert.device ? profileNames[alert.device.profile] : "Без профиля")}</small>
              <small>${severityBadge(alert.severity)} · ${escapeHtml(alert.caseRecord.status === "new" ? "Новый" : alert.caseRecord.status === "in-progress" ? "В работе" : alert.caseRecord.status === "confirmed" ? "Подтверждённый" : alert.caseRecord.status === "false-positive" ? "Ложное срабатывание" : "Допустимая активность")}</small>
            </button>`).join("") : `<div class="siem-empty">По выбранным условиям сигналов нет. Штатные действия видны здесь вместе с жёлтыми и красными сигналами.</div>`}
        </div>
        <section class="siem-detail" aria-live="polite">
          ${selected ? siemDetailMarkup(selected) : `<div class="siem-empty">Выберите сигнал для просмотра подробностей и связанных событий.</div>`}
        </section>
      </div>`;
    content.dataset.filtersReady = "true";
    for (const [attribute, value] of [
      ["data-siem-filter-device", filters.device],
      ["data-siem-filter-profile", filters.profile],
      ["data-siem-filter-severity", filters.severity],
      ["data-siem-filter-status", filters.status],
      ["data-siem-search", filters.search]
    ]) {
      const control = $(`[${attribute}]`, content);
      if (control) control.value = value;
    }
    if (activeSearch) {
      const search = $("[data-siem-search]", content);
      search.focus();
      search.setSelectionRange(searchSelection[0], searchSelection[1]);
    }

    content.oninput = event => {
      if (event.target.matches("[data-siem-search]")) renderSiemApp(content);
    };
    content.onchange = event => {
      if (event.target.matches("[data-siem-case-status], [data-siem-case-note]")) {
        saveSiemCase(content.dataset.selectedAlert, content);
        return;
      }
      if (event.target.matches("[data-siem-filter-device], [data-siem-filter-profile], [data-siem-filter-severity], [data-siem-filter-status]")) {
        renderSiemApp(content);
      }
    };
    content.onclick = event => {
      const button = event.target.closest("[data-siem-select]");
      if (!button) return;
      content.dataset.selectedAlert = button.dataset.siemSelect;
      renderSiemApp(content);
    };
  }

  function siemDetailMarkup(alert) {
    const device = alert.device;
    const status = alert.caseRecord.status;
    return `
      <h4>${escapeHtml(alert.title)}</h4>
      <p>${severityBadge(alert.severity)} · ${escapeHtml(alert.ruleId)}</p>
      <p><strong>Правило:</strong> ${escapeHtml(alert.description)}</p>
      <p><strong>Устройство:</strong> ${escapeHtml(device?.serial || "Неизвестно")} · ${escapeHtml(device?.ipAddress || "Нет адреса")} · ${escapeHtml(device?.computer || "")}</p>
      <p><strong>Профиль / пользователь:</strong> ${escapeHtml(device ? profileNames[device.profile] : "Неизвестно")} · ${escapeHtml(device?.user || "Неизвестно")}</p>
      <h4>Связанные исходные события (${alert.events.length})</h4>
      <ol class="siem-events">${alert.events.map(event => `
        <li><strong>${escapeHtml(new Date(event.timestamp).toLocaleString("ru-RU"))} · ${escapeHtml(event.app)}</strong><br>
          ${escapeHtml(event.title)} — ${escapeHtml(event.detail)}<br><small>${escapeHtml(event.ipAddress || "198.51.100.100")} · ${escapeHtml(event.source)}</small></li>`).join("")}</ol>
      <label for="siemCaseStatus">Статус расследования</label>
      <select id="siemCaseStatus" data-siem-case-status>
        <option value="new"${status === "new" ? " selected" : ""}>Новый</option>
        <option value="in-progress"${status === "in-progress" ? " selected" : ""}>В работе</option>
        <option value="confirmed"${status === "confirmed" ? " selected" : ""}>Подтверждённый</option>
        <option value="false-positive"${status === "false-positive" ? " selected" : ""}>Ложное срабатывание</option>
        <option value="benign-positive"${status === "benign-positive" ? " selected" : ""}>Допустимая активность</option>
      </select>
      <label for="siemCaseNote">Заметка аналитика</label>
      <textarea id="siemCaseNote" data-siem-case-note maxlength="1000" placeholder="Кратко запишите ход проверки и вывод">${escapeHtml(alert.caseRecord.note || "")}</textarea>
      <small>Заметка и статус сохраняются в локальном состоянии учебной виртуальной машины.</small>`;
  }

  function saveSiemCase(alertId, content) {
    if (!alertId) return;
    const status = $("[data-siem-case-status]", content)?.value || "new";
    const note = $("[data-siem-case-note]", content)?.value || "";
    sharedState.siemCases[alertId] = { status, note, updatedAt: Date.now() };
    persistState("siem-case");
    renderSiemApp(content);
  }

  function refreshOpenApps() {
    for (const name of ["network", "programs", "remote", "siem"]) {
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
      windowElement.dataset.dragging = "true";
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
      if (!start) return;
      const parent = windowElement.offsetParent;
      const maxLeft = Math.max(0, parent.clientWidth - windowElement.offsetWidth);
      const maxTop = Math.max(0, parent.clientHeight - windowElement.offsetHeight);
      windowElement.style.left = `${Math.max(0, Math.min(maxLeft, start.left + event.clientX - start.x))}px`;
      windowElement.style.top = `${Math.max(0, Math.min(maxTop, start.top + event.clientY - start.y))}px`;
    });
    handle.addEventListener("pointerup", () => {
      if (!start) return;
      start = null;
      delete windowElement.dataset.dragging;
      onDrop(windowElement);
    });
    handle.addEventListener("pointercancel", () => {
      start = null;
      delete windowElement.dataset.dragging;
    });
  }

  function openRemoteSession(device) {
    const existing = $(`[data-remote-device="${device.id}"]`, adminWindows);
    if (existing) {
      existing.hidden = false;
      existing.style.zIndex = String(++zIndex);
      renderAdminTaskbarApps();
      return;
    }
    const remoteWindow = document.createElement("section");
    remoteWindow.className = "remote-window connecting";
    remoteWindow.dataset.remoteDevice = device.id;
    remoteWindow.style.zIndex = String(++zIndex);
    remoteWindow.innerHTML = `
      <div class="window-titlebar" data-drag-handle>
        <span>Удалённый сеанс · ${escapeHtml(device.serial)} · ${escapeHtml(device.user)}</span>
        <span class="window-buttons">
          <button type="button" aria-label="Свернуть" data-minimize-remote="${device.id}">—</button>
          <button type="button" aria-label="Отключиться" data-disconnect="${device.id}">×</button>
        </span>
      </div>
      <div class="window-content">
        <div class="remote-toolbar">
          <button type="button" data-remote-control="${device.id}">Включить управление</button>
          <button type="button" data-remote-lock="${device.id}">Заблокировать ввод</button>
          <button type="button" data-remote-warn="${device.id}">Отправить предупреждение</button>
          <button type="button" data-disconnect="${device.id}">Отключиться</button>
          <span class="connection-pill" data-connection-status>Подключено · только просмотр</span>
        </div>
        <div class="remote-preview">
          <div class="remote-screen" data-remote-screen>
            <div class="remote-screen-topline"><span>${escapeHtml(device.serial)} · ${escapeHtml(device.ipAddress)} · экран профиля в реальном времени (симуляция)</span><span data-remote-lock-status></span></div>
            <div class="remote-screen-icons" data-remote-icons>
              <button type="button" class="remote-screen-icon" data-remote-launch="${device.id}" data-app="browser"><span>🌐</span>Браузер</button>
              <button type="button" class="remote-screen-icon" data-remote-launch="${device.id}" data-app="mail"><span>✉️</span>Почта</button>
              <button type="button" class="remote-screen-icon" data-remote-launch="${device.id}" data-app="files"><span>📁</span>Проводник</button>
              <button type="button" class="remote-screen-icon" data-remote-launch="${device.id}" data-app="program"><span>📦</span>Программы</button>
              <button type="button" class="remote-screen-icon" data-remote-launch="${device.id}" data-app="vpn"><span>🔐</span>VPN Client</button>
            </div>
            <section class="remote-screen-app" data-remote-windows aria-live="polite"></section>
            <section class="remote-start-menu" data-remote-start-menu hidden aria-label="Меню Пуск удалённого рабочего стола">
              <strong>${escapeHtml(device.user)} · ${escapeHtml(device.ipAddress)}</strong>
              <p>${escapeHtml(profileNames[device.profile])}</p>
              <div class="start-app-list">
                <button type="button" data-remote-launch="${device.id}" data-app="browser"><span>🌐</span><strong>Браузер</strong></button>
                <button type="button" data-remote-launch="${device.id}" data-app="mail"><span>✉️</span><strong>Почта</strong></button>
                <button type="button" data-remote-launch="${device.id}" data-app="files"><span>📁</span><strong>Проводник</strong></button>
                <button type="button" data-remote-launch="${device.id}" data-app="vpn"><span>🔐</span><strong>VPN Client</strong></button>
                <button type="button" data-remote-launch="${device.id}" data-app="program"><span>📦</span><strong>Все программы</strong></button>
              </div>
            </section>
            <div class="remote-screen-taskbar">
              <button type="button" class="remote-start-button" data-remote-start="${device.id}" aria-expanded="false">SH</button>
              <div class="taskbar-apps" data-remote-taskbar></div>
              <span class="taskbar-spacer"></span>
              <span class="remote-system-status">◉ · RU</span>
              <time data-remote-clock></time>
            </div>
          </div>
        </div>
      </div>`;
    adminWindows.append(remoteWindow);
    makeDraggable(remoteWindow);
    remoteWindow.addEventListener("pointerdown", () => { remoteWindow.style.zIndex = String(++zIndex); });
    initializeRemoteDesktopIcons(remoteWindow, device.id);
    renderRemoteScreen(device.id);
    renderAdminTaskbarApps();
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
    const profileProgram = profileApplications[device.profile].name;
    return [
      { name: "Браузер", action: "launch-browser", severity: "normal" },
      { name: "Почта", action: "launch-mail", severity: "normal" },
      { name: "Проводник", action: "launch-files", severity: "normal" },
      { name: "VPN Client", action: "launch-vpn", severity: "normal" },
      { name: profileProgram, action: "run-profile-program", severity: device.profile === "miner" ? "dangerous" : "normal" }
    ];
  }

  function userWindowBodyMarkup(device, userWindow, remote = false) {
    const remoteAttributes = remote ? `data-remote-action="${device.id}"` : "";
    const department = device.computer.split("·")[1]?.trim() || "Организация";
    if (userWindow.kind === "browser") {
      if (userWindow.page === "training") {
        return `<div class="browser-address"><span>portal.training.test</span><span>${escapeHtml(device.ipAddress)} · локальная страница</span></div>
          <h3>Портал ${escapeHtml(department)}</h3><p>Здравствуйте, ${escapeHtml(device.user)}. Здесь доступны внутренние материалы и рабочие сервисы организации.</p>
          <div class="portal-card-grid"><article><strong>Рабочая сводка</strong><span>Обновлена для профиля ${escapeHtml(profileNames[device.profile])}</span></article>
          <article><strong>Устройство</strong><span>${escapeHtml(device.serial)} · ${escapeHtml(device.ipAddress)}</span></article></div>
          ${userWindow.result ? `<div class="application-result">${escapeHtml(userWindow.result)}</div>` : ""}
          <button type="button" data-client-command="restricted-site" ${remoteAttributes}>Попробовать открыть запрещённый ресурс</button>`;
      }
      if (userWindow.page === "blocked") {
        const redirected = device.profile === "redirect";
        return `<div class="browser-address"><span>blocked.training.test</span><span>Доступ заблокирован</span></div>
          <h3>${redirected ? "Обнаружено перенаправление" : "Доступ заблокирован"}</h3>
          <p>${redirected ? "Учебная система обнаружила перенаправление запрещённого ресурса." : "Запрещённый ресурс заблокирован учебной симуляцией."} Внешний сайт не загружался.</p>`;
      }
      return `<div class="browser-address"><span>portal.training.test</span><span>${escapeHtml(device.ipAddress)} · локальная учебная сеть</span></div>
        <div class="browser-welcome"><h3>Внутренний портал</h3><p>${escapeHtml(device.user)} · ${escapeHtml(department)}. Внешняя сеть отключена.</p>
        ${userWindow.result ? `<div class="application-result">${escapeHtml(userWindow.result)}</div>` : ""}
        <button type="button" data-client-command="browser" ${remoteAttributes}>Открыть учебный портал</button>
        <button type="button" data-client-command="restricted-site" ${remoteAttributes}>Открыть запрещённый ресурс</button></div>`;
    }
    if (userWindow.kind === "vpn") {
      return `<div class="program-window-content"><h3>VPN Client</h3>
        <p>${escapeHtml(userWindow.result || "Виртуальный клиент готов. Настоящее подключение не выполняется.")}</p>
        <button type="button" data-client-command="vpn" ${remoteAttributes}>Попытаться подключиться</button></div>`;
    }
    if (userWindow.kind === "mail") {
      return `<div class="program-window-content">
        <h3>Почта организации</h3>
        <p>${escapeHtml(device.user)} · ${escapeHtml(department)} · ${escapeHtml(device.ipAddress)}. Внешняя отправка и получение отключены.</p>
        <div class="mail-list">
          <article class="mail-card"><strong>${escapeHtml(department)} · ежедневная сводка</strong><span>Внутреннее сообщение · сегодня</span><p>Материалы для команды ${escapeHtml(department)} доступны в учебном портале.</p></article>
          <article class="mail-card"><strong>Отчёт по рабочим задачам</strong><span>Учебное вложение · безопасный просмотр</span><p>Вложение синтетическое, внешние файлы не загружались.</p></article>
        </div>
        <div class="application-result" data-app-result>${escapeHtml(userWindow.result || "Выберите сообщение для просмотра.")}</div>
        <button type="button" data-client-command="mail-open" ${remoteAttributes}>Открыть выбранное сообщение</button>
        <button type="button" data-client-command="mail-reply" ${remoteAttributes}>Подготовить ответ</button>
      </div>`;
    }
    if (userWindow.kind === "files") {
      return `<div class="program-window-content">
        <h3>Проводник</h3>
        <p>Учебный профиль: ${escapeHtml(device.user)} · ${escapeHtml(department)} · ${escapeHtml(device.ipAddress)}. Файлы существуют только в этой сессии.</p>
        <div class="file-list">
          <div class="file-row">📁 Документы ${escapeHtml(device.user)}</div><div class="file-row">📁 Материалы · ${escapeHtml(department)}</div><div class="file-row">📄 Отчёт ${escapeHtml(device.serial)}.txt</div>
        </div>
        <div class="application-result" data-app-result>${escapeHtml(userWindow.result || "Выберите учебный объект.")}</div>
        <button type="button" data-client-command="files-open-report" ${remoteAttributes}>Открыть учебный отчёт</button>
        <button type="button" data-client-command="files-save-copy" ${remoteAttributes}>Создать учебную копию</button>
      </div>`;
    }
    if (userWindow.kind === "programs") {
      return `<div class="program-window-content"><h3>Программы</h3><p>Выбери программу для запуска на этом виртуальном компьютере.</p>
        <div class="program-launch-list">${availablePrograms(device).map(program => `
          <button type="button" data-client-command="${program.action}" data-program-name="${escapeHtml(program.name)}" ${remoteAttributes}>
            <span>📦</span><span>${escapeHtml(program.name)}</span><small>${program.action === "run-profile-program" ? "Рабочее приложение профиля · учебные действия" : "Штатное виртуальное приложение"}</small>
          </button>`).join("")}</div></div>`;
    }
    if (userWindow.kind === "profile-app") {
      const profileApp = profileApplications[device.profile];
      return `<div class="program-window-content">
        <h3>${escapeHtml(profileApp.name)}</h3>
        <p>${escapeHtml(profileApp.description)}</p>
        <div class="application-result" data-app-result>${escapeHtml(userWindow.result || "Приложение готово. Выбери безопасную задачу или учебную проверку.")}</div>
        <div class="application-actions">
          <button type="button" data-client-command="profile-save" ${remoteAttributes}>Сохранить учебный документ</button>
          ${profileApp.actions.map(action => `
            <button type="button" data-client-command="scenario:${escapeHtml(action.id)}" ${remoteAttributes}>
              ${escapeHtml(action.label)} · ${action.severity === "dangerous" ? "красный сценарий" : "жёлтый сценарий"}
            </button>`).join("")}
        </div>
        <p><small>Сценарии создают только учебные записи. Код, сетевые соединения и реальные системные настройки не затрагиваются.</small></p>
      </div>`;
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
        ${userWindow.lastActionAt ? `<small class="user-window-activity-status ${escapeHtml(userWindow.lastActionSeverity || "normal")}">● ${escapeHtml(severityNames[userWindow.lastActionSeverity] || "Активность")} · ${escapeHtml(new Date(userWindow.lastActionAt).toLocaleTimeString("ru-RU"))}</small>` : ""}
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
      : kind === "mail" ? "Почта"
        : kind === "files" ? "Проводник"
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
    if ($("[data-dragging='true']", clientWindows)) return;
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
      screen.dataset.controlMode = String(currentRemoteControl(deviceId));
      const windowsArea = $("[data-remote-windows]", screen);
      if ($("[data-dragging='true']", windowsArea)) return;
      const recentActivity = sharedState.events
        .filter(event => event.deviceId === deviceId && event.source !== "admin")
        .slice(0, 5);
      const activityPositionKey = `${STORAGE_KEY}:${deviceId}:activity-window`;
      const activityPosition = JSON.parse(sessionStorage.getItem(activityPositionKey) || "null");
      const narrowScreen = screen.clientWidth <= 560;
      const activityLeft = narrowScreen ? 8 : Number.isFinite(activityPosition?.left) ? activityPosition.left : Math.max(100, Math.round(screen.clientWidth * 0.38));
      const activityTop = Number.isFinite(activityPosition?.top) ? activityPosition.top : 52;
      const activityWidth = narrowScreen ? "calc(100% - 16px)" : `min(610px, calc(100% - ${activityLeft + 16}px))`;
      const currentActivity = recentActivity[0];
      const activityMarkup = `<section class="app-window user-app-window remote-activity-window" data-remote-activity-window style="left:${activityLeft}px;top:${activityTop}px;width:${activityWidth};height:220px;z-index:4">
            <div class="window-titlebar user-window-titlebar" data-drag-handle>
              <span>Действия на экране пользователя</span><span class="remote-live-indicator"><i></i> LIVE</span>
            </div>
            <div class="user-window-content remote-activity-content">
              <h3>${escapeHtml(currentActivity?.app || "Рабочий стол")} · ${escapeHtml(device.user)}</h3>
              <p><strong>Последнее действие:</strong> ${escapeHtml(currentActivity?.title || "Ожидание активности профиля")}</p>
              <p>${escapeHtml(currentActivity?.detail || "Рабочее место подключено. Действия пользователя и сценарные события появятся здесь без открытия дополнительной вкладки.")}</p>
              <small>${currentActivity ? escapeHtml(new Date(currentActivity.timestamp).toLocaleTimeString("ru-RU")) : "Ожидание события"} · ${escapeHtml(device.serial)} · ${escapeHtml(device.ipAddress)}</small>
              <div class="remote-activity-feed"><strong>Последние действия</strong>${recentActivity.length ? recentActivity.map(event => `
                <article class="remote-activity-item ${escapeHtml(event.severity)}">
                  <span>${escapeHtml(new Date(event.timestamp).toLocaleTimeString("ru-RU"))} · ${escapeHtml(event.app)}</span>
                  <strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.detail)}</small>
                </article>`).join("") : `<article class="remote-activity-item"><span>Поток симуляции запущен</span><strong>Нет записанных действий</strong><small>Ожидание первой активности.</small></article>`}</div>
            </div>
          </section>`;
      windowsArea.innerHTML = `${activityMarkup}${windows
        .filter(item => !item.minimized)
        .map((item, index) => userWindowMarkup(device, item, true, index)).join("")}`;
      $("[data-remote-taskbar]", screen).innerHTML = windows.map(item => `<button type="button" class="taskbar-app${item.minimized ? " minimized-app" : " active-app"}"
        data-remote-task-device="${deviceId}" data-remote-task-window="${escapeHtml(item.id)}" data-remote-task-minimized="${item.minimized ? "true" : "false"}">${escapeHtml(item.title)}</button>`).join("");
      $$(".user-app-window", windowsArea).forEach(windowElement => {
        makeDraggable(windowElement, movedWindow => {
          const left = Number.parseFloat(movedWindow.style.left);
          const top = Number.parseFloat(movedWindow.style.top);
          if (movedWindow.matches("[data-remote-activity-window]")) {
            sessionStorage.setItem(activityPositionKey, JSON.stringify({ left, top }));
            return;
          }
          updateDeviceWindows(device, items => items.map(item => item.id === movedWindow.dataset.userWindow
            ? { ...item, left, top }
            : item));
        }, () => currentRemoteControl(deviceId));
      });
    }
    const lockStatus = $("[data-remote-lock-status]", session);
    if (lockStatus) lockStatus.textContent = isInputLocked(deviceId) ? "Ввод заблокирован" : "Сеанс активен";
  }

  function renderClientLockStatus() {
    if (!loggedInDeviceId) return;
    const locked = isInputLocked(loggedInDeviceId);
    $("#clientLockStatus").textContent = locked ? "Ввод заблокирован администратором" : "";
    $("#clientStatus").textContent = locked ? "Администратор временно заблокировал ввод пользователя." : "";
    $$("[data-client-action], [data-client-command], [data-user-window-action], [data-start-panel], [data-start-action], [data-start-user], [data-settings-action], [data-tray-toggle], [data-tray-action], [data-calendar-toggle], [data-calendar-step], [data-calendar-day], #desktopThemeSelect, #volumeControl", clientScreen)
      .forEach(button => { button.disabled = locked; });
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
    const risky = device.profile === "miner" && app === "Compute Worker";
    addEvent(makeEvent(
      device.id,
      app,
      "Приложение",
      risky ? "dangerous" : "normal",
      `Запущена программа: ${app}`,
      risky ? "Сценарный индикатор; исполняемый код не запускается." : "Виртуальный запуск приложения.",
      actor,
      risky ? {
        ruleId: "compute.worker-launch",
        ruleTitle: "Запуск неизвестной вычислительной задачи",
        ruleDescription: "Профиль нагрузочного сценария запускает виртуальную задачу; исполняемый код не запускается.",
        scenarioId: `${device.profile}.profile-workflow`
      } : {}
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
        addEvent(makeEvent(device.id, "VPN Client", "VPN", "suspicious", "Попытка VPN-подключения", "Подозрительное учебное событие. Реальное VPN-соединение не создавалось.", actor, {
          ruleId: "vpn.suspicious-connect",
          ruleTitle: "Подозрительная попытка VPN",
          ruleDescription: "Профиль VPN создаёт учебный сигнал при попытке подключения; реальное соединение не выполняется."
        }));
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
        actor,
        redirected ? {
          ruleId: "route.blocked-redirect",
          ruleTitle: "Перенаправление запрещённого ресурса",
          ruleDescription: "Симулятор обнаружил изменение ожидаемого маршрута при учебной попытке открыть запрещённый адрес."
        } : {
          ruleId: "web.blocked-resource",
          ruleTitle: "Заблокирован запрещённый ресурс",
          ruleDescription: "Учебная политика остановила попытку открыть запрещённый адрес."
        }
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
    } else if (action === "mail") {
      openClientWindow(device, "mail", actor);
    } else if (action === "files") {
      openClientWindow(device, "files", actor);
    } else if (action === "vpn") {
      openClientWindow(device, "vpn", actor);
    } else if (action === "program") {
      openClientWindow(device, "programs", actor);
    }
  }

  function runClientCommand(deviceId, action, actor, bypassLock = false, programName = "") {
    const device = deviceById(deviceId);
    if (!device) return;
    if (action.startsWith("launch-")) {
      openClientActionPanel(device, action.slice("launch-".length), actor);
      return;
    }
    if (action === "run-profile-program") {
      openClientWindow(device, "profile-app", actor, programName || profileApplications[device.profile].name);
      return;
    }
    if (action.startsWith("scenario:")) {
      const finding = profileApplications[device.profile].actions.find(item => item.id === action.slice("scenario:".length));
      if (finding) recordScenarioFinding(device, finding, actor);
      return;
    }
    if (action === "profile-save") {
      const title = profileApplications[device.profile].name;
      addEvent(makeEvent(device.id, title, "Приложение", "normal", "Учебный документ сохранён", "Симуляция сохранила состояние документа; пользовательский текст и реальные файлы не читались.", actor));
      updateAppWindow(device, `profile-${title}`, window => ({ ...window, result: "Документ сохранён в виртуальной сессии." }));
      return;
    }
    if (action === "mail-open" || action === "mail-reply") {
      const title = action === "mail-open" ? "Учебное сообщение открыто" : "Черновик ответа подготовлен";
      addEvent(makeEvent(device.id, "Почта", "Приложение", "normal", title, "Действие выполнено в локальном учебном почтовом ящике; внешняя отправка не выполнялась.", actor));
      updateAppWindow(device, "mail", window => ({ ...window, result: action === "mail-open" ? "Открыто безопасное учебное сообщение «Планёрка отдела»." : "Черновик ответа подготовлен локально и не отправлен." }));
      return;
    }
    if (action === "files-open-report" || action === "files-save-copy") {
      const title = action === "files-open-report" ? "Учебный отчёт открыт" : "Учебная копия создана";
      addEvent(makeEvent(device.id, "Проводник", "Приложение", "normal", title, "Файловая операция выполнена внутри виртуальной сессии; файловая система ОС не затрагивалась.", actor));
      updateAppWindow(device, "files", window => ({ ...window, result: action === "files-open-report" ? "Открыт демонстрационный отчёт SOC." : "Копия создана в учебном пространстве." }));
      return;
    }
    performClientAction(device, action, actor, bypassLock);
  }

  function recordScenarioFinding(device, finding, actor) {
    addEvent(makeEvent(
      device.id,
      profileApplications[device.profile].name,
      "Процесс",
      finding.severity,
      finding.title,
      finding.detail,
      actor,
      {
        ruleId: finding.ruleId,
        ruleTitle: finding.ruleTitle,
        ruleDescription: finding.ruleDescription,
        scenarioId: `${device.profile}.profile-workflow`
      }
    ));
    updateAppWindow(device, `profile-${profileApplications[device.profile].name}`, window => ({
      ...window,
      result: `${finding.title}. Результат зафиксирован в учебном сценарии.`
    }));
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

    const draggedShortcut = target.closest("[data-open-app][data-dragged='true'], [data-client-action][data-dragged='true'], [data-remote-launch][data-dragged='true']");
    if (draggedShortcut) {
      delete draggedShortcut.dataset.dragged;
      event.preventDefault();
      return;
    }
    const adminDesktopIcon = target.closest("#adminDesktopIcons [data-open-app]");
    if (adminDesktopIcon) {
      if (event.detail === 0 || event.detail > 1 || adminDesktopIcon.dataset.pointerType === "touch") {
        openApp(adminDesktopIcon.dataset.openApp);
        adminStartMenu.hidden = true;
        adminStartButton.setAttribute("aria-expanded", "false");
      }
      event.preventDefault();
      return;
    }
    const clientDesktopIcon = target.closest("#clientDesktop .client-icons [data-client-action]");
    if (clientDesktopIcon && event.detail === 1 && clientDesktopIcon.dataset.pointerType !== "touch") {
      event.preventDefault();
      return;
    }
    const desktopBackground = target.closest("#adminDesktop, #clientDesktop");
    if (desktopBackground && !target.closest(".desktop-icon, .desktop-windows, .client-taskbar, .admin-start-menu, .client-start-menu, .tray-panel, .calendar-hit-area")) {
      $$(".desktop-icon.selected", desktopBackground).forEach(icon => icon.classList.remove("selected"));
    }
    const trayControl = target.closest("[data-tray-toggle], [data-calendar-toggle]");
    if (!trayControl && !target.closest(".tray-panel")) closeTrayPanels();
    const lockedSystemControl = target.closest("[data-start-panel], [data-start-action], [data-start-user], [data-settings-action], [data-tray-toggle], [data-calendar-toggle], [data-calendar-step], [data-calendar-day], [data-tray-action]");
    if (lockedSystemControl && clientScreen.hidden === false && loggedInDeviceId && isInputLocked(loggedInDeviceId)) {
      showToast("Ввод заблокирован администратором.");
      return;
    }
    const adminStartClick = target.closest("#adminStartButton");
    if (!adminStartMenu.hidden && !adminStartClick && !adminStartMenu.contains(target)) {
      adminStartMenu.hidden = true;
      adminStartButton.setAttribute("aria-expanded", "false");
    }
    if (adminStartClick && adminScreen.hidden === false) {
      const shouldOpen = adminStartMenu.hidden;
      adminStartMenu.hidden = !shouldOpen;
      adminStartButton.setAttribute("aria-expanded", String(shouldOpen));
      closeAdminStartFlyouts();
      closeTrayPanels();
      if (shouldOpen) renderAdminUsers();
      return;
    }
    const remoteStartButton = target.closest("[data-remote-start]");
    if (remoteStartButton) {
      const deviceId = remoteStartButton.dataset.remoteStart;
      const remoteWindow = $(`[data-remote-device="${deviceId}"]`, adminWindows);
      const remoteMenu = $("[data-remote-start-menu]", remoteWindow);
      if (!currentRemoteControl(deviceId)) {
        showToast("Включи управление, чтобы использовать меню удалённого рабочего стола.");
        return;
      }
      remoteMenu.hidden = !remoteMenu.hidden;
      remoteStartButton.setAttribute("aria-expanded", String(!remoteMenu.hidden));
      return;
    }
    const remoteLaunchButton = target.closest("[data-remote-launch]");
    if (remoteLaunchButton) {
      const deviceId = remoteLaunchButton.dataset.remoteLaunch;
      if (!currentRemoteControl(deviceId)) {
        showToast("Удалённый сеанс находится в режиме просмотра.");
        return;
      }
      const device = deviceById(deviceId);
      if (device) {
        openClientActionPanel(device, remoteLaunchButton.dataset.app, "admin-remote");
        const remoteWindow = $(`[data-remote-device="${deviceId}"]`, adminWindows);
        $("[data-remote-start-menu]", remoteWindow).hidden = true;
        $("[data-remote-start]", remoteWindow).setAttribute("aria-expanded", "false");
      }
      return;
    }
    const remoteTask = target.closest("[data-remote-task-device]");
    if (remoteTask) {
      const deviceId = remoteTask.dataset.remoteTaskDevice;
      if (!currentRemoteControl(deviceId)) {
        showToast("Удалённый сеанс находится в режиме просмотра.");
        return;
      }
      const action = remoteTask.dataset.remoteTaskMinimized === "true" ? "restore" : "minimize";
      manageUserWindow(deviceId, remoteTask.dataset.remoteTaskWindow, action);
      return;
    }
    const adminStartAction = target.closest("[data-admin-start-action]");
    if (adminStartAction && adminScreen.hidden === false) {
      if (adminStartAction.dataset.adminStartAction === "logout") logout();
      else if (adminStartAction.dataset.adminStartAction === "open-siem") openApp("siem");
      else if (adminStartAction.dataset.adminStartAction === "all-users") beginUserSwitch();
      else if (adminStartAction.dataset.adminStartAction === "shutdown") shutDownVirtualMachine();
      else if (adminStartAction.dataset.adminStartAction === "restart") restartVirtualMachine();
      adminStartMenu.hidden = true;
      adminStartButton.setAttribute("aria-expanded", "false");
      return;
    }
    const adminStartUser = target.closest("[data-admin-start-user]");
    if (adminStartUser && adminScreen.hidden === false) {
      beginUserSwitch(adminStartUser.dataset.adminStartUser);
      return;
    }
    const adminStartPanelButton = target.closest("[data-admin-start-panel]");
    if (adminStartPanelButton && adminScreen.hidden === false) {
      const panelByName = {
        power: adminPowerFlyout,
        settings: adminSettingsFlyout,
        users: adminUsersFlyout
      };
      const panel = panelByName[adminStartPanelButton.dataset.adminStartPanel];
      if (!panel) return;
      const shouldOpen = panel.hidden;
      closeAdminStartFlyouts();
      panel.hidden = !shouldOpen;
      adminStartPanelButton.setAttribute("aria-expanded", String(shouldOpen));
      if (panel === adminUsersFlyout) renderAdminUsers();
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
    const settingsAction = target.closest("[data-settings-action]");
    if (settingsAction && adminScreen.hidden === false && settingsAction.dataset.settingsAction === "admin-network") {
      closeAdminStartFlyouts();
      closeTrayPanels(adminInternetPanel.id);
      adminInternetPanel.hidden = false;
      renderTraySettings();
      return;
    }
    if (settingsAction && clientScreen.hidden === false && loggedInDeviceId) {
      if (settingsAction.dataset.settingsAction === "network") {
        closeStartFlyouts();
        closeTrayPanels(internetPanel.id);
        internetPanel.hidden = false;
        renderTraySettings();
      }
      return;
    }
    const calendarToggle = target.closest("[data-calendar-toggle]");
    if (calendarToggle && ((clientScreen.hidden === false && loggedInDeviceId) || adminScreen.hidden === false)) {
      const panelId = calendarToggle.dataset.calendarToggle || calendarPanel.id;
      const panel = document.getElementById(panelId);
      if (!panel) return;
      const shouldOpen = panel.hidden;
      closeTrayPanels(shouldOpen ? panel.id : "");
      panel.hidden = !shouldOpen;
      calendarToggle.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen) renderCalendar(panelId === adminCalendarPanel.id ? adminCalendarGrid : calendarGrid);
      return;
    }
    const trayToggle = target.closest("[data-tray-toggle]");
    if (trayToggle && ((clientScreen.hidden === false && loggedInDeviceId) || adminScreen.hidden === false)) {
      const panel = document.getElementById(trayToggle.dataset.trayToggle);
      if (!panel) return;
      const shouldOpen = panel.hidden;
      closeTrayPanels(shouldOpen ? panel.id : "");
      panel.hidden = !shouldOpen;
      trayToggle.setAttribute("aria-expanded", String(shouldOpen));
      return;
    }
    const calendarStep = target.closest("[data-calendar-step]");
    const activeCalendarPanel = calendarStep?.closest(".calendar-panel");
    if (calendarStep && activeCalendarPanel && !activeCalendarPanel.hidden) {
      calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(calendarStep.dataset.calendarStep), 1);
      renderCalendar(activeCalendarPanel === adminCalendarPanel ? adminCalendarGrid : calendarGrid);
      return;
    }
    const calendarDay = target.closest("[data-calendar-day]");
    const selectedCalendarPanel = calendarDay?.closest(".calendar-panel");
    if (calendarDay && selectedCalendarPanel && !selectedCalendarPanel.hidden) {
      const [year, month, day] = calendarDay.dataset.calendarDay.split("-").map(Number);
      selectedCalendarDate = new Date(year, month, day);
      calendarMonth = new Date(year, month, 1);
      renderCalendar(selectedCalendarPanel === adminCalendarPanel ? adminCalendarGrid : calendarGrid);
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
      adminStartMenu.hidden = true;
      adminStartButton.setAttribute("aria-expanded", "false");
      return;
    }
    const adminTaskApp = target.closest("[data-admin-task-app]");
    if (adminTaskApp) {
      const appWindow = $(`[data-app-window="${adminTaskApp.dataset.adminTaskApp}"]`, adminWindows);
      if (!appWindow) return;
      const shouldHide = !appWindow.hidden && appWindow.style.zIndex === String(zIndex);
      appWindow.hidden = shouldHide;
      if (!shouldHide) appWindow.style.zIndex = String(++zIndex);
      renderAdminTaskbarApps();
      return;
    }
    const adminTaskRemote = target.closest("[data-admin-task-remote]");
    if (adminTaskRemote) {
      const remoteWindow = $(`[data-remote-device="${adminTaskRemote.dataset.adminTaskRemote}"]`, adminWindows);
      if (!remoteWindow) return;
      const shouldHide = !remoteWindow.hidden && remoteWindow.style.zIndex === String(zIndex);
      remoteWindow.hidden = shouldHide;
      if (!shouldHide) remoteWindow.style.zIndex = String(++zIndex);
      renderAdminTaskbarApps();
      return;
    }
    const minimizeButton = target.closest("[data-minimize-app]");
    if (minimizeButton) {
      const appWindow = $(`[data-app-window="${minimizeButton.dataset.minimizeApp}"]`, adminWindows);
      if (appWindow) appWindow.hidden = true;
      renderAdminTaskbarApps();
      return;
    }
    const minimizeRemote = target.closest("[data-minimize-remote]");
    if (minimizeRemote) {
      const remoteWindow = $(`[data-remote-device="${minimizeRemote.dataset.minimizeRemote}"]`, adminWindows);
      if (remoteWindow) remoteWindow.hidden = true;
      renderAdminTaskbarApps();
      return;
    }
    const closeButton = target.closest("[data-close-app]");
    if (closeButton) {
      const appWindow = $(`[data-app-window="${closeButton.dataset.closeApp}"]`, adminWindows);
      if (appWindow) appWindow.remove();
      renderAdminTaskbarApps();
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
      renderAdminTaskbarApps();
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
      if (["browser", "mail", "files", "vpn", "program"].includes(clientActionButton.dataset.clientAction)) {
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
    $("#adminVolumeControl").value = String(soundVolume);
    persistTraySettings();
  });

  $("#adminVolumeControl").addEventListener("input", event => {
    soundVolume = Number(event.currentTarget.value);
    $("#volumeControl").value = String(soundVolume);
    persistTraySettings();
  });

  $("#desktopThemeSelect").addEventListener("change", event => {
    desktopTheme = event.currentTarget.value === "light" ? "light" : "blue";
    $("#adminDesktopThemeSelect").value = desktopTheme;
    persistTraySettings();
    applyDesktopTheme();
  });

  $("#adminDesktopThemeSelect").addEventListener("change", event => {
    desktopTheme = event.currentTarget.value === "light" ? "light" : "blue";
    $("#desktopThemeSelect").value = desktopTheme;
    persistTraySettings();
    applyDesktopTheme();
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
  renderAdminUsers();
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
