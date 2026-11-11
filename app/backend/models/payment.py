"""
CRM Hira - Payment & Installment Engine
Handles lump-sum and installment plans, dynamic remaining balance calculation,
and monthly payment confirmation prompts.
"""

from datetime import datetime, timedelta
from app.backend.db import get_db_connection


def create_payment_plan(patient_id: int, plan_type: str, total_amount: float, 
                        down_payment: float = 0, num_installments: int = 1,
                        start_date_str: str = None, payment_method: str = "cash",
                        description: str = "", user_id: int = None, conn=None) -> dict:
    """
    Creates a financial plan for a patient.
    If plan_type == 'installment', generates installment records with monthly due dates.
    Calculates remaining balance automatically.
    """
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    try:
        if not start_date_str:
            start_date_str = datetime.now().strftime("%Y-%m-%d")

        paid_initial = float(down_payment) if plan_type == "installment" else (float(total_amount) if payment_method != "unpaid" else 0)
        remaining = max(0.0, float(total_amount) - paid_initial)

        status = "fully_paid" if remaining == 0 else ("partially_paid" if paid_initial > 0 else "pending")

        cursor = conn.execute("""
            INSERT INTO payments (
                patient_id, plan_type, total_amount, paid_amount,
                remaining_balance, payment_method, status, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (patient_id, plan_type, total_amount, paid_initial, remaining, payment_method, status, description))
        payment_id = cursor.lastrowid

        installment_ids = []
        if plan_type == "installment" and num_installments > 0:
            installment_amount = round(remaining / num_installments, 2)
            base_date = datetime.strptime(start_date_str, "%Y-%m-%d")

            for i in range(1, num_installments + 1):
                # Monthly interval: approximately 30 days
                due_date = (base_date + timedelta(days=30 * i)).strftime("%Y-%m-%d")
                
                # Adjust last installment for rounding differences
                if i == num_installments:
                    current_amt = round(remaining - (installment_amount * (num_installments - 1)), 2)
                else:
                    current_amt = installment_amount

                inst_cur = conn.execute("""
                    INSERT INTO installments (
                        payment_id, patient_id, installment_number, total_installments,
                        due_date, amount, status
                    ) VALUES (?, ?, ?, ?, ?, ?, 'unpaid')
                """, (payment_id, patient_id, i, num_installments, due_date, current_amt))
                installment_ids.append(inst_cur.lastrowid)

        conn.commit()
        return {
            "payment_id": payment_id,
            "patient_id": patient_id,
            "plan_type": plan_type,
            "total_amount": total_amount,
            "paid_amount": paid_initial,
            "remaining_balance": remaining,
            "status": status,
            "installment_count": len(installment_ids)
        }
    finally:
        if should_close:
            conn.close()


def confirm_installment_payment(installment_id: int, payment_method: str = "pos", 
                                notes: str = "", user_id: int = None) -> dict:
    """
    Confirms an installment payment, updates installment to 'paid',
    and dynamically recalculates the patient's payment remaining balance.
    """
    conn = get_db_connection()
    try:
        inst = conn.execute("SELECT * FROM installments WHERE id = ?", (installment_id,)).fetchone()
        if not inst:
            return {"error": "Installment not found"}

        if inst["status"] == "paid":
            return {"error": "Installment is already paid"}

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("""
            UPDATE installments
            SET status = 'paid', paid_at = ?, payment_method = ?, confirmation_notes = ?, confirmed_by = ?
            WHERE id = ?
        """, (now_str, payment_method, notes, user_id, installment_id))

        payment_id = inst["payment_id"]

        # Recalculate totals for parent payment
        payment = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
        all_inst = conn.execute("SELECT amount, status FROM installments WHERE payment_id = ?", (payment_id,)).fetchall()
        
        paid_from_installments = sum(r["amount"] for r in all_inst if r["status"] == "paid")
        total = payment["total_amount"]
        # If there was a down payment, it's total - sum of all installment amounts
        all_inst_total = sum(r["amount"] for r in all_inst)
        down_payment = max(0.0, total - all_inst_total)
        total_paid = down_payment + paid_from_installments
        remaining = max(0.0, total - total_paid)

        new_status = "fully_paid" if remaining <= 0.01 else "partially_paid"

        conn.execute("""
            UPDATE payments
            SET paid_amount = ?, remaining_balance = ?, status = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (total_paid, remaining, new_status, payment_id))

        conn.commit()
        return {
            "success": True,
            "installment_id": installment_id,
            "amount_paid": inst["amount"],
            "total_paid": total_paid,
            "remaining_balance": remaining,
            "status": new_status
        }
    finally:
        conn.close()


def get_monthly_payment_confirmation_prompts(year_month_prefix: str = None) -> list[dict]:
    """
    Retrieves all installments that are due in the specified year-month (e.g. '2026-03')
    or currently due / overdue that require confirmation.
    """
    conn = get_db_connection()
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        if not year_month_prefix:
            year_month_prefix = today_str[:7]

        rows = conn.execute("""
            SELECT i.*, p.full_name as patient_name, p.phone as patient_phone, p.file_number,
                   pay.total_amount, pay.remaining_balance
            FROM installments i
            JOIN patients p ON i.patient_id = p.id
            JOIN payments pay ON i.payment_id = pay.id
            WHERE i.status IN ('unpaid', 'overdue')
              AND (i.due_date LIKE ? OR i.due_date <= ?)
            ORDER BY i.due_date ASC
        """, (f"{year_month_prefix}%", today_str)).fetchall()

        return [dict(r) for r in rows]
    finally:
        conn.close()
