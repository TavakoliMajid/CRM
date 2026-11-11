/**
 * CRM Hira - Main SPA Application Controller
 */

window.App = {
  currentRoute: 'dashboard',

  async init() {
    // Check language
    const lang = localStorage.getItem('crm_hira_lang') || 'fa';
    document.documentElement.dir = (lang === 'fa') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    // Check auth
    const token = API.getToken();
    if (!token) {
      window.location.hash = '#login';
      AuthComponent.render();
      return;
    }

    try {
      const me = await API.getMe();
      if (!me.authenticated) {
        window.location.hash = '#login';
        AuthComponent.render();
        return;
      }
      this.initAppLayout();
    } catch {
      window.location.hash = '#login';
      AuthComponent.render();
    }
  },

  initAppLayout() {
    const user = API.getCurrentUser() || { full_name: 'کاربر سیستم', role: 'operator', role_title_fa: 'پذیرش' };
    const root = document.getElementById('app-root');

    root.innerHTML = `
      <div class="app-container">
        <!-- Sidebar Navigation -->
        <aside class="sidebar" id="app-sidebar">
          <div class="sidebar-header">
            <div class="clinic-logo">H</div>
            <div class="clinic-title">
              <h1>کلینیک هیرا</h1>
              <p>سیستم جامع CRM و پیگیری هوشمند</p>
            </div>
          </div>

          <nav class="sidebar-nav">
            <button class="nav-item active" data-route="dashboard" onclick="App.navigate('dashboard')">
              <span class="nav-icon">📊</span>
              <span>${I18N.t('dashboard')}</span>
            </button>

            <button class="nav-item" data-route="patients" onclick="App.navigate('patients')">
              <span class="nav-icon">👥</span>
              <span>${I18N.t('patients')}</span>
            </button>

            <button class="nav-item" data-route="followups" onclick="App.navigate('followups')">
              <span class="nav-icon">📅</span>
              <span>${I18N.t('followups')}</span>
            </button>

            <button class="nav-item" data-route="leads" onclick="App.navigate('leads')">
              <span class="nav-icon">🎯</span>
              <span>${I18N.t('leads')}</span>
            </button>

            <button class="nav-item" data-route="payments" onclick="App.navigate('payments')">
              <span class="nav-icon">💳</span>
              <span>${I18N.t('payments')}</span>
            </button>

            <button class="nav-item" data-route="referrals" onclick="App.navigate('referrals')">
              <span class="nav-icon">🏆</span>
              <span>${I18N.t('referrals')}</span>
            </button>

            <button class="nav-item" data-route="sync_backup" onclick="App.navigate('sync_backup')">
              <span class="nav-icon">☁️</span>
              <span>${I18N.t('syncBackup')}</span>
            </button>

            ${user.role === 'admin' ? `
              <button class="nav-item" data-route="users" onclick="App.navigate('users')">
                <span class="nav-icon">⚙️</span>
                <span>${I18N.t('usersMgmt')}</span>
              </button>
            ` : ''}
          </nav>

          <div class="sidebar-footer">
            <div class="user-badge">
              <span class="user-name">${user.full_name || user.username}</span>
              <span class="user-role">${user.role_title_fa || user.role}</span>
            </div>
            <button class="btn-logout" onclick="API.logout()" title="خروج از حساب">خروج</button>
          </div>
        </aside>

        <!-- Main Wrapper -->
        <div class="main-wrapper">
          <header class="topbar">
            <div class="topbar-left">
              <button class="menu-toggle-btn" onclick="App.toggleSidebar()">☰</button>
              <h2 class="page-title" id="page-title">${I18N.t('dashboard')}</h2>
            </div>
            <div class="topbar-actions">
              <!-- Shamsi Date indicator -->
              <span style="font-size:13px; color:var(--text-muted); background:#f1f5f9; padding:6px 12px; border-radius:8px; font-weight:600;">
                📅 ${Jalali.getTodayJalali().text}
              </span>
              <!-- Language Toggle -->
              <button class="btn btn-secondary btn-sm" onclick="App.toggleLanguage()">
                ${I18N.currentLang === 'fa' ? 'English' : 'فارسی'}
              </button>
            </div>
          </header>

          <main class="content-body" id="main-content">
            <!-- Dynamic Component Content -->
          </main>
        </div>
      </div>

      <!-- Global Modal Container -->
      <div class="modal-overlay" id="app-modal">
        <div id="modal-slot"></div>
      </div>
    `;

    // Handle hash changes
    window.addEventListener('hashchange', () => this.handleRouting());
    this.handleRouting();
  },

  handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash, false);
  },

  navigate(route, updateHash = true) {
    if (updateHash) {
      window.location.hash = `#${route}`;
    }
    this.currentRoute = route;

    // Close mobile sidebar if open
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Update active nav button
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
      if (el.getAttribute('data-route') === route) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update title
    const titles = {
      dashboard: I18N.t('dashboard'),
      patients: I18N.t('patients'),
      followups: I18N.t('followups'),
      leads: I18N.t('leads'),
      payments: I18N.t('payments'),
      referrals: I18N.t('referrals'),
      sync_backup: I18N.t('syncBackup'),
      users: I18N.t('usersMgmt')
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[route] || route;

    // Render component
    switch (route) {
      case 'dashboard':
        DashboardComponent.render();
        break;
      case 'patients':
        PatientsComponent.render();
        break;
      case 'followups':
        FollowupsComponent.render();
        break;
      case 'leads':
        LeadsComponent.render();
        break;
      case 'payments':
        PaymentsComponent.render();
        break;
      case 'referrals':
        ReferralsComponent.render();
        break;
      case 'sync_backup':
        SyncBackupComponent.render();
        break;
      case 'users':
        UsersComponent.render();
        break;
      default:
        DashboardComponent.render();
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  },

  toggleLanguage() {
    const next = (I18N.currentLang === 'fa') ? 'en' : 'fa';
    I18N.setLanguage(next);
    this.initAppLayout();
  },

  openModal(html) {
    const overlay = document.getElementById('app-modal');
    const slot = document.getElementById('modal-slot');
    if (overlay && slot) {
      slot.innerHTML = html;
      overlay.classList.add('open');
    }
  },

  closeModal() {
    const overlay = document.getElementById('app-modal');
    if (overlay) overlay.classList.remove('open');
  }
};

// Global startup
window.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Register PWA service worker for Android and offline resilience
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  }
});
