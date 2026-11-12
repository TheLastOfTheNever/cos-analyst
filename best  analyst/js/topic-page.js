(function () {
  const topicId = new URLSearchParams(window.location.search).get("topic");
  const topic = window.SOC_TOPIC_CONTENT && window.SOC_TOPIC_CONTENT[topicId];
  const content = document.getElementById("topic-content");
  const toc = document.getElementById("topic-toc");

  if (!topic) {
    document.title = "Тема не найдена — SOC Academy";
    document.getElementById("topic-title").textContent = "Учебная тема не найдена";
    document.getElementById("topic-lead").textContent = "Выбери тему в меню соответствующего раздела.";
    const message = document.createElement("p");
    message.className = "note";
    message.textContent = "Ссылка ведёт на неизвестную тему. Вернись в раздел и выбери материал из списка.";
    content.appendChild(message);
    return;
  }

  document.title = topic.title + " — SOC Academy";
  document.getElementById("topic-category").textContent = topic.category;
  document.getElementById("topic-title").textContent = topic.title;
  document.getElementById("topic-lead").textContent = topic.lead;
  document.getElementById("topic-back").href = topic.categoryPage;
  document.getElementById("topic-back").textContent = "К разделу «" + topic.category + "»";

  topic.sections.forEach((section, index) => {
    const id = "topic-section-" + (index + 1);
    const article = document.createElement("article");
    article.className = "lesson";
    article.id = id;

    const heading = document.createElement("h2");
    heading.textContent = section.title;
    article.appendChild(heading);

    const paragraph = document.createElement("p");
    paragraph.textContent = section.text;
    article.appendChild(paragraph);

    if (section.points && section.points.length) {
      const list = document.createElement("ul");
      section.points.forEach((point) => {
        const item = document.createElement("li");
        item.textContent = point;
        list.appendChild(item);
      });
      article.appendChild(list);
    }

    if (section.note) {
      const note = document.createElement("div");
      note.className = "tip";
      note.textContent = section.note;
      article.appendChild(note);
    }

    content.appendChild(article);

    const tocLink = document.createElement("a");
    tocLink.href = "#" + id;
    tocLink.textContent = section.title;
    toc.appendChild(tocLink);
  });

  if (topic.related && topic.related.length) {
    const related = document.createElement("article");
    related.className = "lesson";
    const heading = document.createElement("h2");
    heading.textContent = "Связанные материалы";
    related.appendChild(heading);
    const actions = document.createElement("div");
    actions.className = "actions";
    topic.related.forEach((item) => {
      const link = document.createElement("a");
      link.className = "btn ghost";
      link.href = item.href;
      link.textContent = item.label;
      actions.appendChild(link);
    });
    related.appendChild(actions);
    content.appendChild(related);
  }
})();
