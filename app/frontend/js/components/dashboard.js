/**
 * CRM Hira - Dashboard & Visual Monitoring Component
 */

window.DashboardComponent = {
  async render() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:40px;">
        <p>در حال بارگذاری اطلاعات داشبورد...</p>
      </div>
    `;

    try {
      const stats = await API.getDashboardStats();
      const todayJalali = Jalali.getTodayJalali();

      container.innerHTML = `
        <!-- Top Stats Grid -->
        <div class="stats-grid">
          <div class="card stat-card emerald">
            <div class="stat-info">
              <h3>${I18N.t('activePatients')}</h3>
              <div class="stat-value">${I18N.toPersianDigits(stats.patients.active)} <span style="font-size:14px; font-weight:normal; color:var(--text-muted);">از ${I18N.toPersianDigits(stats.patients.total)}</span></div>
            </div>
            <div class="stat-icon" style="background:#dcfce7; color:#166534;">👥</div>
          </div>

          <div class="card stat-card amber">
            <div class="stat-info">
              <h3>${I18N.t('followupsToday')}</h3>
              <div class="stat-value" style="color:#d97706;">${I18N.toPersianDigits(stats.followups.today)} <span style="font-size:13px; color:#ef4444;">(${I18N.toPersianDigits(stats.followups.overdue)} معوق)</span></div>
            </div>
            <div class="stat-icon" style="background:#fef3c7; color:#b45309;">📞</div>
          </div>

          <div class="card stat-card indigo">
            <div class="stat-info">
              <h3>${I18N.t('paidRevenue')}</h3>
              <div class="stat-value" style="font-size:18px;">${I18N.formatPrice(stats.finance.paid)}</div>
            </div>
            <div class="stat-icon" style="background:#e0e7ff; color:#4338ca;">💳</div>
          </div>

          <div class="card stat-card rose">
            <div class="stat-info">
              <h3>${I18N.t('remainingBalance')}</h3>
              <div class="stat-value" style="font-size:18px; color:#e11d48;">${I18N.formatPrice(stats.finance.remaining)}</div>
            </div>
            <div class="stat-icon" style="background:#ffe4e6; color:#be123c;">⏳</div>
          </div>
        </div>

        <!-- Section 3: Visual Monitoring Panel (Active vs Inactive) -->
        <div class="monitor-panel">
          <div class="monitor-card">
            <div class="monitor-card-header">
              <h4>📊 پایش وضعیت مراجعین و زیباجویان</h4>
              <span class="pill pill-merged">کل: ${I18N.toPersianDigits(stats.patients.total)} پرونده</span>
            </div>
            <div class="monitor-badges">
              <div class="monitor-badge badge-active">
                <span class="count">${I18N.toPersianDigits(stats.patients.active)}</span>
                <span class="label">زیباجویان تحت درمان فعال</span>
              </div>
              <div class="monitor-badge badge-inactive">
                <span class="count">${I18N.toPersianDigits(stats.patients.inactive)}</span>
                <span class="label">پرونده‌های راکد / غیرفعال</span>
              </div>
            </div>
            <div style="margin-top:14px; text-align:left;">
              <button class="btn btn-secondary btn-sm" onclick="App.navigate('patients')">مشاهده لیست و مدیریت وضعیت &larr;</button>
            </div>
          </div>

          <div class="monitor-card">
            <div class="monitor-card-header">
              <h4>👥 پایش پرسنل و کاربران سیستم (RBAC)</h4>
              <span class="pill pill-active">کل: ${I18N.toPersianDigits(stats.users.total)} کاربر</span>
            </div>
            <div class="monitor-badges">
              <div class="monitor-badge badge-active">
                <span class="count">${I18N.toPersianDigits(stats.users.active)}</span>
                <span class="label">کاربران فعال (مجاز به ورود)</span>
              </div>
              <div class="monitor-badge badge-inactive">
                <span class="count">${I18N.toPersianDigits(stats.users.inactive)}</span>
                <span class="label">کاربران غیرفعال (مسدود)</span>
              </div>
            </div>
            <div style="margin-top:14px; text-align:left;">
              <button class="btn btn-secondary btn-sm" onclick="App.navigate('users')">مدیریت دسترسی‌ها &larr;</button>
            </div>
          </div>
        </div>

        <!-- Monthly Payment Confirmation Prompt Banner (Requirement 4) -->
        ${stats.installments_due_month > 0 ? `
          <div style="background:linear-gradient(135deg, #fffbeb, #fef3c7); border:1px solid #fde68a; border-radius:var(--radius); padding:16px 20px; margin-bottom:24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:24px;">🔔</span>
              <div>
                <strong style="color:#92400e; font-size:14px;">یادآوری وصول اقساط ماه جاری (${todayJalali.text}):</strong>
                <p style="color:#b45309; font-size:13px; margin-top:2px;">
                  تعداد <b>${I18N.toPersianDigits(stats.installments_due_month)}</b> قسط سررسید شده در انتظار تایید دریافت و کسر از مانده حساب است.
                </p>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.navigate('payments')">مشاهده و تایید وصول اقساط</button>
          </div>
        ` : ''}

        <!-- Quick Actions & Clinic Shortcuts -->
        <div class="card" style="margin-bottom:24px;">
          <h4 style="font-size:15px; font-weight:700; margin-bottom:14px;">⚡ دسترسی سریع به عملیات کلینیک</h4>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="PatientsComponent.openNewPatientModal()">
              <span>➕</span> پذیرش زیباجوی جدید (با خدمات چندگانه)
            </button>
            <button class="btn btn-secondary" onclick="LeadsComponent.openNewLeadModal()">
              <span>📝</span> ثبت مشاوره / پیش‌فاکتور جدید (رتارگتینگ)
            </button>
            <button class="btn btn-secondary" onclick="App.navigate('followups')">
              <span>📅</span> بررسی تماس‌های پیگیری امروز (${todayJalali.formatted})
            </button>
            <button class="btn btn-secondary" onclick="App.navigate('referrals')">
              <span>🏆</span> مشاهده گزارش معرفین و درآمد جذب‌شده
            </button>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:red; padding:20px;">خطا در دریافت اطلاعات: ${err.message}</div>`;
    }
  }
};
