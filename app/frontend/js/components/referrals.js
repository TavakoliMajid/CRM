/**
 * CRM Hira - Referral System & Leaderboard Component
 */

window.ReferralsComponent = {
  async render() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:700;">سامانه باشگاه معرفین و مراجعین معرفی‌شده</h2>
          <p style="font-size:12.5px; color:var(--text-muted);">
            ردیابی کدهای معرف اختصاصی بیماران، شمارش مراجعین جذب‌شده و محاسبه کل گردش مالی حاصل از معرفی هر شخص.
          </p>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px; background:linear-gradient(135deg, #f0fdfa, #ccfbf1); border:1px solid #99f6e4;">
        <div style="display:flex; align-items:center; gap:14px;">
          <span style="font-size:32px;">🏆</span>
          <div>
            <h3 style="font-size:15px; font-weight:700; color:#0f766e;">نحوه کارکرد کد معرف کلینیک هیرا</h3>
            <p style="font-size:13px; color:#115e59; margin-top:4px; line-height:1.6;">
              هنگام پذیرش هر زیباجوی جدید، یک کد معرف یکتا (مانند <code style="background:#ffffff; padding:2px 6px; border-radius:4px; font-weight:bold;">HIRA-1042</code>) صادر می‌شود.
              هرگاه متقاضی جدیدی با وارد کردن این کد ثبت‌نام کند، سیستم خودکار شمارنده معرف را افزایش داده و مبالغ پرداختی او را در کارنامه معرف ثبت می‌نماید.
            </p>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>رتبه</th>
              <th>نام معرف</th>
              <th>شماره تماس معرف</th>
              <th>کد معرف اختصاصی</th>
              <th>تعداد مراجعین جذب شده</th>
              <th>کل درآمد حاصل برای کلینیک</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody id="referrals-table-body">
            <tr><td colspan="7" style="text-align:center; padding:30px;">در حال بارگذاری آمار معرفین...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.loadStats();
  },

  async loadStats() {
    try {
      const stats = await API.getReferralStats();
      const tbody = document.getElementById('referrals-table-body');
      if (!tbody) return;

      if (!stats || stats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">هنوز معرفی ثبت نشده است. هنگام پذیرش بیمار جدید می‌توانید کد معرف را وارد نمایید.</td></tr>`;
        return;
      }

      const medals = ['🥇', '🥈', '🥉'];

      tbody.innerHTML = stats.map((r, idx) => {
        const medal = medals[idx] || `#${idx + 1}`;
        return `
          <tr>
            <td><strong style="font-size:16px;">${medal}</strong></td>
            <td><strong style="color:var(--primary); cursor:pointer;" onclick="PatientsComponent.openPatientDetails(${r.referrer_id})">${r.referrer_name}</strong></td>
            <td>${r.referrer_phone}</td>
            <td><span class="pill pill-merged" style="font-family:monospace; font-size:13px;">${r.referral_code}</span></td>
            <td><strong style="font-size:15px; color:#0d9488;">${I18N.toPersianDigits(r.referred_count)} زیباجو</strong></td>
            <td><strong style="font-size:14px; color:#16a34a;">${I18N.formatPrice(r.total_revenue_generated)}</strong></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="PatientsComponent.openPatientDetails(${r.referrer_id})">
                مشاهده پرونده و شبکه معرفی
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  }
};
