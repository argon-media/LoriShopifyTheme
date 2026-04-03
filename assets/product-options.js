/**
 * Product Options JavaScript
 * Handles purchase option selection, quantity, email verification, and gallery
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    initProductGallery();
    initPurchaseOptions();
    initQuantitySelector();
    initTestimonialSlider();
  });

  /**
   * Product Gallery - Image switching
   */
  function initProductGallery() {
    const mainImage = document.getElementById('mainProductImage');
    const thumbs = document.querySelectorAll('.product-gallery__thumb');

    if (!mainImage || thumbs.length === 0) return;

    thumbs.forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        const newSrc = this.getAttribute('data-image-src');
        
        mainImage.src = newSrc;
        
        thumbs.forEach(function(t) {
          t.classList.remove('active');
        });
        this.classList.add('active');
      });
    });
  }

  /**
   * Purchase Options - Selection handling
   */
  function initPurchaseOptions() {
    const options = document.querySelectorAll('.purchase-option');
    const productForm = document.getElementById('productForm');
    const emailInput = document.getElementById('customerEmail');
    const emailStatus = document.getElementById('emailStatus');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const variantInput = document.getElementById('variantId');
    const quantitySelector = document.getElementById('quantitySelector');
    const checkEligibilityBtn = document.getElementById('checkEligibilityBtn');

    if (options.length === 0) return;

    // Select first option by default
    if (options[0]) {
      options[0].classList.add('active');
    }

    options.forEach(function(option) {
      option.addEventListener('click', function(e) {
        // Don't toggle if clicking on form elements inside
        if (e.target.closest('.first-free-form')) return;
        
        // Remove active from all
        options.forEach(function(opt) {
          opt.classList.remove('active');
        });
        
        // Add active to clicked
        this.classList.add('active');
        
        // Handle purchase type
        const purchaseType = this.getAttribute('data-purchase-type');
        handlePurchaseTypeChange(purchaseType, variantInput, addToCartBtn, quantitySelector);
      });
    });

    // Check Eligibility button click handler
    if (checkEligibilityBtn && emailInput) {
      checkEligibilityBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const email = emailInput.value.trim();
        const btnText = this.querySelector('.btn-text');
        
        if (!email || !isValidEmail(email)) {
          emailStatus.textContent = 'Please enter a valid email address.';
          emailStatus.style.color = '#ef4444';
          return;
        }
        
        // Show checking state
        if (btnText) btnText.textContent = 'Checking...';
        this.disabled = true;
        
        // Simulate API call
        setTimeout(function() {
          checkFirstTimeCustomer(email, emailStatus, addToCartBtn);
          if (btnText) btnText.textContent = 'Check Eligibility';
          checkEligibilityBtn.disabled = false;
        }, 1500);
      });
    }

    // Clear status on email input change
    if (emailInput) {
      emailInput.addEventListener('input', function() {
        if (emailStatus) {
          emailStatus.textContent = '';
          emailStatus.className = 'first-free-form__status';
        }
      });
      
      // Prevent click from bubbling to parent
      emailInput.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    // Form submission
    if (productForm) {
      productForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const activeOption = document.querySelector('.purchase-option.active');
        const purchaseType = activeOption ? activeOption.getAttribute('data-purchase-type') : 'onetime';
        const variants = window.productVariants || {};
        const quantity = parseInt(document.getElementById('quantity').value) || 1;
        
        if (purchaseType === 'first-free') {
          const email = emailInput ? emailInput.value.trim() : '';
          
          if (!email || !isValidEmail(email)) {
            alert('Please enter a valid email address to claim your free journal.');
            return;
          }
          
          // Store email for tracking
          localStorage.setItem('newsletter_email', email);
          
          // Mark email as used for free trial
          const usedEmails = JSON.parse(localStorage.getItem('used_trial_emails') || '[]');
          if (!usedEmails.includes(email.toLowerCase())) {
            usedEmails.push(email.toLowerCase());
            localStorage.setItem('used_trial_emails', JSON.stringify(usedEmails));
          }
        }
        
        // Build cart item with properties
        const cartItem = buildCartItem(purchaseType, variants, quantity, emailInput);
        
        // Add to cart via AJAX
        addToCartAjax(cartItem, addToCartBtn);
      });
    }
  }

  /**
   * Build cart item based on purchase type
   */
  function buildCartItem(purchaseType, variants, quantity, emailInput) {
    const item = {
      id: variants.default,
      quantity: quantity,
      properties: {}
    };
    
    switch(purchaseType) {
      case 'onetime':
        item.properties['Purchase Type'] = 'One-Time Purchase';
        break;
        
      case 'subscribe':
        item.properties['Purchase Type'] = 'Subscription';
        item.properties['Discount'] = variants.subscriptionDiscount + '% Off';
        // Use subscription variant if available
        if (variants.subscription) {
          item.id = variants.subscription;
        }
        break;
        
      case 'first-free':
        item.properties['Purchase Type'] = 'Free Trial';
        if (variants.freeTrial) {
          item.id = variants.freeTrial;
        }
        if (emailInput && emailInput.value) {
          item.properties['Email'] = emailInput.value;
        }
        // Check for newsletter opt-in
        const newsletterCheckbox = document.getElementById('newsletterOptin');
        if (newsletterCheckbox && newsletterCheckbox.checked) {
          item.properties['Newsletter'] = 'Weekly Bookmark';
        }
        item.quantity = 1;
        break;
    }
    
    return item;
  }

  /**
   * Add to cart via AJAX API
   */
  function addToCartAjax(item, btnEl) {
    const btnText = btnEl ? btnEl.querySelector('.btn-text') : null;
    const originalText = btnText ? btnText.textContent : 'Add to Cart';
    
    if (btnText) btnText.textContent = 'Adding...';
    if (btnEl) btnEl.disabled = true;
    
    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [item] })
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.status === 422) {
        // Error adding to cart
        alert(data.description || 'Could not add item to cart.');
        if (btnText) btnText.textContent = originalText;
        if (btnEl) btnEl.disabled = false;
      } else {
        // Success - redirect to cart or show success
        if (btnText) btnText.textContent = 'Added!';
        setTimeout(function() {
          window.location.href = '/cart';
        }, 500);
      }
    })
    .catch(function(error) {
      console.error('Error:', error);
      alert('Could not add item to cart. Please try again.');
      if (btnText) btnText.textContent = originalText;
      if (btnEl) btnEl.disabled = false;
    });
  }

  /**
   * Handle purchase type changes - Switch variants and toggle quantity
   */
  function handlePurchaseTypeChange(type, variantInput, addToCartBtn, quantitySelector) {
    const btnText = addToCartBtn ? addToCartBtn.querySelector('.btn-text') : null;
    const variants = window.productVariants || {};
    
    if (!btnText) return;

    switch(type) {
      case 'onetime':
        btnText.textContent = 'Add to cart';
        if (addToCartBtn) addToCartBtn.disabled = false;
        // Show quantity selector
        if (quantitySelector) quantitySelector.classList.remove('hidden');
        // Use default variant
        if (variantInput && variants.default) {
          variantInput.value = variants.default;
        }
        break;
        
      case 'subscribe':
        btnText.textContent = 'Add to cart';
        if (addToCartBtn) addToCartBtn.disabled = false;
        // Show quantity selector
        if (quantitySelector) quantitySelector.classList.remove('hidden');
        // Use subscription variant if available
        if (variantInput && variants.subscription) {
          variantInput.value = variants.subscription;
        } else if (variantInput && variants.default) {
          variantInput.value = variants.default;
        }
        break;
        
      case 'first-free':
        btnText.textContent = 'Claim Trial Journal';
        // Hide quantity selector
        if (quantitySelector) quantitySelector.classList.add('hidden');
        // Reset quantity to 1
        const quantityInput = document.getElementById('quantity');
        if (quantityInput) quantityInput.value = 1;
        // Switch to free trial variant if available
        if (variantInput && variants.freeTrial) {
          variantInput.value = variants.freeTrial;
        }
        break;
        
      default:
        btnText.textContent = 'Add to cart';
        if (quantitySelector) quantitySelector.classList.remove('hidden');
        if (variantInput && variants.default) {
          variantInput.value = variants.default;
        }
    }
  }


  /**
   * Quantity Selector
   */
  function initQuantitySelector() {
    const minusBtn = document.querySelector('.quantity-selector__btn--minus');
    const plusBtn = document.querySelector('.quantity-selector__btn--plus');
    const input = document.getElementById('quantity');

    if (!minusBtn || !plusBtn || !input) return;

    // Immediate click response
    minusBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const currentValue = parseInt(input.value) || 1;
      if (currentValue > 1) {
        input.value = currentValue - 1;
        input.dispatchEvent(new Event('change'));
      }
    });

    plusBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const currentValue = parseInt(input.value) || 1;
      input.value = currentValue + 1;
      input.dispatchEvent(new Event('change'));
    });

    // Hold to repeat (faster quantity changes)
    let holdInterval;
    
    function startHold(increment) {
      holdInterval = setInterval(function() {
        const currentValue = parseInt(input.value) || 1;
        if (increment > 0) {
          input.value = currentValue + 1;
        } else if (currentValue > 1) {
          input.value = currentValue - 1;
        }
      }, 100); // Repeat every 100ms when held
    }
    
    function stopHold() {
      clearInterval(holdInterval);
    }

    minusBtn.addEventListener('mousedown', function() {
      setTimeout(function() { startHold(-1); }, 300);
    });
    minusBtn.addEventListener('mouseup', stopHold);
    minusBtn.addEventListener('mouseleave', stopHold);
    
    plusBtn.addEventListener('mousedown', function() {
      setTimeout(function() { startHold(1); }, 300);
    });
    plusBtn.addEventListener('mouseup', stopHold);
    plusBtn.addEventListener('mouseleave', stopHold);

    input.addEventListener('change', function() {
      let value = parseInt(this.value) || 1;
      if (value < 1) value = 1;
      this.value = value;
    });
  }

  /**
   * Check if customer is first-time
   */
  function checkFirstTimeCustomer(email, statusEl, btnEl) {
    if (!statusEl) return;

    const previousEmails = JSON.parse(localStorage.getItem('used_trial_emails') || '[]');
    
    if (previousEmails.includes(email.toLowerCase())) {
      statusEl.textContent = '✕ This email has already been used for a free trial.';
      statusEl.style.color = '#ef4444';
      if (btnEl) btnEl.disabled = true;
    } else {
      statusEl.textContent = '✓ You\'re eligible for a free journal!';
      statusEl.style.color = '#22c55e';
      if (btnEl) btnEl.disabled = false;
    }
  }

  /**
   * Email validation
   */
  function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Testimonial Slider
   */
  function initTestimonialSlider() {
    const slider = document.getElementById('testimonialSlider');
    if (!slider) return;

    const testimonials = slider.querySelectorAll('.testimonial-card');
    const dots = document.querySelectorAll('.testimonial-dot');
    const prevBtn = document.querySelector('.testimonial-nav-btn--prev');
    const nextBtn = document.querySelector('.testimonial-nav-btn--next');
    
    if (testimonials.length <= 1) return;

    let currentIndex = 0;

    function showTestimonial(index) {
      testimonials.forEach(function(t, i) {
        t.style.display = i === index ? 'block' : 'none';
      });
      
      dots.forEach(function(d, i) {
        d.classList.toggle('active', i === index);
      });
    }

    function nextTestimonial() {
      currentIndex = (currentIndex + 1) % testimonials.length;
      showTestimonial(currentIndex);
    }

    function prevTestimonial() {
      currentIndex = (currentIndex - 1 + testimonials.length) % testimonials.length;
      showTestimonial(currentIndex);
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', nextTestimonial);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', prevTestimonial);
    }

    dots.forEach(function(dot, index) {
      dot.addEventListener('click', function() {
        currentIndex = index;
        showTestimonial(currentIndex);
      });
    });
  }

})();
