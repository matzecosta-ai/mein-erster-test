/* paperorbit Studio – Skript */

/* ================================================================
   PROJEKTE – hier pflegst du dein Portfolio.
   kategorie: "schnitt", "ki" oder "post"
   bild:  optional, z. B. "media/projekt1.jpg"  (sonst Platzhalter-Grafik)
   video: optional, z. B. "media/projekt1.mp4"  (Klick spielt es ab)
   ================================================================ */
const PROJEKTE = [
  { titel: "Nachtfahrt",          kunde: "Musikvideo · Band XY",        kategorie: "schnitt", farben: ["#2b2550", "#ff5a36"] },
  { titel: "Die Papierstadt",     kunde: "KI-Kurzfilm · eigenes Projekt", kategorie: "ki",      farben: ["#3b5bdb", "#f2b134"] },
  { titel: "Herbstkollektion",    kunde: "Werbespot · Modelabel",       kategorie: "post",    farben: ["#7a3b2e", "#f4ecdf"] },
  { titel: "Zwischen den Zeilen", kunde: "Dokumentarfilm · 52 min",     kategorie: "schnitt", farben: ["#1f1b2e", "#8fa3c9"] },
  { titel: "Orbit 01",            kunde: "KI-Visuals · Festival",       kategorie: "ki",      farben: ["#ff5a36", "#2b2550"] },
  { titel: "Kaffeeland",          kunde: "Imagefilm + Social Cuts",     kategorie: "post",    farben: ["#4d3a2a", "#f2b134"] },
];

const KATEGORIE_NAME = { schnitt: "Schnitt", ki: "KI-Video", post: "Postproduktion" };

/* Platzhalter-Grafik im Papierschnitt-Stil, falls (noch) kein Bild da ist */
function platzhalter(p, i) {
  const [a, b] = p.farben;
  const id = "g" + i;
  const motive = [
    `<circle cx="110" cy="46" r="18" fill="${b}"/><path d="M0 76 Q40 56 80 70 T160 64 V100 H0Z" fill="#1f1b2e" opacity=".85"/>`,
    `<g fill="#fbf6ee" opacity=".9"><rect x="30" y="50" width="16" height="40"/><rect x="50" y="34" width="20" height="56"/><rect x="74" y="44" width="14" height="46"/><rect x="92" y="26" width="22" height="64"/><rect x="118" y="54" width="14" height="36"/></g><ellipse cx="80" cy="30" rx="60" ry="10" fill="none" stroke="${b}" stroke-width="2" stroke-dasharray="4 3"/>`,
    `<path d="M40 100 Q60 30 80 30 T120 100Z" fill="${b}" opacity=".9"/><circle cx="80" cy="26" r="10" fill="#1f1b2e"/>`,
    `<g stroke="${b}" stroke-width="2" fill="none" opacity=".8"><path d="M20 30h120M20 44h96M20 58h112M20 72h70"/></g>`,
    `<circle cx="80" cy="50" r="20" fill="${b}"/><ellipse cx="80" cy="50" rx="44" ry="12" fill="none" stroke="#fbf6ee" stroke-width="2.5" transform="rotate(-18 80 50)"/><circle cx="126" cy="36" r="4" fill="#fbf6ee"/>`,
    `<path d="M0 70 Q30 50 60 64 T120 58 T160 60 V100 H0Z" fill="${b}" opacity=".7"/><path d="M0 84 Q40 70 90 80 T160 78 V100 H0Z" fill="#1f1b2e" opacity=".8"/><circle cx="40" cy="34" r="12" fill="#fbf6ee" opacity=".8"/>`,
  ];
  return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${a}" stop-opacity=".75"/></linearGradient></defs>
    <rect width="160" height="100" fill="url(#${id})"/>${motive[i % motive.length]}</svg>`;
}

function renderProjekte() {
  const grid = document.getElementById("project-grid");
  grid.innerHTML = PROJEKTE.map((p, i) => `
    <article class="project reveal" data-kat="${p.kategorie}" ${p.video ? `data-video="${p.video}" tabindex="0" role="button"` : ""}>
      <div class="thumb">${p.bild ? `<img src="${p.bild}" alt="${p.titel}" loading="lazy">` : platzhalter(p, i)}</div>
      <div class="meta">
        <span class="tag">${KATEGORIE_NAME[p.kategorie] || p.kategorie}</span>
        <h3>${p.titel}</h3>
        <p>${p.kunde}</p>
      </div>
    </article>`).join("");
}

/* Filter */
function setupFilter() {
  const buttons = document.querySelectorAll("[data-filter]");
  buttons.forEach(btn => btn.addEventListener("click", () => {
    buttons.forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    const f = btn.dataset.filter;
    document.querySelectorAll(".project").forEach(el => {
      el.classList.toggle("hidden", f !== "alle" && el.dataset.kat !== f);
    });
  }));
}

/* Video-Overlay */
function setupLightbox() {
  const box = document.querySelector(".lightbox");
  const video = box.querySelector("video");
  const missing = box.querySelector(".missing");
  const close = box.querySelector(".close");

  function open(src) {
    missing.hidden = true;
    video.hidden = false;
    video.src = src;
    box.classList.add("open");
    document.body.style.overflow = "hidden";
    video.play().catch(() => {});
    close.focus();
  }
  function shut() {
    box.classList.remove("open");
    video.pause();
    video.removeAttribute("src");
    video.load();
    document.body.style.overflow = "";
  }
  video.addEventListener("error", () => { video.hidden = true; missing.hidden = false; });

  document.querySelectorAll("[data-open-reel]").forEach(el =>
    el.addEventListener("click", () => open("media/showreel.mp4")));
  document.addEventListener("click", e => {
    const card = e.target.closest(".project[data-video]");
    if (card) open(card.dataset.video);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && box.classList.contains("open")) shut();
    const card = e.target.closest && e.target.closest(".project[data-video]");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(card.dataset.video); }
  });
  close.addEventListener("click", shut);
  box.addEventListener("click", e => { if (e.target === box) shut(); });
}

/* Logo-Intro auf der Startseite */
function setupIntro() {
  const v = document.querySelector(".intro-video");
  if (!v) return;
  const sound = document.querySelector("[data-intro-sound]");
  const replay = document.querySelector("[data-intro-replay]");
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Bei "Bewegung reduzieren" nicht automatisch abspielen: das Logo-Standbild (poster) bleibt stehen.
  if (ruhig) { v.removeAttribute("autoplay"); v.pause(); }

  function abspielen() { v.currentTime = 0; v.play().catch(() => {}); }
  sound.addEventListener("click", () => {
    v.muted = !v.muted;
    sound.setAttribute("aria-pressed", String(!v.muted));
    sound.querySelector("span").textContent = v.muted ? "Ton an" : "Ton aus";
    if (!v.muted && (v.ended || v.paused)) abspielen();
  });
  replay.addEventListener("click", abspielen);
}

/* Mobiles Menü */
function setupMenu() {
  const btn = document.querySelector(".menu-btn");
  const nav = document.getElementById("nav");
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
  nav.addEventListener("click", e => {
    if (e.target.tagName === "A") { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
  });
}

/* Einblenden beim Scrollen */
function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("in")); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: .12 });
  els.forEach(el => io.observe(el));
}

renderProjekte();
setupFilter();
setupLightbox();
setupIntro();
setupMenu();
setupReveal();
document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
