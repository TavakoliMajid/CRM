/**
 * CRM Hira - Payments, Installment Engine & Balance Tracking Component
 */

window.PaymentsComponent = {
  async render() {
    const container = document.getElementById('main-content');
    const todayJalali = Jalali.getTodayJalali();

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:700;">امور مالی، موتور اقساط و تسویه حساب‌ها</h2>
          <p style="font-size:12.5px; color:var(--text-muted);">
            مدیریت پرداخت‌های یکجا، اقساط ماهیانه و بروزرسانی خودکار مانده بدهی زیباجویان.
          </p>
        </div>

        <button class="btn btn-primary" onclick="PaymentsComponent.openNewPaymentPlanModal()">
          <span>➕</span> ثبت طرح مالی / اقساط جدید
        </button>
      </div>

      <!-- Section: Monthly Payment Confirmation Prompts (Requirement 4) -->
      <div class="card" style="margin-bottom:28px; border-right:4px solid var(--warning);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">🔔</span>
            <h3 style="font-size:15px; font-weight:700; color:#92400e;">
              یادآوری و تایید وصول اقساط ماه جاری (${todayJalali.text})
            </h3>
          </div>
          <span class="pill pill-pending" id="monthly-prompts-count">در حال بررسی...</span>
        </div>

        <div class="table-container" style="border:none; box-shadow:none;">
          <table>
            <thead>
              <tr>
                <th>نام زیباجو</th>
                <th>تلفن</th>
                <th>شماره قسط</th>
                <th>موعد سررسید</th>
                <th>مبلغ قسط</th>
                <th>مانده کل پرونده</th>
                <th>عملیات وصول</th>
              </tr>
            </thead>
            <tbody id="monthly-prompts-tbody">
              <tr><td colspan="7" style="text-align:center; padding:20px;">در حال بارگذاری اقساط سررسید شده...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section: General Financial Ledger -->
      <h3 style="font-size:16px; font-weight:700; margin-bottom:12px;">دفتر کل دریافتی‌ها و فاکتورها</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>شماره پرونده</th>
              <th>نام زیباجو</th>
              <th>نوع طرح</th>
              <th>مبلغ کل فاکتور</th>
              <th>مجموع وصولی</th>
              <th>مانده بدهی باقیمانده</th>
              <th>وضعیت تسویه</th>
              <th>تاریخ ثبت</th>
            </tr>
          </thead>
          <tbody id="all-payments-tbody">
            <tr><td colspan="8" style="text-align:center; padding:20px;">در حال بارگذاری سوابق مالی...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.loadMonthlyPrompts();
    await this.loadAllPayments();
  },

  async loadMonthlyPrompts() {
    try {
      const prompts = await API.getMonthlyInstallmentPrompts();
      const tbody = document.getElementById('monthly-prompts-tbody');
      const countPill = document.getElementById('monthly-prompts-count');
      if (!tbody) return;

      if (!prompts || prompts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#10b981;">✓ تمامی اقساط ماه جاری با موفقیت وصول شده‌اند و قسط معوقه‌ای وجود ندارد.</td></tr>`;
        if (countPill) countPill.textContent = '۰ قسط در انتظار';
        return;
      }

      if (countPill) countPill.textContent = `${I18N.toPersianDigits(prompts.length)} قسط در انتظار وصول`;

      tbody.innerHTML = prompts.map(i => `
        <tr>
          <td><strong style="color:var(--primary); cursor:pointer;" onclick="PatientsComponent.openPatientDetails(${i.patient_id})">${i.patient_name}</strong></td>
          <td>${i.patient_phone}</td>
          <td>قسط ${I18N.toPersianDigits(i.installment_number)} از ${I18N.toPersianDigits(i.total_installments)}</td>
          <td><strong>${Jalali.toJalaliString(i.due_date)}</strong></td>
          <td><strong style="color:var(--text-main); font-size:14px;">${I18N.formatPrice(i.amount)}</strong></td>
          <td><span style="color:var(--danger); font-weight:bold;">${I18N.formatPrice(i.remaining_balance)}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="PaymentsComponent.confirmPrompt(${i.id}, '${i.patient_name}', ${i.amount})">
              ✓ تایید و کسر از مانده
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async loadAllPayments() {
    try {
      const payments = await API.getPayments();
      const tbody = document.getElementById('all-payments-tbody');
      if (!tbody) return;

      if (!payments || payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">فاکتوری ثبت نشده است.</td></tr>`;
        return;
      }

      tbody.innerHTML = payments.map(p => {
        const isPaid = p.status === 'fully_paid';
        return `
          <tr>
            <td><strong>${p.file_number}</strong></td>
            <td><strong style="color:var(--primary); cursor:pointer;" onclick="PatientsComponent.openPatientDetails(${p.patient_id})">${p.patient_name}</strong></td>
            <td>${p.plan_type === 'installment' ? '<span class="pill pill-merged">طرح اقساطی</span>' : 'یکجا (نقدی)'}</td>
            <td><strong>${I18N.formatPrice(p.total_amount)}</strong></td>
            <td><span style="color:var(--success); font-weight:bold;">${I18N.formatPrice(p.paid_amount)}</span></td>
            <td>
              <span style="color:${p.remaining_balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:bold;">
                ${I18N.formatPrice(p.remaining_balance)}
              </span>
            </td>
            <td>
              <span class="pill ${isPaid ? 'pill-active' : 'pill-pending'}">
                ${isPaid ? 'تسویه کامل' : 'دارای مانده اقساط'}
              </span>
            </td>
            <td>${Jalali.toJalaliString(p.created_at ? p.created_at.split(' ')[0] : '')}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async confirmPrompt(installmentId, patientName, amount) {
    const method = prompt(`تایید وصول مبلغ ${I18N.formatPrice(amount)} برای ${patientName}\nروش پرداخت (pos/card_to_card/cash):`, "pos");
    if (!method) return;

    try {
      const res = await API.confirmInstallment(installmentId, { payment_method: method, notes: "تایید از داشبورد اقساط ماهیانه" });
      alert(`پرداخت تایید شد!\nمجموع دریافتی پرونده: ${I18N.formatPrice(res.total_paid)}\nمانده بدهی باقیمانده جدید: ${I18N.formatPrice(res.remaining_balance)}`);
      this.loadMonthlyPrompts();
      this.loadAllPayments();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async openNewPaymentPlanModal() {
    const patients = await API.getPatients();
    const todayJalali = Jalali.getTodayJalali();

    const patientOptions = patients.map(p => `<option value="${p.id}">${p.full_name} (${p.file_number} - ${p.phone})</option>`).join('');

    App.openModal(`
      <div class="modal-card" style="max-width:550px;">
        <div class="modal-header">
          <h3>ثبت طرح مالی / اقساط جدید برای بیمار</h3>
          <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="new-payment-plan-form" onsubmit="PaymentsComponent.submitNewPlan(event)">
            <div class="form-group">
              <label class="form-label">انتخاب پرونده زیباجو *</label>
              <select name="patient_id" class="form-select" required>
                ${patientOptions}
              </select>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">مبلغ کل فاکتور (تومان) *</label>
                <input type="number" name="total_amount" id="npp-total" class="form-input" required oninput="PaymentsComponent.recalcPlanPreview()">
              </div>
              <div class="form-group">
                <label class="form-label">نوع طرح پرداخت</label>
                <select name="plan_type" id="npp-plan-type" class="form-select" onchange="PaymentsComponent.togglePlanType(this.value)">
                  <option value="installment">طرح اقساطی</option>
                  <option value="lump_sum">پرداخت کامل (یکجا)</option>
                </select>
              </div>
            </div>

            <div id="npp-installment-fields">
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label">مبلغ پیش‌پرداخت (تومان)</label>
                  <input type="number" name="down_payment" id="npp-down" class="form-input" value="0" oninput="PaymentsComponent.recalcPlanPreview()">
                </div>
                <div class="form-group">
                  <label class="form-label">تعداد اقساط ماهیانه</label>
                  <select name="num_installments" id="npp-count" class="form-select" onchange="PaymentsComponent.recalcPlanPreview()">
                    <option value="2">۲ قسط</option>
                    <option value="3" selected>۳ قسط</option>
                    <option value="4">۴ قسط</option>
                    <option value="5">۵ قسط</option>
                    <option value="6">۶ قسط</option>
                  </select>
                </div>
              </div>
              <div id="npp-preview-box" style="background:#ecfdf5; border:1px solid #a7f3d0; padding:10px 14px; border-radius:8px; font-size:13px; color:#065f46; margin-bottom:14px;">
                مانده اقساط: ۰ تومان
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">تاریخ شروع اقساط (شمسی)</label>
                <input type="text" name="start_date" class="form-input jalali-datepicker" value="${todayJalali.formatted}">
              </div>
              <div class="form-group">
                <label class="form-label">روش پرداخت اولیه</label>
                <select name="payment_method" class="form-select">
                  <option value="pos">کارتخوان کلینیک</option>
                  <option value="card_to_card">کارت به کارت</option>
                  <option value="cash">نقدی</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">توضیحات و یادداشت مالی</label>
              <textarea name="description" class="form-textarea" placeholder="مثال: هزینه پکیج کاشت و جلسات تقویتی همراه با ضمانت‌نامه"></textarea>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="App.closeModal()">انصراف</button>
              <button type="submit" class="btn btn-primary">ثبت و ایجاد جدول اقساط</button>
            </div>
          </form>
        </div>
      </div>
    `);

    initAllJalaliDatePickers();
  },

  togglePlanType(val) {
    const fields = document.getElementById('npp-installment-fields');
    if (fields) {
      fields.style.display = (val === 'installment') ? 'block' : 'none';
    }
  },

  recalcPlanPreview() {
    const total = parseFloat(document.getElementById('npp-total')?.value || 0);
    const down = parseFloat(document.getElementById('npp-down')?.value || 0);
    const count = parseInt(document.getElementById('npp-count')?.value || 1);
    const remaining = Math.max(0, total - down);
    const perMonth = count > 0 ? Math.round(remaining / count) : 0;

    const box = document.getElementById('npp-preview-box');
    if (box) {
      box.innerHTML = `
        مانده کل بدهی: <b>${I18N.formatPrice(remaining)}</b> | مبلغ هر قسط: <b>${I18N.formatPrice(perMonth)}</b>
      `;
    }
  },

  async submitNewPlan(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const payload = {
      patient_id: formData.get('patient_id'),
      plan_type: formData.get('plan_type'),
      total_amount: parseFloat(formData.get('total_amount') || 0),
      down_payment: parseFloat(formData.get('down_payment') || 0),
      num_installments: parseInt(formData.get('num_installments') || 1),
      start_date: Jalali.jalaliStringToGregorian(formData.get('start_date')),
      payment_method: formData.get('payment_method'),
      description: formData.get('description')
    };

    try {
      await API.createPaymentPlan(payload);
      App.closeModal();
      alert("طرح مالی با موفقیت ثبت شد و جدول اقساط ایجاد گردید.");
      this.render();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  }
};
