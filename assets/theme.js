/**
 * Lori J. Smith Theme - Main JavaScript
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    initMobileMenu();
    initSmoothScroll();
  });

  /**
   * Mobile Menu Toggle
   */
  function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');
    const closeBtn = document.getElementById('mobileMenuClose');
    
    if (!toggle || !menu) {
      console.log('Mobile menu elements not found');
      return;
    }
    
    function openMenu() {
      menu.classList.add('active');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      console.log('Menu opened');
    }
    
    function closeMenu() {
      menu.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
      console.log('Menu closed');
    }
    
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      if (menu.classList.contains('active')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
    
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }
    
    if (overlay) {
      overlay.addEventListener('click', closeMenu);
    }

    // Close menu when clicking a link
    const menuLinks = menu.querySelectorAll('a');
    menuLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        closeMenu();
      });
    });
  }

  /**
   * Smooth Scroll for anchor links
   */
  function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(function(link) {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        if (href === '#' || href === '#product-section') {
          // Handle #product-section - scroll to product section
          if (href === '#product-section') {
            e.preventDefault();
            const productSection = document.querySelector('#product-section');
            if (productSection) {
              const headerHeight = 80;
              const elementPosition = productSection.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
              
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
              });
            }
          }
          return;
        }
        
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const headerHeight = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

})();
