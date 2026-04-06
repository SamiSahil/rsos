const Dashboard = {
  chartMode: 'week', // 'week' | 'month'
  chartOffset: 0,    // 0 = current period, -1 = previous, 1 = next

  render() {
    this.renderStats();
    this.renderCharts();
    this.renderRecentOrders();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getMenuItems() {
    return Store.get('menuItems') || [];
  },

  getTables() {
    return Store.get('tables') || [];
  },

  getTodayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
      start: start.getTime(),
      end: end.getTime()
    };
  },

  getTodayCompletedOrders() {
    const { start, end } = this.getTodayRange();

    return this.getOrders().filter(
      (order) =>
        order.status === 'completed' &&
        order.timestamp >= start &&
        order.timestamp < end
    );
  },

  getStatsData() {
    const todayCompleted = this.getTodayCompletedOrders();
    const tables = this.getTables();

    const todayRevenue = todayCompleted.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );

    const avgOrderValue = todayCompleted.length
      ? todayRevenue / todayCompleted.length
      : 0;

    const activeTables = tables.filter(
      (table) => table.status === 'occupied' || table.status === 'reserved'
    ).length;

    return {
      todayRevenue,
      todayCompletedOrders: todayCompleted.length,
      avgOrderValue,
      activeTables,
      totalTables: tables.length
    };
  },

  renderStats() {
    const stats = this.getStatsData();
    const container = this.byId('dashboardStats');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--accent-bg);color:var(--accent)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"></path>
          </svg>
        </div>
        <div class="stat-value">${App.currency(stats.todayRevenue)}</div>
        <div class="stat-label">Today's Revenue</div>
        <span class="stat-change up">Completed today</span>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-bg);color:var(--success)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"></path>
          </svg>
        </div>
        <div class="stat-value">${stats.todayCompletedOrders}</div>
        <div class="stat-label">Today's Completed Orders</div>
        <span class="stat-change up">Completed today</span>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--info-bg);color:var(--info)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M18 20V10M12 20V4M6 20v-6"></path>
          </svg>
        </div>
        <div class="stat-value">${App.currency(stats.avgOrderValue)}</div>
        <div class="stat-label">Today's Avg Order Value</div>
        <span class="stat-change up">Completed today</span>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--purple-bg);color:var(--purple)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <path d="M3 9h18M9 3v18"></path>
          </svg>
        </div>
        <div class="stat-value">${stats.activeTables}</div>
        <div class="stat-label">Active/Reserved Tables</div>
        <span class="stat-change up">${stats.totalTables} total</span>
      </div>
    `;
  },

  setChartMode(mode) {
    this.chartMode = mode;
    this.chartOffset = 0;
    this.renderCharts();
  },

  prevPeriod() {
    this.chartOffset -= 1;
    this.renderCharts();
  },

  nextPeriod() {
    if (this.chartOffset < 0) {
      this.chartOffset += 1;
      this.renderCharts();
    }
  },

  getWeekRange(offset = 0) {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const start = new Date(now);
    start.setDate(now.getDate() + mondayOffset + offset * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return { start, end };
  },

  getMonthRange(offset = 0) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);

    return { start, end };
  },

  getRevenueChartData() {
    const completedOrders = this.getOrders().filter((order) => order.status === 'completed');

    if (this.chartMode === 'month') {
      const { start, end } = this.getMonthRange(this.chartOffset);
      const labels = [];
      const data = [];

      const cursor = new Date(start);

      while (cursor < end) {
        const next = new Date(cursor);
        next.setDate(cursor.getDate() + 1);

        labels.push(cursor.getDate().toString());

        const revenue = completedOrders
          .filter(
            (order) =>
              order.timestamp >= cursor.getTime() &&
              order.timestamp < next.getTime()
          )
          .reduce((sum, order) => sum + (order.total || 0), 0);

        data.push(revenue);
        cursor.setDate(cursor.getDate() + 1);
      }

      return {
        labels,
        data,
        title: start.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        }),
        subtitle: 'Daily revenue for selected month'
      };
    }

    const { start } = this.getWeekRange(this.chartOffset);
    const labels = [];
    const data = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + i);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      labels.push(
        dayStart.toLocaleDateString('en-US', { weekday: 'short' })
      );

      const revenue = completedOrders
        .filter(
          (order) =>
            order.timestamp >= dayStart.getTime() &&
            order.timestamp < dayEnd.getTime()
        )
        .reduce((sum, order) => sum + (order.total || 0), 0);

      data.push(revenue);
    }

    return {
      labels,
      data,
      title: this.chartOffset === 0 ? 'This Week' : `Week ${this.chartOffset < 0 ? 'Past' : 'Future'}`,
      subtitle: 'Daily revenue for selected week'
    };
  },

  getCategoryChartData() {
    const orders = this.getOrders();
    const menu = this.getMenuItems();
    const categories = {};

    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const menuItem = menu.find((entry) => entry.id === item.menuId);
        const category = menuItem ? menuItem.category : 'Other';
        categories[category] = (categories[category] || 0) + (item.qty || 0);
      });
    });

    return {
      labels: Object.keys(categories),
      data: Object.values(categories),
      colors: ['#E85D24', '#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']
    };
  },

  renderRevenueHeader(chartData) {
    const titleEl = this.byId('dashboardRevenueTitle');
    const subtitleEl = this.byId('dashboardRevenueSubtitle');
    const controlsEl = this.byId('dashboardRevenueControls');

    if (titleEl) titleEl.textContent = chartData.title;
    if (subtitleEl) subtitleEl.textContent = chartData.subtitle;

    if (controlsEl) {
      controlsEl.innerHTML = `
        <div class="dashboard-chart-controls">
          <button class="btn btn-secondary btn-xs" onclick="Dashboard.prevPeriod()">←</button>
          <button class="btn btn-secondary btn-xs ${this.chartMode === 'week' ? 'active-filter-btn' : ''}" onclick="Dashboard.setChartMode('week')">Week</button>
          <button class="btn btn-secondary btn-xs ${this.chartMode === 'month' ? 'active-filter-btn' : ''}" onclick="Dashboard.setChartMode('month')">Month</button>
          <button class="btn btn-secondary btn-xs" onclick="Dashboard.nextPeriod()">→</button>
        </div>
      `;
    }
  },

  renderCharts() {
    const revenueChart = this.getRevenueChartData();
    const categoryChart = this.getCategoryChartData();

    this.renderRevenueHeader(revenueChart);

    setTimeout(() => {
      ChartLib.lineChart('revenueChart', {
        labels: revenueChart.labels,
        data: revenueChart.data,
        color: '#E85D24'
      });

      ChartLib.pieChart('categoryPieChart', {
        labels: categoryChart.labels,
        data: categoryChart.data,
        colors: categoryChart.colors
      });
    }, 50);
  },

  renderRecentOrders() {
    const container = this.byId('recentOrdersList');
    if (!container) return;

    const orders = [...this.getOrders()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 4);

    const statusBadge = (status) => {
      const map = {
        pending: 'badge-warning',
        'in-progress': 'badge-info',
        completed: 'badge-success'
      };
      return `<span class="badge ${map[status] || 'badge-info'}">${status.replace('-', ' ')}</span>`;
    };

    const typeBadge = (type) =>
      type === 'delivery'
        ? `<span class="badge badge-purple">Delivery</span>`
        : `<span class="badge badge-accent">Dine-in</span>`;

    if (!orders.length) {
      container.innerHTML = `<div class="empty-state"><p>No orders yet</p></div>`;
      return;
    }

    container.innerHTML = orders.map((order) => `
      <div class="premium-order-item" onclick="Dashboard.openOrderDetails(${JSON.stringify(order.id)})">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-weight:900; color:#fff; font-size:0.95rem;">#${order.id}</span>
            ${typeBadge(order.orderType || 'dine-in')}
            ${statusBadge(order.status)}
          </div>

          <div style="font-weight:900; color:var(--accent); font-size:1.1rem; text-shadow:0 2px 10px rgba(232,93,36,0.3);">
            ${App.currency(order.total)}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:10px;">
          <div style="flex:1;">
            <div style="font-size:0.85rem; color:var(--text-primary); font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              ${
                order.orderType === 'delivery'
                  ? `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M5 12l4-4m-4 4l4 4"/></svg> ${App.safeText(order.customerName || 'Guest')} (${App.safeText(order.customerPhone || 'No phone')})`
                  : `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Table ${App.safeText(order.table || '-')} · ${App.safeText(order.customerName || 'Walk-in')}`
              }
            </div>

            <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.4;">
              ${(order.items || []).map((item) => `${item.qty}x ${App.safeText(item.name)}`).join(', ')}
            </div>
          </div>

          <div style="text-align:right;">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">
              ${App.timeAgo(order.timestamp)}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  },

  openOrderDetails(orderId) {
    const order = this.getOrders().find((entry) => String(entry.id) === String(orderId));
    if (!order) return;

    const typeLabel = order.orderType === 'delivery' ? 'Home Delivery' : 'Dine-in';
    const discountPercent = Number(order.discountPercent || 0);
    const discountAmount = Number(order.discount || 0);

    const customerSection = order.orderType === 'delivery'
      ? `
        <div class="summary-row"><span>Customer</span><span>${App.safeText(order.customerName || 'Guest')}</span></div>
        <div class="summary-row"><span>Phone</span><span>${App.safeText(order.customerPhone || '-')}</span></div>
        <div class="summary-row"><span>Address</span><span style="max-width:220px;text-align:right">${App.safeText(order.deliveryAddress || '-')}</span></div>
      `
      : `
        <div class="summary-row"><span>Customer</span><span>${App.safeText(order.customerName || 'Walk-in')}</span></div>
        <div class="summary-row"><span>Table</span><span>${App.safeText(order.table || '-')}</span></div>
        <div class="summary-row"><span>Phone</span><span>${App.safeText(order.customerPhone || '-')}</span></div>
      `;

    const body = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:1.05rem;font-weight:800">Order #${App.safeText(order.id)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">
              ${App.formatDateTime(order.timestamp)}
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge ${order.orderType === 'delivery' ? 'badge-purple' : 'badge-accent'}">${typeLabel}</span>
            <span class="badge ${order.status === 'pending' ? 'badge-warning' : order.status === 'in-progress' ? 'badge-info' : 'badge-success'}">${order.status.replace('-', ' ')}</span>
          </div>
        </div>

        <div style="background:var(--bg-input);padding:14px;border-radius:var(--radius)">
          ${customerSection}
          <div class="summary-row"><span>Payment</span><span>${App.safeText(order.paymentMethod || 'cash')}</span></div>
        </div>

        <div>
          <div style="font-size:0.9rem;font-weight:700;margin-bottom:10px">Items</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${(order.items || []).map((item) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-input);border-radius:var(--radius)">
                <div>
                  <div style="font-weight:600">${App.safeText(item.name)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">Qty: ${item.qty}</div>
                </div>
                <div style="font-weight:700">${App.currency((item.price || 0) * (item.qty || 0))}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background:var(--bg-input);padding:14px;border-radius:var(--radius)">
          <div class="summary-row"><span>Subtotal</span><span>${App.currency(order.subtotal)}</span></div>
          <div class="summary-row"><span>Tax</span><span>${App.currency(order.tax)}</span></div>
          <div class="summary-row"><span>Discount (${discountPercent}%)</span><span>-${App.currency(discountAmount)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${App.currency(order.total)}</span></div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      <button class="btn btn-primary" onclick="Billing.generateReceipt(${JSON.stringify(order.id)})">Open Receipt</button>
    `;

    App.openModal('Order Details', body, footer);
  }
};