(() => {
/* ============================================================
   detail.js — Project Detail Page Interactions
   - Smart nav hide/reveal on scroll + mouse hover at top
   - Sticky project bar with reading progress
   - Number counter animation (KPI section)
   - Scroll-triggered progress bar fill
   ============================================================ */

/* ── Smart Nav: Detail Page Auto-hide / Reveal ──
   동작 규칙:
   1. 히어로 섹션을 지나면 숨김 조건 활성화
   2. 스크롤 다운 → 헤더 위로 슬라이드 아웃 (--hidden)
   3. 스크롤 업 (δ > 4px) → 헤더 복귀 (--peek)
   4. 마우스를 화면 상단 80px 이내에 올리면 → 헤더 복귀
   5. 모바일 터치 스와이프 방향도 동일하게 적용
*/
const navEl        = document.getElementById('nav');
const heroSection  = document.querySelector('.dh-hero');

let lastScrollY    = window.scrollY;
let isNavHidden    = false;

function getHeroBottom() {
  return heroSection ? heroSection.offsetTop + heroSection.offsetHeight : 400;
}

function hideNav() {
  if (isNavHidden) return;
  isNavHidden = true;
  navEl.classList.add('nav--hidden');
  navEl.classList.remove('nav--peek');
}

function showNav() {
  if (!isNavHidden) return;
  isNavHidden = false;
  navEl.classList.remove('nav--hidden');
  navEl.classList.add('nav--peek');
}

function onDetailScroll(e) {
  const currentY = e && typeof e.scroll === 'number' ? e.scroll : window.scrollY;
  const delta    = currentY - lastScrollY;

  // 최상단(0)일 때는 무조건 보이도록 처리
  if (currentY <= 10) {
    showNav();
  } else {
    // 스크롤을 내릴 때 숨김 (최상단이 아니면 계속 숨겨진 상태 유지)
    if (delta > 2) {
      hideNav();
    } 
  }

  lastScrollY = currentY;

  /* reading progress */
  updateReadProgress(currentY);
}

// Initial initialization check for Lenis synchronization
const initScrollListener = () => {
  if (typeof lenis !== 'undefined') {
    lenis.on('scroll', onDetailScroll);
  } else {
    window.addEventListener('scroll', () => onDetailScroll(), { passive: true });
  }
};

// Start listener after a short delay to ensure lenis in main.js is ready
setTimeout(initScrollListener, 100);


/* ── Reading progress & sticky bar ── */
const projectBar   = document.getElementById('project-bar');
const readProgress = document.getElementById('read-progress');

function updateReadProgress(scrollY) {
  const scrollTop = typeof scrollY === 'number' ? scrollY : window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct       = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

  if (readProgress) readProgress.style.width = pct + '%';

  if (projectBar) {
    // 스크롤 조금이라도(10px 이상) 내려가면 진척도 바 활성화 대기
    // (.nav--hidden 과 맞물려 즉시 프로젝트 바로 스왑됨)
    projectBar.classList.toggle('visible', scrollTop > 10);
  }
}
updateReadProgress(window.scrollY);



  /* ── Image Tab Switching with Sliding Indicator ── */
  function initTabs() {
    const containers = document.querySelectorAll('.cs-tabs-container');
    
    containers.forEach(container => {
      const tabsNav = container.querySelector('.cs-tabs');
      const indicator = container.querySelector('.cs-tab-indicator');
      const tabBtns = container.querySelectorAll('.cs-tab-btn');
      const tabPanels = container.querySelectorAll('.cs-tab-panel');
   
      if (!tabBtns.length || !tabPanels.length || !indicator || !tabsNav) return;
   
      function moveIndicator(btn) {
        const left = btn.offsetLeft;
        const width = btn.offsetWidth;
   
        indicator.style.left = `${left}px`;
        indicator.style.width = `${width}px`;
      }
   
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-tab');
   
          // Move Indicator
          moveIndicator(btn);
   
          // Toggle Buttons
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
   
          // Toggle Panels
          tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === targetId);
          });
        });
      });
   
      // Initial Position
      const activeBtn = container.querySelector('.cs-tab-btn.active');
      if (activeBtn) moveIndicator(activeBtn);
      
      // Handle Window Resize
      window.addEventListener('resize', () => {
        const currentActive = container.querySelector('.cs-tab-btn.active');
        if (currentActive) moveIndicator(currentActive);
      }, { passive: true });
    });
  }
 
  // Initialize tabs
  initTabs();
 
  /* ── Tab CTA: Entrance Sweep Animation ── */
  function initTabSweep() {
    const containers = document.querySelectorAll('.cs-tabs-container');
    
    containers.forEach(container => {
      const tabsNav = container.querySelector('.cs-tabs');
      const indicator = container.querySelector('.cs-tab-indicator');
      if (!tabsNav || !indicator) return;
   
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            tabsNav.classList.add('is-sweeping');
            
            setTimeout(() => {
              tabsNav.classList.remove('is-sweeping');
              // Ensure indicator returns to active position
              const activeBtn = container.querySelector('.cs-tab-btn.active');
              if (activeBtn) {
                const left = activeBtn.offsetLeft;
                const width = activeBtn.offsetWidth;
                indicator.style.left = `${left}px`;
                indicator.style.width = `${width}px`;
              }
            }, 1500);
            
            observer.unobserve(container);
          }
        });
      }, { threshold: 0.5 });
   
      observer.observe(container);
    });
  }
  
  initTabSweep();

})();
