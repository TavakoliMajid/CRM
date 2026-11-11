"""
CRM Hira - Post-Treatment Follow-up Schedule & Merge Engine
Automates follow-up task creation according to clinic rules and deduplicates / merges
same-day tasks across multiple services.
"""

from datetime import datetime, timedelta
import json
from app.backend.db import get_db_connection

# Service follow-up scheduling rules
SERVICE_FOLLOWUP_RULES = {
    "hair_transplant": [
        {
            "offset_days": 3,
            "event_key": "psych_call_day3",
            "title_fa": "تماس پشتیبانی روانی (روانشناختی)",
            "title_en": "Psychological support call",
            "notes": "بررسی روحیات بیمار پس از عمل کاشت، کنترل علائم استرس و اطمینان‌بخشی به زیباجو."
        },
        {
            "offset_days": 8,
            "event_key": "scalp_wash_prp_day8",
            "title_fa": "نوبت شستشوی سر و تزریق پی‌آرپی",
            "title_en": "Appointment for PRP and scalp wash",
            "notes": "شستشوی ملایم دلمه‌ها و گرافت‌ها در کلینیک + تزریق دوره‌ای PRP تقویت ریشه."
        },
        {
            "offset_days": 13,
            "event_key": "psych_care_day13",
            "title_fa": "تماس پشتیبانی روانی و راهنمایی مراقبت‌های بعدی",
            "title_en": "Psychological support call and aftercare guidance",
            "notes": "بررسی روند ترمیم گرافت‌ها، توضیح فاز ریزش شوک و راهنمایی شروع محلول‌ها و ویتامین‌ها."
        },
        {
            "offset_days": 150,  # Month 5
            "event_key": "recommendation_month5",
            "title_fa": "توصیه برای تزریقات، مزوتراپی و درمان فیتو (Phyto)",
            "title_en": "Recommendation for injections, mesotherapy, and Phyto treatment",
            "notes": "ورود به ماه پنجم و فاز جوانه زدن موها؛ هماهنگی جهت پکیج مزوتراپی و لوسیون‌های تقویت‌کننده فیتو."
        },
        {
            "offset_days": 240,  # Month 8
            "event_key": "final_photos_month8",
            "title_fa": "پیگیری ارسال عکس‌های نتیجه نهایی",
            "title_en": "Follow-up for final result photos",
            "notes": "درخواست ارسال عکس‌های استاندارد از زوایای مختلف جهت مقایسه با تصاویر قبل از عمل و ثبت نتیجه نهایی."
        }
    ],
    "mesotherapy": [
        {
            "offset_days": 3,
            "event_key": "psych_call_day3",
            "title_fa": "تماس پشتیبانی روانی (روانشناختی)",
            "title_en": "Psychological support call",
            "notes": "بررسی وضعیت پوست سر پس از مزوتراپی و اطمینان از رفع التهاب یا قرمزی موضعی."
        },
        {
            "offset_days": 14,
            "event_key": "next_inj_day14",
            "title_fa": "نوبت جلسه بعدی تزریق مزوتراپی",
            "title_en": "Appointment for the next injection",
            "notes": "هماهنگی نوبت دوم جهت تکمیل پروتکل مزوتراپی تقویتی."
        }
    ],
    "prp": [
        {
            "offset_days": 3,
            "event_key": "psych_call_day3",
            "title_fa": "تماس پشتیبانی روانی (روانشناختی)",
            "title_en": "Psychological support call",
            "notes": "پیگیری واکنش بیمار به پی‌آرپی و بررسی عدم حساسیت موضعی."
        },
        {
            "offset_days": 90,  # Month 3
            "event_key": "next_inj_month3",
            "title_fa": "نوبت جلسه بعدی تزریق پی‌آرپی",
            "title_en": "Appointment for the next injection",
            "notes": "هماهنگی نوبت دوره ۳ ماهه پی‌آرپی برای تثبیت فاز آناژن مو."
        }
    ],
    "botox": [
        {
            "offset_days": 3,
            "event_key": "psych_call_day3",
            "title_fa": "تماس پشتیبانی روانی (روانشناختی)",
            "title_en": "Psychological support call",
            "notes": "کنترل فرم صورت، تقارن عضلات و آموزش عدم فشار بر محل‌های تزریق بوتاکس."
        },
        {
            "offset_days": 120,  # Month 4
            "event_key": "next_inj_month4",
            "title_fa": "نوبت تمدید و تزریق بعدی بوتاکس",
            "title_en": "Appointment for the next injection",
            "notes": "یادآوری کاهش اثر سم بوتولینوم و رزرو نوبت ترمیم ۴ ماهه."
        }
    ]
}

SERVICE_NAMES_FA = {
    "hair_transplant": "کاشت مو",
    "mesotherapy": "مزوتراپی",
    "prp": "پی‌آرپی (PRP)",
    "botox": "بوتاکس"
}

SERVICE_NAMES_EN = {
    "hair_transplant": "Hair Transplant",
    "mesotherapy": "Mesotherapy",
    "prp": "PRP",
    "botox": "Botox"
}


def calculate_due_date(base_date_str: str, offset_days: int) -> str:
    """Calculates due date string YYYY-MM-DD from base date and offset in days."""
    base = datetime.strptime(base_date_str, "%Y-%m-%d")
    target = base + timedelta(days=offset_days)
    return target.strftime("%Y-%m-%d")


