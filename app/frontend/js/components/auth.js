/**
 * CRM Hira - Authentication & Secure Login Screen Component
 */

window.AuthComponent = {
  render() {
    const root = document.getElementById('app-root');
    root.innerHTML = `
      <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #0f172a, #1e293b); padding:20px;">
        <div style="background:#ffffff; border-radius:18px; padding:36px; width:100%; max-width:420px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);">
          <div style="text-align:center; margin-bottom:28px;">
            <div style="width:58px; height:58px; border-radius:14px; background:linear-gradient(135deg, #14b8a6, #0d9488); color:white; font-size:28px; font-weight:bold; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 10px 20px rgba(20, 184, 166, 0.35); margin-bottom:12px;">
              H
            </div>
            <h2 style="font-size:20px; font-weight:800; color:#0f172a;">کلینیک کاشت مو و پوست هیرا</h2>
            <p style="font-size:12.5px; color:#64748b; margin-top:4px;">سیستم اختصاصی مدیریت مراجعین، اقساط و پیگیری هوشمند</p>
          </div>

          <form id="login-form" onsubmit="AuthComponent.submitLogin(event)">
            <div class="form-group">
              <label class="form-label">نام کاربری</label>
              <input type="text" id="login-username" class="form-input" required placeholder="نام کاربری خود را وارد کنید" style="direction:ltr; text-align:left;">
            </div>

            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label">رمز عبور</label>
              <input type="password" id="login-password" class="form-input" required placeholder="••••••••" style="direction:ltr; text-align:left;">
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%; padding:12px; font-size:15px;">
              ورود امن به سامانه
            </button>
          </form>
        </div>
      </div>
    `;
  },

  async submitLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;

    try {
      await API.login(u, p);
      window.location.hash = '#dashboard';
      App.initAppLayout();
    } catch (err) {
      alert("خطا در ورود: " + err.message);
    }
  }
};
