(() => {
  "use strict";

  const galleryEl = document.getElementById("gallery");
  const emptyStateEl = document.getElementById("empty-state");
  const statsEl = document.getElementById("stats");
  const lastSyncEl = document.getElementById("last-sync");
  const filterButtons = document.querySelectorAll(".filter-btn");

  const modal = document.getElementById("modal");
  const modalVisual = document.getElementById("modal-visual");
  const modalId = document.getElementById("modal-id");
  const modalTitle = document.getElementById("modal-title");
  const modalMeta = document.getElementById("modal-meta");
  const modalDesc = document.getElementById("modal-desc");
  const modalTags = document.getElementById("modal-tags");

  let allEntries = [];
  let activeCategory = "all";

  const CATEGORY_LABEL = {
    corridor: "廊下",
    indoor: "屋内",
    outdoor: "屋外",
    night: "夜間",
  };

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  function render() {
    const filtered =
      activeCategory === "all"
        ? allEntries
        : allEntries.filter((e) => e.category === activeCategory);

    galleryEl.innerHTML = "";
    emptyStateEl.hidden = filtered.length !== 0;

    const frag = document.createDocumentFragment();
    for (const entry of filtered) {
      frag.appendChild(buildCard(entry));
    }
    galleryEl.appendChild(frag);
  }

  function buildCard(entry) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", entry.title);

    const label = entry.categoryLabel || CATEGORY_LABEL[entry.category] || entry.category;

    card.innerHTML = `
      <div class="card-visual">
        <img src="${entry.visual}" alt="${entry.title}" loading="lazy" />
        <span class="card-category-tag">${label}</span>
        <span class="card-id">${entry.id}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${entry.title}</h3>
        <p class="card-desc">${entry.description}</p>
        <div class="card-meta">
          <span>${formatDate(entry.recordedAt)}</span>
        </div>
      </div>
    `;

    const open = () => openModal(entry);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        open();
      }
    });

    return card;
  }

  function openModal(entry) {
    const label = entry.categoryLabel || CATEGORY_LABEL[entry.category] || entry.category;
    modalVisual.innerHTML = `<img src="${entry.visual}" alt="${entry.title}" />`;
    modalId.textContent = `${entry.id} / ${label}`;
    modalTitle.textContent = entry.title;
    modalMeta.textContent = `記録日時: ${formatDate(entry.recordedAt)}`;
    modalDesc.textContent = entry.description;
    modalTags.innerHTML = (entry.tags || [])
      .map((t) => `<span>#${t}</span>`)
      .join("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  modal.addEventListener("click", (ev) => {
    if (ev.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !modal.hidden) closeModal();
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeCategory = btn.dataset.category;
      render();
    });
  });

  async function loadData() {
    try {
      const res = await fetch("data/spaces.json", { cache: "no-store" });
      const raw = await res.json();
      const entries = Array.isArray(raw) ? raw : raw.entries || [];
      allEntries = entries.slice().sort(
        (a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)
      );

      const counts = allEntries.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + 1;
        return acc;
      }, {});

      statsEl.textContent = `TOTAL RECORDS: ${allEntries.length}  |  ${Object.entries(
        counts
      )
        .map(([k, v]) => `${CATEGORY_LABEL[k] || k}: ${v}`)
        .join("  /  ")}`;

      if (!Array.isArray(raw) && raw.updatedAt) {
        lastSyncEl.textContent = formatDate(raw.updatedAt);
      } else if (allEntries[0]) {
        lastSyncEl.textContent = formatDate(allEntries[0].recordedAt);
      }

      render();
    } catch (err) {
      galleryEl.innerHTML = "";
      emptyStateEl.hidden = false;
      emptyStateEl.textContent =
        "記録の読み込みに失敗しました。data/spaces.json を確認してください。";
      console.error("[LIMINAL ARCHIVES] failed to load data", err);
    }
  }

  loadData();
})();
