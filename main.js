/* ============================================================
   main.js — Shared across index + detail pages
   ============================================================ */

/* ── 1. Nav scroll effect ── */
const nav = document.getElementById('nav');
// Will be initialized inside initLenis to sync with Lenis scroll


/* ── 2. Hamburger menu ── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });
  navLinks.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    })
  );
}


/* ── 4. Scroll Reveal ── */
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  revealEls.forEach(el => io.observe(el));
}

/* ── 5. Scroll to Top Button ── */
const topBtn = document.getElementById('scrollToTop');
// Will be initialized inside initLenis to sync with Lenis scroll
if (topBtn) {
  topBtn.addEventListener('click', () => {
    if (lenis) {
      lenis.scrollTo(0);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}


/* ── 6. Experience Calculation ── */
const calculateExperience = () => {
  const startDate = new Date('2023-09-01');
  const today = new Date();
  
  // Calculate total months
  let months = (today.getFullYear() - startDate.getFullYear()) * 12;
  months += today.getMonth() - startDate.getMonth();
  
  // Adjust if day of month is earlier than start day
  if (today.getDate() < startDate.getDate()) {
    months--;
  }

  const years = (months / 12).toFixed(1);
  const careerYear = Math.floor(months / 12) + 1;

  // Update DOM
  const heroExp = document.getElementById('hero-exp');
  const aboutExp = document.getElementById('about-exp');

  if (heroExp) {
    // Show as "N년차"
    heroExp.textContent = `${careerYear}년차`;
  }
  
  if (aboutExp) {
    // Show as "N년차"
    aboutExp.textContent = `${careerYear}년차`;
  }
};

// Run on load
document.addEventListener('DOMContentLoaded', () => {
  calculateExperience();
  initLenis();
  initTypewriter();
  syncProjectContent(); // Start automatic content sync (Images, Titles, Desc)
});



/* ── 7. Lenis Smooth Scroll ── */
let lenis;
function initLenis() {
  if (typeof Lenis === 'undefined') return;

  lenis = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 1,
    touchMultiplier: 2,
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Sync Nav & Top Button
  const nav = document.getElementById('nav');
  const topBtn = document.getElementById('scrollToTop');
  
  lenis.on('scroll', (e) => {
    const scrollY = e.scroll;
    
    // Nav effect
    if (nav) {
      nav.classList.toggle('scrolled', scrollY > 20);
    }
    
    // Top button Visibility
    if (topBtn) {
      if (scrollY > 400) {
        topBtn.classList.add('visible');
      } else {
        topBtn.classList.remove('visible');
      }
    }
  });

  // Link Lenis to internal anchor clicks
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        lenis.scrollTo(targetElement, {
          offset: -80 // Account for fixed nav
        });
      }
    });
  });
}


