/**
 * CRM Hira - Patients & Ongoing Profile Management Component
 */

window.PatientsComponent = {
  activeStatusFilter: 'all',
  searchQuery: '',

  async render() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; gap:10px; align-items:center; flex:1; max-width:450px;">
          <input type="text" id="patient-search-input" class="form-input" 
                 placeholder="${I18N.t('search')}" 
                 value="${this.searchQuery}"
                 oninput="PatientsComponent.onSearch(this.value)">
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <div style="display:flex; background:#e2e8f0; padding:3px; border-radius:8px;">
            <button class="btn btn-sm ${this.activeStatusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" 
                    onclick="PatientsComponent.setStatusFilter('all')">همه</button>
            <button class="btn btn-sm ${this.activeStatusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}" 
                    onclick="PatientsComponent.setStatusFilter('active')">فعال</button>
            <button class="btn btn-sm ${this.activeStatusFilter === 'inactive' ? 'btn-primary' : 'btn-secondary'}" 
                    onclick="PatientsComponent.setStatusFilter('inactive')">غیرفعال</button>
          </div>

          <button class="btn btn-primary" onclick="PatientsComponent.openNewPatientModal()">
            <span>➕</span> پذیرش زیباجوی جدید
          </button>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>شماره پرونده</th>
              <th>نام و نام خانوادگی</th>
              <th>شماره تماس</th>
              <th>کد معرف بیمار</th>
              <th>معرفی شده توسط</th>
              <th>وضعیت</th>
              <th>تاریخ ثبت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody id="patients-table-body">
            <tr><td colspan="8" style="text-align:center; padding:30px;">در حال بارگذاری لیست بیماران...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.loadPatients();
  },

  onSearch(query) {
    this.searchQuery = query;
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadPatients(), 300);
  },

  setStatusFilter(status) {
    this.activeStatusFilter = status;
    this.render();
  },

  async loadPatients() {
    try {
      const patients = await API.getPatients(this.searchQuery, this.activeStatusFilter);
      const tbody = document.getElementById('patients-table-body');
      if (!tbody) return;

      if (!patients || patients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">بیماری با این مشخصات یافت نشد.</td></tr>`;
        return;
      }

      tbody.innerHTML = patients.map(p => {
        const isActive = p.is_active === 1;
        return `
          <tr>
            <td><strong style="color:var(--primary);">${p.file_number}</strong></td>
            <td><strong>${p.full_name}</strong></td>
            <td>${p.phone}</td>
            <td><span class="pill pill-merged" style="font-family:monospace;">${p.referral_code}</span></td>
            <td>${p.referred_by_code ? `<span class="pill" style="background:#e0e7ff; color:#3730a3;">${p.referred_by_code}</span>` : '—'}</td>
            <td>
              <span class="pill ${isActive ? 'pill-active' : 'pill-inactive'}">
                ${isActive ? '🟢 فعال' : '⚪ غیرفعال'}
              </span>
            </td>
            <td>${Jalali.toJalaliString(p.created_at ? p.created_at.split(' ')[0] : '')}</td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick="PatientsComponent.openPatientDetails(${p.id})">
                  مشاهده پرونده و درمان‌ها
                </button>
                <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-success'}" 
                        style="padding:4px 8px; font-size:11px;"
                        title="${isActive ? 'غیرفعال کردن پرونده' : 'فعال کردن مجدد پرونده'}"
                        onclick="PatientsComponent.toggleStatusPrompt(${p.id}, ${isActive})">
                  ${isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async toggleStatusPrompt(patientId, currentlyActive) {
    const actionText = currentlyActive ? "غیرفعال" : "فعال";
    let reason = "";
    if (currentlyActive) {
      reason = prompt(`علت تغییر وضعیت به غیرفعال (اختیاری):`, "پایان دوره درمان و رضایت زیباجو");
      if (reason === null) return;
    } else {
      if (!confirm(`آیا از فعال‌سازی مجدد این پرونده اطمینان دارید؟`)) return;
    }

    try {
      await API.togglePatientStatus(patientId, !currentlyActive, reason);
      this.loadPatients();
    } catch (err) {
      alert("خطا در تغییر وضعیت: " + err.message);
    }
  },

  // Open New Patient Registration Modal with Multi-Service Entry (Requirement 1 & 2)
  async openNewPatientModal() {
    const services = await API.getServices();
    const todayJalali = Jalali.getTodayJalali();

    const servicesCheckboxes = services.map(s => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13.5px; font-weight:500;">
          <input type="checkbox" name="services" value="${s.code}" 
                 data-name="${s.name_fa}" 
                 data-price="${s.default_price}"
                 onchange="PatientsComponent.recalcNewPatientTotal()">
          ${s.name_fa}
        </label>
        <span style="font-size:12px; color:var(--text-muted);">${I18N.formatPrice(s.default_price)}</span>
      </div>
    `).join('');

    App.openModal(`
      <div class="modal-card" style="max-width:750px;">
        <div class="modal-header">
          <h3>پذیرش زیباجوی جدید (همراه با ثبت همزمان خدمات)</h3>
          <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="new-patient-form" onsubmit="PatientsComponent.submitNewPatient(event)">
            <!-- Personal Info -->
            <h4 style="font-size:14px; color:var(--primary); margin-bottom:12px; font-weight:700;">۱. اطلاعات هویتی و تماس</h4>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">نام و نام خانوادگی *</label>
                <input type="text" name="full_name" class="form-input" required placeholder="مثال: کیانوش رستمی">
              </div>
              <div class="form-group">
                <label class="form-label">شماره تلفن همراه *</label>
                <input type="text" name="phone" class="form-input" required placeholder="0912xxxxxxx">
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label">کد ملی</label>
                <input type="text" name="national_id" class="form-input" placeholder="00xxxxxxxx">
              </div>
              <div class="form-group">
                <label class="form-label">تلفن اضطراری / ثابت</label>
                <input type="text" name="secondary_phone" class="form-input" placeholder="021xxxxxxxx">
              </div>
              <div class="form-group">
                <label class="form-label">تاریخ تولد (شمسی)</label>
                <input type="text" name="birth_date" class="form-input jalali-datepicker" placeholder="1370/01/01">
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">جنسیت</label>
                <select name="gender" class="form-select">
                  <option value="male">آقا</option>
                  <option value="female">خانم</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">کد معرف (در صورت معرفی توسط بیمار دیگر)</label>
                <input type="text" name="referred_by_code" class="form-input" placeholder="مثال: HIRA-1001" style="text-transform:uppercase;">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">سابقه پزشکی / حساسیت دارویی</label>
              <input type="text" name="medical_history" class="form-input" placeholder="مثال: فشار خون، حساسیت به لیدوکائین...">
            </div>

            <!-- Requirement 1 & 2: Service Entry on Creation -->
            <h4 style="font-size:14px; color:var(--primary); margin:20px 0 12px 0; font-weight:700;">۲. انتخاب خدمات دریافتی در زمان پذیرش (تک یا چند خدمتی)</h4>
            <div style="background:#f1f5f9; padding:12px; border-radius:10px; margin-bottom:14px;">
              <p style="font-size:12.5px; color:#475569; margin-bottom:8px;">
                💡 <b>قاعده هوشمند ادغام پیگیری‌ها:</b> در صورت انتخاب همزمان خدماتی با موعد پیگیری یکسان (مانند تماس روز ۳)، سیستم به طور خودکار وظیفه تماس را ادغام کرده و از تماس تکراری جلوگیری می‌کند.
              </p>
              ${servicesCheckboxes}
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">تاریخ انجام خدمات (شمسی) *</label>
                <input type="text" name="treatment_date" class="form-input jalali-datepicker" value="${todayJalali.formatted}" required>
              </div>
              <div class="form-group">
                <label class="form-label">پزشک / مجری خدمت</label>
                <input type="text" name="performed_by" class="form-input" placeholder="دکتر بهنام مرادی">
              </div>
            </div>

            <!-- Requirement 4: Financial & Installment Setup -->
            <h4 style="font-size:14px; color:var(--primary); margin:20px 0 12px 0; font-weight:700;">۳. طرح پرداخت و امور مالی</h4>
            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label">مبلغ کل فاکتور (تومان)</label>
                <input type="number" id="np-total-amount" name="total_amount" class="form-input" value="0">
              </div>
              <div class="form-group">
                <label class="form-label">نحوه پرداخت</label>
                <select name="plan_type" id="np-plan-type" class="form-select" onchange="PatientsComponent.toggleInstallmentFields(this.value)">
                  <option value="lump_sum">تسویه کامل (یکجا)</option>
                  <option value="installment">طرح اقساطی</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">روش پرداخت اولیه</label>
                <select name="payment_method" class="form-select">
                  <option value="pos">کارتخوان (POS)</option>
                  <option value="card_to_card">کارت به کارت</option>
                  <option value="cash">نقدی</option>
                </select>
              </div>
            </div>

            <div id="np-installment-section" style="display:none; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:14px; margin-bottom:14px;">
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label">مبلغ پیش‌پرداخت (تومان)</label>
                  <input type="number" id="np-down-payment" name="down_payment" class="form-input" value="0" oninput="PatientsComponent.recalcInstallmentsPreview()">
                </div>
                <div class="form-group">
                  <label class="form-label">تعداد اقساط ماهیانه</label>
                  <select name="num_installments" id="np-num-installments" class="form-select" onchange="PatientsComponent.recalcInstallmentsPreview()">
                    <option value="2">۲ قسط (ماهیانه)</option>
                    <option value="3" selected>۳ قسط (ماهیانه)</option>
                    <option value="4">۴ قسط (ماهیانه)</option>
                    <option value="5">۵ قسط (ماهیانه)</option>
                    <option value="6">۶ قسط (ماهیانه)</option>
                  </select>
                </div>
              </div>
              <div id="np-installment-preview" style="font-size:13px; font-weight:600; color:#065f46;">
                مانده اقساط: ۰ تومان
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">انصراف</button>
              <button type="submit" class="btn btn-primary">ثبت نهایی و صدور خودکار پیگیری‌ها</button>
            </div>
          </form>
        </div>
      </div>
    `);

    initAllJalaliDatePickers();
  },

  recalcNewPatientTotal() {
    let total = 0;
    const checks = document.querySelectorAll('#new-patient-form input[name="services"]:checked');
    checks.forEach(c => {
      total += parseFloat(c.getAttribute('data-price') || 0);
    });
    const totalInput = document.getElementById('np-total-amount');
    if (totalInput) {
      totalInput.value = total;
      this.recalcInstallmentsPreview();
    }
  },

  toggleInstallmentFields(planType) {
    const sec = document.getElementById('np-installment-section');
    if (sec) {
      sec.style.display = (planType === 'installment') ? 'block' : 'none';
      this.recalcInstallmentsPreview();
    }
  },

  recalcInstallmentsPreview() {
    const total = parseFloat(document.getElementById('np-total-amount')?.value || 0);
    const down = parseFloat(document.getElementById('np-down-payment')?.value || 0);
    const count = parseInt(document.getElementById('np-num-installments')?.value || 1);
    const remaining = Math.max(0, total - down);
    const perMonth = count > 0 ? Math.round(remaining / count) : 0;

    const preview = document.getElementById('np-installment-preview');
    if (preview) {
      preview.innerHTML = `
        مانده کل جهت اقساط: <b>${I18N.formatPrice(remaining)}</b> | هر قسط ماهیانه: <b>${I18N.formatPrice(perMonth)}</b> (طی ${I18N.toPersianDigits(count)} ماه)
      `;
    }
  },

  async submitNewPatient(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    // Selected services
    const treatments = [];
    const checks = form.querySelectorAll('input[name="services"]:checked');
    const treatmentDateShamsi = formData.get('treatment_date');
    const treatmentDateGregorian = Jalali.jalaliStringToGregorian(treatmentDateShamsi);
    const perfBy = formData.get('performed_by');

    checks.forEach(c => {
      treatments.push({
        service_code: c.value,
        service_name: c.getAttribute('data-name'),
        price: parseFloat(c.getAttribute('data-price') || 0),
        treatment_date: treatmentDateGregorian,
        performed_by: perfBy
      });
    });

    const payload = {
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      secondary_phone: formData.get('secondary_phone'),
      national_id: formData.get('national_id'),
      birth_date: formData.get('birth_date'),
      gender: formData.get('gender'),
      referred_by_code: formData.get('referred_by_code'),
      medical_history: formData.get('medical_history'),
      treatments: treatments,
      payment: {
        total_amount: parseFloat(formData.get('total_amount') || 0),
        plan_type: formData.get('plan_type'),
        down_payment: parseFloat(formData.get('down_payment') || 0),
        num_installments: parseInt(formData.get('num_installments') || 1),
        payment_method: formData.get('payment_method'),
        start_date: treatmentDateGregorian
      }
    };

    try {
      const res = await API.createPatient(payload);
      App.closeModal();
      alert(`زیباجو با موفقیت ثبت شد.\nشماره پرونده: ${res.file_number}\nکد معرف اختصاصی: ${res.referral_code}`);
      this.loadPatients();
    } catch (err) {
      alert("خطا در ثبت پرونده: " + err.message);
    }
  },

  // Ongoing Profile Management: View Profile, Log Additional Service, Log Product, View Schedule
  async openPatientDetails(patientId) {
    try {
      const data = await API.getPatientDetails(patientId);
      const p = data.patient;
      const isActive = p.is_active === 1;

      App.openModal(`
        <div class="modal-card" style="max-width:850px;">
          <div class="modal-header">
            <div>
              <h3>پرونده جامع: ${p.full_name} (${p.file_number})</h3>
              <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                کد معرف اختصاصی: <span class="pill pill-merged">${p.referral_code}</span> 
                ${p.referred_by_code ? `| معرفی شده با کد: <b>${p.referred_by_code}</b>` : ''}
              </p>
            </div>
            <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
          </div>

          <div class="modal-body">
            <!-- Patient Status Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid var(--border); padding:12px 16px; border-radius:10px; margin-bottom:20px;">
              <div>
                وضعیت فعلی: <span class="pill ${isActive ? 'pill-active' : 'pill-inactive'}">${isActive ? '🟢 فعال' : '⚪ غیرفعال'}</span>
                ${p.inactive_reason ? `<span style="font-size:12px; color:var(--text-muted); margin-right:8px;">(علت: ${p.inactive_reason})</span>` : ''}
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="PatientsComponent.openAddTreatmentModal(${p.id})">
                  ➕ ثبت خدمت / جراحی جدید
                </button>
                <button class="btn btn-secondary btn-sm" onclick="PatientsComponent.openAddProductModal(${p.id})">
                  🧴 ثبت خرید محصول مراقبتی
                </button>
              </div>
            </div>

            <!-- Tabs inside modal -->
            <div style="display:flex; gap:8px; border-bottom:1px solid var(--border); margin-bottom:16px;">
              <button class="btn btn-sm btn-primary" id="pmodal-tab-btn-treatments" onclick="PatientsComponent.switchModalTab('treatments')">خدمات انجام شده (${data.treatments.length})</button>
              <button class="btn btn-sm btn-secondary" id="pmodal-tab-btn-followups" onclick="PatientsComponent.switchModalTab('followups')">تقویم پیگیری‌ها (${data.followups.length})</button>
              <button class="btn btn-sm btn-secondary" id="pmodal-tab-btn-financial" onclick="PatientsComponent.switchModalTab('financial')">مالی و اقساط (${data.payments.length})</button>
              <button class="btn btn-sm btn-secondary" id="pmodal-tab-btn-products" onclick="PatientsComponent.switchModalTab('products')">محصولات (${data.products.length})</button>
              <button class="btn btn-sm btn-secondary" id="pmodal-tab-btn-referrals" onclick="PatientsComponent.switchModalTab('referrals')">معرفی‌شدگان (${data.referred_patients.length})</button>
            </div>

            <!-- Tab 1: Treatments -->
            <div id="pmodal-tab-treatments">
              ${data.treatments.length === 0 ? '<p style="color:var(--text-muted);">هنوز خدمتی ثبت نشده است.</p>' : `
                <table>
                  <thead>
                    <tr><th>خدمت</th><th>تاریخ انجام</th><th>پزشک/مجری</th><th>مبلغ</th><th>توضیحات</th></tr>
                  </thead>
                  <tbody>
                    ${data.treatments.map(t => `
                      <tr>
                        <td><strong>${t.service_name}</strong></td>
                        <td>${Jalali.toJalaliString(t.treatment_date)}</td>
                        <td>${t.performed_by || '—'}</td>
                        <td>${I18N.formatPrice(t.price)}</td>
                        <td>${t.notes || '—'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Tab 2: Followups (Shows deduplication and merge clearly!) -->
            <div id="pmodal-tab-followups" style="display:none;">
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px 14px; border-radius:8px; font-size:12.5px; margin-bottom:12px;">
                🛡️ <b>سیستم هوشمند ادغام وظایف:</b> رویدادهای مربوط به خدمات مختلف که در یک روز سررسید شده‌اند (مثل تماس روانشناختی روز ۳) ادغام گردیده تا از تماس‌های تکراری با بیمار جلوگیری شود.
              </div>
              <table>
                <thead>
                  <tr><th>موعد پیگیری</th><th>عنوان وظیفه</th><th>خدمات مرتبط</th><th>وضعیت</th><th>عملیات</th></tr>
                </thead>
                <tbody>
                  ${data.followups.map(f => {
                    const isMerged = f.services_involved && f.services_involved.includes(',');
                    return `
                      <tr>
                        <td><strong>${Jalali.toJalaliString(f.due_date)}</strong></td>
                        <td>
                          <b>${f.title_fa}</b>
                          ${isMerged ? `<br><span class="pill pill-merged">ادغام چند خدمت</span>` : ''}
                        </td>
                        <td><small style="color:var(--text-muted);">${f.services_involved}</small></td>
                        <td>
                          <span class="pill ${f.status === 'completed' ? 'pill-active' : 'pill-pending'}">
                            ${f.status === 'completed' ? 'تکمیل شد' : 'در انتظار تماس'}
                          </span>
                        </td>
                        <td>
                          ${f.status !== 'completed' ? `
                            <button class="btn btn-success btn-sm" onclick="PatientsComponent.completeFollowupPrompt(${f.id}, ${p.id})">ثبت انجام تماس</button>
                          ` : `<span style="font-size:12px; color:var(--success);">✓ انجام شده</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Tab 3: Financial & Installments (Dynamic remaining balance) -->
            <div id="pmodal-tab-financial" style="display:none;">
              ${data.payments.map(py => `
                <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                      <strong>طرح: ${py.plan_type === 'installment' ? 'طرح اقساطی' : 'پرداخت یکجا'}</strong>
                      <span class="pill ${py.status === 'fully_paid' ? 'pill-active' : 'pill-pending'}" style="margin-right:8px;">
                        ${py.status === 'fully_paid' ? 'تسویه کامل' : 'دارای مانده بدهی'}
                      </span>
                    </div>
                    <div>
                      کل: <b>${I18N.formatPrice(py.total_amount)}</b> | پرداختی: <b style="color:var(--success);">${I18N.formatPrice(py.paid_amount)}</b> | 
                      مانده: <b style="color:var(--danger);">${I18N.formatPrice(py.remaining_balance)}</b>
                    </div>
                  </div>

                  <!-- Installments Table -->
                  ${data.installments.filter(i => i.payment_id === py.id).length > 0 ? `
                    <table style="font-size:12.5px;">
                      <thead>
                        <tr><th>قسط #</th><th>موعد سررسید</th><th>مبلغ قسط</th><th>وضعیت</th><th>عملیات</th></tr>
                      </thead>
                      <tbody>
                        ${data.installments.filter(i => i.payment_id === py.id).map(i => `
                          <tr>
                            <td>قسط ${I18N.toPersianDigits(i.installment_number)} از ${I18N.toPersianDigits(i.total_installments)}</td>
                            <td>${Jalali.toJalaliString(i.due_date)}</td>
                            <td><strong>${I18N.formatPrice(i.amount)}</strong></td>
                            <td>
                              <span class="pill ${i.status === 'paid' ? 'pill-active' : 'pill-pending'}">
                                ${i.status === 'paid' ? 'وصول شد' : 'در انتظار پرداخت'}
                              </span>
                            </td>
                            <td>
                              ${i.status !== 'paid' ? `
                                <button class="btn btn-primary btn-sm" onclick="PatientsComponent.confirmInstallmentPrompt(${i.id}, ${p.id})">تایید وصول</button>
                              ` : `<span style="font-size:11px; color:var(--success);">${i.paid_at ? Jalali.toJalaliString(i.paid_at.split(' ')[0]) : 'پرداخت شد'}</span>`}
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}
                </div>
              `).join('')}
            </div>

            <!-- Tab 4: Purchased Products -->
            <div id="pmodal-tab-products" style="display:none;">
              ${data.products.length === 0 ? '<p style="color:var(--text-muted);">محصولی خریداری نشده است.</p>' : `
                <table>
                  <thead>
                    <tr><th>نام محصول</th><th>تعداد</th><th>قیمت واحد</th><th>مبلغ کل</th><th>تاریخ خرید</th></tr>
                  </thead>
                  <tbody>
                    ${data.products.map(pr => `
                      <tr>
                        <td><strong>${pr.product_name}</strong></td>
                        <td>${I18N.toPersianDigits(pr.quantity)}</td>
                        <td>${I18N.formatPrice(pr.unit_price)}</td>
                        <td>${I18N.formatPrice(pr.total_price)}</td>
                        <td>${Jalali.toJalaliString(pr.purchase_date)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Tab 5: Referrals brought in -->
            <div id="pmodal-tab-referrals" style="display:none;">
              ${data.referred_patients.length === 0 ? '<p style="color:var(--text-muted);">این بیمار تاکنون مراجعی با کد معرف خود ثبت نکرده است.</p>' : `
                <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:10px 14px; border-radius:8px; margin-bottom:12px;">
                  🌟 این بیمار با کد معرف <b>${p.referral_code}</b> تعداد <b>${I18N.toPersianDigits(data.referred_patients.length)}</b> زیباجوی جدید به کلینیک معرفی کرده است.
                </div>
                <table>
                  <thead>
                    <tr><th>شماره پرونده</th><th>نام زیباجو</th><th>تلفن</th><th>تاریخ پذیرش</th></tr>
                  </thead>
                  <tbody>
                    ${data.referred_patients.map(rp => `
                      <tr>
                        <td><strong>${rp.file_number}</strong></td>
                        <td>${rp.full_name}</td>
                        <td>${rp.phone}</td>
                        <td>${Jalali.toJalaliString(rp.created_at ? rp.created_at.split(' ')[0] : '')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="App.closeModal()">بستن پرونده</button>
          </div>
        </div>
      `);
    } catch (err) {
      alert("خطا در بارگذاری پرونده: " + err.message);
    }
  },

  switchModalTab(tabKey) {
    const tabs = ['treatments', 'followups', 'financial', 'products', 'referrals'];
    tabs.forEach(t => {
      const el = document.getElementById(`pmodal-tab-${t}`);
      const btn = document.getElementById(`pmodal-tab-btn-${t}`);
      if (el) el.style.display = (t === tabKey) ? 'block' : 'none';
      if (btn) {
        btn.className = (t === tabKey) ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
      }
    });
  },

  async openAddTreatmentModal(patientId) {
    const services = await API.getServices();
    const todayJalali = Jalali.getTodayJalali();

    const options = services.map(s => `<option value="${s.code}" data-price="${s.default_price}">${s.name_fa} (${I18N.formatPrice(s.default_price)})</option>`).join('');

    const modalContent = `
      <div class="modal-card" style="max-width:550px;">
        <div class="modal-header">
          <h3>ثبت خدمت / درمان جدید برای بیمار</h3>
          <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="add-treatment-form" onsubmit="PatientsComponent.submitAddTreatment(event, ${patientId})">
            <div class="form-group">
              <label class="form-label">نوع خدمت / درمان *</label>
              <select name="service_code" class="form-select" id="at-service-select" required onchange="PatientsComponent.onServiceSelectChange(this)">
                ${options}
              </select>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">تاریخ انجام (شمسی) *</label>
                <input type="text" name="treatment_date" class="form-input jalali-datepicker" value="${todayJalali.formatted}" required>
              </div>
              <div class="form-group">
                <label class="form-label">مبلغ خدمت (تومان)</label>
                <input type="number" name="price" id="at-price-input" class="form-input" value="${services[0]?.default_price || 0}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">پزشک / اپراتور انجام‌دهنده</label>
              <input type="text" name="performed_by" class="form-input" placeholder="دکتر مرادی">
            </div>

            <div class="form-group">
              <label class="form-label">یادداشت درمان</label>
              <textarea name="notes" class="form-textarea" placeholder="توضیحات جلسه، حجم تزریق، ناحیه و..."></textarea>
            </div>

            <p style="font-size:12px; color:var(--primary); margin-bottom:12px;">
              🔄 با ثبت این خدمت، وظایف پیگیری دوره نقاهت این خدمت به طور خودکار به تقویم پیگیری بیمار افزوده و ادغام می‌شود.
            </p>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">انصراف</button>
              <button type="submit" class="btn btn-primary">ثبت خدمت و بروزرسانی پیگیری‌ها</button>
            </div>
          </form>
        </div>
      </div>
    `;

    App.openModal(modalContent);
    initAllJalaliDatePickers();
  },

  onServiceSelectChange(sel) {
    const selectedOption = sel.options[sel.selectedIndex];
    const price = selectedOption.getAttribute('data-price') || 0;
    const priceInput = document.getElementById('at-price-input');
    if (priceInput) priceInput.value = price;
  },

  async submitAddTreatment(e, patientId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const sel = form.querySelector('select[name="service_code"]');
    const sName = sel.options[sel.selectedIndex].text.split(' (')[0];
    const tDateShamsi = formData.get('treatment_date');
    const tDateGregorian = Jalali.jalaliStringToGregorian(tDateShamsi);

    const payload = {
      service_code: formData.get('service_code'),
      service_name: sName,
      treatment_date: tDateGregorian,
      price: parseFloat(formData.get('price') || 0),
      performed_by: formData.get('performed_by'),
      notes: formData.get('notes')
    };

    try {
      await API.addTreatment(patientId, payload);
      alert("خدمت جدید با موفقیت ثبت شد و برنامه پیگیری بیمار بروزرسانی گردید.");
      PatientsComponent.openPatientDetails(patientId);
    } catch (err) {
      alert("خطا در ثبت خدمت: " + err.message);
    }
  },

  async openAddProductModal(patientId) {
    const todayJalali = Jalali.getTodayJalali();
    App.openModal(`
      <div class="modal-card" style="max-width:500px;">
        <div class="modal-header">
          <h3>ثبت خرید محصول مراقبتی برای بیمار</h3>
          <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="add-product-form" onsubmit="PatientsComponent.submitAddProduct(event, ${patientId})">
            <div class="form-group">
              <label class="form-label">نام محصول *</label>
              <input type="text" name="product_name" class="form-input" required placeholder="مثال: شامپو تخصصی فیتو / محلول تقویت ریشه">
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">تعداد</label>
                <input type="number" name="quantity" class="form-input" value="1" min="1">
              </div>
              <div class="form-group">
                <label class="form-label">قیمت واحد (تومان)</label>
                <input type="number" name="unit_price" class="form-input" value="850000">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">تاریخ خرید</label>
              <input type="text" name="purchase_date" class="form-input jalali-datepicker" value="${todayJalali.formatted}">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">انصراف</button>
              <button type="submit" class="btn btn-primary">ثبت خرید</button>
            </div>
          </form>
        </div>
      </div>
    `);
    initAllJalaliDatePickers();
  },

  async submitAddProduct(e, patientId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const pDateShamsi = formData.get('purchase_date');

    const payload = {
      product_name: formData.get('product_name'),
      quantity: parseInt(formData.get('quantity') || 1),
      unit_price: parseFloat(formData.get('unit_price') || 0),
      purchase_date: Jalali.jalaliStringToGregorian(pDateShamsi)
    };

    try {
      await API.addProduct(patientId, payload);
      alert("خرید محصول ثبت شد.");
      PatientsComponent.openPatientDetails(patientId);
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async completeFollowupPrompt(followupId, patientId) {
    const notes = prompt("یادداشت تماس و وضعیت بیمار:", "تماس پشتیبانی گرفته شد. حال عمومی بیمار مناسب است.");
    if (notes === null) return;

    try {
      await API.updateFollowup(followupId, 'completed', notes);
      alert("وظیفه پیگیری با موفقیت تکمیل شد.");
      PatientsComponent.openPatientDetails(patientId);
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async confirmInstallmentPrompt(installmentId, patientId) {
    const method = prompt("روش پرداخت قسط (pos/card_to_card/cash):", "pos");
    if (!method) return;

    try {
      const res = await API.confirmInstallment(installmentId, { payment_method: method, notes: "وصول تایید شد" });
      alert(`قسط با موفقیت ثبت وصول شد.\nمانده حساب باقیمانده بیمار: ${I18N.formatPrice(res.remaining_balance)}`);
      PatientsComponent.openPatientDetails(patientId);
    } catch (err) {
      alert("خطا: " + err.message);
    }
  }
};
