(function (root, factory) {
  "use strict";

  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.SocSiemEngine = engine;
})(typeof globalThis === "undefined" ? this : globalThis, function () {
  "use strict";

  const profileApplications = {
    normal: {
      name: "Office Suite",
      description: "Рабочие документы и проверка вложенных макросов.",
      actions: [
        { id: "office-template", label: "Проверить внешний шаблон", severity: "suspicious", title: "Внешний шаблон документа заблокирован", detail: "Шаблон запросил недоверенный источник; симулятор заблокировал загрузку.", ruleId: "office.external-template", ruleTitle: "Загрузка внешнего шаблона", ruleDescription: "Документ пытался получить шаблон из недоверенного источника." },
        { id: "office-unsigned-macro-review", label: "Проверить неподписанный макрос", severity: "suspicious", title: "Обнаружен неподписанный макрос", detail: "Проверка безопасности поместила макрос в карантин; код не исполнялся.", ruleId: "office.unsigned-macro", ruleTitle: "Неподписанный макрос", ruleDescription: "Сценарий отмечен как потенциально рискованный и остановлен." },
        { id: "office-unsigned-macro-run", label: "Симулировать запуск макроса", severity: "dangerous", title: "Запуск макроса остановлен", detail: "Симулятор выявил небезопасное действие. Реальный код не запускался.", ruleId: "office.blocked-macro-run", ruleTitle: "Попытка запуска макроса", ruleDescription: "Запуск остановлен политикой учебного рабочего места." }
      ]
    },
    vpn: {
      name: "Sales Dashboard",
      description: "Рабочая панель отдела продаж с учебными сценариями контроля доступа.",
      actions: [
        { id: "sales-off-hours", label: "Проверить вход вне рабочего времени", severity: "suspicious", title: "Вход в панель вне рабочего времени", detail: "Синтетическое событие для расследования; внешний вход не выполнялся.", ruleId: "sales.off-hours-login", ruleTitle: "Вход вне рабочего времени", ruleDescription: "Учебный профиль отметил нетипичное время доступа." },
        { id: "sales-export", label: "Запросить массовый экспорт", severity: "suspicious", title: "Массовый экспорт данных ограничен", detail: "Экспорт остановлен в учебной среде; реальные данные не выгружались.", ruleId: "sales.bulk-export", ruleTitle: "Массовый экспорт", ruleDescription: "Объём запроса превышает заданный учебный порог." },
        { id: "sales-admin-tunnel", label: "Проверить административный туннель", severity: "dangerous", title: "Несанкционированный туннель заблокирован", detail: "Сценарий заблокирован локально; сетевое соединение не создавалось.", ruleId: "sales.admin-tunnel", ruleTitle: "Несанкционированный туннель", ruleDescription: "Запрошено действие, запрещённое политикой профиля." }
      ]
    },
    redirect: {
      name: "Route Helper",
      description: "Проверка маршрутов и политик разрешения имён в виртуальной сети.",
      actions: [
        { id: "route-dns-mismatch", label: "Проверить несовпадение DNS-политики", severity: "suspicious", title: "Несовпадение DNS-политики", detail: "Синтетический ответ не совпал с учебной политикой; наружный запрос не отправлялся.", ruleId: "route.dns-policy", ruleTitle: "Несовпадение DNS-политики", ruleDescription: "Результат разрешения имени расходится с ожидаемым профилем." },
        { id: "route-rule-change", label: "Проверить запрещённое изменение маршрута", severity: "suspicious", title: "Изменение маршрута требует проверки", detail: "Изменение отклонено до применения; системные маршруты не менялись.", ruleId: "route.rule-change", ruleTitle: "Изменение маршрута", ruleDescription: "Пользователь запросил изменение вне разрешённой политики." },
        { id: "route-override", label: "Симулировать обход маршрутизации", severity: "dangerous", title: "Обход маршрутизации заблокирован", detail: "Опасный сценарий остановлен симулятором; реальная сеть не затронута.", ruleId: "route.policy-bypass", ruleTitle: "Обход сетевой политики", ruleDescription: "Попытка изменить поведение учебной маршрутизации." }
      ]
    },
    miner: {
      name: "Compute Worker",
      description: "Учебная панель фоновых задач и контроля ресурсов.",
      actions: [
        { id: "compute-threshold", label: "Проверить превышение порога CPU", severity: "suspicious", title: "Повышенная нагрузка CPU", detail: "Имитированное превышение порога отображено для расследования.", ruleId: "compute.cpu-threshold", ruleTitle: "Повышенная нагрузка CPU", ruleDescription: "Учебный показатель нагрузки превысил профильный порог." },
        { id: "compute-autostart", label: "Проверить неизвестную задачу автозапуска", severity: "suspicious", title: "Неизвестная задача автозапуска", detail: "Задача помещена в карантин симуляции; автозапуск ОС не менялся.", ruleId: "compute.unknown-autostart", ruleTitle: "Неизвестный автозапуск", ruleDescription: "Неизвестная задача требует проверки аналитиком." },
        { id: "compute-hidden-worker", label: "Симулировать скрытую вычислительную задачу", severity: "dangerous", title: "Скрытая вычислительная задача остановлена", detail: "Сценарий помечен как опасный и остановлен; вычисления не запускались.", ruleId: "compute.hidden-worker", ruleTitle: "Скрытая вычислительная задача", ruleDescription: "Неизвестная фоновая задача пытается использовать ресурсы." }
      ]
    }
  };

  function alertIdForEvent(event) {
    const ruleId = event.ruleId || `event:${event.id}`;
    return `${event.deviceId || "unknown"}:${ruleId}`;
  }

  function buildAlerts(events, devices, cases = {}) {
    const deviceById = new Map(devices.map(device => [device.id, device]));
    const grouped = new Map();

    for (const event of events) {
      if (!["normal", "suspicious", "dangerous"].includes(event.severity)) continue;
      const id = alertIdForEvent(event);
      const alert = grouped.get(id) || {
        id,
        ruleId: event.ruleId || `event:${event.id}`,
        title: event.ruleTitle || event.title,
        description: event.ruleDescription || event.detail,
        severity: event.severity,
        device: deviceById.get(event.deviceId) || null,
        events: [],
        timestamp: event.timestamp
      };
      alert.events.push(event);
      alert.timestamp = Math.max(alert.timestamp, event.timestamp);
      grouped.set(id, alert);
    }

    return [...grouped.values()]
      .map(alert => ({
        ...alert,
        events: alert.events.sort((left, right) => left.timestamp - right.timestamp),
        caseRecord: cases[alert.id] || { status: "new", note: "", updatedAt: 0 }
      }))
      .sort((left, right) => right.timestamp - left.timestamp);
  }

  return { alertIdForEvent, buildAlerts, profileApplications };
});
