"""
CRM Hira - Patient, Lead & Referral Management
Handles patient records, multi-service treatment logging, referral code generation,
lead tracking for non-purchasing consultations, and 1-click lead conversion.
"""

from datetime import datetime
import json
import random
from app.backend.db import get_db_connection
from app.backend.services.followup_engine import generate_followup_tasks_for_treatments
from app.backend.models.payment import create_payment_plan


def generate_unique_file_number(conn) -> str:
    """Generates sequential clinic file number like P-1001."""
    row = conn.execute("SELECT id FROM patients ORDER BY id DESC LIMIT 1").fetchone()
    next_id = (row["id"] + 1) if row else 1001
    return f"P-{next_id:04d}"


def generate_unique_referral_code(conn, prefix="HIRA") -> str:
    """Generates unique referral code like HIRA-8291."""
    while True:
        num = random.randint(1000, 9999)
        code = f"{prefix}-{num}"
        existing = conn.execute("SELECT id FROM patients WHERE referral_code = ?", (code,)).fetchone()
        if not existing:
            return code


def create_patient_with_services(data: dict, user_id: int = None) -> dict:
    """
    Registers a new patient with one or multiple initial services,
    automatically creates follow-up schedule (with deduplication merge),
    and sets up optional payment plan.
    """
    conn = get_db_connection()
    try:
        file_number = data.get("file_number") or generate_unique_file_number(conn)
        referral_code = generate_unique_referral_code(conn)

        cursor = conn.execute("""
            INSERT INTO patients (
                file_number, full_name, national_id, phone, secondary_phone,
                gender, birth_date, referral_code, referred_by_code,
                medical_history, notes, is_active, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (
            file_number,
            data.get("full_name", "").strip(),
            data.get("national_id", "").strip(),
            data.get("phone", "").strip(),
            data.get("secondary_phone", "").strip(),
            data.get("gender", "male"),
            data.get("birth_date", ""),
            referral_code,
            data.get("referred_by_code", "").strip().upper() or None,
            data.get("medical_history", ""),
            data.get("notes", ""),
            user_id
        ))
        patient_id = cursor.lastrowid

        # Insert initial treatments
        treatments = data.get("treatments", [])
        saved_treatments = []
        today_str = datetime.now().strftime("%Y-%m-%d")

        for tr in treatments:
            s_code = tr.get("service_code")
            s_name = tr.get("service_name", s_code)
            t_date = tr.get("treatment_date", today_str)
            price = float(tr.get("price", 0))
            perf_by = tr.get("performed_by", "")
            notes = tr.get("notes", "")

            cur_tr = conn.execute("""
                INSERT INTO patient_treatments (
                    patient_id, service_code, service_name, treatment_date, performed_by, price, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (patient_id, s_code, s_name, t_date, perf_by, price, notes))
            saved_treatments.append({
                "id": cur_tr.lastrowid,
                "service_code": s_code,
                "service_name": s_name,
                "treatment_date": t_date
            })

        # Generate follow-up tasks if treatments provided
        if saved_treatments:
            generate_followup_tasks_for_treatments(patient_id, saved_treatments, conn=conn)

        # Create payment plan if payment info provided
        payment_info = data.get("payment")
        if payment_info and float(payment_info.get("total_amount", 0)) > 0:
            create_payment_plan(
                patient_id=patient_id,
                plan_type=payment_info.get("plan_type", "lump_sum"),
                total_amount=float(payment_info.get("total_amount", 0)),
                down_payment=float(payment_info.get("down_payment", 0)),
                num_installments=int(payment_info.get("num_installments", 1)),
                start_date_str=payment_info.get("start_date", today_str),
                payment_method=payment_info.get("payment_method", "cash"),
                description=payment_info.get("description", "طرح پرداخت اولیه هنگام پذیرش"),
                user_id=user_id,
                conn=conn
            )

        conn.commit()
        return {
            "success": True,
            "patient_id": patient_id,
            "file_number": file_number,
            "referral_code": referral_code,
            "full_name": data.get("full_name")
        }
    finally:
        conn.close()


def add_treatment_to_patient(patient_id: int, treatment_data: dict, user_id: int = None) -> dict:
    """
    Ongoing Profile Management:
    Logs a new service/treatment for an existing patient and dynamically updates their follow-up schedule.
    """
    conn = get_db_connection()
    try:
        patient = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            return {"error": "Patient not found"}

        today_str = datetime.now().strftime("%Y-%m-%d")
        s_code = treatment_data.get("service_code")
        s_name = treatment_data.get("service_name", s_code)
        t_date = treatment_data.get("treatment_date", today_str)
        price = float(treatment_data.get("price", 0))
        perf_by = treatment_data.get("performed_by", "")
        notes = treatment_data.get("notes", "")

        cursor = conn.execute("""
            INSERT INTO patient_treatments (
                patient_id, service_code, service_name, treatment_date, performed_by, price, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (patient_id, s_code, s_name, t_date, perf_by, price, notes))
        treatment_id = cursor.lastrowid

        # Dynamically calculate & merge follow-up tasks
        task_info = [{"service_code": s_code, "service_name": s_name, "treatment_date": t_date}]
        tasks = generate_followup_tasks_for_treatments(patient_id, task_info, conn=conn)

        conn.commit()
        return {
            "success": True,
            "treatment_id": treatment_id,
            "tasks_scheduled": tasks
        }
    finally:
        conn.close()


def add_product_to_patient(patient_id: int, product_data: dict) -> dict:
    """Logs a purchased aftercare product for an existing patient."""
    conn = get_db_connection()
    try:
        qty = int(product_data.get("quantity", 1))
        unit_price = float(product_data.get("unit_price", 0))
        total_price = qty * unit_price
        p_date = product_data.get("purchase_date") or datetime.now().strftime("%Y-%m-%d")

        cursor = conn.execute("""
            INSERT INTO patient_products (
                patient_id, product_name, quantity, unit_price, total_price, purchase_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (patient_id, product_data.get("product_name"), qty, unit_price, total_price, p_date, product_data.get("notes", "")))

        conn.commit()
        return {"success": True, "product_id": cursor.lastrowid, "total_price": total_price}
    finally:
        conn.close()


def get_referral_statistics() -> list[dict]:
    """
    Calculates how many new clients each referrer brings in
    and returns a leaderboard of top referrers.
    """
    conn = get_db_connection()
    try:
        # Match referred_by_code with patients' referral_code
        rows = conn.execute("""
            SELECT 
                r.id as referrer_id,
                r.full_name as referrer_name,
                r.phone as referrer_phone,
                r.referral_code,
                COUNT(p.id) as referred_count,
                COALESCE(SUM(pay.total_amount), 0) as total_revenue_generated
            FROM patients r
            JOIN patients p ON p.referred_by_code = r.referral_code
            LEFT JOIN payments pay ON pay.patient_id = p.id
            GROUP BY r.id
            ORDER BY referred_count DESC, total_revenue_generated DESC
        """).fetchall()

        return [dict(r) for r in rows]
    finally:
        conn.close()


def create_lead(data: dict, user_id: int = None) -> dict:
    """
    Registers a non-purchasing consultation lead for retargeting.
    """
    conn = get_db_connection()
    try:
        services_json = json.dumps(data.get("interested_services", []), ensure_ascii=False)
        today_str = datetime.now().strftime("%Y-%m-%d")

        cursor = conn.execute("""
            INSERT INTO leads (
                full_name, phone, consultation_date, interested_services,
                quoted_price, consultation_notes, retargeting_status,
                next_followup_date, referred_by_code, assigned_to
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("full_name", "").strip(),
            data.get("phone", "").strip(),
            data.get("consultation_date") or today_str,
            services_json,
            float(data.get("quoted_price", 0)),
            data.get("consultation_notes", ""),
            data.get("retargeting_status", "needs_followup"),
            data.get("next_followup_date", ""),
            data.get("referred_by_code", "").strip().upper() or None,
            user_id
        ))

        conn.commit()
        return {"success": True, "lead_id": cursor.lastrowid}
    finally:
        conn.close()


def convert_lead_to_patient(lead_id: int, user_id: int = None) -> dict:
    """
    1-Click Lead Conversion:
    Converts a consultation lead into a full patient profile,
    preserving consultation notes and referrer details.
    """
    conn = get_db_connection()
    try:
        lead = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
        if not lead:
            return {"error": "Lead not found"}

        if lead["converted_patient_id"]:
            return {"error": "Lead already converted", "patient_id": lead["converted_patient_id"]}

        file_number = generate_unique_file_number(conn)
        referral_code = generate_unique_referral_code(conn)

        # Insert new patient
        cursor = conn.execute("""
            INSERT INTO patients (
                file_number, full_name, phone, referral_code, referred_by_code,
                notes, is_active, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        """, (
            file_number,
            lead["full_name"],
            lead["phone"],
            referral_code,
            lead["referred_by_code"],
            f"تبدیل شده از سرنخ مشاوره. یادداشت مشاوره: {lead['consultation_notes']}",
            user_id
        ))
        patient_id = cursor.lastrowid

        # Update lead status
        conn.execute("""
            UPDATE leads
            SET retargeting_status = 'converted', converted_patient_id = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (patient_id, lead_id))

        conn.commit()
        return {
            "success": True,
            "patient_id": patient_id,
            "file_number": file_number,
            "referral_code": referral_code,
            "full_name": lead["full_name"]
        }
    finally:
        conn.close()


def toggle_status(entity_type: str, entity_id: int, is_active: bool, reason: str = "") -> dict:
    """
    Allows administrators to manually toggle Active vs Inactive status
    for patients or system users.
    """
    conn = get_db_connection()
    try:
        val = 1 if is_active else 0
        if entity_type == "patient":
            conn.execute("""
                UPDATE patients
                SET is_active = ?, inactive_reason = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (val, reason, entity_id))
        elif entity_type == "user":
            conn.execute("""
                UPDATE users
                SET is_active = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (val, entity_id))
        else:
            return {"error": "Invalid entity type"}

        conn.commit()
        return {"success": True, "entity_id": entity_id, "is_active": is_active}
    finally:
        conn.close()
