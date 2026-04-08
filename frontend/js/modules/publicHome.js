const PublicHome = {
  cart: [],
  filterCategory: 'All',
  selectedTableId: '',
  searchText: '',
  reviewRating: 5,

  render() {
    this.renderLayout();
    this.renderHero();
    this.renderFilters();
    this.renderMenuGrid();
    this.renderReviewsSection(); // NEW
    this.updateCartBadge();
  },

  byId(id) {
    return document.getElementById(id);
  },

  // ---------- Store getters ----------
  getMenuItems() {
    return Store.get('menuItems') || [];
  },

  getTables() {
    return Store.get('tables') || [];
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getFeedback() {
    return Store.get('feedback') || [];
  },

  getDiscountPercent() {
    return Store.getDiscountPercent ? Store.getDiscountPercent() : 0;
  },

  getTaxRate() {
    return window.APP_CONFIG?.TAX_RATE || 0.05;
  },

  // ---------- Search / Filter ----------
  syncSearchState() {
    const input = this.byId('publicMenuSearch');
    this.searchText = (input?.value || '').trim().toLowerCase();
  },

  getCategories() {
    return ['All', ...new Set(this.getMenuItems().map((item) => item.category))];
  },

  getFilteredItems() {
    this.syncSearchState();

    let items = [...this.getMenuItems()];

    if (this.filterCategory !== 'All') {
      items = items.filter((item) => item.category === this.filterCategory);
    }

    if (this.searchText) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(this.searchText) ||
        item.category.toLowerCase().includes(this.searchText)
      );
    }

    return items;
  },

  // ---------- Layout ----------
  renderLayout() {
    const page = this.byId('page-home');
    if (!page) return;

    page.innerHTML = `
      <div class="public-home-wrap">
        <div class="public-hero" id="publicHero"></div>

        <div class="public-menu-controls">
          <div class="search-input public-search-wrap">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="M21 21l-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Search dishes..."
              id="publicMenuSearch"
              oninput="PublicHome.filterMenu()"
            >
          </div>

          <div class="filter-chips" id="publicMenuFilterChips"></div>
        </div>

        <div class="menu-grid" id="publicMenuGrid"></div>

        <!-- NEW: Reviews section container -->
        <div id="publicReviewsSection"></div>
      </div>
    `;
  },

  renderHero() {
    const hero = this.byId('publicHero');
    if (!hero) return;

    const discountPercent = this.getDiscountPercent();

    hero.innerHTML = `
      <div class="public-hero-banner">
        <div class="public-brand">
          <div class="public-brand-logo">RsOs</div>
          <div>
            <h1>RestOS</h1>
            <p>Fresh food. Fast ordering. Beautiful dining.</p>
            ${
              discountPercent > 0
                ? `<div class="public-discount-banner">Special Offer: ${discountPercent}% discount on all orders!</div>`
                : ''
            }
          </div>
        </div>

        <div class="public-hero-actions">
          <button class="btn-icon" title="About / Info" onclick="PublicHome.showAbout()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M18 20V10M12 20V4M6 20v-6"></path>
            </svg>
          </button>

          <button class="btn-icon public-cart-btn" title="Cart" onclick="PublicHome.openCartModal()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"></path>
            </svg>
            <span class="public-cart-badge" id="publicCartBadge" style="display:none">0</span>
          </button>

          <button class="btn-icon" title="Track Order" onclick="PublicHome.openTrackOrderModal()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M3 3h18v18H3z"></path>
              <path d="M9 9h6v6H9z"></path>
            </svg>
          </button>

          <button class="btn-icon" title="Staff Login" onclick="App.openLoginModal()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    const searchInput = this.byId('publicMenuSearch');
    if (searchInput) {
      searchInput.value = this.searchText || '';
    }

    this.updateCartBadge();
  },

  // ---------- Filters ----------
  renderFilters() {
    const container = this.byId('publicMenuFilterChips');
    if (!container) return;

    container.innerHTML = this.getCategories()
      .map((category) => `
        <div
          class="filter-chip ${category === this.filterCategory ? 'active' : ''}"
          onclick="PublicHome.setCategory('${App.escapeHTML(category)}', this)"
        >
          ${App.safeText(category)}
        </div>
      `)
      .join('');
  },

  setCategory(category, el) {
    this.filterCategory = category;

    document
      .querySelectorAll('#publicMenuFilterChips .filter-chip')
      .forEach((chip) => chip.classList.remove('active'));

    if (el) el.classList.add('active');

    this.renderMenuGrid();
  },

  filterMenu() {
    this.syncSearchState();
    this.renderMenuGrid();
  },

  // ---------- Menu grid ----------
  renderMenuGrid() {
    const grid = this.byId('publicMenuGrid');
    if (!grid) return;

    const items = this.getFilteredItems();

    if (!items.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <p>No menu items found</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map((item) => this.renderMenuCard(item)).join('');
  },

  renderMenuCard(item) {
    const media = item.imageUrl
      ? `
        <img
          src="${App.safeText(item.imageUrl, '')}"
          alt="${App.safeText(item.name)}"
          class="menu-item-image"
        >
      `
      : `
        <div class="menu-item-emoji-wrap">
          ${App.safeText(item.emoji || '🍽️')}
        </div>
      `;

    return `
      <div class="menu-card public-menu-card">
        <div class="menu-card-img menu-item-media">
          ${media}
        </div>
        <div class="menu-card-body">
          <h4>${App.safeText(item.name)}</h4>
          <div class="menu-category">${App.safeText(item.category)}</div>
          <div class="menu-item-description">
            ${App.safeText(item.description || '')}
          </div>
          <div class="menu-price">${App.currency(item.price)}</div>
        </div>

        <div class="menu-card-footer public-order-footer">
          <button
            type="button"
            class="btn btn-primary btn-sm public-order-btn"
            onclick="PublicHome.addToCart('${item.id}')"
          >
            Add to Cart
          </button>
        </div>
      </div>
    `;
  },

  // ---------- About ----------
  showAbout() {
    App.openModal(
      'About RestaurantOS',
      `
        <div class="modal-stack">
          <div class="panel-muted">Browse our menu and place orders for delivery or table dining.</div>
          <div class="panel-muted">Add multiple dishes to your cart and place one complete order.</div>
          <div class="panel-muted">Staff can log in using the login icon to manage kitchen, billing, and inventory.</div>
        </div>
      `,
      `<button class="btn btn-primary" onclick="App.closeModal()">Close</button>`
    );
  },

  // ---------- Cart ----------
  getCartCount() {
    return this.cart.reduce((sum, item) => sum + item.qty, 0);
  },

  getCartTotals() {
    const taxRate = this.getTaxRate();
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = subtotal * taxRate;

    let discountPercent = this.getDiscountPercent();
    if (discountPercent < 0) discountPercent = 0;
    if (discountPercent > 100) discountPercent = 100;

    const discount = subtotal * (discountPercent / 100);
    const total = subtotal + tax - discount;

    return { subtotal, tax, discountPercent, discount, total };
  },

  updateCartBadge() {
    const badge = this.byId('publicCartBadge');
    if (!badge) return;

    const count = this.getCartCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  },

  addToCart(menuId) {
    const item = this.getMenuItems().find((entry) => entry.id === menuId);
    if (!item) return;

    const existing = this.cart.find((entry) => entry.menuId === menuId);

    if (existing) {
      if (existing.qty >= item.stock) {
        App.toast('Not enough stock available', 'warning');
        return;
      }
      existing.qty += 1;
    } else {
      this.cart.push({
        menuId: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        imageUrl: item.imageUrl || '',
        emoji: item.emoji || '🍽️'
      });
    }

    this.updateCartBadge();
    App.toast(`${item.name} added to cart`, 'success');
  },

  changeCartQty(menuId, delta) {
    const cartItem = this.cart.find((entry) => entry.menuId === menuId);
    if (!cartItem) return;

    const menuItem = this.getMenuItems().find((entry) => entry.id === menuId);
    cartItem.qty += delta;

    if (cartItem.qty <= 0) {
      this.cart = this.cart.filter((entry) => entry.menuId !== menuId);
    } else if (menuItem && cartItem.qty > menuItem.stock) {
      cartItem.qty = menuItem.stock;
      App.toast('Not enough stock available', 'warning');
    }

    this.updateCartBadge();

    if (!this.cart.length) {
      App.closeModal();
      App.toast('Your cart is empty', 'info');
      return;
    }

    this.openCartModal(true);
  },

  removeFromCart(menuId) {
    this.cart = this.cart.filter((entry) => entry.menuId !== menuId);
    this.updateCartBadge();

    if (!this.cart.length) {
      App.closeModal();
      App.toast('Your cart is empty', 'info');
      return;
    }

    this.openCartModal(true);
  },

  getAvailableTables() {
    return this.getTables().filter((table) => table.status === 'available');
  },

  renderCartItem(item) {
    const media = item.imageUrl
      ? `
        <img
          src="${App.safeText(item.imageUrl, '')}"
          alt="${App.safeText(item.name)}"
          class="public-cart-item-image"
        >
      `
      : `
        <span class="public-cart-item-emoji">${App.safeText(item.emoji || '🍽️')}</span>
      `;

    return `
      <div class="public-cart-item">
        <div class="public-cart-thumb">
          ${media}
        </div>

        <div class="public-cart-info">
          <div class="public-cart-name">${App.safeText(item.name)}</div>
          <div class="public-cart-price">${App.currency(item.price)} each</div>
        </div>

        <div class="public-cart-qty">
          <button class="btn btn-secondary btn-xs" onclick="PublicHome.changeCartQty('${item.menuId}', -1)">−</button>
          <span>${item.qty}</span>
          <button class="btn btn-secondary btn-xs" onclick="PublicHome.changeCartQty('${item.menuId}', 1)">+</button>
        </div>

        <div class="public-cart-total">${App.currency(item.price * item.qty)}</div>
        <button class="btn btn-danger btn-xs" onclick="PublicHome.removeFromCart('${item.menuId}')">Remove</button>
      </div>
    `;
  },

  renderTableOption(table) {
    return `
      <div class="public-table-card" onclick="PublicHome.selectTable('${table.id}', this)">
        <div class="public-table-card-image">🪑</div>
        <div class="public-table-card-number">Table ${table.number}</div>
        <div class="public-table-card-seats">${table.seats} seats</div>
      </div>
    `;
  },

  openCartModal(reopen = false) {
    if (!this.cart.length) {
      if (!reopen) App.toast('Your cart is empty', 'info');
      return;
    }

    this.selectedTableId = '';

    const availableTables = this.getAvailableTables();
    const { subtotal, tax, discountPercent, discount, total } = this.getCartTotals();

    const cartHtml = this.cart.map((item) => this.renderCartItem(item)).join('');
    const tablesHtml = availableTables.length
      ? availableTables.map((table) => this.renderTableOption(table)).join('')
      : `<div class="text-soft">No available tables right now</div>`;

    const body = `
      <div class="cart-modal-intro">
        <h4 class="cart-modal-title">Your Cart</h4>
        <p class="cart-modal-subtitle">Review your selected dishes before placing your order.</p>
      </div>

      <div class="public-cart-list">
        ${cartHtml}
      </div>

      <div class="cart-summary-box">
        <div class="summary-row"><span>Subtotal</span><span>${App.currency(subtotal)}</span></div>
        <div class="summary-row"><span>Tax (${(this.getTaxRate() * 100).toFixed(0)}%)</span><span>${App.currency(tax)}</span></div>
        <div class="summary-row"><span>Discount (${discountPercent}%)</span><span>-${App.currency(discount)}</span></div>
        <div class="summary-row total"><span>Total</span><span>${App.currency(total)}</span></div>
      </div>

      <div class="form-group">
        <label class="form-label">Order Type</label>
        <select class="form-select" id="publicOrderType" onchange="PublicHome.toggleOrderTypeFields()">
          <option value="delivery">Home Delivery</option>
          <option value="dine-in">Choose Table</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Customer Name</label>
        <input type="text" class="form-input" id="publicCustomerName" placeholder="Your name">
      </div>

      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input type="text" class="form-input" id="publicCustomerPhone" placeholder="e.g. 017XXXXXXXX">
      </div>

      <div class="form-group" id="deliveryAddressGroup">
        <label class="form-label">Home Address</label>
        <textarea class="form-textarea" id="publicDeliveryAddress" placeholder="Enter your delivery address"></textarea>
      </div>

      <div class="form-group" id="tableSelectGroup" style="display:none">
        <label class="form-label">Choose Available Table</label>
        <div class="public-table-picker">
          ${tablesHtml}
        </div>
        <input type="hidden" id="publicTableSelect" value="">
      </div>

      <div class="form-group">
        <label class="form-label">Payment Method</label>
        <select class="form-select" id="publicPaymentMethod">
          <option value="bKash">bKash</option>
          <option value="Nagad">Nagad</option>
          <option value="Rocket">Rocket</option>
          <option value="COD">Cash on Delivery</option>
          <option value="cash">Cash</option>
        </select>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="publicSubmitOrderBtn" onclick="PublicHome.submitCartOrder()">Place Order</button>
    `;

    App.openModal('Place Your Order', body, footer);
    this.toggleOrderTypeFields();
  },

  toggleOrderTypeFields() {
    const type = this.byId('publicOrderType');
    const deliveryGroup = this.byId('deliveryAddressGroup');
    const tableGroup = this.byId('tableSelectGroup');
    const orderType = type?.value || 'delivery';

    if (deliveryGroup) deliveryGroup.style.display = orderType === 'delivery' ? 'block' : 'none';
    if (tableGroup) tableGroup.style.display = orderType === 'dine-in' ? 'block' : 'none';
  },

  selectTable(tableId, el) {
    this.selectedTableId = tableId;

    const hiddenInput = this.byId('publicTableSelect');
    if (hiddenInput) hiddenInput.value = tableId;

    document.querySelectorAll('.public-table-card').forEach((card) => card.classList.remove('selected'));
    if (el) el.classList.add('selected');
  },

  validateOrderForm({ orderType, customerPhone, deliveryAddress, tableId }) {
    if (!customerPhone) {
      App.toast('Phone number is required', 'warning');
      return false;
    }

    if (orderType === 'delivery' && !deliveryAddress) {
      App.toast('Delivery address is required', 'warning');
      return false;
    }

    if (orderType === 'dine-in' && !tableId) {
      App.toast('Please choose an available table', 'warning');
      return false;
    }

    return true;
  },

  buildOrderPayload({ orderType, customerName, customerPhone, deliveryAddress, paymentMethod, tableId }) {
    const { subtotal, tax, discountPercent, discount, total } = this.getCartTotals();

    return {
      orderType,
      customerName,
      customerPhone,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : '',
      paymentMethod,
      tableId: orderType === 'dine-in' ? tableId : null,
      items: this.cart.map((item) => ({ menuId: item.menuId, qty: item.qty, price: item.price })),
      subtotal,
      tax,
      discountPercent,
      discount,
      total
    };
  },

  showOrderPlacedModal(orderData) {
    const estimatedText = orderData.estimatedPrepMinutes
      ? `Estimated completion time: <strong>${orderData.estimatedPrepMinutes} min</strong>`
      : `Your order is waiting for kitchen confirmation. Estimated completion time will appear once cooking starts.`;

    App.openModal(
      `Order #${orderData.orderNumber} Placed`,
      `
        <div class="modal-stack">
          <div class="panel-muted"><strong>Status:</strong> ${App.safeText(orderData.status || 'pending')}</div>
          <div class="panel-info">${estimatedText}</div>
          <div class="panel-muted">Total: <strong>${App.currency(orderData.total || 0)}</strong></div>
        </div>
      `,
      `<button class="btn btn-primary" onclick="App.closeModal()">OK</button>`
    );
  },

  openTrackOrderModal() {
    const body = `
      <div class="form-group">
        <label class="form-label">Order Number</label>
        <input type="text" class="form-input" id="trackOrderNumber" placeholder="Enter your order number">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="PublicHome.trackOrder()">Track Order</button>
    `;

    App.openModal('Track Your Order', body, footer);
  },

  trackOrder() {
    const orderNumber = (this.byId('trackOrderNumber')?.value || '').trim();
    if (!orderNumber) {
      App.toast('Please enter your order number', 'warning');
      return;
    }

    const order = this.getOrders().find((entry) => String(entry.id) === String(orderNumber));
    if (!order) {
      App.toast('Order not found', 'error');
      return;
    }

    const timingHtml = order.estimatedPrepMinutes
      ? `
        <div class="panel-info">
          <strong>Estimated Time:</strong> ${order.estimatedPrepMinutes} min<br>
          <strong>Expected Ready:</strong> ${App.formatDateTime(order.estimatedReadyAt)}
        </div>
      `
      : `<div class="panel-muted">Kitchen has not started cooking yet.</div>`;

    App.openModal(
      `Order #${order.id}`,
      `
        <div class="modal-stack">
          <div class="panel-muted"><strong>Status:</strong> ${App.safeText(order.status)}</div>
          ${timingHtml}
          <div class="panel-muted"><strong>Total:</strong> ${App.currency(order.total || 0)}</div>
        </div>
      `,
      `<button class="btn btn-primary" onclick="App.closeModal()">Close</button>`
    );
  },

  async submitCartOrder() {
    if (!this.cart.length) {
      App.toast('Your cart is empty', 'warning');
      return;
    }

    const submitBtn = this.byId('publicSubmitOrderBtn');

    const orderType = this.byId('publicOrderType')?.value || 'delivery';
    const customerName = (this.byId('publicCustomerName')?.value || '').trim();
    const customerPhone = (this.byId('publicCustomerPhone')?.value || '').trim();
    const deliveryAddress = (this.byId('publicDeliveryAddress')?.value || '').trim();
    const paymentMethod = this.byId('publicPaymentMethod')?.value || 'cash';
    const tableId = this.byId('publicTableSelect')?.value || '';

    const isValid = this.validateOrderForm({ orderType, customerPhone, deliveryAddress, tableId });
    if (!isValid) return;

    App.setButtonLoading(submitBtn, true, 'Placing...', 'Place Order');

    try {
      const payload = this.buildOrderPayload({
        orderType,
        customerName,
        customerPhone,
        deliveryAddress,
        paymentMethod,
        tableId
      });

      const json = await Store.request('/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      this.cart = [];
      this.selectedTableId = '';
      this.updateCartBadge();

      await Store.fetchMenuItems();
      await Store.fetchOrders();

      App.closeModal();
      this.showOrderPlacedModal(json.data);
    } catch (error) {
      console.error('Public order submit failed:', error);
      App.toast(error.message || 'Failed to place order', 'error');
    } finally {
      App.setButtonLoading(submitBtn, false, 'Placing...', 'Place Order');
    }
  },

  // ============================================================
  // REVIEWS / FEEDBACK (NEW)
  // ============================================================

  getTopReviews(limit = 3) {
    return [...this.getFeedback()]
      .sort((a, b) => {
        const r = Number(b.rating || 0) - Number(a.rating || 0);
        if (r !== 0) return r;
        return Number(b.timestamp || 0) - Number(a.timestamp || 0);
      })
      .slice(0, limit);
  },

  renderStars(rating = 0) {
    const r = Math.max(0, Math.min(5, Number(rating || 0)));
    const filled = '★'.repeat(r);
    const empty = '☆'.repeat(5 - r);
    return `<span style="color:var(--warning);font-size:0.95rem">${filled}${empty}</span>`;
  },

  renderReviewsSection() {
    const container = this.byId('publicReviewsSection');
    if (!container) return;

    const top = this.getTopReviews(3);

    const cards = top.length
      ? top
          .map(
            (r) => `
        <div class="card" style="background:var(--bg-card);border-radius:var(--radius-lg)">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px">
            <div style="font-weight:800;color:var(--text-primary)">${App.safeText(r.name || 'Anonymous')}</div>
            ${this.renderStars(r.rating)}
          </div>
          <div style="color:var(--text-secondary);font-size:0.85rem;line-height:1.5">
            "${App.safeText(r.text || '')}"
          </div>
          <div style="margin-top:10px;color:var(--text-muted);font-size:0.75rem">
            ${App.timeAgo(r.timestamp)}
          </div>
        </div>
      `
          )
          .join('')
      : `<div class="panel-muted">No reviews yet. Be the first to review!</div>`;

    container.innerHTML = `
      <div class="card" style="margin-top:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Customer Reviews</div>
            <div class="card-subtitle">Top rated feedback from our customers</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="PublicHome.openAllReviewsModal()">View All Reviews</button>
            <button class="btn btn-primary btn-sm" onclick="PublicHome.openAddReviewModal()">Write a Review</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
          ${cards}
        </div>
      </div>
    `;
  },

  openAllReviewsModal() {
    const reviews = [...this.getFeedback()].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

    const list = reviews.length
      ? reviews
          .map(
            (r) => `
        <div class="panel-muted" style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <strong>${App.safeText(r.name || 'Anonymous')}</strong>
            ${this.renderStars(r.rating)}
          </div>
          <div style="color:var(--text-secondary)">${App.safeText(r.text || '')}</div>
          <div class="text-soft">${App.timeAgo(r.timestamp)}</div>
        </div>
      `
          )
          .join('')
      : `<div class="empty-state"><p>No reviews yet</p></div>`;

    App.openModal(
      'All Customer Reviews',
      `<div class="modal-stack">${list}</div>`,
      `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`
    );
  },

  openAddReviewModal() {
    this.reviewRating = 5;

    const body = `
      <div class="form-group">
        <label class="form-label">Your Name</label>
        <input class="form-input" id="publicReviewName" placeholder="Name (optional)">
      </div>

      <div class="form-group">
        <label class="form-label">Rating</label>
        <div id="publicReviewStars" style="display:flex;gap:6px;font-size:1.6rem;cursor:pointer">
          ${[1,2,3,4,5].map((n) => `<span data-star="${n}" onclick="PublicHome.setReviewRating(${n})">★</span>`).join('')}
        </div>
        <input type="hidden" id="publicReviewRating" value="5">
      </div>

      <div class="form-group">
        <label class="form-label">Comment</label>
        <textarea class="form-textarea" id="publicReviewText" rows="3" placeholder="Write your feedback..."></textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="submitPublicReviewBtn" onclick="PublicHome.submitReview()">Submit</button>
    `;

    App.openModal('Write a Review', body, footer);
    this.setReviewRating(5);
  },

  setReviewRating(rating) {
    this.reviewRating = Math.max(1, Math.min(5, Number(rating || 5)));

    const hidden = this.byId('publicReviewRating');
    if (hidden) hidden.value = String(this.reviewRating);

    document.querySelectorAll('#publicReviewStars span').forEach((node) => {
      const star = Number(node.dataset.star || 0);
      node.style.color = star <= this.reviewRating ? 'var(--warning)' : 'var(--text-muted)';
    });
  },

  async submitReview() {
    const btn = this.byId('submitPublicReviewBtn');
    const name = (this.byId('publicReviewName')?.value || '').trim() || 'Anonymous';
    const rating = parseInt(this.byId('publicReviewRating')?.value || '5', 10);
    const text = (this.byId('publicReviewText')?.value || '').trim();

    if (!text) {
      App.toast('Please write a comment', 'warning');
      return;
    }

    App.setButtonLoading(btn, true, 'Submitting...', 'Submit');

    try {
      await Store.request('/feedback', {
        method: 'POST',
        body: JSON.stringify({ name, rating, text })
      });

      await Store.fetchFeedback();
      App.closeModal();
      this.renderReviewsSection();
      App.toast('Thanks for your review!', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to submit review', 'error');
    } finally {
      App.setButtonLoading(btn, false, 'Submitting...', 'Submit');
    }
  }
};