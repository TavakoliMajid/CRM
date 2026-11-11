/**
 * Jalali (Solar Hijri / تقویم هجری شمسی) Calendar Engine
 * Provides accurate bidirectional conversions between Gregorian (میلادی) and Jalali (شمسی),
 * Persian month names, formatting, and day of week calculations.
 */

const JALALI_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند"
];

const JALALI_WEEK_DAYS = [
  "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"
];

// Gregorian to Jalali conversion algorithm
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + parseInt((gy2 + 3) / 4) - parseInt((gy2 + 99) / 100) + parseInt((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * parseInt(days / 12053);
  days %= 12053;
  jy += 4 * parseInt(days / 1461);
  days %= 1461;
  jy += parseInt((days - 1) / 365);
  if (days > 0) {
    days = (days - 1) % 365;
  }
  let jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

// Jalali to Gregorian conversion algorithm
function jalaliToGregorian(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + ((parseInt(jy / 33)) * 8) + (parseInt(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * parseInt(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * parseInt(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * parseInt(days / 1461);
  days %= 1461;
  gy += parseInt((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (let m = 1; m <= 12; m++) {
    if (gd <= sal_a[m]) {
      gm = m;
      break;
    }
    gd -= sal_a[m];
  }
  return { gy, gm, gd };
}

// Jalali leap year check
function isJalaliLeapYear(jy) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let jp = breaks[0];
  let jm;
  let jump;
  let n;
  if (jy < jp || jy >= breaks[breaks.length - 1]) return false;
  for (let i = 1; i < breaks.length; i++) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  n = jy - jp;
  if (jump - n < 6) n = n - jump + (parseInt((jump + 4) / 33) * 33);
  let leap = ((n + 1) % 33) - 1;
  if (leap === -1) leap = 4;
  return leap % 4 === 0;
}

// Days in Jalali month
function getJalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

// Format Date object or YYYY-MM-DD string to Shamsi string
function toJalaliString(dateInput, withMonthName = false) {
  if (!dateInput) return "—";
  let d;
  if (typeof dateInput === "string") {
    const parts = dateInput.split("-");
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }
  if (isNaN(d.getTime())) return dateInput;

  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const pad = (n) => String(n).padStart(2, '0');

  if (withMonthName) {
    return `${jd} ${JALALI_MONTH_NAMES[jm - 1]} ${jy}`;
  }
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

// Convert today to Shamsi YYYY/MM/DD
function getTodayJalali() {
  const now = new Date();
  const { jy, jm, jd } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const pad = (n) => String(n).padStart(2, '0');
  return {
    jy, jm, jd,
    formatted: `${jy}/${pad(jm)}/${pad(jd)}`,
    text: `${jd} ${JALALI_MONTH_NAMES[jm - 1]} ${jy}`
  };
}

// Convert Jalali string "1403/05/20" to Gregorian "2024-08-10"
function jalaliStringToGregorian(jalaliStr) {
  if (!jalaliStr) return "";
  const parts = jalaliStr.replace(/\//g, '-').split('-');
  if (parts.length !== 3) return jalaliStr;
  const jy = parseInt(parts[0]);
  const jm = parseInt(parts[1]);
  const jd = parseInt(parts[2]);
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  const pad = (n) => String(n).padStart(2, '0');
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

window.Jalali = {
  gregorianToJalali,
  jalaliToGregorian,
  getJalaliMonthDays,
  toJalaliString,
  getTodayJalali,
  jalaliStringToGregorian,
  monthNames: JALALI_MONTH_NAMES,
  weekDays: JALALI_WEEK_DAYS
};
