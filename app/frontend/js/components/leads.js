/**
 * CRM Hira - Lead Tracking & Consultation Retargeting Component
 */

window.LeadsComponent = {
  activeStatusFilter: 'all',

  async render() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:700;">مدیریت سرنخ‌ها و مشاوره‌ها (رتارگتینگ مراجعین بالقوه)</h2>
          <p style="font-size:12.5px; color:var(--text-muted);">
            ثبت اطلاعات افرادی که مشاوره یا پیش‌فاکتور دریافت کرده‌اند جهت بازاریابی و تماس‌های ترغیبی بعدی.
          </p>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <select class="form-select" style="width:180px;" onchange="LeadsComponent.setStatusFilter(this.value)">
            <option value="all">همه وضعیت‌ها</option>
            <option value="needs_followup">نیازمند پیگیری</option>
            <option value="interested">علاقه‌مند و مصمم</option>
            <option value="thinking">در حال تصمیم‌گیری</option>
            <option value="price_sensitive">حساس به قیمت (منتظر تخفیف)</option>
            <option value="converted">تبدیل شده به زیباجو</option>
            <option value="lost">انصراف داده / لغو شده</option>
          </select>

          <button class="btn btn-primary" onclick="LeadsComponent.openNewLeadModal()">
            <span>➕</span> ثبت مشاوره جدید
          </button>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>نام و نام خانوادگی</th>
              <th>شماره تماس</th>
              <th>تاریخ مشاوره</th>
              <th>خدمات مورد علاقه</th>
              <th>مبلغ پیش‌فاکتور</th>
              <th>وضعیت رتارگتینگ</th>
              <th>یادداشت‌های مشاوره</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody id="leads-table-body">
            <tr><td colspan="8" style="text-align:center; padding:30px;">در حال دریافت سرنخ‌ها...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.loadLeads();
  },

  setStatusFilter(status) {
    this.activeStatusFilter = status;
    this.loadLeads();
  },

  async loadLeads() {
    try {
      const leads = await API.getLeads(this.activeStatusFilter);
      const tbody = document.getElementById('leads-table-body');
      if (!tbody) return;

      if (!leads || leads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">سرنخی با این فیلتر یافت نشد.</td></tr>`;
        return;
      }

      const statusLabels = {
        needs_followup: { text: "نیازمند پیگیری", cls: "pill-pending" },
        interested: { text: "علاقه‌مند", cls: "pill-active" },
        thinking: { text: "در حال فکر", cls: "pill-pending" },
        price_sensitive: { text: "حساس به قیمت", cls: "pill-pending" },
        converted: { text: "✓ ثبت‌نام شده", cls: "pill-active" },
        lost: { text: "منصرف", cls: "pill-inactive" }
      };

      tbody.innerHTML = leads.map(l => {
        const isConverted = l.retargeting_status === 'converted';
        const st = statusLabels[l.retargeting_status] || { text: l.retargeting_status, cls: "pill-pending" };

        return `
          <tr>
            <td><strong>${l.full_name}</strong></td>
            <td><a href="tel:${l.phone}" style="color:inherit; text-decoration:none; font-weight:600;">📞 ${l.phone}</a></td>
            <td>${Jalali.toJalaliString(l.consultation_date)}</td>
            <td><small style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${l.interested_services ? l.interested_services.replace(/\[|"|\]/g, '') : '—'}</small></td>
            <td><strong>${I18N.formatPrice(l.quoted_price)}</strong></td>
            <td><span class="pill ${st.cls}">${st.text}</span></td>
            <td style="max-width:240px; font-size:12.5px; color:var(--text-muted);">${l.consultation_notes || '—'}</td>
            <td>
              ${!isConverted ? `
                <button class="btn btn-primary btn-sm" onclick="LeadsComponent.convertLeadPrompt(${l.id})">
                  🎯 تبدیل به بیمار
                </button>
              ` : `
                <span style="color:var(--success); font-size:12px; font-weight:600;">تبدیل شد (پرونده فعال)</span>
              `}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async openNewLeadModal() {
    const todayJalali = Jalali.getTodayJalali();
    const services = await API.getServices();

    const servicesCheckboxes = services.map(s => `
      <label style="display:inline-flex; align-items:center; gap:6px; margin:4px 8px; font-size:13px; cursor:pointer;">
        <input type="checkbox" name="interested_services" value="${s.code}">
        ${s.name_fa}
      </label>
    `).join('');

    App.openModal(`
      <div class="modal-card" style="max-width:600px;">
        <div class="modal-header">
          <h3>ثبت مشاوره / پیش‌فاکتور جدید (رتارگتینگ)</h3>
          <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="new-lead-form" onsubmit="LeadsComponent.submitNewLead(event)">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">نام و نام خانوادگی *</label>
                <input type="text" name="full_name" class="form-input" required placeholder="مثال: کامران رستگار">
              </div>
              <div class="form-group">
                <label class="form-label">شماره تلفن همراه *</label>
                <input type="text" name="phone" class="form-input" required placeholder="0912xxxxxxx">
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">تاریخ مشاوره (شمسی)</label>
                <input type="text" name="consultation_date" class="form-input jalali-datepicker" value="${todayJalali.formatted}">
              </div>
              <div class="form-group">
                <label class="form-label">مبلغ پیش‌فاکتور اعلامی (تومان)</label>
                <input type="number" name="quoted_price" class="form-input" value="0">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">خدمات مورد نظر زیباجو</label>
              <div style="background:#f8fafc; border:1px solid var(--border); padding:10px; border-radius:8px;">
                ${servicesCheckboxes}
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">وضعیت رتارگتینگ</label>
                <select name="retargeting_status" class="form-select">
                  <option value="needs_followup">نیازمند پیگیری اولیه</option>
                  <option value="interested">علاقه‌مند (در حال برنامه‌ریزی مرخصی)</option>
                  <option value="thinking">در حال تصمیم‌گیری</option>
                  <option value="price_sensitive">حساس به قیمت (پیشنهاد تخفیف)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">کد معرف (در صورت وجود)</label>
                <input type="text" name="referred_by_code" class="form-input" placeholder="مثال: HIRA-1001" style="text-transform:uppercase;">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">یادداشت‌های مشاوره و ترجیحات زیباجو</label>
              <textarea name="consultation_notes" class="form-textarea" placeholder="مثال: زیباجو متقاضی کاشت خط رویش با حداکثر تراکم است. نگران دوره نقاهت بود و نیازمند تماس در انتهای هفته جهت نهایی کردن تاریخ است."></textarea>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">انصراف</button>
              <button type="submit" class="btn btn-primary">ثبت سرنخ مشاوره</button>
            </div>
          </form>
        </div>
      </div>
    `);

    initAllJalaliDatePickers();
  },

  async submitNewLead(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const interested = [];
    form.querySelectorAll('input[name="interested_services"]:checked').forEach(c => {
      interested.push(c.value);
    });

    const payload = {
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      consultation_date: Jalali.jalaliStringToGregorian(formData.get('consultation_date')),
      quoted_price: parseFloat(formData.get('quoted_price') || 0),
      interested_services: interested,
      retargeting_status: formData.get('retargeting_status'),
      referred_by_code: formData.get('referred_by_code'),
      consultation_notes: formData.get('consultation_notes')
    };

    try {
      await API.createLead(payload);
      App.closeModal();
      alert("سرنخ مشاوره با موفقیت ثبت شد.");
      this.loadLeads();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async convertLeadPrompt(leadId) {
    if (!confirm("آیا مایلید این سرنخ مشاوره را به یک پرونده رسمی زیباجو تبدیل نمایید؟\nتمامی یادداشت‌ها و مشخصات منتقل خواهد شد.")) return;

    try {
      const res = await API.convertLead(leadId);
      alert(`زیباجو با موفقیت به پرونده رسمی تبدیل گردید!\nشماره پرونده جدید: ${res.file_number}\nکد معرف: ${res.referral_code}`);
      this.loadLeads();
      // Open the new patient details
      PatientsComponent.openPatientDetails(res.patient_id);
    } catch (err) {
      alert("خطا در تبدیل: " + err.message);
    }
  }
};
