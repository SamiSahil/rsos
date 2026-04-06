const Billing = {
  currentOrder: null,

  paymentConfig: {
    tip: 0,
    discount: 0,
    serviceCharge: 0,
    split: 1,
    method: 'cash'
  },

  render() {
    this.renderTable();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getSearchText() {
    return (this.byId('billingSearchInput')?.value || '').trim().toLowerCase();
  },

  getStatusFilter() {
    return this.byId('billingStatusFilter')?.value || 'all';
  },

  filter() {
    this.renderTable();
  },

  getFilteredOrders() {
    let orders = [...this.getOrders()].sort((a, b) => b.timestamp - a.timestamp);
    const search = this.getSearchText();
    const statusFilter = this.getStatusFilter();

    if (search) {
      orders = orders.filter((order) =>
        String(order.id).toLowerCase().includes(search) ||
        String(order.table || '').toLowerCase().includes(search) ||
        String(order.customerName || '').toLowerCase().includes(search) ||
        String(order.customerPhone || '').toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      orders = orders.filter((order) => (order.billingStatus || 'pending') === statusFilter);
    }

    return orders;
  },

  getBillingStatusBadge(status) {
    const map = {
      pending: 'badge-warning',
      completed: 'badge-success'
    };

    return `<span class="badge ${map[status] || 'badge-warning'}">${App.safeText(status)}</span>`;
  },

  getTypeBadge(type) {
    if (type === 'delivery') {
      return `<span class="badge badge-purple">Delivery</span>`;
    }

    return `<span class="badge badge-accent">Dine-in</span>`;
  },

  getOfflineBadge(order) {
    if (!order.offlineQueued) return '';
    return `
      <div class="billing-inline-badge-wrap">
        <span class="badge badge-warning">Offline Queue</span>
      </div>
    `;
  },

  renderCustomerBlock(order) {
    return `
      <div class="billing-customer-block">
        <span class="billing-customer-name">${App.safeText(order.customerName || 'Guest')}</span>
        <span class="billing-customer-phone">${App.safeText(order.customerPhone || 'No phone')}</span>
      </div>
    `;
  },

  renderTableRow(order) {
    const billingStatus = order.billingStatus || 'pending';

    return `
      <tr>
        <td class="billing-strong-cell">#${App.safeText(order.id)}</td>

        <td>
          ${
            order.orderType === 'dine-in'
              ? `Table ${App.safeText(order.table || '-')}`
              : `<span class="billing-muted-dash">—</span>`
          }
        </td>

        <td>${this.getTypeBadge(order.orderType || 'dine-in')}</td>

        <td>${this.renderCustomerBlock(order)}</td>

        <td class="billing-strong-cell">${App.currency(order.total)}</td>

        <td>
          ${this.getBillingStatusBadge(billingStatus)}
          ${this.getOfflineBadge(order)}
        </td>

        <td class="billing-time-cell">
          ${this.formatOrderTime(order.timestamp)}
        </td>

        <td>
          <button class="btn btn-secondary btn-xs" onclick="Billing.generateReceipt(${JSON.stringify(order.id)})">
            Receipt
          </button>
        </td>
      </tr>
    `;
  },

  renderTable() {
    const body = this.byId('billingBody');
    if (!body) return;

    const orders = this.getFilteredOrders();

    if (!orders.length) {
      body.innerHTML = `
        <tr>
          <td colspan="8" class="billing-empty-cell">
            No orders found
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = orders.map((order) => this.renderTableRow(order)).join('');
  },

  findOrder(orderId) {
    return this.getOrders().find((order) => String(order.id) === String(orderId));
  },

  getOrderTypeLabel(order) {
    return order.orderType === 'delivery' ? 'Home Delivery' : 'Dine-in';
  },

  getDiscountPercent(order) {
    return Number(order.discountPercent || 0);
  },

  getDiscountAmount(order) {
    return Number(order.discount || 0);
  },

  async markBillingCompleted(orderId) {
    const order = this.getOrders().find((entry) => String(entry.id) === String(orderId));
    if (!order || !order.mongoId) return;

    try {
      await Store.request(`/orders/${order.mongoId}/billing-status`, {
        method: 'PATCH',
        body: JSON.stringify({ billingStatus: 'completed' })
      });

      await Store.fetchOrders();
    } catch (error) {
      console.error('Failed to update billing status:', error);
      App.toast(error.message || 'Failed to update billing status', 'error');
    }
  },

  renderReceiptContactSection(order) {
    if (order.orderType === 'delivery') {
      return `
        <div class="receipt-row"><span>Phone</span><span>${App.safeText(order.customerPhone || '-')}</span></div>
        <div class="receipt-row">
          <span>Address</span>
          <span class="receipt-multiline-value">${App.safeText(order.deliveryAddress || '-')}</span>
        </div>
      `;
    }

    return `
      <div class="receipt-row"><span>Table</span><span>${App.safeText(order.table || '-')}</span></div>
      <div class="receipt-row"><span>Phone</span><span>${App.safeText(order.customerPhone || '-')}</span></div>
    `;
  },

  renderReceiptItems(order) {
    return (order.items || [])
      .map(
        (item) => `
          <div class="receipt-row">
            <span>${Number(item.qty || 0)}x ${App.safeText(item.name)}</span>
            <span>${App.currency((item.price || 0) * (item.qty || 0))}</span>
          </div>
        `
      )
      .join('');
  },

  buildReceiptHTML(order) {
    const orderTypeLabel = this.getOrderTypeLabel(order);
    const discountPercent = this.getDiscountPercent(order);
    const discountAmount = this.getDiscountAmount(order);

    return `
      <div class="receipt-preview" id="receiptPrint">
        <h2>RestOS</h2>
        <p class="receipt-sub">
          Uttara, Food City, Dhaka-1230<br>
          Mobile: +880 1903048550
        </p>

        <hr class="receipt-divider">

        <div class="receipt-row"><span>Order #</span><span>${App.safeText(order.id)}</span></div>
        <div class="receipt-row"><span>Type</span><span>${orderTypeLabel}</span></div>
        <div class="receipt-row"><span>Customer</span><span>${App.safeText(order.customerName || 'Guest')}</span></div>

        ${this.renderReceiptContactSection(order)}

        <div class="receipt-row"><span>Payment</span><span>${App.safeText(order.paymentMethod || 'cash')}</span></div>
        <div class="receipt-row"><span>Date</span><span>${new Date(order.timestamp).toLocaleDateString()}</span></div>
        <div class="receipt-row"><span>Time</span><span>${new Date(order.timestamp).toLocaleTimeString()}</span></div>

        <hr class="receipt-divider">

        <div class="receipt-section-title">Items:</div>
        ${this.renderReceiptItems(order)}

        <hr class="receipt-divider">

        <div class="receipt-row"><span>Subtotal</span><span>${App.currency(order.subtotal)}</span></div>
        <div class="receipt-row"><span>Tax (${((window.APP_CONFIG?.TAX_RATE || 0.08) * 100).toFixed(0)}%)</span><span>${App.currency(order.tax)}</span></div>
        <div class="receipt-row"><span>Discount (${discountPercent}%)</span><span>-${App.currency(discountAmount)}</span></div>

        <hr class="receipt-divider">

        <div class="receipt-row bold"><span>TOTAL</span><span>${App.currency(order.total)}</span></div>

        <hr class="receipt-divider">

        ${
          order.offlineQueued
            ? `<p class="receipt-footer receipt-warning">
                This receipt is for an offline queued order and has not synced yet.
              </p>`
            : ''
        }

        <p class="receipt-footer">
          Thank you for ordering with us!<br>
          Please visit again soon ❤️
        </p>
      </div>
    `;
  },

  generateReceipt(orderId) {
    const order = this.findOrder(orderId);
    if (!order) {
      App.toast('Order not found', 'error');
      return;
    }

    this.currentOrder = order;

    const body = this.buildReceiptHTML(order);

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      <button class="btn btn-primary" onclick="Billing.printReceipt()">Print</button>
    `;

    App.openModal('Receipt', body, footer);
  },

  openOrderDetails(orderId) {
    const order = this.findOrder(orderId);
    if (!order) {
      App.toast('Order not found', 'error');
      return;
    }

    const discountPercent = this.getDiscountPercent(order);
    const discountAmount = this.getDiscountAmount(order);
    const typeLabel = order.orderType === 'delivery' ? 'Home Delivery' : 'Dine-in';
    const billingStatus = order.billingStatus || 'pending';

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
            <span class="badge ${billingStatus === 'completed' ? 'badge-success' : 'badge-warning'}">${billingStatus}</span>
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
  },

  async printReceipt() {
    const receipt = this.byId('receiptPrint');
    if (!receipt) {
      App.toast('Receipt not found', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      App.toast('Unable to open print window', 'error');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 380px;
              margin: 0 auto;
            }
            h2 {
              text-align: center;
              margin-bottom: 4px;
            }
            .receipt-sub {
              text-align: center;
              font-size: 0.75rem;
              color: #666;
              margin-bottom: 16px;
            }
            .receipt-divider {
              border: none;
              border-top: 1px dashed #ccc;
              margin: 12px 0;
            }
            .receipt-row {
              display: flex;
              justify-content: space-between;
              font-size: 0.82rem;
              padding: 2px 0;
              color: #333;
              gap: 8px;
            }
            .receipt-row span:last-child {
              text-align: right;
            }
            .receipt-row.bold {
              font-weight: 700;
              font-size: 0.95rem;
              color: #111;
            }
            .receipt-footer {
              text-align: center;
              font-size: 0.72rem;
              color: #999;
              margin-top: 16px;
            }
            .receipt-warning {
              color: #d97706;
            }
            .receipt-section-title {
              font-weight: 700;
              font-size: 0.82rem;
              margin-bottom: 6px;
              color: #111;
            }
            .receipt-multiline-value {
              text-align: right;
              max-width: 180px;
            }
          </style>
        </head>
        <body>${receipt.innerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(async () => {
      printWindow.print();
      printWindow.close();

      if (this.currentOrder?.id) {
        await this.markBillingCompleted(this.currentOrder.id);
      }
    }, 300);
  },

  formatOrderTime(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};