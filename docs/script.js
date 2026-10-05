(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const USERS_KEY = "pulse_users";   // { username: { likes: [keys], saved: [stories] } }
  const CURRENT_KEY = "pulse_current";

  const store = new Map(); // key -> story, used when saving
  let allNews = [];
  let posts = [];
  let category = "top";
  let view = "home";

  // ---------- Browser storage (our "database") ----------
  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch (e) { return {}; }
  }
  let db = readUsers();
  let me = "";
  try { me = localStorage.getItem(CURRENT_KEY) || ""; } catch (e) { me = ""; }
  if (me && !db[me]) me = "";

  function persist() {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(db));
      localStorage.setItem(CURRENT_KEY, me);
    } catch (e) { /* storage blocked: keep working in memory */ }
  }

  function likeCount(key) {
    return Object.values(db).filter((u) => u.likes.includes(key)).length;
  }

  function withState(s) {
    const u = db[me];
    return Object.assign({}, s, {
      likes: likeCount(s.key),
      liked: !!u && u.likes.includes(s.key),
      saved: !!u && u.saved.some((x) => x.key === s.key)
    });
  }

  // ---------- Helpers ----------
  function escapeHtml(value) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value).replace(/[&<>"']/g, (ch) => map[ch]);
  }

  function safeUrl(u) {
    return /^https?:\/\//i.test(u || "") ? u : "";
  }

  function timeAgo(iso) {
    const secs = (Date.now() - new Date(iso)) / 1000;
    if (isNaN(secs)) return "";
    if (secs < 3600) return Math.max(1, Math.round(secs / 60)) + " min ago";
    if (secs < 86400) return Math.round(secs / 3600) + " h ago";
    return Math.round(secs / 86400) + " d ago";
  }

  // ---------- Cards ----------
  function cardHtml(s) {
    store.set(s.key, s);
    const key = escapeHtml(s.key);
    const link = safeUrl(s.link);
    const image = safeUrl(s.image);
    const title = link
      ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(s.title) + "</a>"
      : escapeHtml(s.title);
    return (
      '<article class="post">' +
      (image ? '<img class="thumb" src="' + escapeHtml(image) + '" alt="" loading="lazy">' : "") +
      '<div class="post-meta"><span class="tag">' + escapeHtml(s.category) + "</span>" +
      '<time class="post-date">' + escapeHtml(timeAgo(s.published)) + "</time></div>" +
      "<h3>" + title + "</h3>" +
      "<p>" + escapeHtml(s.summary) + "</p>" +
      '<span class="source">' + escapeHtml(s.source || "") + "</span>" +
      '<div class="actions">' +
      '<button type="button" class="act' + (s.liked ? " on" : "") + '" data-act="like" data-key="' + key + '">&hearts; <span>' + s.likes + "</span></button>" +
      '<button type="button" class="act' + (s.saved ? " on" : "") + '" data-act="save" data-key="' + key + '">' + (s.saved ? "Saved" : "Save") + "</button>" +
      "</div></article>"
    );
  }

  function renderInto(el, items, emptyText) {
    el.innerHTML = items.length
      ? items.map((s) => cardHtml(withState(s))).join("")
      : '<p class="section-intro">' + escapeHtml(emptyText) + "</p>";
  }

  // ---------- Views ----------
  function showView(name) {
    view = name;
    document.querySelectorAll("[data-view]").forEach((el) => {
      el.classList.toggle("hidden", el.dataset.view !== name);
    });
    if (name === "saved") renderSaved();
    if (name === "profile") renderProfile();
    window.scrollTo(0, 0);
  }

  function updateNav() {
    $("nav-profile").textContent = me || "Sign in";
  }

  function renderHome() {
    showLive();
    renderPicks();
  }

  function showLive() {
    const q = $("search").value.trim().toLowerCase();
    let list = category === "top" ? allNews.slice(0, 30) : allNews.filter((s) => s.category === category);
    if (q) list = allNews.filter((s) => (category === "top" || s.category === category) && (s.title + " " + s.summary).toLowerCase().includes(q));
    renderInto($("live-feed"), list, q ? "No stories match your search." : "No stories available right now.");
  }

  function renderPicks() {
    renderInto($("feed"), posts.map((p) => ({
      key: "post:" + p.id, title: p.title, summary: p.content, link: "", image: "",
      published: p.created_at, category: p.category, source: "Editor's pick"
    })), "No editor's picks yet.");
  }

  function renderSaved() {
    const feed = $("saved-feed");
    if (!me) {
      $("saved-intro").textContent = "Sign in to save stories and see them here.";
      feed.innerHTML = "";
      return;
    }
    $("saved-intro").textContent = "Hi " + me + ", everything you save shows up here.";
    renderInto(feed, db[me].saved, "Nothing saved yet. Tap Save on any story.");
  }

  function renderProfile() {
    const names = Object.keys(db);
    $("profile-title").textContent = me ? "Signed in as " + me : "Choose a profile";
    $("profile-note").textContent = me ? "" : "Sign in to like and save stories.";
    $("logout-btn").classList.toggle("hidden", !me);
    $("profile-error").classList.add("hidden");
    $("profile-list").innerHTML = names
      .map((n) => '<button type="button" class="tab' + (n === me ? " active" : "") + '" data-name="' + escapeHtml(n) + '">' + escapeHtml(n) + "</button>")
      .join("");
  }

  // ---------- Profiles ----------
  function signIn(name) {
    if (!db[name]) db[name] = { likes: [], saved: [] };
    me = name;
    persist();
    updateNav();
    renderHome();
    showView("home");
  }

  $("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("profile-name").value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
      $("profile-error").classList.remove("hidden");
      return;
    }
    $("profile-name").value = "";
    signIn(name);
  });

  $("profile-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-name]");
    if (btn) signIn(btn.dataset.name);
  });

  $("logout-btn").addEventListener("click", () => {
    me = "";
    persist();
    updateNav();
    renderHome();
    showView("home");
  });

  // ---------- Like / Save ----------
  function toggle(kind, key) {
    if (!me) { showView("profile"); return null; }
    const u = db[me];
    let active;
    if (kind === "like") {
      const i = u.likes.indexOf(key);
      active = i < 0;
      if (active) u.likes.push(key); else u.likes.splice(i, 1);
    } else {
      const i = u.saved.findIndex((s) => s.key === key);
      active = i < 0;
      if (active) {
        const s = store.get(key) || {};
        u.saved.unshift({
          key: key, title: s.title, summary: s.summary, link: s.link, image: s.image,
          published: s.published, category: s.category, source: s.source
        });
      } else {
        u.saved.splice(i, 1);
      }
    }
    persist();
    return active;
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".act");
    if (!btn) return;
    const key = btn.dataset.key;
    const kind = btn.dataset.act;
    const active = toggle(kind, key);
    if (active === null) return;

    document.querySelectorAll(".act").forEach((b) => {
      if (b.dataset.key !== key || b.dataset.act !== kind) return;
      b.classList.toggle("on", active);
      if (kind === "like") b.querySelector("span").textContent = likeCount(key);
      else b.textContent = active ? "Saved" : "Save";
    });
    if (kind === "save" && !active && view === "saved") renderSaved();
  });

  // ---------- Data files (written by GitHub, read here) ----------
  async function loadNews() {
    try {
      const res = await fetch("data/news.json?t=" + Date.now());
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      allNews = (data.items || []).map((s) => Object.assign({}, s, { key: s.link }));
      $("live-status").textContent = allNews.length
        ? "Updated " + timeAgo(data.updated) + ". GitHub refreshes the news about every 15 minutes."
        : 'No stories yet. Run the "Update news" workflow once from the repository\'s Actions tab.';
      showLive();
    } catch (err) {
      $("live-status").textContent = "Could not load stories. Try refreshing the page.";
    }
  }

  async function loadPosts() {
    try {
      const res = await fetch("data/posts.json");
      if (!res.ok) throw new Error("Request failed");
      posts = await res.json();
      renderPicks();
    } catch (err) {
      $("feed").innerHTML = '<p class="error-msg">Could not load editor\'s picks.</p>';
    }
  }

  // ---------- Wiring ----------
  $("home-link").addEventListener("click", () => showView("home"));
  $("nav-saved").addEventListener("click", () => showView("saved"));
  $("nav-profile").addEventListener("click", () => showView("profile"));

  $("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cat]");
    if (!btn) return;
    category = btn.dataset.cat;
    $("tabs").querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
    showLive();
  });
  $("search").addEventListener("input", showLive);
  $("live-feed").addEventListener("error", (e) => {
    if (e.target.tagName === "IMG") e.target.remove(); // hide broken thumbnails
  }, true);

  updateNav();
  loadNews();
  loadPosts();
  setInterval(loadNews, 5 * 60 * 1000);
})();
