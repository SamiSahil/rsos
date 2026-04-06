const StaffPage = {
  isLoading: false,

  byId(id) {
    return document.getElementById(id);
  },

  getStaff() {
    return Store.get('staff') || [];
  },

  getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
  },

  async load() {
    if (this.isLoading) return;

    this.isLoading = true;

    try {
      await Store.fetchStaff();
      this.render();
    } catch (error) {
      App.toast(error.message || 'Failed to load staff', 'error');
    } finally {
      this.isLoading = false;
    }
  },

  async refresh() {
    await this.load();
  },

  render() {
    this.renderSummary();
    this.renderTable();
  },

  calculatePayableSalary(person) {
    const monthlySalary = Number(person.monthlySalary || 0);
    const workingDays = Number(person.workingDays || 30);
    const presentDays = Number(person.presentDays || 0);

    if (workingDays <= 0) return 0;

    const dailySalary = monthlySalary / workingDays;
    return dailySalary * presentDays;
  },

  formatAttendance(person) {
    const present = Number(person.presentDays || 0);
    const absent = Number(person.absentDays || 0);
    const leave = Number(person.leaveDays || 0);
    return `${present}P / ${absent}A / ${leave}L`;
  },

  getSummaryData() {
    const staff = this.getStaff();

    return {
      total: staff.length,
      active: staff.filter((person) => person.status === 'active').length,
      inactive: staff.filter((person) => person.status === 'inactive').length,
      onLeave: staff.filter((person) => person.status === 'on-leave').length,
      totalPayroll: staff.reduce((sum, person) => sum + Number(person.monthlySalary || 0), 0),
      totalPayable: staff.reduce((sum, person) => sum + this.calculatePayableSalary(person), 0)
    };
  },

  renderSummary() {
    const summary = this.byId('staffSummary');
    if (!summary) return;

    const { total, active, inactive, onLeave, totalPayroll, totalPayable } = this.getSummaryData();

    summary.innerHTML = `
      <div class="staff-summary-grid">
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-accent">${total}</div>
          <div class="staff-summary-label">Total Staff</div>
        </div>

        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-success">${active}</div>
          <div class="staff-summary-label">Active</div>
        </div>

        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-warning">${onLeave}</div>
          <div class="staff-summary-label">On Leave</div>
        </div>

        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-danger">${inactive}</div>
          <div class="staff-summary-label">Inactive</div>
        </div>

        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-info">${App.currency(totalPayroll)}</div>
          <div class="staff-summary-label">Total Monthly Payroll</div>
        </div>

        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-purple">${App.currency(totalPayable)}</div>
          <div class="staff-summary-label">Total Payable Salary</div>
        </div>
      </div>
    `;
  },

  getRoleBadge(role) {
    const roleMap = {
      admin: 'badge-danger',
      manager: 'badge-purple',
      cashier: 'badge-info',
      kitchen: 'badge-warning',
      waiter: 'badge-success'
    };

    return `<span class="badge ${roleMap[role] || 'badge-accent'}">${App.safeText(role)}</span>`;
  },

  getInitials(fullName) {
    if (!fullName) return 'ST';

    return fullName
      .split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  },

  renderStatusControls(person) {
    const today = this.getTodayDateString();
    const currentStatus = (person.attendance || []).find((entry) => entry.date === today)?.status || person.status || 'inactive';

    return `
      <div class="staff-status-actions">
        <button
          class="staff-status-btn ${currentStatus === 'active' ? 'is-active active-green' : ''}"
          title="Active"
          onclick="StaffPage.quickUpdateStatus('${person._id}', 'active')"
        >
          <span class="staff-status-dot"></span>
          <span class="staff-status-label">Active</span>
        </button>

        <button
          class="staff-status-btn ${currentStatus === 'inactive' ? 'is-active active-red' : ''}"
          title="Inactive"
          onclick="StaffPage.quickUpdateStatus('${person._id}', 'inactive')"
        >
          <span class="staff-status-dot"></span>
          <span class="staff-status-label">Inactive</span>
        </button>

        <button
          class="staff-status-btn ${currentStatus === 'on-leave' ? 'is-active active-yellow' : ''}"
          title="Leave"
          onclick="StaffPage.quickUpdateStatus('${person._id}', 'on-leave')"
        >
          <span class="staff-status-dot"></span>
          <span class="staff-status-label">Leave</span>
        </button>

        <button
          class="btn btn-secondary btn-xs"
          onclick="StaffPage.openAttendanceCalendar('${person._id}')"
        >
          Calendar
        </button>
      </div>
    `;
  },

  async quickUpdateStatus(id, status) {
    try {
      await Store.request(`/staff/${id}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          date: this.getTodayDateString()
        })
      });

      await Store.fetchStaff();
      this.render();
      App.toast(`Attendance updated to ${status.replace('-', ' ')}`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update attendance', 'error');
    }
  },

  renderStaffRow(person) {
    return `
      <tr>
        <td>
          <div class="staff-user-wrap">
            <div class="staff-avatar">
              ${this.getInitials(person.fullName)}
            </div>

            <div>
              <div class="staff-user-name">${App.safeText(person.fullName)}</div>
              <div class="staff-user-email">${App.safeText(person.email)}</div>
            </div>
          </div>
        </td>

        <td>${this.getRoleBadge(person.role)}</td>
        <td>${this.renderStatusControls(person)}</td>
        <td>${App.safeText(person.phone || '-')}</td>
        <td>${person.joinDate ? new Date(person.joinDate).toLocaleDateString() : '-'}</td>
        <td>${App.currency(person.monthlySalary || 0)}</td>
        <td>${this.formatAttendance(person)}</td>
        <td>${App.currency(this.calculatePayableSalary(person))}</td>

        <td>
          <button class="btn btn-secondary btn-xs" onclick="StaffPage.openViewModal('${person._id}')">View</button>
          <button class="btn btn-primary btn-xs" onclick="StaffPage.openEditModal('${person._id}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="StaffPage.deleteStaff('${person._id}')">Delete</button>
        </td>
      </tr>
    `;
  },

  renderTable() {
    const body = this.byId('staffBody');
    if (!body) return;

    const staff = this.getStaff();

    if (!staff.length) {
      body.innerHTML = `
        <tr>
          <td colspan="9" class="staff-empty-cell">
            No staff found
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = staff.map((person) => this.renderStaffRow(person)).join('');
  },

  getDaysInCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  },

  getAttendanceStatusForDate(person, dateStr) {
    const entry = (person.attendance || []).find((item) => item.date === dateStr);
    return entry?.status || '';
  },

  getCalendarCellClass(status) {
    if (status === 'active') return 'calendar-day active-green';
    if (status === 'inactive') return 'calendar-day active-red';
    if (status === 'on-leave') return 'calendar-day active-yellow';
    return 'calendar-day';
  },

  openAttendanceCalendar(id) {
    const staff = this.getStaff().find((person) => person._id === id);
    if (!staff) {
      App.toast('Staff not found', 'error');
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = this.getDaysInCurrentMonth();

    let daysHtml = '';

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = dateObj.toISOString().slice(0, 10);
      const status = this.getAttendanceStatusForDate(staff, dateStr);

      daysHtml += `
        <button
          class="${this.getCalendarCellClass(status)}"
          onclick="StaffPage.openAttendanceDayPicker('${staff._id}', '${dateStr}')"
        >
          <div class="calendar-day-number">${day}</div>
          <div class="calendar-day-status">${status ? status.replace('-', ' ') : '-'}</div>
        </button>
      `;
    }

    App.openModal(
      `Attendance Calendar — ${App.safeText(staff.fullName)}`,
      `
        <div class="calendar-grid">
          ${daysHtml}
        </div>
      `,
      `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`
    );
  },

  openAttendanceDayPicker(staffId, dateStr) {
    App.openModal(
      `Set Attendance — ${dateStr}`,
      `
        <div class="modal-stack">
          <button class="btn btn-success" onclick="StaffPage.setAttendanceForDate('${staffId}', '${dateStr}', 'active')">Mark Active</button>
          <button class="btn btn-danger" onclick="StaffPage.setAttendanceForDate('${staffId}', '${dateStr}', 'inactive')">Mark Inactive</button>
          <button class="btn btn-secondary" onclick="StaffPage.setAttendanceForDate('${staffId}', '${dateStr}', 'on-leave')">Mark Leave</button>
        </div>
      `,
      `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>`
    );
  },

  async setAttendanceForDate(staffId, dateStr, status) {
    try {
      await Store.request(`/staff/${staffId}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          date: dateStr
        })
      });

      await Store.fetchStaff();
      App.closeModal();
      this.render();
      App.toast(`Attendance set to ${status.replace('-', ' ')} for ${dateStr}`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to set attendance', 'error');
    }
  },

  openAddModal() {
    const body = `
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="form-input" id="staffFullName" placeholder="Full name">
      </div>

      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="staffEmail" type="email" placeholder="Email">
      </div>

      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-input" id="staffPhone" placeholder="Phone">
      </div>

      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" id="staffPassword" type="password" placeholder="Password">
      </div>

      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea class="form-textarea" id="staffAddress" placeholder="Address"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">NID Number</label>
        <input class="form-input" id="staffNidNumber" placeholder="NID Number">
      </div>

      <div class="form-group">
        <label class="form-label">NID Image</label>
        <input class="form-input" id="staffNidImage" type="file" accept="image/*">
      </div>

      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" id="staffRole">
          <option value="waiter">Waiter</option>
          <option value="cashier">Cashier</option>
          <option value="kitchen">Kitchen</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Join Date</label>
        <input class="form-input" id="staffJoinDate" type="date">
      </div>

      <div class="form-group">
        <label class="form-label">Monthly Salary</label>
        <input class="form-input" id="staffMonthlySalary" type="number" min="0" placeholder="10000">
      </div>

      <div class="form-group">
        <label class="form-label">Working Days</label>
        <input class="form-input" id="staffWorkingDays" type="number" min="1" value="30">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveStaffBtn" onclick="StaffPage.saveNewStaff()">Save</button>
    `;

    App.openModal('Add Staff', body, footer);
  },

  buildStaffFormData(prefix = '') {
  const formData = new FormData();

  const field = (baseId) => {
    const id = prefix
      ? `${prefix}${baseId.charAt(0).toUpperCase()}${baseId.slice(1)}`
      : baseId;

    return this.byId(id);
  };

  formData.append('fullName', field('staffFullName')?.value?.trim() || '');
  formData.append('email', field('staffEmail')?.value?.trim() || '');
  formData.append('phone', field('staffPhone')?.value?.trim() || '');
  formData.append('password', field('staffPassword')?.value?.trim() || '');
  formData.append('address', field('staffAddress')?.value?.trim() || '');
  formData.append('nidNumber', field('staffNidNumber')?.value?.trim() || '');
  formData.append('role', field('staffRole')?.value || 'waiter');
  formData.append('status', field('staffStatus')?.value || 'active');
  formData.append('joinDate', field('staffJoinDate')?.value || '');
  formData.append('monthlySalary', field('staffMonthlySalary')?.value || '0');
  formData.append('workingDays', field('staffWorkingDays')?.value || '30');
  formData.append('presentDays', field('staffPresentDays')?.value || '0');
  formData.append('absentDays', field('staffAbsentDays')?.value || '0');
  formData.append('leaveDays', field('staffLeaveDays')?.value || '0');

  const file = field('staffNidImage')?.files?.[0];
  if (file) {
    formData.append('nidImage', file);
  }

  return formData;
},

  validateStaffForm(formData, isEdit = false) {
    const fullName = formData.get('fullName');
    const email = formData.get('email');
    const password = formData.get('password');

    if (!fullName || !email) {
      App.toast('Full name and email are required', 'warning');
      return false;
    }

    if (!isEdit && !password) {
      App.toast('Password is required', 'warning');
      return false;
    }

    const workingDays = Number(formData.get('workingDays') || 0);

    if (workingDays < 1) {
      App.toast('Working days must be at least 1', 'warning');
      return false;
    }

    return true;
  },

  async saveNewStaff() {
    const saveBtn = this.byId('saveStaffBtn');
    const formData = this.buildStaffFormData('');

    if (!this.validateStaffForm(formData, false)) return;

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Save');

    try {
      await Store.request('/staff', {
        method: 'POST',
        body: formData
      });

      await Store.fetchStaff();
      this.render();
      App.closeModal();
      App.toast('Staff added successfully', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to add staff', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Save');
    }
  },

  findStaff(id) {
    return this.getStaff().find((person) => person._id === id);
  },

  openViewModal(id) {
    const staff = this.findStaff(id);
    if (!staff) {
      App.toast('Staff not found', 'error');
      return;
    }

    const payableSalary = this.calculatePayableSalary(staff);

    App.openModal(
      'Staff Details',
      `
        <div class="staff-detail-grid">
          <div><strong>Name:</strong> ${App.safeText(staff.fullName)}</div>
          <div><strong>Email:</strong> ${App.safeText(staff.email)}</div>
          <div><strong>Phone:</strong> ${App.safeText(staff.phone || '-')}</div>
          <div><strong>Address:</strong> ${App.safeText(staff.address || '-')}</div>
          <div><strong>Role:</strong> ${App.safeText(staff.role)}</div>
          <div><strong>Status:</strong> ${App.safeText(staff.status)}</div>
          <div><strong>NID Number:</strong> ${App.safeText(staff.nidNumber || '-')}</div>
          <div><strong>Join Date:</strong> ${staff.joinDate ? new Date(staff.joinDate).toLocaleDateString() : '-'}</div>
          <div><strong>Monthly Salary:</strong> ${App.currency(staff.monthlySalary || 0)}</div>
          <div><strong>Working Days:</strong> ${staff.workingDays || 30}</div>
          <div><strong>Present Days:</strong> ${staff.presentDays || 0}</div>
          <div><strong>Absent Days:</strong> ${staff.absentDays || 0}</div>
          <div><strong>Leave Days:</strong> ${staff.leaveDays || 0}</div>
          <div><strong>Payable Salary:</strong> ${App.currency(payableSalary)}</div>

          ${
            staff.nidImageUrl
              ? `
                <div class="staff-detail-image-wrap">
                  <strong>NID Image:</strong><br>
                  <img src="${App.safeText(staff.nidImageUrl, '')}" class="staff-detail-image">
                </div>
              `
              : ''
          }
        </div>
      `,
      `<button class="btn btn-primary" onclick="App.closeModal()">Close</button>`
    );
  },

  openEditModal(id) {
    const staff = this.findStaff(id);
    if (!staff) {
      App.toast('Staff not found', 'error');
      return;
    }

    const joinDateValue = staff.joinDate
      ? new Date(staff.joinDate).toISOString().slice(0, 10)
      : '';

    const body = `
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="form-input" id="editStaffFullName" value="${App.safeText(staff.fullName, '')}">
      </div>

      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="editStaffEmail" type="email" value="${App.safeText(staff.email, '')}">
      </div>

      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-input" id="editStaffPhone" value="${App.safeText(staff.phone || '', '')}">
      </div>

      <div class="form-group">
        <label class="form-label">New Password (optional)</label>
        <input class="form-input" id="editStaffPassword" type="password" placeholder="Leave blank to keep current">
      </div>

      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea class="form-textarea" id="editStaffAddress">${App.safeText(staff.address || '', '')}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">NID Number</label>
        <input class="form-input" id="editStaffNidNumber" value="${App.safeText(staff.nidNumber || '', '')}">
      </div>

      <div class="form-group">
        <label class="form-label">Replace NID Image</label>
        <input class="form-input" id="editStaffNidImage" type="file" accept="image/*">
      </div>

      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" id="editStaffRole">
          <option value="waiter" ${staff.role === 'waiter' ? 'selected' : ''}>Waiter</option>
          <option value="cashier" ${staff.role === 'cashier' ? 'selected' : ''}>Cashier</option>
          <option value="kitchen" ${staff.role === 'kitchen' ? 'selected' : ''}>Kitchen</option>
          <option value="manager" ${staff.role === 'manager' ? 'selected' : ''}>Manager</option>
          <option value="admin" ${staff.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="editStaffStatus">
          <option value="active" ${staff.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${staff.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          <option value="on-leave" ${staff.status === 'on-leave' ? 'selected' : ''}>On Leave</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Join Date</label>
        <input class="form-input" id="editStaffJoinDate" type="date" value="${joinDateValue}">
      </div>

      <div class="form-group">
        <label class="form-label">Monthly Salary</label>
        <input class="form-input" id="editStaffMonthlySalary" type="number" min="0" value="${staff.monthlySalary || 0}">
      </div>

      <div class="form-group">
        <label class="form-label">Working Days</label>
        <input class="form-input" id="editStaffWorkingDays" type="number" min="1" value="${staff.workingDays || 30}">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveEditStaffBtn" onclick="StaffPage.saveEditStaff('${id}')">Save Changes</button>
    `;

    App.openModal('Edit Staff', body, footer);
  },

  async saveEditStaff(id) {
    const saveBtn = this.byId('saveEditStaffBtn');
    const formData = this.buildStaffFormData('edit');

    if (!this.validateStaffForm(formData, true)) return;

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Save Changes');

    try {
      await Store.request(`/staff/${id}`, {
        method: 'PUT',
        body: formData
      });

      await Store.fetchStaff();
      this.render();
      App.closeModal();
      App.toast('Staff updated successfully', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update staff', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Save Changes');
    }
  },

  deleteStaff(id) {
    const staff = this.findStaff(id);
    if (!staff) {
      App.toast('Staff not found', 'error');
      return;
    }

    App.openModal(
      'Delete Staff',
      `
        <p class="text-muted">
          Are you sure you want to delete <strong>${App.safeText(staff.fullName)}</strong>?
        </p>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="deleteStaffBtn" onclick="StaffPage.confirmDelete('${id}')">Delete</button>
      `
    );
  },

  async confirmDelete(id) {
    const deleteBtn = this.byId('deleteStaffBtn');

    App.setButtonLoading(deleteBtn, true, 'Deleting...', 'Delete');

    try {
      await Store.request(`/staff/${id}`, {
        method: 'DELETE'
      });

      await Store.fetchStaff();
      this.render();
      App.closeModal();
      App.toast('Staff deleted successfully', 'warning');
    } catch (error) {
      App.toast(error.message || 'Failed to delete staff', 'error');
    } finally {
      App.setButtonLoading(deleteBtn, false, 'Deleting...', 'Delete');
    }
  }
};