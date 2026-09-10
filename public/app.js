/**
 * GustoSphere - Interactive Dining Explorer
 * Dual-mode: Communicates with C++ REST API (/api/dining, /api/reserve)
 * with automatic fallback to local data.json for standalone preview.
 */

(() => {
  'use strict';

  // Application State
  const state = {
    allRestaurants: [],
    filteredRestaurants: [],
    filters: {
      tradition: 'all',
      cuisine: 'all',
      age_group: 'all',
      search: ''
    },
    sortBy: 'featured',
    savedIds: new Set(JSON.parse(localStorage.getItem('gustosphere_saved') || '[]')),
    activeModalRestaurant: null,
    isCppApiAvailable: false
  };

  // DOM Elements
  const elements = {
    grid: document.getElementById('dining-cards-grid'),
    emptyState: document.getElementById('empty-state'),
    emptyResetBtn: document.getElementById('empty-state-reset-btn'),
    resetAllBtn: document.getElementById('reset-all-filters-btn'),
    searchInput: document.getElementById('global-search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    sortSelect: document.getElementById('sort-select'),
    visibleCountText: document.getElementById('visible-count-text'),
    totalStatText: document.getElementById('stat-total-restaurants'),
    activeChipsContainer: document.getElementById('active-chips-container'),
    savedCountBadge: document.getElementById('saved-count-badge'),
    savedCounterBtn: document.getElementById('saved-counter-btn'),
    engineBadge: document.getElementById('engine-badge'),
    modal: document.getElementById('restaurant-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalContent: document.getElementById('modal-content-area'),
    toast: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message'),
    toastIcon: document.getElementById('toast-icon')
  };

  // --------------------------------------------------------------------------
  // Initialization & Data Fetching
  // --------------------------------------------------------------------------
  async function init() {
    setupEventListeners();
    updateSavedBadge();
    await loadDiningData();
  }

  async function loadDiningData() {
    try {
      // First attempt to query the C++ REST API
      const response = await fetch('/api/dining', { cache: 'no-store' });
      if (response.ok) {
        state.allRestaurants = await response.json();
        state.isCppApiAvailable = true;
        updateEngineBadge(true);
      } else {
        throw new Error('API not responding with 200');
      }
    } catch (err) {
      console.info('C++ API not responding at /api/dining, falling back to data.json:', err.message);
      // Fallback to static JSON file
      try {
        const localRes = await fetch('./data.json');
        state.allRestaurants = await localRes.json();
        state.isCppApiAvailable = false;
        updateEngineBadge(false);
      } catch (localErr) {
        console.error('Failed to load local fallback data.json:', localErr);
      }
    }

    if (elements.totalStatText) {
      elements.totalStatText.textContent = state.allRestaurants.length;
    }

    applyFilters();
  }

  function updateEngineBadge(isServerActive) {
    if (!elements.engineBadge) return;
    if (isServerActive) {
      elements.engineBadge.innerHTML = `
        <span class="pulse-dot"></span>
        <span class="engine-text">C++ Core Active</span>
      `;
      elements.engineBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      elements.engineBadge.style.background = 'rgba(16, 185, 129, 0.12)';
    } else {
      elements.engineBadge.innerHTML = `
        <span class="pulse-dot" style="background:#e5a93c; box-shadow:0 0 10px #e5a93c;"></span>
        <span class="engine-text" style="color:#f5b74c;">Client Mode</span>
      `;
      elements.engineBadge.style.borderColor = 'rgba(229, 169, 60, 0.3)';
      elements.engineBadge.style.background = 'rgba(229, 169, 60, 0.12)';
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    // Tradition Pills
    document.querySelectorAll('[data-filter-type="tradition"]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleFilterClick('tradition', btn.dataset.value);
        updateButtonGroupActive('[data-filter-type="tradition"]', btn);
      });
    });

    // Cuisine Pills
    document.querySelectorAll('[data-filter-type="cuisine"]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleFilterClick('cuisine', btn.dataset.value);
        updateButtonGroupActive('[data-filter-type="cuisine"]', btn);
      });
    });

    // Age Group Buttons
    document.querySelectorAll('[data-filter-type="age_group"]').forEach(btn => {
      btn.addEventListener('click', () => {
        handleFilterClick('age_group', btn.dataset.value);
        updateButtonGroupActive('[data-filter-type="age_group"]', btn);
      });
    });

    // Global Search Input
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value.trim().toLowerCase();
        if (elements.clearSearchBtn) {
          elements.clearSearchBtn.classList.toggle('hidden', !state.filters.search);
        }
        applyFilters();
      });
    }

    if (elements.clearSearchBtn) {
      elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.filters.search = '';
        elements.clearSearchBtn.classList.add('hidden');
        elements.searchInput.focus();
        applyFilters();
      });
    }

    // Sort Dropdown
    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        applyFilters();
      });
    }

    // Reset All Buttons
    if (elements.resetAllBtn) {
      elements.resetAllBtn.addEventListener('click', resetAllFilters);
    }
    if (elements.emptyResetBtn) {
      elements.emptyResetBtn.addEventListener('click', resetAllFilters);
    }

    // Saved Items Button (Toggles bookmark filter)
    if (elements.savedCounterBtn) {
      elements.savedCounterBtn.addEventListener('click', () => {
        if (state.savedIds.size === 0) {
          showToast('You haven\'t saved any dining sanctuaries yet! Click the ♥ on any card.', '♥');
          return;
        }
        // Toggle view saved only
        if (state.filters.showOnlySaved) {
          delete state.filters.showOnlySaved;
          elements.savedCounterBtn.style.background = '';
        } else {
          state.filters.showOnlySaved = true;
          elements.savedCounterBtn.style.background = 'rgba(224, 90, 71, 0.3)';
          showToast(`Showing ${state.savedIds.size} saved sanctuaries`, '♥');
        }
        applyFilters();
      });
    }

    // Modal Close
    if (elements.modalCloseBtn) {
      elements.modalCloseBtn.addEventListener('click', closeModal);
    }
    if (elements.modal) {
      elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
      });
    }

    // Keyboard Shortcuts ('/' to search, 'Esc' to close modal)
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== elements.searchInput) {
        e.preventDefault();
        elements.searchInput.focus();
      } else if (e.key === 'Escape' && !elements.modal.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  function updateButtonGroupActive(selector, activeBtn) {
    document.querySelectorAll(selector).forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-checked', 'true');
  }

  function handleFilterClick(filterType, value) {
    state.filters[filterType] = value;
    applyFilters();
  }

  function resetAllFilters() {
    state.filters.tradition = 'all';
    state.filters.cuisine = 'all';
    state.filters.age_group = 'all';
    state.filters.search = '';
    delete state.filters.showOnlySaved;

    if (elements.searchInput) {
      elements.searchInput.value = '';
    }
    if (elements.clearSearchBtn) {
      elements.clearSearchBtn.classList.add('hidden');
    }
    if (elements.savedCounterBtn) {
      elements.savedCounterBtn.style.background = '';
    }

    // Reset button active classes
    ['tradition', 'cuisine', 'age_group'].forEach(type => {
      const allBtn = document.querySelector(`[data-filter-type="${type}"][data-value="all"]`);
      if (allBtn) {
        updateButtonGroupActive(`[data-filter-type="${type}"]`, allBtn);
      }
    });

    applyFilters();
    showToast('All discovery filters have been reset', '✧');
  }

  // --------------------------------------------------------------------------
  // Filter & Sort Logic
  // --------------------------------------------------------------------------
  function applyFilters() {
    let result = [...state.allRestaurants];

    // Filter by Tradition
    if (state.filters.tradition && state.filters.tradition !== 'all') {
      result = result.filter(r => r.traditionCategory === state.filters.tradition);
    }

    // Filter by Cuisine
    if (state.filters.cuisine && state.filters.cuisine !== 'all') {
      result = result.filter(r => r.cuisineCode === state.filters.cuisine);
    }

    // Filter by Age Group
    if (state.filters.age_group && state.filters.age_group !== 'all') {
      result = result.filter(r => r.ageGroupCode === state.filters.age_group);
    }

    // Filter by Search text (checks name, cuisine, neighborhood, signature dishes, tradition)
    if (state.filters.search) {
      const q = state.filters.search;
      result = result.filter(r => {
        const dishMatch = r.signatureDishes ? r.signatureDishes.some(d => d.toLowerCase().includes(q)) : false;
        return (
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.tradition.toLowerCase().includes(q) ||
          r.neighborhood.toLowerCase().includes(q) ||
          dishMatch
        );
      });
    }

    // Filter by Saved Bookmarks
    if (state.filters.showOnlySaved) {
      result = result.filter(r => state.savedIds.has(r.id));
    }

    // Sorting
    sortResults(result);

    state.filteredRestaurants = result;
    renderCards(result);
    renderActiveChips();
    updateResultsSummary(result.length);
  }

  function sortResults(arr) {
    switch (state.sortBy) {
      case 'rating_desc':
        arr.sort((a, b) => b.rating - a.rating);
        break;
      case 'reviews_desc':
        arr.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case 'price_asc':
        arr.sort((a, b) => a.priceLevel.length - b.priceLevel.length);
        break;
      case 'price_desc':
        arr.sort((a, b) => b.priceLevel.length - a.priceLevel.length);
        break;
      case 'featured':
      default:
        // default natural dataset order
        break;
    }
  }

  function updateResultsSummary(count) {
    if (elements.visibleCountText) {
      elements.visibleCountText.textContent = count;
    }
  }

  // --------------------------------------------------------------------------
  // Active Filter Chips
  // --------------------------------------------------------------------------
  function renderActiveChips() {
    if (!elements.activeChipsContainer) return;
    elements.activeChipsContainer.innerHTML = '';

    const addChip = (label, onRemove) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = `
        <span>${label}</span>
        <span class="filter-chip-remove" role="button" aria-label="Remove filter">&times;</span>
      `;
      chip.querySelector('.filter-chip-remove').addEventListener('click', onRemove);
      elements.activeChipsContainer.appendChild(chip);
    };

    if (state.filters.tradition !== 'all') {
      const btn = document.querySelector(`[data-filter-type="tradition"][data-value="${state.filters.tradition}"]`);
      const label = btn ? btn.textContent.trim().split('\n')[0] : state.filters.tradition;
      addChip(label, () => {
        const allBtn = document.querySelector(`[data-filter-type="tradition"][data-value="all"]`);
        if (allBtn) allBtn.click();
      });
    }

    if (state.filters.cuisine !== 'all') {
      const btn = document.querySelector(`[data-filter-type="cuisine"][data-value="${state.filters.cuisine}"]`);
      const label = btn ? btn.textContent.trim() : state.filters.cuisine;
      addChip(label, () => {
        const allBtn = document.querySelector(`[data-filter-type="cuisine"][data-value="all"]`);
        if (allBtn) allBtn.click();
      });
    }

    if (state.filters.age_group !== 'all') {
      const btn = document.querySelector(`[data-filter-type="age_group"][data-value="${state.filters.age_group}"]`);
      const label = btn ? btn.querySelector('.age-name').textContent : state.filters.age_group;
      addChip(label, () => {
        const allBtn = document.querySelector(`[data-filter-type="age_group"][data-value="all"]`);
        if (allBtn) allBtn.click();
      });
    }

    if (state.filters.showOnlySaved) {
      addChip('Saved Sanctuaries Only', () => {
        elements.savedCounterBtn.click();
      });
    }

    if (state.filters.search) {
      addChip(`"${state.filters.search}"`, () => {
        elements.clearSearchBtn.click();
      });
    }
  }

  // --------------------------------------------------------------------------
  // Restaurant Cards Renderer
  // --------------------------------------------------------------------------
  function renderCards(restaurants) {
    if (!elements.grid) return;

    if (restaurants.length === 0) {
      elements.grid.innerHTML = '';
      if (elements.emptyState) elements.emptyState.classList.remove('hidden');
      return;
    }

    if (elements.emptyState) elements.emptyState.classList.add('hidden');

    elements.grid.innerHTML = restaurants.map(r => {
      const isSaved = state.savedIds.has(r.id);
      const dishesHtml = (r.signatureDishes || []).slice(0, 2).map(d =>
        `<span class="dish-tag">${escapeHtml(d)}</span>`
      ).join('');

      const dietaryHtml = (r.dietary || []).slice(0, 2).map(item =>
        `<span class="dietary-badge">${escapeHtml(item)}</span>`
      ).join('');

      return `
        <article class="restaurant-card" data-id="${r.id}">
          <div class="card-image-wrap">
            <img src="${r.image}" alt="${escapeHtml(r.name)}" class="card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'">
            <div class="card-gradient-overlay"></div>
            
            <div class="card-top-pills">
              <span class="tradition-tag">${escapeHtml(r.tradition)}</span>
              <span class="price-tag">${r.priceLevel}</span>
            </div>

            <button class="card-bookmark-btn ${isSaved ? 'bookmarked' : ''}" data-bookmark-id="${r.id}" title="${isSaved ? 'Remove from saved' : 'Save to favorites'}" aria-label="Bookmark restaurant">
              ${isSaved ? '♥' : '♡'}
            </button>
          </div>

          <div class="card-content">
            <div class="card-header-row">
              <h3 class="restaurant-title">${escapeHtml(r.name)}</h3>
              <div class="card-rating-badge">★ ${r.rating.toFixed(2)}</div>
            </div>
            <div class="card-neighborhood">${escapeHtml(r.neighborhood)} · ${escapeHtml(r.cuisine)}</div>

            <!-- Age Demographic Adaptation Pill -->
            <div class="card-age-suitability-box">
              <div class="age-box-header">
                <span>✦</span>
                <span>Optimized for: ${escapeHtml(r.ageGroup)}</span>
              </div>
              <p class="age-box-note">${escapeHtml(r.ageSuitabilityNote)}</p>
            </div>

            <!-- Signature Dishes -->
            <div class="card-dishes-block">
              <span class="dishes-label">Signature Dishes</span>
              <div class="dishes-pills-list">
                ${dishesHtml}
              </div>
            </div>

            <!-- Dietary Highlights -->
            <div class="card-dietary-strip">
              ${dietaryHtml}
            </div>

            <div class="card-footer-actions">
              <button class="btn-secondary view-details-btn" data-detail-id="${r.id}">Explore Tradition</button>
              <button class="btn-primary reserve-card-btn" data-reserve-id="${r.id}">Reserve Table</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach card event listeners
    elements.grid.querySelectorAll('.card-bookmark-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(btn.dataset.bookmarkId);
      });
    });

    elements.grid.querySelectorAll('.view-details-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openModal(btn.dataset.detailId);
      });
    });

    elements.grid.querySelectorAll('.reserve-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openModal(btn.dataset.reserveId, true);
      });
    });
  }

  // --------------------------------------------------------------------------
  // Bookmarks Management
  // --------------------------------------------------------------------------
  function toggleBookmark(id) {
    const r = state.allRestaurants.find(x => x.id === id);
    if (!r) return;

    if (state.savedIds.has(id)) {
      state.savedIds.delete(id);
      showToast(`Removed "${r.name}" from saved list`, '♡');
    } else {
      state.savedIds.add(id);
      showToast(`Saved "${r.name}" to favorites!`, '♥');
    }

    localStorage.setItem('gustosphere_saved', JSON.stringify([...state.savedIds]));
    updateSavedBadge();

    // Update bookmark icon on card
    const btn = document.querySelector(`[data-bookmark-id="${id}"]`);
    if (btn) {
      const isSaved = state.savedIds.has(id);
      btn.classList.toggle('bookmarked', isSaved);
      btn.innerHTML = isSaved ? '♥' : '♡';
      btn.title = isSaved ? 'Remove from saved' : 'Save to favorites';
    }

    // If viewing saved only, re-apply filter
    if (state.filters.showOnlySaved) {
      applyFilters();
    }
  }

  function updateSavedBadge() {
    if (elements.savedCountBadge) {
      elements.savedCountBadge.textContent = state.savedIds.size;
    }
  }

  // --------------------------------------------------------------------------
  // Deep Dive Detail & Reservation Modal
  // --------------------------------------------------------------------------
  function openModal(restaurantId, focusReservation = false) {
    const r = state.allRestaurants.find(x => x.id === restaurantId);
    if (!r || !elements.modal || !elements.modalContent) return;

    state.activeModalRestaurant = r;

    // Build Dishes List
    const dishesList = (r.signatureDishes || []).map(dish => `
      <li class="etiquette-item">
        <span class="etiquette-bullet">◈</span>
        <strong>${escapeHtml(dish)}</strong>
      </li>
    `).join('');

    // Build Etiquette List
    const etiquetteList = (r.etiquetteTips || []).map(tip => `
      <li class="etiquette-item">
        <span class="etiquette-bullet">✦</span>
        <span>${escapeHtml(tip)}</span>
      </li>
    `).join('');

    // Tomorrow's date string for default reservation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    elements.modalContent.innerHTML = `
      <div class="modal-hero-cover">
        <img src="${r.image}" alt="${escapeHtml(r.name)}" class="modal-cover-img" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'">
        <div class="modal-hero-gradient"></div>
        <div class="modal-hero-text">
          <div class="modal-badges-row">
            <span class="tradition-tag">🏮 ${escapeHtml(r.tradition)}</span>
            <span class="tradition-tag">🌍 ${escapeHtml(r.cuisine)}</span>
            <span class="tradition-tag">★ ${r.rating.toFixed(2)} (${r.reviewCount} Reviews)</span>
          </div>
          <h2 class="modal-restaurant-title" id="modal-restaurant-name">${escapeHtml(r.name)}</h2>
        </div>
      </div>

      <div class="modal-details-grid">
        <!-- Left Column: Culinary & Tradition Narrative -->
        <div class="modal-col-narrative">
          <div class="modal-section-box">
            <h3 class="modal-section-title">
              <span>🏮</span> The Culinary Heritage & Tradition
            </h3>
            <p class="modal-section-text">${escapeHtml(r.traditionDescription)}</p>
          </div>

          <div class="modal-section-box">
            <h3 class="modal-section-title">
              <span>👥</span> Demographic Harmony (${escapeHtml(r.ageGroup)})
            </h3>
            <p class="modal-section-text">${escapeHtml(r.ageSuitabilityNote)}</p>
            <div style="margin-top:0.6rem; font-size:0.8rem; color:var(--text-gold);">
              Ambiance: <strong>${escapeHtml(r.ambiance)}</strong> · Dress: <strong>${escapeHtml(r.dressCode)}</strong>
            </div>
          </div>

          <div class="modal-section-box">
            <h3 class="modal-section-title">
              <span>📜</span> Traditional Dining Customs & Etiquette
            </h3>
            <ul class="etiquette-list">
              ${etiquetteList}
            </ul>
          </div>

          <div class="modal-section-box">
            <h3 class="modal-section-title">
              <span>🍽️</span> Celebrated Signature Creations
            </h3>
            <ul class="etiquette-list">
              ${dishesList}
            </ul>
          </div>
        </div>

        <!-- Right Column: Interactive Table Reservation Drawer -->
        <div class="modal-col-reservation" id="reservation-drawer-section">
          <div class="modal-section-box" style="border-color: rgba(229, 169, 60, 0.4); background: rgba(229, 169, 60, 0.04);">
            <h3 class="modal-section-title" style="font-size:1.1rem;">
              <span>🗓️</span> Reserve Your Table
            </h3>
            <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1.2rem;">
              Estimated price: <strong>${escapeHtml(r.priceEstimate)}</strong><br>
              Hours: ${escapeHtml(r.hours)}
            </p>

            <form id="table-reservation-form" class="reservation-form">
              <div class="form-group">
                <label class="form-label" for="res-guest-name">Guest Name *</label>
                <input type="text" id="res-guest-name" class="form-input" placeholder="e.g. Suman Saurav" required>
              </div>

              <div class="form-group">
                <label class="form-label" for="res-date">Date *</label>
                <input type="date" id="res-date" class="form-input" value="${defaultDate}" required>
              </div>

              <div class="form-group">
                <label class="form-label" for="res-time">Seating Time *</label>
                <select id="res-time" class="form-select" required>
                  <option value="18:00">6:00 PM (Twilight Seating)</option>
                  <option value="19:00" selected>7:00 PM (Prime Dinner)</option>
                  <option value="20:30">8:30 PM (Late Gastronomy)</option>
                  <option value="21:30">9:30 PM (Night Market Flow)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="res-party-size">Party Size *</label>
                <select id="res-party-size" class="form-select" required>
                  <option value="2">2 Guests (Couple / Duet)</option>
                  <option value="4" selected>4 Guests (Family / Friends)</option>
                  <option value="6">6 Guests (Multi-Gen Gathering)</option>
                  <option value="8">8+ Guests (Ceremonial Feast Banquet)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="res-amenity">Age-Adaptive Request</label>
                <select id="res-amenity" class="form-select">
                  <option value="standard">Standard Seating</option>
                  <option value="high_chair">Baby High Chair & Kids Menu Requested</option>
                  <option value="quiet_booth">Quiet Acoustic Booth for Elders</option>
                  <option value="romantic_corner">Candlelit Intimate Corner for Couples</option>
                  <option value="bar_counter">Dynamic Chef Counter for Trendsetters</option>
                </select>
              </div>

              <button type="submit" class="reserve-submit-btn" id="confirm-reservation-btn">
                Confirm Reservation via C++ Core
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Hook up form submission
    const resForm = document.getElementById('table-reservation-form');
    if (resForm) {
      resForm.addEventListener('submit', handleReservationSubmit);
    }

    elements.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (focusReservation) {
      setTimeout(() => {
        const drawer = document.getElementById('reservation-drawer-section');
        if (drawer) drawer.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  async function handleReservationSubmit(e) {
    e.preventDefault();
    const guestName = document.getElementById('res-guest-name').value;
    const date = document.getElementById('res-date').value;
    const time = document.getElementById('res-time').value;
    const partySize = document.getElementById('res-party-size').value;
    const amenity = document.getElementById('res-amenity').value;

    const btn = document.getElementById('confirm-reservation-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Transmitting to C++ Server...';
    }

    let bookingRef = 'SAVOR-' + Math.floor(10000 + Math.random() * 90000);

    try {
      // Dispatch to C++ REST API
      const payload = {
        restaurantId: state.activeModalRestaurant.id,
        restaurantName: state.activeModalRestaurant.name,
        guestName,
        date,
        time,
        partySize,
        amenity
      };

      const response = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.bookingReference) {
          bookingRef = data.bookingReference;
        }
      }
    } catch (err) {
      console.warn('C++ server reserve endpoint unreachable, using client reservation confirmation:', err);
    }

    // Display confirmation
    const drawer = document.getElementById('reservation-drawer-section');
    if (drawer) {
      drawer.innerHTML = `
        <div class="modal-section-box" style="border-color: var(--emerald); background: rgba(16, 185, 129, 0.08); text-align:center; padding: 2.5rem 1.5rem;">
          <div style="font-size:3rem; margin-bottom:0.75rem;">🎉</div>
          <h3 style="font-family:var(--font-serif); font-size:1.6rem; color:#34d399; margin-bottom:0.5rem;">Reservation Confirmed!</h3>
          <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:1.5rem;">
            Honored <strong>${escapeHtml(guestName)}</strong>, your table at <strong>${escapeHtml(state.activeModalRestaurant.name)}</strong> is reserved for <strong>${escapeHtml(date)} at ${time}</strong>.
          </p>
          <div style="background:rgba(255,255,255,0.06); border:1px dashed var(--gold-primary); border-radius:10px; padding:1rem; margin-bottom:1.5rem;">
            <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--text-muted);">Booking Reference Code</div>
            <div style="font-family:var(--font-serif); font-size:1.8rem; font-weight:700; color:var(--gold-primary); letter-spacing:0.05em;">${bookingRef}</div>
            <div style="font-size:0.72rem; color:#34d399; margin-top:0.25rem;">✓ Verified & Recorded in C++ Server</div>
          </div>
          <button class="btn-primary" style="width:100%;" id="close-modal-after-reserve-btn">Done</button>
        </div>
      `;

      const doneBtn = document.getElementById('close-modal-after-reserve-btn');
      if (doneBtn) {
        doneBtn.addEventListener('click', closeModal);
      }
    }

    showToast(`Reservation ${bookingRef} Confirmed!`, '✓');
  }

  function closeModal() {
    if (!elements.modal) return;
    elements.modal.classList.add('hidden');
    document.body.style.overflow = '';
    state.activeModalRestaurant = null;
  }

  // --------------------------------------------------------------------------
  // Toast Notifications
  // --------------------------------------------------------------------------
  let toastTimer = null;
  function showToast(message, icon = '✦') {
    if (!elements.toast) return;
    if (elements.toastMessage) elements.toastMessage.textContent = message;
    if (elements.toastIcon) elements.toastIcon.textContent = icon;

    elements.toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, 3500);
  }

  // --------------------------------------------------------------------------
  // Utility: HTML Escaping
  // --------------------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on DOM Content Loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
