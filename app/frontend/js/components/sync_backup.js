/**
 * CRM Hira - Google Sheets Live Mirror & Automated Cloud / Drive Backup Component
 */

window.SyncBackupComponent = {
  currentTab: 'sheets',

  async render() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div style="margin-bottom:20px;">
        <h2 style="font-size:18px; font-weight:700;">مدیریت داده‌ها، آینه‌سازی گوگل‌شیت و پشتیبان‌گیری ابری</h2>
        <p style="font-size:12.5px; color:var(--text-muted);">
          اتصال به Google Sheets جهت مرور لحظه‌ای خارج از نرم‌افزار و پشتیبان‌گیری خودکار در Google Drive / حافظه محلی.
        </p>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:8px;">
        <button class="btn btn-sm ${this.currentTab === 'sheets' ? 'btn-primary' : 'btn-secondary'}" onclick="SyncBackupComponent.switchTab('sheets')">
          📊 همگام‌سازی زنده با گوگل شیت (Google Sheets)
        </button>
        <button class="btn btn-sm ${this.currentTab === 'backup' ? 'btn-primary' : 'btn-secondary'}" onclick="SyncBackupComponent.switchTab('backup')">
          ☁️ پشتیبان‌گیری خودکار و Google Drive
        </button>
      </div>

      <div id="sync-backup-content">
        <!-- Rendered based on currentTab -->
      </div>
    `;

    if (this.currentTab === 'sheets') {
      await this.renderSheetsTab();
    } else {
      await this.renderBackupTab();
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render();
  },

  async renderSheetsTab() {
    const content = document.getElementById('sync-backup-content');
    try {
      const config = await API.getSheetsConfig();
      const origin = window.location.origin;

      content.innerHTML = `
        <!-- Webhook Configuration -->
        <div class="card" style="margin-bottom:24px;">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:12px; color:var(--primary);">
            ۱. تنظیم وب‌هوک ارسال خودکار داده‌ها به گوگل شیت
          </h3>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px; line-height:1.6;">
            با وارد کردن آدرس وب‌اپ گوگل شیت، هر بیمار، خدمت، قسط یا سرنخ جدید فوراً به فایل گوگل‌شیت شما اضافه می‌شود.
          </p>

          <div style="display:flex; gap:10px; margin-bottom:14px;">
            <input type="url" id="sheets-webhook-input" class="form-input" 
                   placeholder="https://script.google.com/macros/s/AKfycb.../exec" 
                   value="${config.webhook_url || ''}">
            <button class="btn btn-primary" onclick="SyncBackupComponent.saveWebhook()">ذخیره آدرس</button>
            <button class="btn btn-secondary" onclick="SyncBackupComponent.triggerSyncNow()">تست و همگام‌سازی فوری</button>
          </div>
        </div>

        <!-- Live CSV / IMPORTDATA Links -->
        <div class="card" style="margin-bottom:24px;">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:12px; color:var(--primary);">
            ۲. لینک‌های زنده فرمول IMPORTDATA برای Google Sheets
          </h3>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px; line-height:1.6;">
            می‌توانید هر یک از فرمول‌های زیر را مستقیماً در خانه <code>A1</code> شیت اکسل یا گوگل‌شیت خود کپی کنید تا اطلاعات زنده بازخوانی شوند:
          </p>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="background:#f8fafc; border:1px solid var(--border); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>جدول پرونده بیماران:</strong>
                <code style="display:block; direction:ltr; text-align:left; color:#0369a1; margin-top:2px;">=IMPORTDATA("${origin}/api/sync/sheets/export?table=patients")</code>
              </div>
              <a href="/api/sync/sheets/export?table=patients" class="btn btn-secondary btn-sm" download>دانلود CSV</a>
            </div>

            <div style="background:#f8fafc; border:1px solid var(--border); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>جدول خدمات و جراحی‌ها:</strong>
                <code style="display:block; direction:ltr; text-align:left; color:#0369a1; margin-top:2px;">=IMPORTDATA("${origin}/api/sync/sheets/export?table=treatments")</code>
              </div>
              <a href="/api/sync/sheets/export?table=treatments" class="btn btn-secondary btn-sm" download>دانلود CSV</a>
            </div>

            <div style="background:#f8fafc; border:1px solid var(--border); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>جدول تقویم پیگیری‌ها:</strong>
                <code style="display:block; direction:ltr; text-align:left; color:#0369a1; margin-top:2px;">=IMPORTDATA("${origin}/api/sync/sheets/export?table=followups")</code>
              </div>
              <a href="/api/sync/sheets/export?table=followups" class="btn btn-secondary btn-sm" download>دانلود CSV</a>
            </div>

            <div style="background:#f8fafc; border:1px solid var(--border); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>جدول فاکتورها و وضعیت اقساط:</strong>
                <code style="display:block; direction:ltr; text-align:left; color:#0369a1; margin-top:2px;">=IMPORTDATA("${origin}/api/sync/sheets/export?table=payments")</code>
              </div>
              <a href="/api/sync/sheets/export?table=payments" class="btn btn-secondary btn-sm" download>دانلود CSV</a>
            </div>
          </div>
        </div>

        <!-- Google Apps Script Guide Box -->
        <div class="card">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:8px;">کد آماده Google Apps Script برای اتصال مستقیم</h3>
          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px;">
            در گوگل‌شیت خود به منوی <b>Extensions &gt; Apps Script</b> بروید، کد زیر را قرار داده و به عنوان Web App دیپلوی کنید:
          </p>
          <pre style="background:#0f172a; color:#f1f5f9; padding:14px; border-radius:8px; font-size:12px; direction:ltr; text-align:left; overflow-x:auto;">${config.apps_script_template}</pre>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="card" style="color:red;">خطا: ${err.message}</div>`;
    }
  },

  async renderBackupTab() {
    const content = document.getElementById('sync-backup-content');
    try {
      const backups = await API.getBackups();
      const driveConfig = await API.getGoogleDriveConfig();

      content.innerHTML = `
        <div class="card" style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="font-size:15px; font-weight:700; color:var(--primary);">پشتیبان‌گیری نقطه به نقطه (Atomic Backup)</h3>
              <p style="font-size:13px; color:var(--text-muted); margin-top:2px;">
                ایجاد اسنپ‌شات‌های کامل و بدون توقف از پایگاه داده و ذخیره در حافظه محلی یا فضای ابری.
              </p>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary" onclick="SyncBackupComponent.createInstantBackup('local')">
                💾 ذخیره بک‌آپ محلی
              </button>
              <button class="btn btn-primary" onclick="SyncBackupComponent.createInstantBackup('google_drive')">
                ☁️ تهیه و آپلود فوری در Google Drive جیمیل
              </button>
            </div>
          </div>
        </div>

        <!-- Google Drive Gmail Free 15GB Guide Card -->
        <div class="card" style="margin-bottom:24px; border-right:4px solid #0284c7;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h3 style="font-size:15px; font-weight:700; color:#0369a1;">
                📧 اتصال به فضای رایگان ۱۵ گیگابایتی گوگل درایو (هر حساب جیمیل)
              </h3>
              <p style="font-size:12.5px; color:var(--text-muted); margin-top:4px; line-height:1.6;">
                هر اکانت شخصی جیمیل دارای ۱۵ گیگابایت فضای ابری رایگان Google Drive است.
                تنها با ۳ مرحله ساده در ۲ دقیقه می‌توانید بک‌آپ‌های کلینیک را خودکار در درایو شخصی خود ذخیره کنید:
              </p>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid var(--border); padding:14px; border-radius:10px; margin-bottom:14px; font-size:13px; line-height:1.7;">
            <b>دستورالعمل ۳ مرحله‌ای اتصال جیمیل:</b><br>
            ۱. با اکانت جیمیل خود وارد سایت <a href="https://script.google.com" target="_blank" style="color:#0284c7; font-weight:bold;">script.google.com</a> شوید و دکمه <b>New project</b> را بزنید.<br>
            ۲. کد آماده زیر را در آن پیست کرده و دکمه <b>Deploy &gt; New deployment</b> را بزنید (نوع Web app، دسترسی: Anyone).<br>
            ۳. آدرس وب‌اپ تولید شده را در کادر زیر کپی کرده و ذخیره نمایید. تمام! پوشه‌ای به نام <code>CRM_Hira_Backups</code> در درایو شما ایجاد و فایل‌ها در آن ذخیره می‌شوند.
          </div>

          <div style="display:flex; gap:10px; margin-bottom:16px;">
            <input type="url" id="gdrive-webhook-input" class="form-input" 
                   placeholder="https://script.google.com/macros/s/AKfycb.../exec (آدرس وب‌اپ درایو جیمیل)" 
                   value="${driveConfig.webhook_url || ''}"
                   style="direction:ltr; text-align:left;">
            <button class="btn btn-primary" onclick="SyncBackupComponent.saveDriveConfig()">ذخیره آدرس جیمیل</button>
          </div>

          <details style="margin-top:10px;">
            <summary style="cursor:pointer; font-size:13px; font-weight:600; color:#0369a1;">📋 مشاهده و کپی کد آماده Google Apps Script برای جیمیل</summary>
            <pre style="background:#0f172a; color:#f1f5f9; padding:14px; border-radius:8px; font-size:12px; direction:ltr; text-align:left; overflow-x:auto; margin-top:8px;">${driveConfig.apps_script_template}</pre>
          </details>
        </div>

        <!-- Backups List Table -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>نام فایل پشتیبان</th>
                <th>حجم فایل</th>
                <th>مقصد ذخیره‌سازی</th>
                <th>وضعیت</th>
                <th>تاریخ ایجاد</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              ${backups.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">نسخه پشتیبانی یافت نشد.</td></tr>' : 
                backups.map(b => `
                  <tr>
                    <td><strong style="direction:ltr; display:inline-block; font-family:monospace;">${b.backup_name}</strong></td>
                    <td>${(b.file_size / 1024).toFixed(1)} کیلوبایت</td>
                    <td><span class="pill pill-merged">${b.destination === 'google_drive' ? '☁️ Google Drive' : '💻 سرور محلی'}</span></td>
                    <td><span class="pill pill-active">✓ ${b.status}</span></td>
                    <td>${Jalali.toJalaliString(b.created_at ? b.created_at.split(' ')[0] : '')}</td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <a href="/api/backup/download?filename=${b.backup_name}" class="btn btn-secondary btn-sm" download>
                          دانلود فایل
                        </a>
                        <button class="btn btn-danger btn-sm" onclick="SyncBackupComponent.restorePrompt('${b.backup_name}')">
                          بازیابی داده‌ها
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="card" style="color:red;">خطا: ${err.message}</div>`;
    }
  },

  async saveWebhook() {
    const url = document.getElementById('sheets-webhook-input')?.value;
    try {
      await API.saveSheetsConfig(url);
      alert("آدرس وب‌هوک گوگل شیت ذخیره شد.");
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async triggerSyncNow() {
    try {
      const res = await API.triggerSheetsSync();
      alert("نتیجه همگام‌سازی:\n" + JSON.stringify(res, null, 2));
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async createInstantBackup(destination = 'local') {
    try {
      const res = await API.createBackup(destination, "پشتیبان پنل وب");
      alert(`نسخه پشتیبان با موفقیت ایجاد شد.\nنام فایل: ${res.filename}\nحجم: ${(res.size_bytes / 1024).toFixed(1)} KB\nوضعیت: ${res.status}`);
      this.render();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async saveDriveConfig() {
    const url = document.getElementById('gdrive-webhook-input')?.value;
    try {
      await API.saveGoogleDriveConfig(url);
      alert("آدرس اتصال به Google Drive جیمیل با موفقیت ذخیره شد.");
      this.render();
    } catch (err) {
      alert("خطا: " + err.message);
    }
  },

  async restorePrompt(filename) {
    if (!confirm(`⚠️ هشدار: آیا از بازیابی اطلاعات از فایل "${filename}" اطمینان کامل دارید؟\nقبل از بازیابی، یک نسخه ایمنی خودکار ایجاد خواهد شد.`)) return;

    try {
      const res = await API.restoreBackup(filename);
      alert("پایگاه داده با موفقیت به تاریخ نسخه انتخابی بازگردانی شد.\nنسخه ایمنی قبلی با نام: " + res.safety_backup);
      window.location.reload();
    } catch (err) {
      alert("خطا در بازیابی: " + err.message);
    }
  }
};
