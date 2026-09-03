(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const progress = document.querySelector(".reading-progress span");
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".site-nav");
  const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  // Every image has a designed fallback until the matching file is added to /img.
  document.querySelectorAll("[data-image-slot]").forEach((slot) => {
    const image = slot.querySelector("[data-slot-image]");
    if (!image) return;

    const markLoaded = () => slot.classList.remove("is-missing");
    const markMissing = () => slot.classList.add("is-missing");

    image.addEventListener("load", markLoaded);
    image.addEventListener("error", markMissing);

    if (image.complete) {
      image.naturalWidth > 0 ? markLoaded() : markMissing();
    }
  });

  // Reveal copy and frames as the reader moves through each chapter.
  const revealItems = document.querySelectorAll(".reveal");
  revealItems.forEach((item) => {
    const delay = item.dataset.delay;
    if (delay) item.style.setProperty("--reveal-delay", `${delay}ms`);
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6%" }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const closeMenu = () => {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
    body.classList.remove("menu-open");
  };

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const willOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(willOpen));
      navigation.classList.toggle("is-open", willOpen);
      body.classList.toggle("menu-open", willOpen);
    });

    navLinks.forEach((link) => link.addEventListener("click", closeMenu));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) closeMenu();
    });
  }

  // One scroll listener updates both reading progress and the active chapter.
  let ticking = false;
  const updateScrollState = () => {
    const scrollable = root.scrollHeight - window.innerHeight;
    const percentage = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    if (progress) progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;

    const marker = window.scrollY + window.innerHeight * 0.35;
    let activeId = "";
    sections.forEach((section) => {
      if (section.offsetTop <= marker) activeId = section.id;
    });

    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${activeId}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });

    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateScrollState);
    },
    { passive: true }
  );

  updateScrollState();
})();
