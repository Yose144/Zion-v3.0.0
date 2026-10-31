// ============================================
// GENESIS NAVIGATION & READING EXPERIENCE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initChapterNavigation();
  initReadingProgress();
  initBackToTop();
  initScrollReveal();
});

// ========== CHAPTER NAVIGATION ==========
function initChapterNavigation() {
  const navItems = document.querySelectorAll('.chapter-nav-sticky .nav-item');
  const chapters = document.querySelectorAll('.chapter-article');
  
  if (!navItems.length || !chapters.length) return;
  
  // Intersection Observer for active chapter highlighting
  const observerOptions = {
    root: null,
    rootMargin: '-150px 0px -70% 0px',
    threshold: 0
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        
        // Remove active class from all nav items
        navItems.forEach(item => item.classList.remove('active'));
        
        // Add active class to current nav item
        const activeItem = document.querySelector(`.chapter-nav-sticky .nav-item[href="#${id}"]`);
        if (activeItem) {
          activeItem.classList.add('active');
        }
      }
    });
  }, observerOptions);
  
  // Observe all chapters
  chapters.forEach(chapter => observer.observe(chapter));
  
  // Smooth scroll on click
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        const offsetTop = targetElement.offsetTop - 150;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ========== READING PROGRESS ==========
function initReadingProgress() {
  const progressBar = document.getElementById('reading-progress');
  
  if (!progressBar) return;
  
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercentage = (scrollTop / scrollHeight) * 100;
    
    progressBar.style.width = `${Math.min(scrollPercentage, 100)}%`;
  });
}

// ========== BACK TO TOP BUTTON ==========
function initBackToTop() {
  const backToTopBtn = document.getElementById('back-to-top');
  
  if (!backToTopBtn) return;
  
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  });
  
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// ========== SCROLL REVEAL ANIMATIONS ==========
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.chapter-quote, .meditation-box, .chapter-icon-divider');
  
  if (!revealElements.length) return;
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '0';
        entry.target.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
          entry.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, 100);
        
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  revealElements.forEach(el => revealObserver.observe(el));
}

// ========== READING TIME ESTIMATE ==========
function estimateReadingTime() {
  const articles = document.querySelectorAll('.chapter-article');
  const wordsPerMinute = 200;
  
  articles.forEach(article => {
    const text = article.textContent || '';
    const wordCount = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);
    
    // You can display this somewhere if needed
    article.dataset.readingTime = readingTime;
  });
}

// ========== KEYBOARD NAVIGATION ==========
document.addEventListener('keydown', (e) => {
  // Arrow keys for chapter navigation
  if (e.key === 'ArrowLeft') {
    const prevBtn = document.querySelector('.prev-chapter-btn');
    if (prevBtn) prevBtn.click();
  } else if (e.key === 'ArrowRight') {
    const nextBtn = document.querySelector('.next-chapter-btn');
    if (nextBtn) nextBtn.click();
  }
});

// ========== SAVE READING POSITION ==========
function saveReadingPosition() {
  const scrollPosition = window.pageYOffset;
  const currentUrl = window.location.pathname;
  
  localStorage.setItem(`reading-position-${currentUrl}`, scrollPosition);
}

function restoreReadingPosition() {
  const currentUrl = window.location.pathname;
  const savedPosition = localStorage.getItem(`reading-position-${currentUrl}`);
  
  if (savedPosition) {
    window.scrollTo({
      top: parseInt(savedPosition),
      behavior: 'instant'
    });
  }
}

// Save position on scroll (debounced)
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(saveReadingPosition, 500);
});

// Restore position on load
window.addEventListener('load', restoreReadingPosition);