def generate_followup_tasks_for_treatments(patient_id: int, treatments: list[dict], conn=None) -> list[dict]:
    """
    Given a list of treatments for a patient (each with service_code and treatment_date),
    computes all required follow-up tasks, merging duplicate events on the same day.
    
    Persists new tasks or merges into existing tasks in the database.
    Returns list of created/merged task dictionaries.
    """
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    try:
        # Dictionary keyed by (due_date, event_key) to aggregate and merge
        planned_tasks = {}

        # First, retrieve all existing pending or completed tasks for this patient
        existing_rows = conn.execute(
            "SELECT * FROM followup_tasks WHERE patient_id = ?",
            (patient_id,)
        ).fetchall()

        existing_by_date_key = {}
        for r in existing_rows:
            key = (r["due_date"], r["event_key"])
            existing_by_date_key[key] = dict(r)

        # Plan new tasks from each treatment
        for tr in treatments:
            s_code = tr.get("service_code")
            t_date = tr.get("treatment_date")
            rules = SERVICE_FOLLOWUP_RULES.get(s_code, [])

            service_fa = SERVICE_NAMES_FA.get(s_code, tr.get("service_name", s_code))
            service_en = SERVICE_NAMES_EN.get(s_code, s_code)

            for rule in rules:
                due_date = calculate_due_date(t_date, rule["offset_days"])
                event_key = rule["event_key"]
                map_key = (due_date, event_key)

                if map_key not in planned_tasks:
                    planned_tasks[map_key] = {
                        "due_date": due_date,
                        "event_key": event_key,
                        "title_fa": rule["title_fa"],
                        "title_en": rule["title_en"],
                        "services_fa": [service_fa],
                        "services_en": [service_en],
                        "services_involved": [s_code],
                        "treatment_dates": [t_date],
                        "notes_list": [rule["notes"]]
                    }
                else:
                    # MERGE with existing planned task for this date & event key
                    task = planned_tasks[map_key]
                    if s_code not in task["services_involved"]:
                        task["services_involved"].append(s_code)
                        task["services_fa"].append(service_fa)
                        task["services_en"].append(service_en)
                    if t_date not in task["treatment_dates"]:
                        task["treatment_dates"].append(t_date)
                    if rule["notes"] not in task["notes_list"]:
                        task["notes_list"].append(rule["notes"])

        # Now save or merge into DB
        saved_tasks = []
        for map_key, task in planned_tasks.items():
            due_date, event_key = map_key
            services_json = json.dumps(task["services_involved"], ensure_ascii=False)
            dates_json = json.dumps(task["treatment_dates"], ensure_ascii=False)
            
            # Format combined titles and notes
            is_merged = len(task["services_involved"]) > 1
            if is_merged:
                joined_fa = " و ".join(task["services_fa"])
                joined_en = " & ".join(task["services_en"])
                final_title_fa = f"{task['title_fa']} (مشترک: {joined_fa})"
                final_title_en = f"{task['title_en']} (Merged: {joined_en})"
                combined_notes = " | ".join(task["notes_list"])
            else:
                final_title_fa = task["title_fa"]
                final_title_en = task["title_en"]
                combined_notes = task["notes_list"][0] if task["notes_list"] else ""

            if map_key in existing_by_date_key:
                # Merge into existing task if not completed
                existing = existing_by_date_key[map_key]
                existing_services = json.loads(existing["services_involved"]) if existing["services_involved"] else []
                updated_services = list(set(existing_services + task["services_involved"]))
                updated_services_json = json.dumps(updated_services, ensure_ascii=False)

                # Merge title if multiple
                if len(updated_services) > 1:
                    services_fa_list = [SERVICE_NAMES_FA.get(s, s) for s in updated_services]
                    services_en_list = [SERVICE_NAMES_EN.get(s, s) for s in updated_services]
                    up_title_fa = f"{task['title_fa']} (مشترک: {' و '.join(services_fa_list)})"
                    up_title_en = f"{task['title_en']} (Merged: {' & '.join(services_en_list)})"
                else:
                    up_title_fa = final_title_fa
                    up_title_en = final_title_en

                # Append note if new
                up_notes = existing["notes"] or ""
                if combined_notes and combined_notes not in up_notes:
                    up_notes = f"{up_notes} | {combined_notes}".strip(" | ")

                conn.execute("""
                    UPDATE followup_tasks
                    SET services_involved = ?, title_fa = ?, title_en = ?, notes = ?, updated_at = datetime('now')
                    WHERE id = ?
                """, (updated_services_json, up_title_fa, up_title_en, up_notes, existing["id"]))
                
                saved_tasks.append({
                    "id": existing["id"],
                    "action": "merged_existing",
                    "due_date": due_date,
                    "title_fa": up_title_fa,
                    "services": updated_services
                })
            else:
                # Insert brand new task
                cursor = conn.execute("""
                    INSERT INTO followup_tasks (
                        patient_id, due_date, event_key, title_fa, title_en,
                        services_involved, treatment_dates, status, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """, (
                    patient_id, due_date, event_key, final_title_fa, final_title_en,
                    services_json, dates_json, combined_notes
                ))
                saved_tasks.append({
                    "id": cursor.lastrowid,
                    "action": "created",
                    "due_date": due_date,
                    "title_fa": final_title_fa,
                    "services": task["services_involved"]
                })

        conn.commit()
        return saved_tasks

    finally:
        if should_close:
            conn.close()
