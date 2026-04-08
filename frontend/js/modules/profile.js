const Profile = {
  month: '',
  summary: null,
  payments: [],
  isLoading: false,

  byId(id) {
    return document.getElementById(id);
  },

  defaultMonth() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  },

  formatMonthLabel(monthStr) {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return monthStr || '';
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  getMe() {
    return Store.get('authUser');
  },

  async load() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      if (!this.month) this.month = this.defaultMonth();
      await this.fetchMonthData();
      this.render();
    } catch (e) {
      App.toast(e.message || 'Failed to load profile', 'error');
    } finally {
      this.isLoading = false;
    }
  },

  async fetchMonthData() {
    const month = this.month || this.defaultMonth();

    const summaryJson = await Store.request(`/payroll/summary/me?month=${encodeURIComponent(month)}`);
    const paymentsJson = await Store.request(`/payroll/payments/me?month=${encodeURIComponent(month)}`);

    this.summary = summaryJson.data;
    this.payments = paymentsJson.data || [];
  },

  async setMonth(value) {
    this.month = value || this.defaultMonth();
    await this.fetchMonthData();
    this.render();
  },

  renderAvatar(user) {
    if (user?.photoUrl) {
      return `<img src="${App.safeText(user.photoUrl, '')}" class="staff-profile-photo-lg" alt="${App.safeText(user.fullName, '')}">`;
    }
    return `<div class="staff-profile-initials-lg">${App.safeText((user?.fullName || 'ST').slice(0,2).toUpperCase())}</div>`;
  },

  render() {
    const page = this.byId('page-profile');
    if (!page) return;

    const user = this.getMe();
    if (!user) {
      page.innerHTML = `<div class="empty-state"><p>Please log in</p></div>`;
      return;
    }

    const monthLabel = this.formatMonthLabel(this.month);

    const s = this.summary || {};
    const paymentsHtml = this.payments.length
      ? this.payments.map(p => `
          <div class="panel-muted" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div>
              <div style="font-weight:900">${App.safeText(p.receiptNumber)}</div>
              <div class="text-soft">${new Date(p.paidAt).toLocaleString()}</div>
              ${p.note ? `<div class="text-soft">Note: ${App.safeText(p.note)}</div>` : ''}
            </div>
            <div style="text-align:right">
              <div style="font-weight:900;color:var(--accent)">${App.currency(p.amount)}</div>
              <button class="btn btn-secondary btn-xs" onclick='Profile.openSalaryReceipt(${JSON.stringify(p)})'>Receipt</button>
            </div>
          </div>
        `).join('')
      : `<div class="panel-muted">No salary payments found for this month.</div>`;

    page.innerHTML = `
      <div class="card">
        <div class="staff-profile-header">
          ${this.renderAvatar(user)}
          <div class="staff-profile-title">
            <div class="staff-profile-name">${App.safeText(user.fullName)}</div>
            <div class="staff-profile-meta">
              ${App.safeText(user.role)} • ${App.safeText(user.status)}<br>
              ${App.safeText(user.email)}
            </div>
          </div>

          <div style="margin-left:auto;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="Profile.openChangePhoto()">Change Photo</button>
            <button class="btn btn-secondary btn-sm" onclick="Profile.openChangePassword()">Change Password</button>
          </div>
        </div>

        <div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
          <div class="panel-muted"><strong>Phone:</strong> ${App.safeText(user.phone || '-')}</div>
          <div class="panel-muted"><strong>Address:</strong> ${App.safeText(user.address || '-')}</div>
          <div class="panel-muted"><strong>Join Date:</strong> ${user.joinDate ? new Date(user.joinDate).toLocaleDateString() : '-'}</div>
          <div class="panel-muted"><strong>Monthly Salary:</strong> ${App.currency(user.monthlySalary || 0)}</div>
          <div class="panel-muted"><strong>Working Days:</strong> ${Number(user.workingDays || 0)}</div>
        </div>

        <div style="margin-top:18px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-weight:900">Payroll Overview</div>
            <div class="text-soft">Rule: Present=100%, Leave=50%, Absent=0% (decimals kept)</div>
          </div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <label class="text-soft">Month</label>
            <input class="form-input" style="width:auto" type="month" value="${this.month}" onchange="Profile.setMonth(this.value)">
          </div>
        </div>

        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
          <div class="panel-muted"><strong>Present:</strong> ${Number(s.presentDays || 0)}</div>
          <div class="panel-muted"><strong>Leave:</strong> ${Number(s.leaveDays || 0)} (50%)</div>
          <div class="panel-muted"><strong>Paid Days (Eq.):</strong> ${Number(s.paidEquivalentDays || 0).toFixed(1)}</div>
          <div class="panel-muted"><strong>Unpaid (Eq.):</strong> ${Number(s.unpaidEquivalentDays || 0).toFixed(1)}</div>

          <div class="panel-info"><strong>Payable (${monthLabel}):</strong> ${App.currency(s.payableAmount || 0)}</div>
          <div class="panel-muted"><strong>Paid:</strong> ${App.currency(s.paidAmount || 0)}</div>
          <div class="panel-danger"><strong>Due:</strong> ${App.currency(s.dueAmount || 0)}</div>
        </div>

        <div style="margin-top:18px">
          <div style="font-weight:900;margin-bottom:10px">Salary Payment History (Proof)</div>
          <div class="modal-stack">${paymentsHtml}</div>
        </div>
      </div>
    `;
  },

  openChangePhoto() {
    App.openModal(
      'Change Profile Photo',
      `
        <div class="form-group">
          <label class="form-label">Select New Photo</label>
          <input class="form-input" id="myNewPhoto" type="file" accept="image/*">
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Profile.savePhoto()">Save</button>
      `
    );
  },

  async savePhoto() {
    const file = this.byId('myNewPhoto')?.files?.[0];
    if (!file) return App.toast('Please select a photo', 'warning');

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const json = await Store.request('/profile/photo', { method: 'PUT', body: formData });

      // Update auth user in Store so UI instantly updates everywhere
      Store.setAuthUser(json.data);

      App.closeModal();
      this.render();
      App.toast('Photo updated', 'success');
    } catch (e) {
      App.toast(e.message || 'Failed to update photo', 'error');
    }
  },

  openChangePassword() {
    App.openModal(
      'Change Password',
      `
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input class="form-input" id="myCurrentPassword" type="password">
        </div>

        <div class="form-group">
          <label class="form-label">New Password</label>
          <input class="form-input" id="myNewPassword" type="password">
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Profile.savePassword()">Update</button>
      `
    );
  },

  async savePassword() {
    const currentPassword = (this.byId('myCurrentPassword')?.value || '').trim();
    const newPassword = (this.byId('myNewPassword')?.value || '').trim();

    if (!currentPassword || !newPassword) {
      return App.toast('Both passwords are required', 'warning');
    }

    try {
      await Store.request('/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      App.closeModal();
      App.toast('Password updated', 'success');
    } catch (e) {
      App.toast(e.message || 'Failed to update password', 'error');
    }
  },

  openSalaryReceipt(payment) {
    if (!payment) return;

    const snap = payment.snapshot || {};
    const monthLabel = this.formatMonthLabel(payment.month);

    App.openModal(
      'Salary Receipt (Proof)',
      `
        <div class="receipt-preview" id="salaryReceiptPrint">
          <h2>RestOS</h2>
          <p class="receipt-sub">Salary Payment Receipt (Cash)</p>

          <hr class="receipt-divider" />
          <div class="receipt-row"><span>Receipt #</span><span>${App.safeText(payment.receiptNumber)}</span></div>
          <div class="receipt-row"><span>Salary Month</span><span>${App.safeText(monthLabel)}</span></div>
          <div class="receipt-row"><span>Paid At</span><span>${new Date(payment.paidAt).toLocaleString()}</span></div>

          <hr class="receipt-divider" />
          <div class="receipt-row bold"><span>Amount Paid</span><span>${App.currency(payment.amount)}</span></div>

          <hr class="receipt-divider" />
          <div class="receipt-section-title">Snapshot</div>
          <div class="receipt-row"><span>Present</span><span>${Number(snap.presentDays || 0)}</span></div>
          <div class="receipt-row"><span>Leave</span><span>${Number(snap.leaveDays || 0)} (50%)</span></div>
          <div class="receipt-row"><span>Paid Days (Eq.)</span><span>${Number(snap.paidEquivalentDays || 0).toFixed(1)}</span></div>
          <div class="receipt-row"><span>Unpaid (Eq.)</span><span>${Number(snap.unpaidEquivalentDays || 0).toFixed(1)}</span></div>
          <div class="receipt-row"><span>Payable</span><span>${App.currency(snap.payableAmount || 0)}</span></div>
          <div class="receipt-row"><span>Paid Before</span><span>${App.currency(snap.paidBefore || 0)}</span></div>
          <div class="receipt-row"><span>Due Before</span><span>${App.currency(snap.dueBefore || 0)}</span></div>

          <hr class="receipt-divider" />
          <p class="receipt-footer">System-generated proof of salary payment.</p>
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="Profile.printReceipt()">Print</button>
      `
    );
  },

  printReceipt() {
    const receipt = this.byId('salaryReceiptPrint');
    if (!receipt) return App.toast('Receipt not found', 'error');

    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return App.toast('Unable to open print window', 'error');

    w.document.write(`<html><head><title>Salary Receipt</title></head><body>${receipt.innerHTML}</body></html>`);
    w.document.close();
    w.focus();

    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  }
};