/* ── 8. Hero Mouse Motion (3D Tilt + Interactive Dots) ── */
(function initHeroMouseMotion() {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;

  const isTouchDevice = window.matchMedia('(hover: none)').matches;
  if (isTouchDevice) return;

  const ctx = canvas.getContext('2d');
  const GAP = 24; 
  const DOT_R = 1.2; 
  const BASE_OPACITY = 0.28; // Subtle suppression based on feedback
  const INFLUENCE_RADIUS = 220; 

  // Colors: base Slate-400 (visible grey), diverse palette for hover
  const bR = 148, bG = 163, bB = 184; 
  // Premium palette for "Diverse but subtle" effect
  const palette = [
    {r: 99,  g: 102, b: 241}, // Indigo
    {r: 16,  g: 185, b: 129}, // Emerald
    {r: 236, g: 72,  b: 153}, // Rose
    {r: 139, g: 92,  b: 246}, // Violet
    {r: 59,  g: 130, b: 246}, // Blue
    {r: 245, g: 158, b: 11}   // Amber
  ];

  let mouseX = -9999, mouseY = -9999;
  let mouseInHero = false;
  let targetTX = 0, targetTY = 0;
  let curTX = 0, curTY = 0;
  const LERP = 0.12;
  let visible = true, rafId = null;

  let dots = [];
  
  function initDots() {
    const w = parseInt(canvas.style.width) || hero.offsetWidth;
    const h = parseInt(canvas.style.height) || hero.offsetHeight;
    const cols = Math.ceil(w / GAP) + 1;
    const rows = Math.ceil(h / GAP) + 1;
    
    dots = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const color = palette[Math.floor(Math.random() * palette.length)];
        dots.push({
          baseX: col * GAP,
          baseY: row * GAP,
          x: col * GAP,
          y: row * GAP,
          vx: 0,
          vy: 0,
          colorR: color.r,
          colorG: color.g,
          colorB: color.b
        });
      }
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = hero.getBoundingClientRect();
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initDots();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    mouseInHero = true;
    targetTX = ((e.clientX - r.left) / r.width  - 0.5) * 2;
    targetTY = ((e.clientY - r.top)  / r.height - 0.5) * 2;
  }, { passive: true });

  hero.addEventListener('mouseleave', () => {
    mouseInHero = false;
    mouseX = -9999; mouseY = -9999;
    targetTX = 0; targetTY = 0;
  });

  const obs = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !rafId) rafId = requestAnimationFrame(tick);
  }, { threshold: 0 });
  obs.observe(hero);

  function drawDots() {
    const w = parseInt(canvas.style.width) || hero.offsetWidth;
    const h = parseInt(canvas.style.height) || hero.offsetHeight;
    ctx.clearRect(0, 0, w, h);

    const SPRING = 0.04;    // Snap back force (softer return)
    const DAMPING = 0.82;   // Friction (smoother glide)
    const PULL = 0.025;     // Magnetic pull to mouse (about half as sticky)
    const PULL_RADIUS = 120; // Distance where magnetic pull is active

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      let r = bR, g = bG, b = bB, a = BASE_OPACITY;

      // Physics integration
      let fx = (dot.baseX - dot.x) * SPRING;
      let fy = (dot.baseY - dot.y) * SPRING;

      if (mouseInHero) {
        const dx = mouseX - dot.x;
        const dy = mouseY - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate original distance for color (looks better anchored to base)
        const baseDx = dot.baseX - mouseX;
        const baseDy = dot.baseY - mouseY;
        const baseDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);

        if (dist < PULL_RADIUS) {
          // Magnetic pull: closer dots get pulled more strongly
          const pullStrength = (1 - dist / PULL_RADIUS) * PULL;
          fx += dx * pullStrength;
          fy += dy * pullStrength;
        }

        if (baseDist < INFLUENCE_RADIUS) {
          // Color change based on distance from mouse
          const t = 1 - baseDist / INFLUENCE_RADIUS;
          const ease = t * t;
          r = Math.round(bR + (dot.colorR - bR) * ease);
          g = Math.round(bG + (dot.colorG - bG) * ease);
          b = Math.round(bB + (dot.colorB - bB) * ease);
          a = BASE_OPACITY + (0.95 - BASE_OPACITY) * ease; // Richer peak opacity
        }
      }

      dot.vx = (dot.vx + fx) * DAMPING;
      dot.vy = (dot.vy + fy) * DAMPING;
      dot.x += dot.vx;
      dot.y += dot.vy;

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fill();
    }
  }

  function tick() {
    // If not visible or scrolled way past hero, stop rendering to save resources
    if (!visible || window.scrollY > hero.offsetHeight + 100) { 
      rafId = null; 
      return; 
    }
    
    curTX += (targetTX - curTX) * LERP;
    curTY += (targetTY - curTY) * LERP;
    if (Math.abs(curTX) < 0.001) curTX = 0;
    if (Math.abs(curTY) < 0.001) curTY = 0;
    hero.style.setProperty('--mouse-x', curTX.toFixed(4));
    hero.style.setProperty('--mouse-y', curTY.toFixed(4));
    drawDots();
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
})();


