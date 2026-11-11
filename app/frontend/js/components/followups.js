/**
 * CRM Hira - Post-Treatment Follow-up Schedule & Merge Management Component
 */

window.FollowupsComponent = {
  currentFilter: 'all', // all, pending, completed, today

  async render() {
    const container = document.getElementById('main-content');
    const todayJalali = Jalali.getTodayJalali();

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:700;">برنامه پیگیری و مراقبت‌های پس از عمل</h2>
          <p style="font-size:12.5px; color:var(--text-muted);">
            امروز: <b>${todayJalali.text} (${todayJalali.formatted})</b>
          </p>
        </div>

        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="FollowupsComponent.setFilter('all')">همه</button>
          <button class="btn btn-sm ${this.currentFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}" onclick="FollowupsComponent.setFilter('pending')">در انتظار تماس</button>
          <button class="btn btn-sm ${this.currentFilter === 'today' ? 'btn-primary' : 'btn-secondary'}" onclick="FollowupsComponent.setFilter('today')">موعد امروز</button>
          <button class="btn btn-sm ${this.currentFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}" onclick="FollowupsComponent.setFilter('completed')">تکمیل شده</button>
        </div>
      </div>

      <!-- Informational banner explaining automatic deduplication -->
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius); padding:14px 18px; margin-bottom:20px; display:flex; align-items:flex-start; gap:12px;">
        <span style="font-size:22px; line-height:1;">✨</span>
        <div style="font-size:13px; color:#166534; line-height:1.7;">
          <strong>هوش مصنوعی ادغام خدمات چندگانه:</strong>
          هرگاه بیماری همزمان چند خدمت انجام دهد که پیگیری یکسانی در یک روز دارند (مانند تماس پشتیبانی روانی روز سوم)، سیستم وظایف را بدون تکرار ادغام کرده و با برچسب بنفش <span class="pill pill-merged">ادغام شده (چند خدمتی)</span> نمایش می‌دهد.
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>موعد پیگیری (شمسی)</th>
              <th>نام زیباجو</th>
              <th>شماره تماس</th>
              <th>عنوان پیگیری و پروتکل</th>
              <th>خدمات درگیر</th>
              <th>وضعیت</th>
              <th>یادداشت‌های بالینی</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody id="followups-table-body">
            <tr><td colspan="8" style="text-align:center; padding:30px;">در حال دریافت برنامه پیگیری...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.loadFollowups();
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.render();
  },

  async loadFollowups() {
    try {
      const todayStr = (this.currentFilter === 'today') ? new Date().toISOString().split('T')[0] : '';
      const statusParam = (this.currentFilter === 'today' || this.currentFilter === 'all') ? 'all' : this.currentFilter;
      const tasks = await API.getFollowups(statusParam, '', todayStr);

      const tbody = document.getElementById('followups-table-body');
      if (!tbody) return;

      if (!tasks || tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">موردی برای نمایش وجود ندارد.</td></tr>`;
        return;
      }

      tbody.innerHTML = tasks.map(t => {
        const isDone = t.status === 'completed';
        const isMerged = t.title_fa.includes('مشترک') || (t.services_involved && (t.services_involved.includes(',') || t.services_involved.length > 20));
        
        return `
          <tr style="${isDone ? 'background-color:#fafafa; opacity:0.85;' : ''}">
            <td>
              <strong style="color:var(--text-main); font-size:14px;">${Jalali.toJalaliString(t.due_date)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${t.due_date}</div>
            </td>
            <td>
              <strong style="cursor:pointer; color:var(--primary);" onclick="PatientsComponent.openPatientDetails(${t.patient_id})">
                ${t.patient_name}
              </strong>
              <div style="font-size:11px; color:var(--text-muted);">${t.file_number}</div>
            </td>
            <td>
              <a href="tel:${t.patient_phone}" style="color:inherit; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                📞 ${t.patient_phone}
              </a>
            </td>
            <td>
              <div style="font-weight:700; color:#1e293b; font-size:13.5px;">${t.title_fa}</div>
              ${isMerged ? `<span class="pill pill-merged" style="margin-top:4px;">✨ ادغام شده (چند خدمتی)</span>` : ''}
            </td>
            <td>
              <span style="font-size:12px; color:#475569; background:#f1f5f9; padding:3px 8px; border-radius:6px; display:inline-block;">
                ${t.services_involved.replace(/\[|"|\]/g, '')}
              </span>
            </td>
            <td>
              <span class="pill ${isDone ? 'pill-active' : 'pill-pending'}">
                ${isDone ? '✓ تکمیل شد' : '⏳ در انتظار تماس'}
              </span>
            </td>
            <td style="max-width:220px; font-size:12px; color:var(--text-muted);">
              ${t.notes || '—'}
            </td>
            <td>
              ${!isDone ? `
                <button class="btn btn-success btn-sm" onclick="FollowupsComponent.completeTask(${t.id})">
                  ثبت انجام تماس
                </button>
              ` : `
                <span style="color:var(--success); font-size:12px; font-weight:600;">✓ انجام شد</span>
              `}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async completeTask(taskId) {
    const notes = prompt("یادداشت و نتیجه تماس اپراتور:", "تماس پشتیبانی گرفته شد. حال بیمار کاملا مساعد است و مشکلی گزارش نشد.");
    if (notes === null) return;

    try {
      await API.updateFollowup(taskId, 'completed', notes);
      alert("تماس با موفقیت ثبت شد.");
      this.loadFollowups();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  }
};
