const Dashboard = {
  // Presets:
  // today | yesterday | thisWeek | lastWeek | thisMonth | lastMonth | custom
  rangePreset: 'thisWeek',

  // for custom range
  customStart: '',
  customEnd: '',

  render() {
    this.renderStats();
    this.renderCharts();
    this.renderRecentOrders();
  },

  byId(id) {
    return document.getElementById(id);
  },

  // ---------------------------
  // Data sources
  // ---------------------------
  getOrders() {
    return Store.get('orders') || [];
  },

  getMenuItems() {
    return Store.get('menuItems') || [];
  },

  getTables() {
    return Store.get('tables') || [];
  },

  // ---------------------------
  // Basic stats (unchanged: "Today")
  // ---------------------------
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

  // ============================================================
  // NEW: Date Range Picker logic
  // ============================================================

  // Helpers
  startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  },

  toISODateInputValue(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  },

  formatRangeTitle(start, endExclusive) {
    // endExclusive is next-day boundary; show inclusive end date
    const endInclusive = new Date(endExclusive.getTime() - 1);
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = endInclusive.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const y1 = start.getFullYear();
    const y2 = endInclusive.getFullYear();
    if (y1 === y2) return `${s} — ${e}, ${y1}`;
    return `${s}, ${y1} — ${e}, ${y2}`;
  },

  getWeekRange(offsetWeeks = 0) {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const start = new Date(now);
    start.setDate(now.getDate() + mondayOffset + offsetWeeks * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return { start, end };
  },

  getMonthRange(offsetMonths = 0) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
    return { start, end };
  },

  compressLabels(labels, maxLabels = 14) {
    if (!labels || labels.length <= maxLabels) return labels;
    const step = Math.ceil(labels.length / maxLabels);
    return labels.map((l, i) => (i % step === 0 ? l : ''));
  },

  // Preset setter
  setRangePreset(preset) {
    this.rangePreset = preset || 'thisWeek';

    // When switching to custom, initialize default if empty
    if (this.rangePreset === 'custom') {
      if (!this.customStart || !this.customEnd) {
        const end = this.startOfDay(new Date());
        const start = this.addDays(end, -6); // last 7 days
        this.customStart = this.toISODateInputValue(start);
        this.customEnd = this.toISODateInputValue(end);
      }
    }

    this.renderCharts();
  },

  setCustomStart(value) {
    this.customStart = value || '';
  },

  setCustomEnd(value) {
    this.customEnd = value || '';
  },

  applyCustomRange() {
    if (!this.customStart || !this.customEnd) {
      App.toast('Please select both start and end dates', 'warning');
      return;
    }

    const start = this.startOfDay(new Date(this.customStart));
    const end = this.startOfDay(new Date(this.customEnd));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      App.toast('Invalid custom dates', 'error');
      return;
    }

    if (end.getTime() < start.getTime()) {
      App.toast('End date cannot be before start date', 'warning');
      return;
    }

    this.renderCharts();
  },

  getSelectedRange() {
    const nowStart = this.startOfDay(new Date());

    if (this.rangePreset === 'today') {
      const start = nowStart;
      const end = this.addDays(start, 1);
      return { start, end, granularity: 'hour', title: 'Today', subtitle: 'Hourly revenue for today' };
    }

    if (this.rangePreset === 'yesterday') {
      const end = nowStart;
      const start = this.addDays(end, -1);
      return { start, end, granularity: 'hour', title: 'Yesterday', subtitle: 'Hourly revenue for yesterday' };
    }

    if (this.rangePreset === 'thisWeek') {
      const { start, end } = this.getWeekRange(0);
      return { start, end, granularity: 'day', title: 'This Week', subtitle: 'Daily revenue for this week' };
    }

    if (this.rangePreset === 'lastWeek') {
      const { start, end } = this.getWeekRange(-1);
      return { start, end, granularity: 'day', title: 'Last Week', subtitle: 'Daily revenue for last week' };
    }

    if (this.rangePreset === 'thisMonth') {
      const { start, end } = this.getMonthRange(0);
      const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { start, end, granularity: 'day', title: label, subtitle: 'Daily revenue for this month' };
    }

    if (this.rangePreset === 'lastMonth') {
      const { start, end } = this.getMonthRange(-1);
      const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { start, end, granularity: 'day', title: label, subtitle: 'Daily revenue for last month' };
    }

    // custom
    if (this.rangePreset === 'custom') {
      const start = this.customStart ? this.startOfDay(new Date(this.customStart)) : this.startOfDay(new Date());
      const endInclusive = this.customEnd ? this.startOfDay(new Date(this.customEnd)) : this.startOfDay(new Date());
      const end = this.addDays(endInclusive, 1); // make end exclusive

      // If same day -> hourly, else daily
      const isSameDay = start.getTime() === endInclusive.getTime();
      const granularity = isSameDay ? 'hour' : 'day';

      return {
        start,
        end,
        granularity,
        title: this.formatRangeTitle(start, end),
        subtitle: granularity === 'hour' ? 'Hourly revenue for selected day' : 'Daily revenue for selected range'
      };
    }

    // fallback
    const { start, end } = this.getWeekRange(0);
    return { start, end, granularity: 'day', title: 'This Week', subtitle: 'Daily revenue for this week' };
  },

  getRevenueChartData() {
    const completedOrders = this.getOrders().filter((order) => order.status === 'completed');
    const range = this.getSelectedRange();

    const startMs = range.start.getTime();
    const endMs = range.end.getTime();

    const inRange = completedOrders.filter((o) => o.timestamp >= startMs && o.timestamp < endMs);

    if (range.granularity === 'hour') {
      const labels = [];
      const data = [];

      for (let h = 0; h < 24; h++) {
        const bucketStart = new Date(range.start);
        bucketStart.setHours(h, 0, 0, 0);

        const bucketEnd = new Date(bucketStart);
        bucketEnd.setHours(h + 1, 0, 0, 0);

        labels.push(
          bucketStart.toLocaleTimeString('en-US', { hour: '2-digit' })
        );

        const revenue = inRange
          .filter((o) => o.timestamp >= bucketStart.getTime() && o.timestamp < bucketEnd.getTime())
          .reduce((sum, o) => sum + (o.total || 0), 0);

        data.push(revenue);
      }

      // keep labels compact
      const compactLabels = labels.map((l, i) => (i % 3 === 0 ? l : '')); // show every 3 hours

      return {
        labels: compactLabels,
        data,
        title: range.title,
        subtitle: range.subtitle
      };
    }

    // daily buckets
    const labels = [];
    const data = [];

    const cursor = new Date(range.start);
    while (cursor.getTime() < range.end.getTime()) {
      const next = new Date(cursor);
      next.setDate(cursor.getDate() + 1);

      // label style depends on preset length
      let label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // For "thisWeek/lastWeek", show weekday
      if (this.rangePreset === 'thisWeek' || this.rangePreset === 'lastWeek') {
        label = cursor.toLocaleDateString('en-US', { weekday: 'short' });
      }

      // For month presets, show day-of-month
      if (this.rangePreset === 'thisMonth' || this.rangePreset === 'lastMonth') {
        label = String(cursor.getDate());
      }

      labels.push(label);

      const revenue = inRange
        .filter((o) => o.timestamp >= cursor.getTime() && o.timestamp < next.getTime())
        .reduce((sum, o) => sum + (o.total || 0), 0);

      data.push(revenue);
      cursor.setDate(cursor.getDate() + 1);
    }

    const compactLabels = this.compressLabels(labels, 14);

    return {
      labels: compactLabels,
      data,
      title: range.title,
      subtitle: range.subtitle
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

    if (!controlsEl) return;

    const isCustom = this.rangePreset === 'custom';
    const startVal = this.customStart || '';
    const endVal = this.customEnd || '';

    controlsEl.innerHTML = `
      <div class="dashboard-chart-controls" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <select class="form-select" style="width:auto;padding:6px 30px 6px 10px;font-size:0.8rem"
          onchange="Dashboard.setRangePreset(this.value)">
          <option value="today" ${this.rangePreset === 'today' ? 'selected' : ''}>Today</option>
          <option value="yesterday" ${this.rangePreset === 'yesterday' ? 'selected' : ''}>Yesterday</option>
          <option value="thisWeek" ${this.rangePreset === 'thisWeek' ? 'selected' : ''}>This week</option>
          <option value="lastWeek" ${this.rangePreset === 'lastWeek' ? 'selected' : ''}>Last week</option>
          <option value="thisMonth" ${this.rangePreset === 'thisMonth' ? 'selected' : ''}>This month</option>
          <option value="lastMonth" ${this.rangePreset === 'lastMonth' ? 'selected' : ''}>Last month</option>
          <option value="custom" ${this.rangePreset === 'custom' ? 'selected' : ''}>Custom</option>
        </select>

        ${
          isCustom
            ? `
              <input class="form-input" type="date" style="width:auto;padding:6px 10px;font-size:0.8rem"
                value="${startVal}"
                onchange="Dashboard.setCustomStart(this.value)">
              <input class="form-input" type="date" style="width:auto;padding:6px 10px;font-size:0.8rem"
                value="${endVal}"
                onchange="Dashboard.setCustomEnd(this.value)">
              <button class="btn btn-secondary btn-xs" onclick="Dashboard.applyCustomRange()">Apply</button>
            `
            : ''
        }
      </div>
    `;
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

  // ---------------------------
  // Recent orders (unchanged)
  // ---------------------------
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