/* ── 9. Typewriter Effect ── */
function initTypewriter() {
  const headline = document.querySelector('.hero__headline');
  if (!headline) return;

  const line1Text = "복잡한 서비스를 구조화하는";
  const line2Text = "프로덕트 디자이너";

  headline.innerHTML = '<span class="typed-line1"></span><span class="typed-cursor"></span>';
  
  const span1 = headline.querySelector('.typed-line1');
  const cursor = headline.querySelector('.typed-cursor');
  let span2;

  let i = 0;
  let isLine2 = false;

  function typeChar() {
    if (!isLine2) {
      if (i < line1Text.length) {
        span1.textContent += line1Text.charAt(i);
        i++;
        setTimeout(typeChar, 60 + Math.random() * 40);
      } else {
        isLine2 = true;
        i = 0;
        
        // Insert line break and second span specifically *before* the cursor
        headline.insertBefore(document.createElement('br'), cursor);
        span2 = document.createElement('span');
        span2.className = 'hero__headline--accent typed-line2';
        headline.insertBefore(span2, cursor);

        setTimeout(typeChar, 300); // 300ms pause at line break
      }
    } else {
      if (i < line2Text.length) {
        span2.textContent += line2Text.charAt(i);
        i++;
        setTimeout(typeChar, 60 + Math.random() * 40);
      } else {
        cursor.classList.add('finished');
      }
    }
  }

  // Start after a short delay so the page can render
  setTimeout(typeChar, 400);
}

/* ── 10. Automatic Project Content Sync ── */
async function syncProjectContent() {
  // Select both index cards and detail page next/prev cards
  const cards = document.querySelectorAll('.project-card, .next-card');
  if (!cards.length) return;

  const parser = new DOMParser();

  for (const card of cards) {
    const url = card.getAttribute('href');
    // Skip external links or anchor links
    if (!url || url.startsWith('#') || url.startsWith('http') || url.includes('://')) continue;

    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const html = await response.text();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 0. Sync Theme (New: Extracts data-theme from target body and applies to card)
      const targetBody = doc.querySelector('body');
      if (targetBody) {
        const targetTheme = targetBody.getAttribute('data-theme');
        if (targetTheme) {
          card.setAttribute('data-next-theme', targetTheme);
        }
      }

      // 1. Sync Image (Index cards & Next cards)
      const heroImg = doc.querySelector('.dh-visual-wrap--hero img') || doc.querySelector('.dh-hero__visual img');
      if (heroImg) {
        const heroSrc = heroImg.getAttribute('src');
        const isProjectCard = card.classList.contains('project-card');
        
        // Target container selector depends on card type
        const thumbContainer = card.querySelector(isProjectCard ? '.project-card__thumb' : '.next-card__visual');
        
        if (thumbContainer) {
          let thumbImg = thumbContainer.querySelector('img');
          if (!thumbImg) {
            thumbImg = document.createElement('img');
            thumbImg.loading = 'lazy';
            thumbContainer.prepend(thumbImg);
          }
          if (thumbImg) {
            thumbImg.src = heroSrc;
            thumbImg.alt = heroImg.alt || "Project Thumbnail";
          }
        }
      }

      // 2. Sync Title
      const heroTitle = doc.querySelector('.dh-hero__title');
      if (heroTitle) {
        // Find title in either project-card or next-card
        const cardTitle = card.querySelector('.project-card__title') || card.querySelector('.next-card__title');
        if (cardTitle) {
          // Clean up breaks and double spaces for card preview
          cardTitle.innerText = heroTitle.innerText.replace(/\n\s+/g, ' ').replace(/\n/g, ' ').trim();
        }
      }

      // 3. Sync Description (Hero Summary)
      const heroSummary = doc.querySelector('.dh-hero__summary');
      if (heroSummary) {
        // Mapping: heroSummary -> .project-card__desc or .next-card__meta
        const cardDesc = card.querySelector('.project-card__desc') || card.querySelector('.next-card__meta');
        if (cardDesc) {
          cardDesc.innerText = heroSummary.innerText.replace(/\n\s+/g, ' ').replace(/\n/g, ' ').trim();
        }
      }
      
    } catch (err) {
      console.log(`Note: Local sync for ${url} prevented by browser security. Use a local server (Live Server).`);
    }
  }
}


