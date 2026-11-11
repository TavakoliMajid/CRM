/**
 * CRM Hira - Internationalization & Persian Formatting Dictionary
 * Full Persian (Farsi) RTL primary support with English toggle.
 */

const I18N = {
  currentLang: localStorage.getItem('crm_hira_lang') || 'fa',

  translations: {
    fa: {
      appName: "کلینیک هیرا | سیستم مدیریت مراجعین و پیگیری",
      clinicName: "کلینیک تخصصی کاشت مو و پوست هیرا",
      dashboard: "داشبورد و مانیتورینگ",
      patients: "پرونده زیباجویان",
      newPatient: "پذیرش زیباجوی جدید",
      followups: "برنامه پیگیری و مراقبت‌ها",
      leads: "سرنخ‌ها و مشاوره‌ها (رتارگتینگ)",
      payments: "امور مالی و اقساط",
      referrals: "سامانه معرفین (Referral)",
      syncBackup: "همگام‌سازی گوگل شیت و بک‌آپ",
      usersMgmt: "کاربران و سطوح دسترسی (RBAC)",
      active: "فعال",
      inactive: "غیرفعال",
      statusOverview: "پایش وضعیت بیماران و کاربران",
      activePatients: "زیباجویان فعال",
      inactivePatients: "زیباجویان غیرفعال",
      activeStaff: "پرسنل فعال",
      totalRevenue: "کل گردش مالی",
      paidRevenue: "مجموع وصولی نقد/اقساط",
      remainingBalance: "مانده کل مطالبات",
      followupsToday: "پیگیری‌های نیازمند تماس امروز",
      overdueFollowups: "پیگیری‌های معوقه",
      installmentsDueMonth: "اقساط سررسید این ماه",
      confirmPayment: "تایید و ثبت وصول قسط",
      lumpSum: "پرداخت یکجا (نقدی)",
      installment: "طرح اقساطی",
      referralLeaderboard: "برترین معرفین کلینیک",
      clientCount: "تعداد مراجعین معرفی شده",
      convertLead: "تبدیل به پرونده بیمار",
      mergedTaskNotice: "این وظیفه حاصل ادغام چندین خدمت در یک روز است (بدون تکرار)",
      save: "ذخیره اطلاعات",
      cancel: "انصراف",
      search: "جستجو با نام، شماره پرونده، تلفن یا کد معرف...",
      all: "همه موارد"
    },
    en: {
      appName: "CRM Hira | Hair Clinic CRM",
      clinicName: "Hira Hair & Aesthetic Clinic",
      dashboard: "Dashboard & Monitoring",
      patients: "Patients",
      newPatient: "New Patient Entry",
      followups: "Follow-up Schedule",
      leads: "Leads & Consultations (Retargeting)",
      payments: "Payments & Installments",
      referrals: "Referral System",
      syncBackup: "Google Sheets Sync & Backup",
      usersMgmt: "Users & RBAC",
      active: "Active",
      inactive: "Inactive",
      statusOverview: "Patient & User Status Monitor",
      activePatients: "Active Patients",
      inactivePatients: "Inactive Patients",
      activeStaff: "Active Staff",
      totalRevenue: "Total Revenue",
      paidRevenue: "Collected Revenue",
      remainingBalance: "Remaining Balance",
      followupsToday: "Follow-ups Due Today",
      overdueFollowups: "Overdue Follow-ups",
      installmentsDueMonth: "Installments Due This Month",
      confirmPayment: "Confirm Payment",
      lumpSum: "Lump Sum",
      installment: "Installment Plan",
      referralLeaderboard: "Top Referrers",
      clientCount: "Referred Clients",
      convertLead: "Convert to Patient",
      mergedTaskNotice: "Merged task covering multiple services on the same day",
      save: "Save",
      cancel: "Cancel",
      search: "Search by name, file #, phone or referral code...",
      all: "All"
    }
  },

  t(key) {
    const dict = this.translations[this.currentLang] || this.translations.fa;
    return dict[key] || key;
  },

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('crm_hira_lang', lang);
    document.documentElement.dir = (lang === 'fa') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('lang:changed', { detail: { lang } }));
  },

  toPersianDigits(input) {
    if (this.currentLang !== 'fa') return String(input);
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(input).replace(/[0-9]/g, (w) => persianNumbers[+w]);
  },

  formatPrice(amount) {
    const num = Math.round(Number(amount) || 0);
    const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (this.currentLang === 'fa') {
      return `${this.toPersianDigits(formatted)} تومان`;
    }
    return `${formatted} Tomans`;
  }
};

window.I18N = I18N;
