/**
 * CRM Hira - RBAC & User Status Management Component (Admin Only)
 * Allows administrator to create staff, define roles, toggle status, and view staff passwords.
 */

window.UsersComponent = {
  async render() {
    const container = document.getElementById('main-content');
    const currentUser = API.getCurrentUser();

    if (currentUser && currentUser.role !== 'admin') {
      container.innerHTML = `
        <div class="card" style="padding:30px; text-align:center; color:var(--danger);">
          <h3>دسترسی محدود شده است</h3>
          <p style="margin-top:8px;">تنها مدیر کل سیستم (Admin) اجازه دسترسی به مدیریت پرسنل و سطوح دسترسی را دارد.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:700;">مدیریت پرسنل، سطوح دسترسی و وضعیت کاربران (RBAC)</h2>
          <p style="font-size:12.5px; color:var(--text-muted);">
            تعریف نقش‌های کاربری (پزشک، پذیرش/اپراتور، حسابدار)، مشاهده رمزهای عبور و تغییر وضعیت فعال/غیرفعال.
          </p>
        </div>

        <button class="btn btn-primary" onclick="UsersComponent.openNewUserModal()">
          <span>➕</span> افزودن پرسنل جدید
        </button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>نام کاربری</th>
              <th>نام و نام خانوادگی</th>
              <th>نقش سازمانی</th>
              <th>رمز عبور (مدیر)</th>
              <th>شماره تماس</th>
              <th>وضعیت حساب</th>
              <th>تاریخ عضویت</th>
              <th>عملیات تغییر وضعیت</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="8" style="text-align:center; padding:30px;">در حال بارگذاری لیست کاربران...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.loadUsers();
  },

  async loadUsers() {
    try {
      const users = await API.getUsers();
      const tbody = document.getElementById('users-table-body');
      if (!tbody) return;

      const roleBadges = {
        admin: '<span class="pill pill-merged">مدیر کل سیستم</span>',
        doctor: '<span class="pill" style="background:#e0f2fe; color:#0369a1;">پزشک / متخصص</span>',
        operator: '<span class="pill" style="background:#fef3c7; color:#92400e;">پذیرش و پیگیری</span>',
        accountant: '<span class="pill" style="background:#dcfce7; color:#166534;">امور مالی و حسابداری</span>'
      };

      tbody.innerHTML = users.map(u => {
        const isActive = u.is_active === 1;
        const isAdminUser = u.role === 'admin';
        return `
          <tr>
            <td><strong style="font-family:monospace; font-size:14px;">${u.username}</strong></td>
            <td><strong>${u.full_name}</strong></td>
            <td>${roleBadges[u.role] || u.role}</td>
            <td>
              <div style="display:flex; align-items:center; gap:6px;">
                <span id="pwd-val-${u.id}" style="font-family:monospace; font-size:13px; filter:blur(4px); user-select:none; transition:0.2s; background:#f1f5f9; padding:2px 8px; border-radius:4px;">
                  ${u.raw_pwd || '••••••••'}
                </span>
                <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:11px;" 
                        title="نمایش / پنهان‌سازی رمز"
                        onclick="UsersComponent.togglePwdVisibility(${u.id})">
                  👁️
                </button>
              </div>
            </td>
            <td>${u.phone || '—'}</td>
            <td>
              <span class="pill ${isActive ? 'pill-active' : 'pill-inactive'}">
                ${isActive ? '🟢 فعال' : '⚪ غیرفعال'}
              </span>
            </td>
            <td>${Jalali.toJalaliString(u.created_at ? u.created_at.split(' ')[0] : '')}</td>
            <td>
              ${!isAdminUser ? `
                <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-success'}" 
                        onclick="UsersComponent.toggleUserStatus(${u.id}, ${isActive})">
                  ${isActive ? 'غیرفعال‌سازی کاربر' : 'فعال‌سازی مجدد'}
                </button>
              ` : `<span style="font-size:12px; color:var(--text-muted);">حساب اصلی</span>`}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  togglePwdVisibility(userId) {
    const el = document.getElementById(`pwd-val-${userId}`);
    if (el) {
      if (el.style.filter === 'none') {
        el.style.filter = 'blur(4px)';
        el.style.userSelect = 'none';
      } else {
        el.style.filter = 'none';
        el.style.userSelect = 'all';
      }
    }
  },

  async toggleUserStatus(userId, currentlyActive) {
    if (!confirm(`آیا از تغییر وضعیت این کاربر به ${currentlyActive ? 'غیرفعال' : 'فعال'} اطمینان دارید؟`)) return;

    try {
      await API.toggleUserStatus(userId, !currentlyActive);
      this.loadUsers();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  openNewUserModal() {
    App.openModal(`
      <div class="modal-card" style="max-width:500px;">
        <div class="modal-header">
          <h3>افزودن پرسنل جدید به سامانه</h3>
          <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="new-user-form" onsubmit="UsersComponent.submitNewUser(event)">
            <div class="form-group">
              <label class="form-label">نام و نام خانوادگی *</label>
              <input type="text" name="full_name" class="form-input" required placeholder="مثال: دکتر مهدی صبوری">
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">نام کاربری (لاتین) *</label>
                <input type="text" name="username" class="form-input" required placeholder="مثال: doc1" style="direction:ltr; text-align:left;">
              </div>
              <div class="form-group">
                <label class="form-label">رمز عبور *</label>
                <input type="text" name="password" class="form-input" required placeholder="کلمه عبور پرسنل" style="direction:ltr; text-align:left;">
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">نقش و سطح دسترسی (RBAC) *</label>
                <select name="role" class="form-select" required>
                  <option value="operator">پذیرش و اپراتور پیگیری</option>
                  <option value="doctor">پزشک / متخصص پوست و مو</option>
                  <option value="accountant">حسابدار و امور مالی</option>
                  <option value="admin">مدیر سیستم (کمکی)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">شماره همراه</label>
                <input type="text" name="phone" class="form-input" placeholder="0912xxxxxxx">
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">انصراف</button>
              <button type="submit" class="btn btn-primary">ایجاد حساب کاربری</button>
            </div>
          </form>
        </div>
      </div>
    `);
  },

  async submitNewUser(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const payload = {
      full_name: formData.get('full_name'),
      username: formData.get('username'),
      password: formData.get('password'),
      role: formData.get('role'),
      phone: formData.get('phone')
    };

    try {
      await API.createUser(payload);
      App.closeModal();
      alert("حساب کاربری جدید با موفقیت ایجاد شد.");
      this.loadUsers();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  }
};
