const App = {
  validPages: [
    'home',
    'dashboard',
    'profile',
    'menu',
    'floor',
    'pos',
    'kitchen',
    'inventory',
    'analytics',
    'billing',
    'sync',
    'staff'
  ],

  protectedPages: [
    'dashboard',
    'profile',
    'menu',
    'floor',
    'pos',
    'kitchen',
    'inventory',
    'analytics',
    'billing',
    'sync',
    'staff'
  ],

  // Role access rules (admin/manager can access all protected pages by default)
  // Others are restricted by these lists.
  pageRoles: {
    // Admin/Manager only
    staff: ['admin', 'manager'],

    // Cashier + Admin/Manager
    dashboard: ['admin', 'manager', 'cashier'],
    inventory: ['admin', 'manager', 'cashier'],
    analytics: ['admin', 'manager', 'cashier'],
    billing: ['admin', 'manager', 'cashier'],

    // Operational pages (Waiter/Kitchen/Cashier/Admin/Manager)
    profile: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'],
    menu: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'],
    floor: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'],
    pos: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'],
    kitchen: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'],

    // Sync only: waiter + kitchen + admin/manager (cashier excluded)
    sync: ['admin', 'manager', 'waiter', 'kitchen']
  },

  pageTitles: {
    home: ['RestaurantOS', 'Explore menu & place your order'],
    dashboard: ['Dashboard', 'Overview & Insights'],
    profile: ['My Profile', 'View your info, salary & payment history'],
    menu: ['Menu Engine', 'Manage food items & pricing'],
    floor: ['Floor Map', 'Table management & status'],
    pos: ['Point of Sale', 'Create & manage orders'],
    kitchen: ['Order Tracker', 'Kitchen order pipeline'],
    inventory: ['Inventory', 'Stock management & alerts'],
    analytics: ['Analytics', 'Reports & customer feedback'],
    billing: ['Billing', 'Invoices & receipts'],
    sync: ['Sync Center', 'Offline queue & conflict management'],
    staff: ['Staff Management', 'Manage staff, roles, status and records']
  },

  initCompleted: false,

  async init() {
    try {
      await Store.init();
      this.setupDateTime();
      this.bindGlobalEvents();
      this.subscribeToStore();
      this.refreshUI();
      this.startKitchenDeadlineWatcher();

      const initialPage = this.getPageFromHash() || 'home';
      await this.navigate(initialPage, false);

      this.initCompleted = true;
    } catch (error) {
      console.error('App initialization failed:', error);
      this.toast(error.message || 'Failed to initialize app', 'error');
    }
  },

  bindGlobalEvents() {
    const sidebarOverlay = this.byId('sidebarOverlay');
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => this.toggleSidebar(false));
    }
  },

  subscribeToStore() {
    Store.subscribe((key) => {
      this.updatePendingBadge();
      this.updateSyncQueueBadge();
      this.updateNotificationCount();
      this.updateAuthUI();
      this.updateRoleBasedNav();
      this.rerenderCurrentPageOnStateChange(key);

      if (key === 'settings' && Store.getCurrentPage() === 'home') {
        try {
          PublicHome.render();
        } catch (error) {
          console.error('Failed to rerender PublicHome after settings change:', error);
        }
      }

      if (key === 'settings' && Store.getCurrentPage() === 'pos') {
        try {
          POS.renderCart();
        } catch (error) {
          console.error('Failed to rerender POS cart after settings change:', error);
        }
      }
    });
  },

  refreshUI() {
    this.updatePendingBadge();
    this.updateSyncQueueBadge();
    this.updateNotificationCount();
    this.updateAuthUI();
    this.updateRoleBasedNav();
  },

  byId(id) {
    return document.getElementById(id);
  },

  escapeHTML(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  safeText(value, fallback = '-') {
    return value == null || value === '' ? fallback : this.escapeHTML(String(value));
  },

  getPageFromHash() {
    const hash = window.location.hash.replace('#/', '').replace('#', '').trim();
    return this.validPages.includes(hash) ? hash : null;
  },

  setHash(page) {
    const newHash = `#/${page}`;
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  },

  getDefaultPageForRole(role) {
    if (!role) return 'home';

    if (role === 'admin' || role === 'manager') return 'dashboard';
    if (role === 'cashier') return 'dashboard';
    if (role === 'kitchen') return 'kitchen';
    if (role === 'waiter') return 'pos';

    return 'home';
  },

  canAccessPage(page) {
    if (!this.protectedPages.includes(page)) {
      return { allowed: true };
    }

    if (!Store.isAuthenticated()) {
      return { allowed: false, reason: 'auth' };
    }

    const user = Store.get('authUser');

    // Admin/Manager can access all protected pages
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      return { allowed: true };
    }

    const allowedRoles = this.pageRoles[page];
    if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
      return { allowed: false, reason: 'role' };
    }

    return { allowed: true };
  },

  async navigate(page, updateHash = true) {
    if (!this.validPages.includes(page)) page = 'home';

    const access = this.canAccessPage(page);

    if (!access.allowed) {
      if (access.reason === 'auth') {
        // Don’t let public land on staff screens
        this.toast('Staff login required', 'warning');
        this.openLoginModal();
        page = 'home';
      } else if (access.reason === 'role') {
        this.toast('Access denied', 'error');
        const role = Store.get('authUser')?.role || null;
        page = this.getDefaultPageForRole(role);
      }
    }

    Store.setCurrentPage(page);

    if (updateHash) {
      this.setHash(page);
    }

    this.updateNavigation(page);
    this.updateVisiblePage(page);
    this.updatePageMeta(page);
// Prefetch analytics feedback ONCE when navigating to analytics
if (page === 'analytics') {
  const user = Store.get('authUser');
  const canModerate = user && (user.role === 'admin' || user.role === 'manager');
  await Store.fetchFeedback(!!canModerate);
}
    try {
      await this.renderPage(page);
    } catch (error) {
      console.error(`Render failed for page "${page}":`, error);
      this.toast(`Failed to render ${page}`, 'error');
    }

    this.closeSidebar();
  },

  updateNavigation(page) {
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  },

  updateVisiblePage(page) {
    document.querySelectorAll('.page-view').forEach((view) => {
      view.classList.toggle('active', view.id === `page-${page}`);
    });

    const app = this.byId('app');
    if (app) {
      app.classList.toggle('public-mode', page === 'home');
    }
  },

  updatePageMeta(page) {
    const titleEl = this.byId('pageTitle');
    const breadcrumbEl = this.byId('pageBreadcrumb');
    const [title, subtitle] = this.pageTitles[page] || [page, ''];

    if (titleEl) titleEl.textContent = title;
    if (breadcrumbEl) breadcrumbEl.textContent = subtitle;
  },

  async renderPage(page) {
    const renderers = {
      home: async () => PublicHome.render(),
      dashboard: async () => Dashboard.render(),

      profile: async () => {
        if (typeof Profile?.load === 'function') {
          await Profile.load();
        } else {
          throw new Error('Profile module not loaded');
        }
      },

      menu: async () => MenuEngine.render(),
      floor: async () => FloorMap.render(),
      pos: async () => POS.render(),
      kitchen: async () => Kitchen.render(),
      inventory: async () => Inventory.render(),

      analytics: async () => {
  Analytics.render(); // render only, no fetching here
},

      billing: async () => Billing.render(),
      sync: async () => SyncCenter.render(),
      staff: async () => StaffPage.load()
    };

    const renderFn = renderers[page];
    if (typeof renderFn === 'function') {
      await renderFn();
    }
  },

  rerenderCurrentPageOnStateChange(key) {
    const page = Store.getCurrentPage();

    const pageDependencies = {
      home: ['menuItems', 'tables', 'settings', 'orders', 'feedback'],
      dashboard: ['orders', 'tables', 'menuItems'],
      kitchen: ['orders'],
      billing: ['orders'],
      floor: ['tables'],
      pos: ['menuItems', 'tables', 'settings'],
      inventory: ['menuItems'],
      analytics: ['orders', 'feedback'],
      sync: ['orders', 'tables', 'menuItems'],
      staff: ['staff'],
      profile: ['authUser']
    };

    const deps = pageDependencies[page] || [];
    if (!deps.includes(key)) return;

    try {
      this.renderPage(page);
    } catch (error) {
      console.error(`Re-render failed for "${page}" after state change "${key}":`, error);
    }
  },

  async handleRouteChange() {
    const page = this.getPageFromHash() || 'home';
    await this.navigate(page, false);
  },

  toggleSidebar(forceState = null) {
    const sidebar = this.byId('sidebar');
    const overlay = this.byId('sidebarOverlay');
    if (!sidebar || !overlay) return;

    const shouldOpen =
      typeof forceState === 'boolean'
        ? forceState
        : !sidebar.classList.contains('open');

    sidebar.classList.toggle('open', shouldOpen);
    overlay.classList.toggle('show', shouldOpen);
  },

  closeSidebar() {
    this.toggleSidebar(false);
  },

  setupDateTime() {
    const update = () => {
      const now = new Date();
      const el = this.byId('currentDateTime');
      if (!el) return;

      el.textContent = now.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    update();
    setInterval(update, 30000);
  },

  updatePendingBadge() {
    const badge = this.byId('pendingBadge');
    if (!badge) return;

    const pending = (Store.get('orders') || []).filter((order) => order.status === 'pending').length;
    badge.textContent = pending;
    badge.style.display = pending > 0 ? 'inline-block' : 'none';
  },

  updateSyncQueueBadge() {
    const badge = this.byId('syncQueueBadge');
    if (!badge) return;

    const queueLength = Store.getQueue().length;
    badge.textContent = queueLength;
    badge.style.display = queueLength > 0 ? 'inline-block' : 'none';
  },

  getDueSoonOrders() {
    const now = Date.now();

    return (Store.get('orders') || []).filter((order) => {
      if (order.status !== 'in-progress' || !order.estimatedReadyAt) return false;
      const diff = order.estimatedReadyAt - now;
      const minutesLeft = Math.ceil(diff / 60000);
      return minutesLeft <= 10 && minutesLeft >= 0;
    });
  },

  getLateOrders() {
    const now = Date.now();

    return (Store.get('orders') || []).filter((order) => {
      if (order.status !== 'in-progress' || !order.estimatedReadyAt) return false;
      return now > order.estimatedReadyAt;
    });
  },

  updateNotificationCount() {
    const badge = this.byId('notificationCountBadge');
    if (!badge) return;

    const pending = (Store.get('orders') || []).filter((order) => order.status === 'pending').length;
    const lowStock = (Store.get('menuItems') || []).filter((item) => item.stock <= 10).length;
    const syncQueue = Store.getQueue().length;
    const dueSoon = this.getDueSoonOrders().length;
    const late = this.getLateOrders().length;

    const total = pending + lowStock + syncQueue + dueSoon + late;

    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  },

  updateAuthUI() {
    const userInfo = this.byId('staffAuthInfo');
    const appContainer = this.byId('app');
    const user = Store.get('authUser');

    if (appContainer) {
      appContainer.classList.toggle('is-authenticated', !!user);
    }

    if (!userInfo) return;

    if (!user) {
      userInfo.innerHTML = '';
      return;
    }

    userInfo.innerHTML = `
      <div class="staff-auth-chip">
        <span class="staff-auth-name">${this.safeText(user.fullName)}</span>
        <span class="staff-auth-role">${this.safeText(user.role)}</span>
        <button class="btn btn-secondary btn-xs" onclick="App.logout()">Logout</button>
      </div>
    `;
  },

  // UPDATED: sidebar shows only what the role can access
  updateRoleBasedNav() {
    const user = Store.get('authUser');
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    nav.querySelectorAll('.nav-item[data-page]').forEach((item) => {
      const page = item.dataset.page;

      if (page === 'home') {
        item.style.display = '';
        return;
      }

      if (!user) {
        item.style.display = 'none';
        return;
      }

      const access = this.canAccessPage(page);
      item.style.display = access.allowed ? '' : 'none';
    });
  
    // Hide empty section labels
    const children = Array.from(nav.children);
    let currentLabel = null;
    let labelHasVisibleItems = false;

    const flushLabel = () => {
      if (!currentLabel) return;
      currentLabel.style.display = labelHasVisibleItems ? '' : 'none';
    };

    for (const el of children) {
      if (el.classList.contains('nav-section-label')) {
        flushLabel();
        currentLabel = el;
        labelHasVisibleItems = false;

        if (!user && !el.classList.contains('public-only-nav')) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
        }
        continue;
      }

      if (el.classList.contains('nav-item')) {
        if (el.style.display !== 'none') labelHasVisibleItems = true;
      }
    }

    flushLabel();
  },

  openModal(title, bodyHTML, footerHTML = '') {
    const titleEl = this.byId('modalTitle');
    const bodyEl = this.byId('modalBody');
    const footerEl = this.byId('modalFooter');
    const overlay = this.byId('modalOverlay');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHTML;
    if (footerEl) footerEl.innerHTML = footerHTML;
    if (overlay) overlay.classList.add('show');
  },

  closeModal() {
    const overlay = this.byId('modalOverlay');
    if (overlay) overlay.classList.remove('show');
  },

  openLoginModal() {
    const body = `
      <div class="modal-stack">
        <div class="modal-center">
          <div class="login-logo-box">Rs</div>
          <h3 class="modal-heading">Staff Login</h3>
          <p class="modal-subtext">Only authorized staff can access the management dashboard.</p>
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="loginEmail" placeholder="Enter email">
        </div>

        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" id="loginPassword" placeholder="Enter password">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="loginSubmitBtn" onclick="App.submitLogin()">Login</button>
    `;

    this.openModal('Staff Login', body, footer);
  },

  async submitLogin() {
    const email = (this.byId('loginEmail')?.value || '').trim();
    const password = (this.byId('loginPassword')?.value || '').trim();
    const submitBtn = this.byId('loginSubmitBtn');

    if (!email || !password) {
      this.toast('Email and password are required', 'warning');
      return;
    }

    this.setButtonLoading(submitBtn, true, 'Logging in...', 'Login');

    try {
      const user = await Store.login(email, password);
      this.closeModal();
      this.toast(`Welcome back, ${this.safeText(user.fullName)}`, 'success');

      await this.navigate(this.getDefaultPageForRole(user.role));
    } catch (error) {
      this.toast(error.message || 'Login failed', 'error');
    } finally {
      this.setButtonLoading(submitBtn, false, 'Logging in...', 'Login');
    }
  },

  logout() {
    Store.logout();
    this.toast('Logged out successfully', 'info');
    this.navigate('home');
  },

  setButtonLoading(button, isLoading, loadingText, normalText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : normalText;
  },

  toast(message, type = 'success') {
    const container = this.byId('toastContainer');
    if (!container) return;

    const colors = {
      success: 'var(--success)',
      error: 'var(--danger)',
      warning: 'var(--warning)',
      info: 'var(--info)'
    };

    const icons = {
      success: `<svg fill="none" stroke="${colors.success}" stroke-width="2" viewBox="0 0 24 24" width="20" height="20"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>`,
      error: `<svg fill="none" stroke="${colors.error}" stroke-width="2" viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg fill="none" stroke="${colors.warning}" stroke-width="2" viewBox="0 0 24 24" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg fill="none" stroke="${colors.info}" stroke-width="2" viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${this.safeText(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  showNotifications() {
    const pending = (Store.get('orders') || []).filter((order) => order.status === 'pending').length;
    const lowStock = (Store.get('menuItems') || []).filter((item) => item.stock <= 10).length;
    const syncQueue = Store.getQueue().length;
    const dueSoonOrders = this.getDueSoonOrders();
    const lateOrders = this.getLateOrders();

    const dueSoonHtml = dueSoonOrders.length
      ? dueSoonOrders
          .map(
            (order) => `
          <div class="panel-warning">
            <strong>Order #${order.id}</strong> due in 10 minutes or less
          </div>
        `
          )
          .join('')
      : '<div class="panel-muted">No orders due soon</div>';

    const lateHtml = lateOrders.length
      ? lateOrders
          .map((order) => {
            const lateMinutes = Math.ceil((Date.now() - order.estimatedReadyAt) / 60000);
            return `
              <div class="panel-danger">
                <strong>Order #${order.id}</strong> late by ${lateMinutes} minute(s)
              </div>
            `;
          })
          .join('')
      : '<div class="panel-muted">No overdue orders</div>';

    const html = `
      <div class="modal-stack">
        <div class="panel-muted"><strong>${pending}</strong> pending order(s) in kitchen</div>
        <div class="panel-danger"><strong>${lowStock}</strong> item(s) with low stock</div>
        <div class="panel-info"><strong>${syncQueue}</strong> queued offline change(s)</div>
        <div>
          <strong>Due Soon</strong>
          <div class="modal-stack" style="margin-top:8px">${dueSoonHtml}</div>
        </div>
        <div>
          <strong>Overdue</strong>
          <div class="modal-stack" style="margin-top:8px">${lateHtml}</div>
        </div>
      </div>
    `;

    this.openModal('Notifications', html, `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`);
  },

  startKitchenDeadlineWatcher() {
    setInterval(() => {
      const dueSoonOrders = this.getDueSoonOrders();

      dueSoonOrders.forEach((order) => {
        const notifyKey = `order_due_${order.id}`;
        if (sessionStorage.getItem(notifyKey)) return;

        sessionStorage.setItem(notifyKey, '1');
        this.toast(`Order #${order.id} is due within 10 minutes`, 'warning');
      });
    }, 60000);
  },

  currency(amount) {
    const symbol = window.APP_CONFIG?.CURRENCY_SYMBOL || '৳';
    return symbol + Number(amount || 0).toFixed(2);
  },

  timeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;

    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;

    return `${Math.floor(hrs / 24)}d ago`;
  },

  formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};