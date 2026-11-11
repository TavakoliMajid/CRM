/**
 * Interactive Jalali (Solar Hijri) Date Picker Component
 * Binds to input elements with class `.jalali-datepicker` or via `initJalaliDatePicker(inputEl)`.
 * Displays interactive Shamsi calendar popup, navigates months/years,
 * and sets the Gregorian YYYY-MM-DD value in `data-gregorian` and input value in `YYYY/MM/DD`.
 */

(function() {
  let activePicker = null;

  function toPersianDigits(num) {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(num).replace(/[0-9]/g, (w) => persianNumbers[+w]);
  }

  class JalaliDatePicker {
    constructor(inputElement, options = {}) {
      this.input = inputElement;
      this.options = options;
      this.isOpen = false;
      
      const today = window.Jalali.getTodayJalali();
      this.currentJy = today.jy;
      this.currentJm = today.jm;
      this.selectedDate = null; // { jy, jm, jd }

      this.init();
    }

    init() {
      // Create popup container
      this.popup = document.createElement('div');
      this.popup.className = 'jalali-calendar-popup';
      this.popup.style.display = 'none';
      document.body.appendChild(this.popup);

      // Event listeners
      this.input.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open();
      });

      this.input.addEventListener('focus', () => {
        this.open();
      });

      this.input.readOnly = true;
      this.input.style.cursor = 'pointer';

      // Set initial value if data-gregorian is set
      const initialGregorian = this.input.getAttribute('data-gregorian') || this.input.value;
      if (initialGregorian && initialGregorian.includes('-')) {
        this.setDateFromGregorian(initialGregorian);
      } else if (!this.input.value && this.options.defaultToday) {
        const today = window.Jalali.getTodayJalali();
        this.selectDate(today.jy, today.jm, today.jd);
      }

      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.popup.contains(e.target) && e.target !== this.input) {
          this.close();
        }
      });
    }

    setDateFromGregorian(gDateStr) {
      const parts = gDateStr.split('-');
      if (parts.length === 3) {
        const { jy, jm, jd } = window.Jalali.gregorianToJalali(
          parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])
        );
        this.selectDate(jy, jm, jd);
      }
    }

    open() {
      if (activePicker && activePicker !== this) {
        activePicker.close();
      }
      activePicker = this;
      this.render();
      this.position();
      this.popup.style.display = 'block';
      this.isOpen = true;
    }

    close() {
      this.popup.style.display = 'none';
      this.isOpen = false;
      if (activePicker === this) activePicker = null;
    }

    position() {
      const rect = this.input.getBoundingClientRect();
      const popupWidth = 290;
      let left = rect.right - popupWidth;
      if (left < 10) left = rect.left;
      let top = rect.bottom + window.scrollY + 5;
      
      this.popup.style.position = 'absolute';
      this.popup.style.top = `${top}px`;
      this.popup.style.left = `${Math.max(10, left)}px`;
      this.popup.style.zIndex = '9999';
    }

    render() {
      const { jy, jm, jd } = window.Jalali.getTodayJalali();
      const monthDays = window.Jalali.getJalaliMonthDays(this.currentJy, this.currentJm);
      
      // Calculate first day of week for current Jalali month
      // Saturday is index 0 in Persian calendar
      const firstGreg = window.Jalali.jalaliToGregorian(this.currentJy, this.currentJm, 1);
      const d = new Date(firstGreg.gy, firstGreg.gm - 1, firstGreg.gd);
      // JS: 0=Sun, 1=Mon, ..., 6=Sat. Persian: 0=Sat, 1=Sun, ..., 6=Fri
      const jsDay = d.getDay();
      const startingDay = (jsDay + 1) % 7;

      let html = `
        <div class="jdatepicker-header">
          <button type="button" class="jdp-btn jdp-next" title="ماه بعدی">&gt;</button>
          <div class="jdp-title">
            <span class="jdp-month">${window.Jalali.monthNames[this.currentJm - 1]}</span>
            <span class="jdp-year">${toPersianDigits(this.currentJy)}</span>
          </div>
          <button type="button" class="jdp-btn jdp-prev" title="ماه قبلی">&lt;</button>
        </div>
        <div class="jdatepicker-weekdays">
          <span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span>
        </div>
        <div class="jdatepicker-days">
      `;

      // Empty slots before 1st of month
      for (let i = 0; i < startingDay; i++) {
        html += `<span class="jdp-day empty"></span>`;
      }

      // Days
      for (let day = 1; day <= monthDays; day++) {
        const isToday = (this.currentJy === jy && this.currentJm === jm && day === jd);
        const isSelected = this.selectedDate && 
                           (this.selectedDate.jy === this.currentJy && 
                            this.selectedDate.jm === this.currentJm && 
                            this.selectedDate.jd === day);
        
        let cls = 'jdp-day';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';

        html += `<button type="button" class="${cls}" data-day="${day}">${toPersianDigits(day)}</button>`;
      }

      html += `
        </div>
        <div class="jdatepicker-footer">
          <button type="button" class="jdp-action-btn jdp-today-btn">امروز</button>
          <button type="button" class="jdp-action-btn jdp-clear-btn">پاک کردن</button>
        </div>
      `;

      this.popup.innerHTML = html;

      // Event listeners on buttons
      this.popup.querySelector('.jdp-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        this.prevMonth();
      });

      this.popup.querySelector('.jdp-next').addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextMonth();
      });

      this.popup.querySelector('.jdp-today-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const t = window.Jalali.getTodayJalali();
        this.selectDate(t.jy, t.jm, t.jd);
        this.close();
      });

      this.popup.querySelector('.jdp-clear-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.input.value = '';
        this.input.removeAttribute('data-gregorian');
        this.selectedDate = null;
        this.input.dispatchEvent(new Event('change'));
        this.close();
      });

      const dayBtns = this.popup.querySelectorAll('.jdp-day:not(.empty)');
      dayBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const day = parseInt(btn.getAttribute('data-day'));
          this.selectDate(this.currentJy, this.currentJm, day);
          this.close();
        });
      });
    }

    prevMonth() {
      if (this.currentJm === 1) {
        this.currentJm = 12;
        this.currentJy--;
      } else {
        this.currentJm--;
      }
      this.render();
    }

    nextMonth() {
      if (this.currentJm === 12) {
        this.currentJm = 1;
        this.currentJy++;
      } else {
        this.currentJm++;
      }
      this.render();
    }

    selectDate(jy, jm, jd) {
      this.selectedDate = { jy, jm, jd };
      const pad = (n) => String(n).padStart(2, '0');
      const jalaliFormatted = `${jy}/${pad(jm)}/${pad(jd)}`;
      
      const { gy, gm, gd } = window.Jalali.jalaliToGregorian(jy, jm, jd);
      const gregorianFormatted = `${gy}-${pad(gm)}-${pad(gd)}`;

      this.input.value = jalaliFormatted;
      this.input.setAttribute('data-gregorian', gregorianFormatted);
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Global binder
  window.initJalaliDatePicker = function(inputEl, options = {}) {
    return new JalaliDatePicker(inputEl, options);
  };

  window.initAllJalaliDatePickers = function() {
    document.querySelectorAll('.jalali-datepicker').forEach(el => {
      if (!el._hasJalaliPicker) {
        el._hasJalaliPicker = true;
        new JalaliDatePicker(el);
      }
    });
  };
})();
