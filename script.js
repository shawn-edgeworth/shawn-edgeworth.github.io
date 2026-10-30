const DEFAULT_TAB = "about";
const tabs = document.querySelectorAll("[data-tab]");
const panels = {
  about: document.getElementById("panel-about"),
  repositories: document.getElementById("panel-repositories"),
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url) {
  const value = String(url).trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(value)) {
    return value;
  }
  return "#";
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, label, href) =>
        `<a href="${escapeHtml(safeUrl(href))}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) {
      return;
    }
    html.push(
      `<${list.tag}>${list.items
        .map((item) => `<li>${inlineMarkdown(item)}</li>`)
        .join("")}</${list.tag}>`
    );
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph();
      flushList();
      html.push("<hr />");
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!list || list.tag !== "ul") {
        flushList();
        list = { tag: "ul", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.tag !== "ol") {
        flushList();
        list = { tag: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

function showTab(name) {
  const tabName = panels[name] ? name : DEFAULT_TAB;

  tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  Object.entries(panels).forEach(([key, panel]) => {
    const active = key === tabName;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  if (window.location.hash.replace("#", "") !== tabName) {
    history.replaceState(null, "", `#${tabName}`);
  }
}

function bindShot(slot, src, alt) {
  const img = slot.querySelector("img");
  if (!src || !img) {
    return;
  }

  img.alt = alt;
  img.addEventListener("load", () => slot.classList.add("has-image"));
  img.addEventListener("error", () => slot.classList.remove("has-image"));
  img.src = src;
}

function renderProjects(projects) {
  const list = document.getElementById("repo-list");
  const counter = document.getElementById("repo-count");
  counter.textContent = String(projects.length);

  list.innerHTML = projects
    .map((project) => {
      const name = escapeHtml(project.name || "repository");
      const url = escapeHtml(safeUrl(project.url || "#"));
      const description = escapeHtml(project.description || "");
      const image = escapeHtml(project.image || "");
      const visibility = escapeHtml(project.visibility || "Public");
      const language = escapeHtml(project.language || "");
      const languageColor = escapeHtml(project.languageColor || "#8b949e");

      return `
        <li class="repo-card">
          <div class="repo-head">
            <a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>
            <span class="label">${visibility}</span>
          </div>
          <p class="repo-desc">${description}</p>
          <div class="repo-shot" data-image="${image}">
            <img alt="Скриншот ${name}" />
            <p class="shot-empty">${image || "images/screenshot.png"}</p>
          </div>
          <p class="repo-meta">
            <span class="lang"><i style="background: ${languageColor}"></i> ${language}</span>
          </p>
        </li>
      `;
    })
    .join("");

  list.querySelectorAll(".repo-shot").forEach((slot) => {
    bindShot(slot, slot.dataset.image, slot.querySelector("img")?.alt || "");
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
});

window.addEventListener("hashchange", () => {
  showTab(window.location.hash.replace("#", ""));
});

showTab(window.location.hash.replace("#", "") || DEFAULT_TAB);

async function loadSite() {
  const aboutEl = document.getElementById("about-content");

  try {
    const config = await fetch("projects.json").then((response) => {
      if (!response.ok) {
        throw new Error("projects.json");
      }
      return response.json();
    });

    renderProjects(config.projects || []);

    const aboutPath = config.about || "about.md";
    const markdown = await fetch(aboutPath).then((response) => {
      if (!response.ok) {
        throw new Error(aboutPath);
      }
      return response.text();
    });

    aboutEl.innerHTML = renderMarkdown(markdown);
  } catch (error) {
    aboutEl.innerHTML =
      "<p>Не удалось загрузить данные. Откройте сайт через локальный сервер или GitHub Pages, не как файл.</p>";
    console.error(error);
  }
}

loadSite();
