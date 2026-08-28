/**
 * Product Options JavaScript
 * Handles purchase option selection, quantity, email verification, and gallery
 */

(function() {
  'use strict';

  // Mailchimp audience (pulled from the theme's footer signup form)
  var MAILCHIMP = {
    action: 'https://lorijsmith.us5.list-manage.com/subscribe/post-json',
    u: 'ce5b25d7e73f18ff0a5c2ad81',
    id: '55ace7222c'
  };

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
    const newsletterCheckbox = document.getElementById('newsletterOptin');

    if (options.length === 0) return;

    // Eligibility state — the free journal can only be claimed after a
    // successful Mailchimp subscribe confirms this email is a new subscriber.
    window.trialEligible = false;
    window.trialEmail = '';

    function setStatus(message, type) {
      if (!emailStatus) return;
      emailStatus.textContent = message;
      emailStatus.style.color = type === 'success' ? '#22c55e' : (type === 'error' ? '#ef4444' : '#6b7280');
    }

    function resetEligibility() {
      window.trialEligible = false;
      const active = document.querySelector('.purchase-option.active');
      if (active && active.getAttribute('data-purchase-type') === 'first-free' && addToCartBtn) {
        addToCartBtn.disabled = true;
      }
    }

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

    // Check Eligibility button — now performs a REAL Mailchimp subscribe.
    // Success  => new subscriber, eligible to claim.
    // Already a member => they've already claimed the free journal.
    if (checkEligibilityBtn && emailInput) {
      checkEligibilityBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const email = emailInput.value.trim();
        const btnText = this.querySelector('.btn-text');

        if (!email || !isValidEmail(email)) {
          setStatus('Please enter a valid email address.', 'error');
          return;
        }

        // The free journal comes WITH the subscription — opt-in is required.
        if (newsletterCheckbox && !newsletterCheckbox.checked) {
          setStatus('Please tick the Monthly Legacy Letter box — the free journal comes with the subscription.', 'error');
          return;
        }

        if (btnText) btnText.textContent = 'Checking...';
        checkEligibilityBtn.disabled = true;
        window.trialEligible = false;
        if (addToCartBtn) addToCartBtn.disabled = true;

        subscribeToMailchimp(email, function(data) {
          const result = interpretMailchimp(data);
          if (btnText) btnText.textContent = 'Check Eligibility';
          checkEligibilityBtn.disabled = false;

          if (result.ok) {
            window.trialEligible = true;
            window.trialEmail = email;
            setStatus('✓ You\'re subscribed and eligible — claim your free journal below!', 'success');
            if (addToCartBtn) addToCartBtn.disabled = false;
          } else {
            window.trialEligible = false;
            if (addToCartBtn) addToCartBtn.disabled = true;
            setStatus('✕ ' + result.msg, 'error');
          }
        });
      });
    }

    // Reset eligibility whenever the email or opt-in changes
    if (emailInput) {
      emailInput.addEventListener('input', function() {
        setStatus('', 'neutral');
        resetEligibility();
      });
      emailInput.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }
    if (newsletterCheckbox) {
      newsletterCheckbox.addEventListener('change', resetEligibility);
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
          if (newsletterCheckbox && !newsletterCheckbox.checked) {
            alert('Please tick the Monthly Legacy Letter box — the free journal comes with the subscription.');
            return;
          }
          // Must pass the Mailchimp eligibility/subscribe step first
          if (!window.trialEligible || window.trialEmail !== email) {
            alert('Please tap "Check Eligibility" first to confirm your free journal.');
            return;
          }

          // One free journal per customer — block a second one
          guardAndAddFreeTrial(purchaseType, variants, emailInput, addToCartBtn);
          return;
        }

        // Build cart item with properties (paid / subscription)
        const cartItem = buildCartItem(purchaseType, variants, quantity, emailInput);

        // Add to cart via AJAX
        addToCartAjax(cartItem, addToCartBtn);
      });
    }
  }

  /**
   * Free journal guard — ensure only ONE free journal per cart.
   * A paid journal + one free journal is allowed; a second free journal is not.
   */
  function guardAndAddFreeTrial(purchaseType, variants, emailInput, addToCartBtn) {
    const freeId = variants.freeTrial;

    fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        const items = (cart && cart.items) || [];
        const alreadyHasFree = items.some(function(it) {
          return (freeId && it.variant_id === freeId) ||
                 (it.properties && it.properties['Purchase Type'] === 'Free Trial') ||
                 (it.final_price === 0);
        });

        if (alreadyHasFree) {
          alert('Your free journal is already in the cart — limit one per customer. If you\'d like another, it can be added as a regular purchase.');
          window.location.href = '/cart';
          return;
        }

        const item = buildCartItem(purchaseType, variants, 1, emailInput);
        addToCartAjax(item, addToCartBtn);
      })
      .catch(function() {
        // If the cart lookup fails, still add (quantity is forced to 1 anyway)
        const item = buildCartItem(purchaseType, variants, 1, emailInput);
        addToCartAjax(item, addToCartBtn);
      });
  }

  /**
   * Subscribe an email to Mailchimp via the embedded-form JSONP endpoint.
   * No server / API key needed — same audience as the footer signup form.
   */
  function subscribeToMailchimp(email, onResult) {
    const cb = 'mcCallback_' + Date.now();
    const url = MAILCHIMP.action +
      '?u=' + encodeURIComponent(MAILCHIMP.u) +
      '&id=' + encodeURIComponent(MAILCHIMP.id) +
      '&EMAIL=' + encodeURIComponent(email) +
      '&c=' + cb;

    const script = document.createElement('script');
    let done = false;

    function cleanup() {
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = function(data) {
      if (done) return;
      done = true;
      cleanup();
      onResult(data);
    };

    script.onerror = function() {
      if (done) return;
      done = true;
      cleanup();
      onResult({ result: 'error', msg: 'network' });
    };

    setTimeout(function() {
      if (done) return;
      done = true;
      cleanup();
      onResult({ result: 'error', msg: 'timeout' });
    }, 8000);

    script.src = url;
    document.body.appendChild(script);
  }

  /**
   * Turn a Mailchimp response into a simple decision.
   */
  function interpretMailchimp(data) {
    if (!data) {
      return { ok: false, already: false, msg: 'Something went wrong — please try again.' };
    }
    if (data.result === 'success') {
      return { ok: true, already: false, msg: '' };
    }
    const raw = (data.msg || '').toString();
    const lower = raw.toLowerCase();

    if (lower.indexOf('already subscribed') !== -1) {
      return { ok: false, already: true, msg: 'This email has already claimed the free journal.' };
    }
    if (raw === 'network' || raw === 'timeout') {
      return { ok: false, already: false, msg: 'Connection issue — please try again.' };
    }
    // Other Mailchimp errors (invalid address, etc.) — strip any HTML for display
    return { ok: false, already: false, msg: stripHtml(raw) || 'Please enter a valid email address.' };
  }

  function stripHtml(str) {
    const tmp = document.createElement('div');
    tmp.innerHTML = str;
    return (tmp.textContent || tmp.innerText || '').trim();
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
        // Subscription is required for this offer, so always record it
        item.properties['Newsletter'] = 'Monthly Legacy Letter';
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
        // The claim button stays locked until Mailchimp eligibility passes
        if (addToCartBtn) addToCartBtn.disabled = !window.trialEligible;
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
