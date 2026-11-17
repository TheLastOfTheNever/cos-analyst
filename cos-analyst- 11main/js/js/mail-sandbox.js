/* Учебная SOC Mail и Sandbox.
 * Вложения — метаданные в интерфейсе, не реальные файлы.
 * Команды и сетевые соединения не запускаются.
 */
(() => {
  "use strict";

  const clientScreen = document.querySelector("#clientScreen");
  const desktop = document.querySelector("#clientDesktop");

  if (!clientScreen || !desktop) {
    console.error("SOC Mail: не найдены элементы рабочего стола пользователя.");
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .socmail-launchers {
      position: absolute; z-index: 3; top: 48px; right: 12px;
      display: flex; gap: 8px;
    }
    .socmail-launchers button, .socmail-window button {
      padding: 8px 11px; border: 1px solid #aebdcb; border-radius: 6px;
      background: #e8eef4; color: #18324b; cursor: pointer;
    }
    .socmail-window {
      position: absolute; z-index: 15; top: 80px; left: 125px;
      width: min(760px, calc(100% - 145px));
      height: min(540px, calc(100% - 155px)); min-height: 300px;
      overflow: hidden; border: 1px solid #8299ae; border-radius: 9px;
      background: #f7f9fc; color: #17283a; box-shadow: 0 18px 55px #0008;
    }
    .socmail-titlebar {
      height: 38px; padding: 8px 12px; background: #dbe5ef;
      font-weight: 700; display: flex; justify-content: space-between;
    }
    .socmail-body { height: calc(100% - 38px); overflow: auto; padding: 14px; }
    .socmail-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
    .socmail-toolbar input { flex: 1; min-width: 0; padding: 8px; }
    .socmail-layout { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 12px; }
    .socmail-list { display: grid; align-content: start; gap: 6px; }
    .socmail-item {
      padding: 9px; border: 1px solid #d5dee7; border-radius: 6px;
      background: #fff; cursor: pointer; text-align: left; color: #17283a;
    }
    .socmail-item.selected { border-color: #148d86; background: #e8f3f2; }
    .socmail-item small, .socmail-item strong { display: block; }
    .socmail-item small { color: #64788b; }
    .socmail-message { min-width: 0; padding: 12px; border: 1px solid #d5dee7; border-radius: 6px; background: #fff; }
    .socmail-message p { overflow-wrap: anywhere; }
    .socmail-attachment {
      display: block; margin: 8px 0; padding: 10px;
      border: 1px dashed #8299ae; border-radius: 6px; background: #f2f6fa;
      cursor: grab;
    }
    .socmail-dropzone {
      margin-top: 12px; padding: 18px; border: 2px dashed #8299ae;
      border-radius: 7px; text-align: center; background: #f2f6fa;
    }
    .socmail-dropzone.dragover { border-color: #148d86; background: #e8f3f2; }
    .socmail-finding { margin: 7px 0; padding: 8px; background: #f0f4f7; border-radius: 5px; }
    @media (max-width: 800px) {
      .socmail-launchers { top: 130px; left: 12px; right: auto; }
      .socmail-window { top: 165px; left: 8px; width: calc(100% - 16px); height: calc(100% - 205px); }
      .socmail-layout { grid-template-columns: 1fr; }
    }
  `;
  document.head.append(style);

  const emails = [
    {
      id: "mail-anna",
      from: "Анна Смирнова · anna.smirnova@company.test",
      subject: "Отчёт отдела за неделю",
      time: "Сегодня, 09:14",
      body: "Привет! Отправляю учебный отчёт для проверки. Файл создан только для тренажёра.",
      attachments: [{ name: "weekly-report.docx", type: "DOCX", note: "Синтетический учебный документ" }]
    },
    {
      id: "mail-colleague",
      from: "Илья Морозов · ilya.morozov@company.test",
      subject: "Материалы встречи",
      time: "Сегодня, 10:02",
      body: "Во вложении учебный PDF с материалами встречи.",
      attachments: [{ name: "meeting-notes.pdf", type: "PDF", note: "Синтетический учебный документ" }]
    },
    {
      id: "mail-unknown",
      from: "Неизвестный отправитель · alert@unknown-mail.test",
      subject: "Срочно: проверьте общий документ",
      time: "Сегодня, позже",
      body: "Письмо содержит учебную ссылку и вложение. Неизвестный отправитель — повод проверить контекст.",
      attachments: [{ name: "Quarterly_Report.docx", type: "DOCX", note: "Подозрительный учебный образец; файл не существует на диске" }],
      suspicious: true
    }
  ];

  let selectedEmailId = emails[0].id;
  let selectedAttachment = null;
  let analyzed = new Set();
  let mailWindow;
  let sandboxWindow;
  let deliveredUnknown = false;
  let activeDeviceId = null;

  function deviceIdFromDesktop() {
    const label = document.querySelector("#clientDeviceLabel")?.textContent || "";
    const match = label.match(/SOC-WS-(101|102|103|104)/);
    return match ? `pc${match[1].slice(1)}` : null;
  }

  function emit(title, detail, severity, traffic, ruleId, ruleTitle, attachmentName = "") {
    const deviceId = activeDeviceId || deviceIdFromDesktop();
    if (!deviceId) return;

    window.dispatchEvent(new CustomEvent("soc:training-event", {
      detail: {
        id: `socmail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        deviceId,
        app: "SOC Mail / Sandbox",
        traffic,
        severity,
        title,
        detail,
        source: "training-mail-sandbox",
        scenarioId: "training-phishing-mail",
        ruleId,
        ruleTitle,
        attachmentName
      }
    }));
  }

  function makeWindow(kind, title) {
    const section = document.createElement("section");
    section.className = "socmail-window";
    section.dataset.socmailWindow = kind;
    section.innerHTML = `
      <div class="socmail-titlebar">
        <span>${title}</span>
        <button type="button" data-socmail-close aria-label="Закрыть">×</button>
      </div>
      <div class="socmail-body"></div>
    `;
    desktop.append(section);
    section.querySelector("[data-socmail-close]").addEventListener("click", () => {
      section.remove();
      if (kind === "mail") mailWindow = null;
      if (kind === "sandbox") sandboxWindow = null;
    });
    return section;
  }

  function openMail() {
    if (!mailWindow?.isConnected) mailWindow = makeWindow("mail", "SOC Mail");
    renderMail();
  }

  function openSandbox() {
    if (!sandboxWindow?.isConnected) sandboxWindow = makeWindow("sandbox", "Sandbox · учебная песочница");
    renderSandbox();
  }

  function renderMail() {
    const body = mailWindow.querySelector(".socmail-body");
    const selected = emails.find(email => email.id === selectedEmailId) || emails[0];

    body.innerHTML = `
      <div class="socmail-toolbar">
        <input type="search" data-mail-search placeholder="Поиск писем" aria-label="Поиск писем">
        <button type="button" data-mail-refresh>Обновить</button>
      </div>
      <div class="socmail-layout">
        <nav class="socmail-list" aria-label="Список писем">
          ${emails.map(email => `
            <button class="socmail-item${email.id === selected.id ? " selected" : ""}"
              type="button" data-mail-select="${email.id}">
              <strong>${email.suspicious ? "⚠ " : ""}${email.from.split(" · ")[0]}</strong>
              <small>${email.subject}</small>
              <small>${email.time}</small>
            </button>
          `).join("")}
        </nav>
        <article class="socmail-message">
          <h3>${selected.subject}</h3>
          <p><strong>От:</strong> ${selected.from}</p>
          <p><strong>Дата:</strong> ${selected.time}</p>
          <p>${selected.body}</p>
          ${selected.suspicious ? `<p><strong>Учебная ссылка:</strong> document-review.training.test</p>` : ""}
          <h4>Вложения</h4>
          ${selected.attachments.map(file => `
            <div class="socmail-attachment" draggable="true"
              data-attachment="${file.name}" data-email="${selected.id}">
              📎 <strong>${file.name}</strong><br>
              <small>${file.type} · ${file.note} · перетащи в Sandbox</small>
            </div>
          `).join("")}
          <button type="button" data-send-sandbox>Передать вложение в Sandbox</button>
          <button type="button" data-delete-mail>Удалить письмо</button>
          <p class="socmail-status" aria-live="polite">Почта учебная; вложения не являются реальными файлами.</p>
        </article>
      </div>
    `;

    body.querySelectorAll("[data-mail-select]").forEach(button => {
      button.addEventListener("click", () => {
        selectedEmailId = button.dataset.mailSelect;
        renderMail();
      });
    });

    body.querySelectorAll("[data-attachment]").forEach(file => {
      file.addEventListener("dragstart", event => {
        selectedAttachment = {
          name: file.dataset.attachment,
          emailId: file.dataset.email
        };
        event.dataTransfer?.setData("text/plain", JSON.stringify(selectedAttachment));
      });
    });

    body.querySelector("[data-send-sandbox]").addEventListener("click", () => {
      selectedAttachment = {
        name: selected.attachments[0].name,
        emailId: selected.id
      };
      openSandbox();
      analyzeAttachment(selectedAttachment);
    });

    body.querySelector("[data-delete-mail]").addEventListener("click", () => {
      emit(
        "Учебное письмо удалено",
        `Письмо «${selected.subject}» перемещено в корзину симуляции.`,
        "normal",
        "Почта",
        "mail.training.delete",
        "Удаление письма в учебной почте"
      );
      const index = emails.findIndex(email => email.id === selected.id);
      if (index >= 0) emails.splice(index, 1);
      selectedEmailId = emails[0]?.id || "";
      renderMail();
    });
  }

  function renderSandbox() {
    const body = sandboxWindow.querySelector(".socmail-body");
    body.innerHTML = `
      <p>Перетащи сюда синтетическое вложение из SOC Mail или выбери письмо и нажми «Передать вложение».</p>
      <div class="socmail-dropzone" data-sandbox-drop>
        Зона анализа Sandbox
      </div>
      <div data-sandbox-results>
        ${analyzed.size ? "" : `<p>Ожидание учебного вложения.</p>`}
      </div>
      <p><small>Анализ только имитируется. Файлы, команды и сетевые соединения не запускаются.</small></p>
    `;

    const zone = body.querySelector("[data-sandbox-drop]");
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", event => {
      event.preventDefault();
      zone.classList.remove("dragover");
      let payload = selectedAttachment;
      try {
        payload = JSON.parse(event.dataTransfer?.getData("text/plain") || "null") || payload;
      } catch (_) { /* Используем выбранное вложение из учебного состояния. */ }
      if (payload?.name) analyzeAttachment(payload);
    });

    for (const name of analyzed) showFindings(name);
  }

  function showFindings(name) {
    const results = sandboxWindow?.querySelector("[data-sandbox-results]");
    if (!results || results.querySelector(`[data-result="${CSS.escape(name)}"]`)) return;

    const card = document.createElement("article");
    card.className = "socmail-finding";
    card.dataset.result = name;
    card.innerHTML = `
      <strong>Отчёт анализа: ${name}</strong>
      <ul>
        <li>Процесс: условный Office → PowerShell; команда не исполнялась.</li>
        <li>Сеть: учебный индикатор c2.training.test; запрос не отправлялся.</li>
        <li>Файл: виртуальный артефакт report-copy.training.txt; диск не изменялся.</li>
      </ul>
    `;
    results.append(card);
  }

  function analyzeAttachment(file) {
    if (!file?.name || analyzed.has(file.name)) {
      if (file?.name) showFindings(file.name);
      return;
    }

    analyzed.add(file.name);
    showFindings(file.name);

    emit(
      "Вложение передано в учебную Sandbox",
      `Начат синтетический анализ вложения ${file.name}.`,
      "suspicious",
      "Sandbox",
      "mail.sandbox.submission",
      "Вложение передано на учебный анализ",
      file.name
    );

    const findings = [
      ["Обнаружена условная цепочка процессов", "Office условно породил PowerShell; команды не выполнялись.", "dangerous", "sandbox.process.chain", "Office → PowerShell"],
      ["Зафиксирован учебный сетевой индикатор", "Домен c2.training.test указан только в сценарии; соединения не было.", "dangerous", "sandbox.network.indicator", "Условный сетевой индикатор"],
      ["Обнаружен учебный файловый артефакт", "report-copy.training.txt существует только в отчёте симуляции.", "suspicious", "sandbox.file.artifact", "Виртуальный файловый артефакт"]
    ];

    findings.forEach(([title, detail, severity, ruleId, ruleTitle], index) => {
      window.setTimeout(() => {
        emit(title, detail, severity, index === 1 ? "Сеть" : index === 2 ? "Файл" : "Процесс",
          ruleId, ruleTitle, file.name);
      }, 500 * (index + 1));
    });
  }

  function ensureLaunchers() {
    const id = deviceIdFromDesktop();
    if (!id || clientScreen.hidden) return;
    activeDeviceId = id;

    let launchers = desktop.querySelector(".socmail-launchers");
    if (!launchers) {
      launchers = document.createElement("div");
      launchers.className = "socmail-launchers";
      launchers.innerHTML = `
        <button type="button" data-open-socmail>✉️ SOC Mail</button>
        <button type="button" data-open-sandbox>🧪 Sandbox</button>
      `;
      desktop.append(launchers);
      launchers.querySelector("[data-open-socmail]").addEventListener("click", openMail);
      launchers.querySelector("[data-open-sandbox]").addEventListener("click", openSandbox);

      emit(
        "Открыт учебный почтовый ящик",
        "SOC Mail доступна в локальной синтетической среде.",
        "normal",
        "Почта",
        "mail.training.open",
        "Открытие учебной почты"
      );

      window.setTimeout(() => {
        if (deliveredUnknown || !document.body.contains(desktop)) return;
        deliveredUnknown = true;
        emit(
          "Получено письмо от неизвестного отправителя",
          "В учебном ящике появилось письмо со ссылкой и синтетическим DOCX-вложением.",
          "suspicious",
          "Почта",
          "mail.unknown.sender",
          "Письмо от неизвестного отправителя"
        );
      }, 60000);
    }
  }

  const observer = new MutationObserver(ensureLaunchers);
  observer.observe(clientScreen, { attributes: true, attributeFilter: ["hidden"] });
  ensureLaunchers();
})();