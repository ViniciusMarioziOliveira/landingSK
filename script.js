(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const storage = (area) => ({
    get(key) {
      try {
        return window[area].getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window[area].setItem(key, value);
      } catch {
        /* private mode: the page still works, it just forgets */
      }
    },
  });
  const local = storage("localStorage");
  const session = storage("sessionStorage");

  const toRoman = (number) => {
    const table = [
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let result = "";
    table.forEach(([value, glyph]) => {
      while (number >= value) {
        result += glyph;
        number -= value;
      }
    });
    return result;
  };

  /* ------------------------------------------------------------
     Images: a textured fallback if a file goes missing
     ------------------------------------------------------------ */
  $$("[data-slot-image]").forEach((image) => {
    const holder = image.parentElement;
    const markMissing = () => holder.classList.add("is-missing");
    image.addEventListener("error", markMissing);
    if (image.complete && image.naturalWidth === 0 && image.getAttribute("src")) markMissing();
  });

  /* ------------------------------------------------------------
     Hero title: split into letters so they can rise one by one
     ------------------------------------------------------------ */
  const hero = $("[data-hero]");
  const title = $("#hero-title");
  if (title) title.setAttribute("aria-label", title.textContent.replace(/\s+/g, " ").trim());

  let charIndex = 0;
  $$("[data-split]").forEach((line) => {
    const words = line.textContent.trim().split(/\s+/);
    line.textContent = "";
    line.setAttribute("aria-hidden", "true");
    words.forEach((word, wordIndex) => {
      const wordEl = document.createElement("span");
      wordEl.className = "word";
      [...word].forEach((letter) => {
        const charEl = document.createElement("span");
        charEl.className = "char";
        charEl.textContent = letter;
        charEl.style.setProperty("--i", charIndex++);
        wordEl.append(charEl);
      });
      line.append(wordEl);
      if (wordIndex < words.length - 1) line.append(" ");
    });
  });

  let heroStarted = false;
  const startHero = () => {
    if (heroStarted || !hero) return;
    heroStarted = true;
    void hero.offsetWidth; // commit the hidden state so the entrance transitions run
    hero.classList.add("is-ready");
  };

  /* ------------------------------------------------------------
     Portal: the wax seal cracks and the doors swing open
     ------------------------------------------------------------ */
  const portal = $("[data-portal]");
  if (portal && root.classList.contains("has-portal")) {
    let opened = false;
    // Any attempt to scroll is read as "let me in": it breaks the seal instead of moving the page
    const scrollIntent = (event) => {
      if (event.type === "keydown" && !["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End", "Enter"].includes(event.key)) return;
      event.preventDefault();
      openPortal();
    };
    const intentEvents = ["wheel", "touchmove", "keydown"];
    const openPortal = () => {
      if (opened) return;
      opened = true;
      session.set("kimi-portal", "1");
      portal.classList.add("is-cracking");
      window.setTimeout(() => {
        intentEvents.forEach((type) => window.removeEventListener(type, scrollIntent));
        portal.classList.add("is-open");
        root.classList.remove("is-sealed");
        window.setTimeout(startHero, 450);
        window.setTimeout(() => {
          portal.remove();
          root.classList.remove("has-portal");
        }, 2100);
      }, 480);
    };

    portal.addEventListener("click", openPortal);
    intentEvents.forEach((type) => window.addEventListener(type, scrollIntent, { passive: false }));
    const autoOpen = () => window.setTimeout(openPortal, 1100);
    if (document.readyState === "complete") autoOpen();
    else window.addEventListener("load", autoOpen, { once: true });
    window.setTimeout(openPortal, 4500); // never keep anyone locked out on a slow connection
  } else {
    portal?.remove();
    root.classList.remove("has-portal", "is-sealed");
    startHero();
  }

  /* ------------------------------------------------------------
     Day / night: parchment by daylight, or candlelit
     ------------------------------------------------------------ */
  const themeButton = $("[data-theme-toggle]");
  const themeMeta = $('meta[name="theme-color"]');
  const syncThemeUi = () => {
    const isNight = root.dataset.theme === "night";
    themeButton?.setAttribute("aria-pressed", String(isNight));
    themeButton?.setAttribute("aria-label", isNight ? "Apagar as velas (modo diurno)" : "Acender as velas (modo noturno)");
    themeMeta?.setAttribute("content", isNight ? "#15111a" : "#ebe0c8");
  };
  syncThemeUi();

  themeButton?.addEventListener("click", () => {
    const next = root.dataset.theme === "night" ? "day" : "night";
    root.classList.add("theme-shift");
    root.dataset.theme = next;
    local.set("kimi-theme", next);
    syncThemeUi();
    window.setTimeout(() => root.classList.remove("theme-shift"), 750);
  });

  /* ------------------------------------------------------------
     The school bell, synthesised (no audio file needed)
     ------------------------------------------------------------ */
  const bellButton = $("[data-bell]");
  let audio;
  const ringBell = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audio ||= new AudioContext();
      if (audio.state === "suspended") audio.resume();
      const now = audio.currentTime;
      const master = audio.createGain();
      master.gain.value = 0.2;
      master.connect(audio.destination);

      // Bronze bell partials: hum, prime, tierce, quint, nominal and brighter overtones
      const base = 196;
      [
        [0.5, 0.45, 5.5],
        [1, 0.9, 4.2],
        [1.19, 0.35, 2.8],
        [1.5, 0.28, 2.4],
        [2, 0.42, 2],
        [2.51, 0.18, 1.3],
        [3.01, 0.13, 1],
        [4.15, 0.07, 0.6],
      ].forEach(([ratio, amplitude, duration]) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = base * ratio;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(amplitude, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain).connect(master);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.05);
      });
    }

    bellButton.classList.remove("is-ringing");
    void bellButton.offsetWidth;
    bellButton.classList.add("is-ringing");
  };
  bellButton?.addEventListener("click", ringBell);

  /* ------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------ */
  const menuButton = $(".menu-toggle");
  const navigation = $("#site-nav");
  const closeMenu = () => {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
    root.classList.remove("menu-open");
  };

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const willOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(willOpen));
      navigation.classList.toggle("is-open", willOpen);
      root.classList.toggle("menu-open", willOpen);
    });
    $$("a", navigation).forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1100) closeMenu();
    });
  }

  /* ------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------ */
  const revealItems = $$(".reveal, .reveal-mask, [data-clock]");
  revealItems.forEach((item) => {
    if (item.dataset.delay) item.style.setProperty("--reveal-delay", `${item.dataset.delay}ms`);
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
      { threshold: 0.14, rootMargin: "0px 0px -6%" }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  /* ------------------------------------------------------------
     Clock face with Roman numerals (the hands turn to 02:17)
     ------------------------------------------------------------ */
  const clockFace = $("[data-clock-face]");
  if (clockFace) {
    const ns = "http://www.w3.org/2000/svg";
    const numerals = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const isHour = i % 5 === 0;
      const tick = document.createElementNS(ns, "line");
      const inner = isHour ? 80 : 84;
      tick.setAttribute("x1", 100 + Math.sin(angle) * inner);
      tick.setAttribute("y1", 100 - Math.cos(angle) * inner);
      tick.setAttribute("x2", 100 + Math.sin(angle) * 88);
      tick.setAttribute("y2", 100 - Math.cos(angle) * 88);
      tick.setAttribute("class", "clock__tick");
      tick.setAttribute("stroke-opacity", isHour ? "1" : "0.4");
      clockFace.append(tick);

      if (isHour) {
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", 100 + Math.sin(angle) * 67);
        label.setAttribute("y", 100 - Math.cos(angle) * 67);
        label.setAttribute("class", "clock__numeral");
        label.textContent = numerals[i / 5];
        clockFace.append(label);
      }
    }
  }

  /* ------------------------------------------------------------
     Quote that inks itself word by word as you scroll
     ------------------------------------------------------------ */
  const inkQuote = $("[data-ink]");
  let inkWords = [];
  if (inkQuote && !reduceMotion.matches) {
    const walker = document.createTreeWalker(inkQuote, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((piece) => {
        if (!piece) return;
        if (/^\s+$/.test(piece)) {
          fragment.append(piece);
          return;
        }
        const span = document.createElement("span");
        span.className = "ink-word";
        span.textContent = piece;
        fragment.append(span);
      });
      node.replaceWith(fragment);
    });
    inkWords = $$(".ink-word", inkQuote);
  }

  /* ------------------------------------------------------------
     Ribbon marquee: fill the track with enough copies to loop
     ------------------------------------------------------------ */
  const marquee = $("[data-marquee]");
  let marqueeWidth = 0;
  let marqueeX = 0;
  let marqueeVisible = true;
  const buildMarquee = () => {
    if (!marquee) return;
    const group = $(".ribbon__group", marquee);
    $$(".ribbon__group", marquee).slice(1).forEach((copy) => copy.remove());
    marqueeWidth = group.getBoundingClientRect().width;
    if (!marqueeWidth) return;
    const copies = Math.max(2, Math.ceil((window.innerWidth * 1.2) / marqueeWidth) + 1);
    for (let i = 1; i < copies; i++) marquee.append(group.cloneNode(true));
  };
  buildMarquee();

  /* ------------------------------------------------------------
     Gallery: pinned horizontal corridor on desktop, swipe on mobile
     ------------------------------------------------------------ */
  const gallery = $("[data-gallery]");
  const galleryTrack = $("[data-gallery-track]");
  const galleryViewport = $("[data-gallery-viewport]");
  const galleryCount = $("[data-gallery-count]");
  const galleryItems = $$("[data-gallery-item]");
  const pinQuery = window.matchMedia("(min-width: 900px) and (min-height: 660px)");
  let galleryTravel = 0;
  let lastGalleryIndex = -1;

  const setGalleryProgress = (progress) => {
    if (!gallery) return;
    gallery.style.setProperty("--gallery-progress", progress.toFixed(4));
    const index = Math.round(progress * (galleryItems.length - 1));
    if (index !== lastGalleryIndex && galleryCount) {
      lastGalleryIndex = index;
      galleryCount.textContent = `${toRoman(index + 1)} / ${toRoman(galleryItems.length)}`;
    }
  };

  const layoutGallery = () => {
    if (!gallery || !galleryTrack) return;
    const shouldPin = pinQuery.matches && !reduceMotion.matches;
    gallery.classList.toggle("is-pinned", shouldPin);
    galleryTrack.style.transform = "";
    if (shouldPin) {
      galleryTravel = Math.max(0, galleryTrack.scrollWidth - window.innerWidth);
      gallery.style.height = `${window.innerHeight + galleryTravel}px`;
    } else {
      galleryTravel = 0;
      gallery.style.height = "";
    }
  };

  galleryViewport?.addEventListener(
    "scroll",
    () => {
      if (gallery.classList.contains("is-pinned")) return;
      const max = galleryViewport.scrollWidth - galleryViewport.clientWidth;
      setGalleryProgress(max > 0 ? galleryViewport.scrollLeft / max : 0);
    },
    { passive: true }
  );

  /* ------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------ */
  const lightbox = $("[data-lightbox]");
  const lightboxImage = $("[data-lightbox-img]");
  const lightboxCaption = $("[data-lightbox-caption]");
  const lightboxCount = $("[data-lightbox-count]");
  let lightboxIndex = 0;
  let lightboxOpener = null;

  const showSlide = (index) => {
    lightboxIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[lightboxIndex];
    const image = $("img", item);
    lightboxImage.src = image.currentSrc || image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = item.dataset.caption || "";
    lightboxCount.textContent = `Tabula ${toRoman(lightboxIndex + 1)} / ${toRoman(galleryItems.length)}`;
    // restart the entrance animation for each slide
    lightboxImage.style.animation = "none";
    void lightboxImage.offsetWidth;
    lightboxImage.style.animation = "";
  };

  if (lightbox && typeof lightbox.showModal === "function") {
    galleryItems.forEach((item, index) => {
      item.addEventListener("click", () => {
        lightboxOpener = item;
        showSlide(index);
        lightbox.showModal();
      });
    });

    $("[data-lightbox-prev]", lightbox).addEventListener("click", () => showSlide(lightboxIndex - 1));
    $("[data-lightbox-next]", lightbox).addEventListener("click", () => showSlide(lightboxIndex + 1));
    $("[data-lightbox-close]", lightbox).addEventListener("click", () => lightbox.close());

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") showSlide(lightboxIndex - 1);
      if (event.key === "ArrowRight") showSlide(lightboxIndex + 1);
    });
    lightbox.addEventListener("close", () => lightboxOpener?.focus());

    let swipeStart = null;
    lightbox.addEventListener("pointerdown", (event) => {
      swipeStart = event.clientX;
    });
    lightbox.addEventListener("pointerup", (event) => {
      if (swipeStart === null) return;
      const delta = event.clientX - swipeStart;
      swipeStart = null;
      if (Math.abs(delta) > 50) showSlide(lightboxIndex + (delta < 0 ? 1 : -1));
    });
  }

  /* ------------------------------------------------------------
     Portrait tilt: stained glass catching the light
     ------------------------------------------------------------ */
  if (finePointer.matches && !reduceMotion.matches) {
    $$("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
        card.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
        card.style.setProperty("--gx", `${x * 100}%`);
        card.style.setProperty("--gy", `${y * 100}%`);
      });
      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ------------------------------------------------------------
     Candlelight that follows the pointer in the night chapter
     ------------------------------------------------------------ */
  const candleSection = $("[data-candlelight]");
  if (candleSection && finePointer.matches) {
    candleSection.addEventListener("pointermove", (event) => {
      const rect = candleSection.getBoundingClientRect();
      candleSection.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      candleSection.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  }

  /* ------------------------------------------------------------
     Custom cursor ring (desktop only)
     ------------------------------------------------------------ */
  const cursor = $("[data-cursor]");
  const cursorLabel = $("[data-cursor-label]");
  const pointer = { x: -100, y: -100, cx: -100, cy: -100 };
  const useCursor = cursor && finePointer.matches && !reduceMotion.matches;

  if (useCursor) {
    root.classList.add("has-cursor");
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        cursor.classList.add("is-active");
      },
      { passive: true }
    );
    root.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
    document.addEventListener("pointerover", (event) => {
      const target = event.target.closest("a, button, [data-tilt], [data-cursor-text]");
      const labelTarget = event.target.closest("[data-cursor-text]");
      cursor.classList.toggle("is-hover", Boolean(target) && !labelTarget);
      cursor.classList.toggle("has-label", Boolean(labelTarget));
      cursorLabel.textContent = labelTarget ? labelTarget.dataset.cursorText : "";
    });
  }

  /* ------------------------------------------------------------
     Falling petals over the prologue (as in the flower field)
     ------------------------------------------------------------ */
  const petalCanvas = $("[data-petals]");
  let petalsVisible = true;
  let drawPetals = () => {};

  if (petalCanvas && !reduceMotion.matches && petalCanvas.getContext) {
    const context = petalCanvas.getContext("2d");
    const colors = ["#f3b9c7", "#fbe9e4", "#e690a8", "#f7d2da", "#ffffff"];
    let width = 0;
    let height = 0;
    let petals = [];

    const makePetal = (anywhere) => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : -20 - Math.random() * height * 0.3,
      size: 5 + Math.random() * 8,
      speed: 0.35 + Math.random() * 0.75,
      drift: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.03,
      angle: Math.random() * Math.PI * 2,
      flip: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.55 + Math.random() * 0.4,
    });

    const resizePetals = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = petalCanvas.clientWidth;
      height = petalCanvas.clientHeight;
      petalCanvas.width = width * ratio;
      petalCanvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = width < 700 ? 16 : 30;
      petals = Array.from({ length: count }, () => makePetal(true));
    };
    resizePetals();
    window.addEventListener("resize", resizePetals);

    let wind = 0;
    drawPetals = (time) => {
      context.clearRect(0, 0, width, height);
      const targetWind = useCursor ? (pointer.x / window.innerWidth - 0.5) * 1.2 : 0;
      wind += (targetWind - wind) * 0.02;

      petals.forEach((petal, index) => {
        petal.y += petal.speed;
        petal.x += Math.sin(time / 1400 + petal.phase) * petal.drift + wind;
        petal.angle += petal.spin;
        petal.flip += 0.03;

        if (petal.y > height + 20 || petal.x < -40 || petal.x > width + 40) {
          petals[index] = makePetal(false);
          petals[index].y = -20;
          return;
        }

        context.save();
        context.translate(petal.x, petal.y);
        context.rotate(petal.angle);
        context.scale(1, 0.55 + Math.abs(Math.sin(petal.flip)) * 0.45);
        context.globalAlpha = petal.alpha;
        context.fillStyle = petal.color;
        context.beginPath();
        context.moveTo(0, -petal.size);
        context.bezierCurveTo(petal.size * 0.9, -petal.size * 0.6, petal.size * 0.7, petal.size * 0.7, 0, petal.size);
        context.bezierCurveTo(-petal.size * 0.7, petal.size * 0.7, -petal.size * 0.9, -petal.size * 0.6, 0, -petal.size);
        context.fill();
        context.restore();
      });
    };
  }

  /* ------------------------------------------------------------
     Visibility tracking so offscreen effects stay idle
     ------------------------------------------------------------ */
  const parallaxItems = $$("[data-parallax]");
  const visibleParallax = new Set();

  if ("IntersectionObserver" in window) {
    const effectObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const target = entry.target;
        if (target === petalCanvas) petalsVisible = entry.isIntersecting;
        else if (target === marquee) marqueeVisible = entry.isIntersecting;
        else if (entry.isIntersecting) visibleParallax.add(target);
        else visibleParallax.delete(target);
      });
    });
    if (petalCanvas) effectObserver.observe(petalCanvas);
    if (marquee) effectObserver.observe(marquee);
    parallaxItems.forEach((item) => effectObserver.observe(item));
  } else {
    parallaxItems.forEach((item) => visibleParallax.add(item));
  }

  /* ------------------------------------------------------------
     One animation loop for everything scroll-driven
     ------------------------------------------------------------ */
  const header = $("[data-header]");
  const progressBar = $("[data-progress]");
  const rail = $(".rail");
  const sealTop = $("[data-seal-top]");
  const medallion = $("[data-medallion]");
  const threadPath = $("[data-thread-path]");
  const threadBox = $("[data-thread]");
  const chapterLinks = $$("[data-chapter-link]");
  const chapters = [...new Set(chapterLinks.map((link) => link.getAttribute("href")))]
    .map((id) => document.querySelector(id))
    .filter(Boolean);

  let lastY = -1;
  let lastDirectionY = window.scrollY;
  let viewportH = window.innerHeight;
  let needsUpdate = true;
  let activeId = "";

  const updateScroll = (y) => {
    const scrollable = root.scrollHeight - viewportH;
    const progress = scrollable > 0 ? clamp(y / scrollable, 0, 1) : 0;
    if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
    rail?.style.setProperty("--rail-progress", progress.toFixed(4));

    // Header: condensed after the prologue starts, hidden while reading downward
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      const goingDown = y > lastDirectionY + 4;
      const goingUp = y < lastDirectionY - 4;
      if (goingDown && y > viewportH * 0.6 && !root.classList.contains("menu-open")) header.classList.add("is-hidden");
      if (goingUp || y < 80) header.classList.remove("is-hidden");
      if (goingDown || goingUp) lastDirectionY = y;
    }

    sealTop?.classList.toggle("is-visible", y > viewportH * 0.9);
    medallion?.style.setProperty("--scroll-rot", `${y * 0.08}deg`);

    // Active chapter for both the header nav and the side rail
    const marker = viewportH * 0.4;
    let current = chapters[0]?.id || "";
    chapters.forEach((chapter) => {
      if (chapter.getBoundingClientRect().top <= marker) current = chapter.id;
    });
    if (current !== activeId) {
      activeId = current;
      chapterLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${activeId}`;
        link.classList.toggle("is-active", isActive);
        if (isActive) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }

    // Parallax: measure the frame, move only the picture inside it
    if (!reduceMotion.matches) {
      visibleParallax.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const offset = rect.top + rect.height / 2 - viewportH / 2;
        item.style.setProperty("--py", `${(-offset * Number(item.dataset.parallax || 0.06)).toFixed(1)}px`);
      });
    }

    // Quote ink
    if (inkWords.length) {
      const rect = inkQuote.getBoundingClientRect();
      const amount = clamp((viewportH * 0.85 - rect.top) / (rect.height + viewportH * 0.3), 0, 1);
      const lit = Math.round(amount * inkWords.length);
      inkWords.forEach((word, index) => word.classList.toggle("is-lit", index < lit));
    }

    // Thread between Sheena and Mimi
    if (threadPath && threadBox) {
      const rect = threadBox.getBoundingClientRect();
      const amount = reduceMotion.matches ? 1 : clamp((viewportH * 0.95 - rect.top) / (viewportH * 0.55), 0, 1);
      threadPath.style.setProperty("--thread", (1 - amount).toFixed(4));
    }

    // Gallery corridor
    if (gallery?.classList.contains("is-pinned") && galleryTravel > 0) {
      const rect = gallery.getBoundingClientRect();
      const amount = clamp(-rect.top / (gallery.offsetHeight - viewportH), 0, 1);
      galleryTrack.style.transform = `translate3d(${(-amount * galleryTravel).toFixed(1)}px, 0, 0)`;
      setGalleryProgress(amount);
    }
  };

  const frame = (time) => {
    const y = window.scrollY;
    const velocity = lastY < 0 ? 0 : y - lastY;

    if (y !== lastY || needsUpdate) {
      updateScroll(y);
      needsUpdate = false;
    }

    if (marquee && marqueeVisible && marqueeWidth > 0 && !reduceMotion.matches) {
      marqueeX -= 0.45 + Math.min(Math.abs(velocity) * 0.35, 18);
      if (marqueeX <= -marqueeWidth) marqueeX += marqueeWidth;
      marquee.style.transform = `translate3d(${marqueeX.toFixed(2)}px, 0, 0)`;
    }

    if (petalsVisible && !document.hidden) drawPetals(time);

    if (useCursor) {
      pointer.cx += (pointer.x - pointer.cx) * 0.2;
      pointer.cy += (pointer.y - pointer.cy) * 0.2;
      cursor.style.transform = `translate3d(${pointer.cx.toFixed(1)}px, ${pointer.cy.toFixed(1)}px, 0)`;
    }

    lastY = y;
    requestAnimationFrame(frame);
  };

  const refreshLayout = () => {
    viewportH = window.innerHeight;
    layoutGallery();
    buildMarquee();
    needsUpdate = true;
  };

  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshLayout, 150);
  });
  window.addEventListener("load", refreshLayout);
  document.fonts?.ready.then(refreshLayout);

  layoutGallery();
  setGalleryProgress(0);
  requestAnimationFrame(frame);
})();
