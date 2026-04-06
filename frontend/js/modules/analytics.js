const Analytics = {
  feedbackRating: 5,
  chartMode: 'week', // week | month | year
  chartOffset: 0,

  render() {
    this.renderStats();
    this.renderSalesChart();
    this.renderTopSellingItems();
    this.renderFeedback();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getCompletedOrders() {
    return this.getOrders().filter((order) => order.status === 'completed');
  },

  getFeedback() {
    return Store.get('feedback') || [];
  },

  getSummaryData() {
    const completedOrders = this.getCompletedOrders();
    const feedback = this.getFeedback();

    const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = completedOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const avgRating =
      feedback.length > 0
        ? (
            feedback.reduce((sum, item) => sum + (item.rating || 0), 0) / feedback.length
          ).toFixed(1)
        : '0.0';

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      avgRating
    };
  },

  renderStats() {
    const container = this.byId('analyticsStats');
    if (!container) return;

    const { totalRevenue, totalOrders, avgOrderValue, avgRating } = this.getSummaryData();

    container.innerHTML = `
      <div class="stat-card analytics-clickable-card" onclick="Analytics.openRevenueBreakdown()">
        <div class="stat-icon" style="background:var(--accent-bg);color:var(--accent)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"></path>
          </svg>
        </div>
        <div class="stat-value">${App.currency(totalRevenue)}</div>
        <div class="stat-label">Total Revenue</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-bg);color:var(--success)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"></path>
          </svg>
        </div>
        <div class="stat-value">${totalOrders}</div>
        <div class="stat-label">Completed Orders</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--info-bg);color:var(--info)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M18 20V10M12 20V4M6 20v-6"></path>
          </svg>
        </div>
        <div class="stat-value">${App.currency(avgOrderValue)}</div>
        <div class="stat-label">Avg Order Value</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--warning-bg);color:var(--warning)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
          </svg>
        </div>
        <div class="stat-value">${avgRating}</div>
        <div class="stat-label">Avg Rating</div>
      </div>
    `;
  },

  setChartMode(mode) {
    this.chartMode = mode;
    this.chartOffset = 0;
    this.renderSalesChart();
  },

  prevPeriod() {
    this.chartOffset -= 1;
    this.renderSalesChart();
  },

  nextPeriod() {
    if (this.chartOffset < 0) {
      this.chartOffset += 1;
      this.renderSalesChart();
    }
  },

  getWeekRange(offset = 0) {
    const now = new Date();
    const day = now.getDay();
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

  getYearRange(offset = 0) {
    const now = new Date();
    const year = now.getFullYear() + offset;
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    return { start, end };
  },

  getSalesChartData() {
    const completedOrders = this.getCompletedOrders();

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
        title: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        subtitle: 'Daily sales for selected month'
      };
    }

    if (this.chartMode === 'year') {
      const { start } = this.getYearRange(this.chartOffset);
      const labels = [];
      const data = [];

      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(start.getFullYear(), month, 1);
        const monthEnd = new Date(start.getFullYear(), month + 1, 1);

        labels.push(
          monthStart.toLocaleDateString('en-US', { month: 'short' })
        );

        const revenue = completedOrders
          .filter(
            (order) =>
              order.timestamp >= monthStart.getTime() &&
              order.timestamp < monthEnd.getTime()
          )
          .reduce((sum, order) => sum + (order.total || 0), 0);

        data.push(revenue);
      }

      return {
        labels,
        data,
        title: String(start.getFullYear()),
        subtitle: 'Monthly sales for selected year'
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
        dayStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
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
      subtitle: 'Daily sales for selected week'
    };
  },

  renderChartHeader(chartData) {
    const titleEl = this.byId('analyticsChartTitle');
    const subtitleEl = this.byId('analyticsChartSubtitle');
    const controlsEl = this.byId('analyticsChartControls');

    if (titleEl) titleEl.textContent = chartData.title;
    if (subtitleEl) subtitleEl.textContent = chartData.subtitle;

    if (controlsEl) {
      controlsEl.innerHTML = `
        <div class="dashboard-chart-controls">
          <button class="btn btn-secondary btn-xs" onclick="Analytics.prevPeriod()">←</button>
          <button class="btn btn-secondary btn-xs ${this.chartMode === 'week' ? 'active-filter-btn' : ''}" onclick="Analytics.setChartMode('week')">Week</button>
          <button class="btn btn-secondary btn-xs ${this.chartMode === 'month' ? 'active-filter-btn' : ''}" onclick="Analytics.setChartMode('month')">Month</button>
          <button class="btn btn-secondary btn-xs ${this.chartMode === 'year' ? 'active-filter-btn' : ''}" onclick="Analytics.setChartMode('year')">Year</button>
          <button class="btn btn-secondary btn-xs" onclick="Analytics.nextPeriod()">→</button>
        </div>
      `;
    }
  },

  renderSalesChart() {
    const chartData = this.getSalesChartData();
    this.renderChartHeader(chartData);

    setTimeout(() => {
      ChartLib.barChart('dailySalesChart', {
        labels: chartData.labels,
        data: chartData.data,
        color: '#E85D24'
      });
    }, 50);
  },

  getRevenueByDate() {
    const completedOrders = this.getCompletedOrders();
    const revenueMap = {};

    completedOrders.forEach((order) => {
      const date = new Date(order.timestamp).toISOString().slice(0, 10);
      revenueMap[date] = (revenueMap[date] || 0) + (order.total || 0);
    });

    return Object.entries(revenueMap)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]));
  },

  openRevenueBreakdown() {
    const revenueList = this.getRevenueByDate();

    const listHtml = revenueList.length
      ? revenueList.map(([date, amount]) => `
          <div class="analytics-revenue-row" onclick="Analytics.showRevenueForDate('${date}')">
            <span>${date}</span>
            <strong>${App.currency(amount)}</strong>
          </div>
        `).join('')
      : `<div class="empty-state"><p>No revenue data yet</p></div>`;

    const body = `
      <div class="form-group">
        <label class="form-label">Select Date</label>
        <input type="date" class="form-input" id="analyticsRevenueDatePicker">
      </div>

      <div class="form-group">
        <button class="btn btn-primary btn-sm" onclick="Analytics.showSelectedRevenueDate()">Show Revenue</button>
      </div>

      <div class="analytics-revenue-list">
        ${listHtml}
      </div>

      <div id="analyticsRevenueDayResult" style="margin-top:16px"></div>
    `;

    App.openModal(
      'Revenue Breakdown',
      body,
      `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`
    );
  },

  showRevenueForDate(date) {
    const revenueList = this.getRevenueByDate();
    const found = revenueList.find(([entryDate]) => entryDate === date);
    const result = this.byId('analyticsRevenueDayResult');
    if (!result) return;

    if (!found) {
      result.innerHTML = `<div class="panel-danger">No revenue found for ${date}</div>`;
      return;
    }

    result.innerHTML = `
      <div class="panel-muted">
        <strong>${date}</strong><br>
        Revenue: <strong>${App.currency(found[1])}</strong>
      </div>
    `;
  },

  showSelectedRevenueDate() {
    const input = this.byId('analyticsRevenueDatePicker');
    if (!input || !input.value) {
      App.toast('Please select a date', 'warning');
      return;
    }

    this.showRevenueForDate(input.value);
  },

  getTopSellingItems() {
    const completedOrders = this.getCompletedOrders();
    const salesMap = {};

    completedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        salesMap[item.name] = (salesMap[item.name] || 0) + (item.qty || 0);
      });
    });

    return Object.entries(salesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  },

  renderTopSellingItems() {
    const container = this.byId('topSellingItems');
    if (!container) return;

    const topItems = this.getTopSellingItems();
    const maxSales = topItems.length > 0 ? topItems[0][1] : 1;

    if (!topItems.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No sales data yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = topItems
      .map(([name, qty], index) => `
        <div class="analytics-top-item">
          <span class="analytics-rank">#${index + 1}</span>

          <div class="analytics-top-item-main">
            <div class="analytics-top-item-name">${App.safeText(name)}</div>
            <div class="stock-bar analytics-top-item-bar">
              <div
                class="stock-bar-fill"
                style="width:${(qty / maxSales) * 100}%;background:var(--accent)"
              ></div>
            </div>
          </div>

          <span class="badge badge-accent">${qty} sold</span>
        </div>
      `)
      .join('');
  },

  renderFeedback() {
    const container = this.byId('feedbackList');
    if (!container) return;

    const feedback = [...this.getFeedback()].sort((a, b) => b.timestamp - a.timestamp);

    if (!feedback.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No feedback yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = feedback
      .map((item) => this.renderFeedbackItem(item))
      .join('');
  },

  renderFeedbackItem(item) {
    const rating = Number(item.rating || 0);
    const filled = '★'.repeat(rating);
    const empty = '☆'.repeat(Math.max(5 - rating, 0));

    return `
      <div class="feedback-item">
        <div class="feedback-stars">${filled}${empty}</div>
        <div class="feedback-text">"${App.safeText(item.text)}"</div>
        <div class="feedback-meta">— ${App.safeText(item.name || 'Anonymous')} · ${App.timeAgo(item.timestamp)}</div>
      </div>
    `;
  },

  addFeedback() {
    const body = `
      <div class="form-group">
        <label class="form-label">Customer Name</label>
        <input type="text" class="form-input" id="feedbackName" placeholder="Name">
      </div>

      <div class="form-group">
        <label class="form-label">Rating</label>
        <div id="feedbackRating" class="feedback-rating-stars">
          ${[1, 2, 3, 4, 5]
            .map(
              (rating) => `
                <span
                  class="star"
                  data-rating="${rating}"
                  onclick="Analytics.setRating(${rating})"
                >★</span>
              `
            )
            .join('')}
        </div>
        <input type="hidden" id="feedbackRatingVal" value="5">
      </div>

      <div class="form-group">
        <label class="form-label">Comments</label>
        <textarea class="form-textarea" id="feedbackText" placeholder="Customer feedback..." rows="3"></textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveFeedbackBtn" onclick="Analytics.saveFeedback()">Save</button>
    `;

    App.openModal('Add Customer Feedback', body, footer);
    this.setRating(5);
  },

  setRating(rating) {
    this.feedbackRating = rating;

    const hiddenInput = this.byId('feedbackRatingVal');
    if (hiddenInput) hiddenInput.value = rating;

    document.querySelectorAll('#feedbackRating .star').forEach((star) => {
      const starRating = parseInt(star.dataset.rating || '0', 10);
      star.style.color = starRating <= rating ? 'var(--warning)' : 'var(--text-muted)';
    });
  },

  validateFeedback({ text }) {
    if (!text) {
      App.toast('Please enter feedback text', 'error');
      return false;
    }

    return true;
  },

  buildFeedbackPayload() {
    return {
      name: (this.byId('feedbackName')?.value || '').trim() || 'Anonymous',
      rating: parseInt(this.byId('feedbackRatingVal')?.value || '5', 10),
      text: (this.byId('feedbackText')?.value || '').trim()
    };
  },

  async saveFeedback() {
    const saveBtn = this.byId('saveFeedbackBtn');
    const payload = this.buildFeedbackPayload();

    if (!this.validateFeedback(payload)) return;

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Save');

    try {
      await Store.request('/feedback', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await Store.fetchFeedback();
      App.closeModal();
      this.renderFeedback();
      App.toast('Feedback added', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to add feedback', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Save');
    }
  },

  getFeedback() {
    return Store.get('feedback') || [];
  }
};