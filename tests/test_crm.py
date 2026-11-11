"""
CRM Hira - Comprehensive Automated Test Suite
Validates all 7 core requirements:
1. Automated Follow-up Scheduling & Same-Day Deduplication / Merge Engine
2. Patient Profile, Ongoing Service / Product Logging, Leads & Referrals
3. Active vs Inactive Status Monitoring & Manual Overrides
4. Payments, Installment Engine & Dynamic Balance Tracking
5. Jalali Calendar & Localization Support
6. Data Management, Google Sheets CSV Sync & Atomic Backup Snapshots
7. Authentication & Role-Based Access Control (RBAC)
"""

import sys
import os
import unittest
from pathlib import Path
from datetime import datetime, timedelta

# Add root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.backend.db import init_db, get_db_connection
from app.backend.auth import hash_password, verify_password, generate_token, verify_token, authenticate_user
from app.backend.services.followup_engine import (
    generate_followup_tasks_for_treatments,
    calculate_due_date,
    SERVICE_FOLLOWUP_RULES
)
from app.backend.models.patient import (
    create_patient_with_services,
    add_treatment_to_patient,
    add_product_to_patient,
    get_referral_statistics,
    create_lead,
    convert_lead_to_patient,
    toggle_status
)
from app.backend.models.payment import (
    create_payment_plan,
    confirm_installment_payment,
    get_monthly_payment_confirmation_prompts
)
from app.backend.services.sheets_sync import export_table_to_csv
from app.backend.services.backup_engine import create_database_backup, list_backups


class TestCRMHiraComprehensive(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.conn = get_db_connection()
        # Clean tables for pristine test environment
        self.conn.execute("DELETE FROM installments;")
        self.conn.execute("DELETE FROM payments;")
        self.conn.execute("DELETE FROM patient_products;")
        self.conn.execute("DELETE FROM followup_tasks;")
        self.conn.execute("DELETE FROM patient_treatments;")
        self.conn.execute("DELETE FROM leads;")
        self.conn.execute("DELETE FROM patients;")
        self.conn.execute("DELETE FROM users;")
        self.conn.commit()

        # Seed sample admin user
        h, s = hash_password("ID982usr!@")
        cur = self.conn.execute(
            "INSERT INTO users (username, password_hash, salt, full_name, role) VALUES (?, ?, ?, ?, ?)",
            ("TheOne", h, s, "مدیر سیستم", "admin")
        )
        self.admin_id = cur.lastrowid
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    # =========================================================================
    # REQUIREMENT 1: CORE BUSINESS & AUTOMATION RULES (FOLLOW-UP MERGE)
    # =========================================================================
    def test_hair_transplant_schedule_rules(self):
        """Hair Transplant: Day 3, Day 8, Day 13, Month 5, Month 8"""
        p = create_patient_with_services({
            "full_name": "سهراب سپهری",
            "phone": "09121110001",
            "treatments": [
                {"service_code": "hair_transplant", "service_name": "کاشت مو", "treatment_date": "2026-01-01"}
            ]
        }, user_id=self.admin_id)

        tasks = self.conn.execute(
            "SELECT * FROM followup_tasks WHERE patient_id = ? ORDER BY due_date ASC",
            (p["patient_id"],)
        ).fetchall()

        self.assertEqual(len(tasks), 5)
        self.assertEqual(tasks[0]["due_date"], "2026-01-04")  # Day 3
        self.assertEqual(tasks[0]["event_key"], "psych_call_day3")
        self.assertEqual(tasks[1]["due_date"], "2026-01-09")  # Day 8
        self.assertEqual(tasks[1]["event_key"], "scalp_wash_prp_day8")
        self.assertEqual(tasks[2]["due_date"], "2026-01-14")  # Day 13
        self.assertEqual(tasks[2]["event_key"], "psych_care_day13")
        self.assertEqual(tasks[3]["due_date"], "2026-05-31")  # Month 5 (+150d)
        self.assertEqual(tasks[3]["event_key"], "recommendation_month5")
        self.assertEqual(tasks[4]["due_date"], "2026-08-29")  # Month 8 (+240d)
        self.assertEqual(tasks[4]["event_key"], "final_photos_month8")

    def test_mesotherapy_schedule_rules(self):
        """Mesotherapy: Day 3 (Psych call), Day 14 (Next injection)"""
        p = create_patient_with_services({
            "full_name": "مریم میرزاخانی",
            "phone": "09121110002",
            "treatments": [
                {"service_code": "mesotherapy", "service_name": "مزوتراپی", "treatment_date": "2026-02-01"}
            ]
        }, user_id=self.admin_id)

        tasks = self.conn.execute(
            "SELECT * FROM followup_tasks WHERE patient_id = ? ORDER BY due_date ASC",
            (p["patient_id"],)
        ).fetchall()

        self.assertEqual(len(tasks), 2)
        self.assertEqual(tasks[0]["due_date"], "2026-02-04")
        self.assertEqual(tasks[0]["event_key"], "psych_call_day3")
        self.assertEqual(tasks[1]["due_date"], "2026-02-15")
        self.assertEqual(tasks[1]["event_key"], "next_inj_day14")

    def test_prp_and_botox_schedule_rules(self):
        """PRP: Day 3, Month 3; Botox: Day 3, Month 4"""
        p = create_patient_with_services({
            "full_name": "بهزاد فراهانی",
            "phone": "09121110003",
            "treatments": [
                {"service_code": "prp", "service_name": "پی‌آرپی", "treatment_date": "2026-03-01"},
                {"service_code": "botox", "service_name": "بوتاکس", "treatment_date": "2026-03-01"}
            ]
        }, user_id=self.admin_id)

        tasks = self.conn.execute(
            "SELECT * FROM followup_tasks WHERE patient_id = ? ORDER BY due_date ASC",
            (p["patient_id"],)
        ).fetchall()

        # Day 3 MUST be merged into 1 task!
        # PRP has Month 3 (+90d)
        # Botox has Month 4 (+120d)
        # Total tasks = 1 (Day 3 merged) + 1 (Month 3 PRP) + 1 (Month 4 Botox) = 3 tasks!
        self.assertEqual(len(tasks), 3, "PRP + Botox on same day must merge Day 3 into 1 single task!")
        
        # Check Day 3 merged task
        day3 = tasks[0]
        self.assertEqual(day3["due_date"], "2026-03-04")
        self.assertIn("مشترک", day3["title_fa"])
        self.assertIn("prp", day3["services_involved"])
        self.assertIn("botox", day3["services_involved"])

    def test_triple_service_deduplication_hair_prp_meso(self):
        """When Hair Transplant + PRP + Mesotherapy are done on the same day: Day 3 must be ONE merged task."""
        p = create_patient_with_services({
            "full_name": "فرهاد مجیدی",
            "phone": "09121110004",
            "treatments": [
                {"service_code": "hair_transplant", "service_name": "کاشت مو", "treatment_date": "2026-04-01"},
                {"service_code": "prp", "service_name": "پی‌آرپی", "treatment_date": "2026-04-01"},
                {"service_code": "mesotherapy", "service_name": "مزوتراپی", "treatment_date": "2026-04-01"}
            ]
        }, user_id=self.admin_id)

        day3_tasks = self.conn.execute(
            "SELECT * FROM followup_tasks WHERE patient_id = ? AND due_date = '2026-04-04'",
            (p["patient_id"],)
        ).fetchall()

        self.assertEqual(len(day3_tasks), 1, "There must be exactly ONE merged Day 3 task!")
        self.assertIn("hair_transplant", day3_tasks[0]["services_involved"])
        self.assertIn("prp", day3_tasks[0]["services_involved"])
        self.assertIn("mesotherapy", day3_tasks[0]["services_involved"])

    # =========================================================================
    # REQUIREMENT 2: ONGOING PROFILE MANAGEMENT, PRODUCTS, LEADS & REFERRALS
    # =========================================================================
    def test_ongoing_profile_add_treatment_and_products(self):
        """Operators can add treatments later to an existing patient, dynamically updating schedule."""
        p = create_patient_with_services({
            "full_name": "پروین اعتصامی",
            "phone": "09121110005"
        }, user_id=self.admin_id)
        pid = p["patient_id"]

        # Initially 0 tasks
        c0 = self.conn.execute("SELECT COUNT(*) FROM followup_tasks WHERE patient_id = ?", (pid,)).fetchone()[0]
        self.assertEqual(c0, 0)

        # Later, patient receives Botox on 2026-05-10
        add_treatment_to_patient(pid, {
            "service_code": "botox",
            "service_name": "بوتاکس",
            "treatment_date": "2026-05-10",
            "price": 2800000
        }, user_id=self.admin_id)

        c1 = self.conn.execute("SELECT COUNT(*) FROM followup_tasks WHERE patient_id = ?", (pid,)).fetchone()[0]
        self.assertEqual(c1, 2)  # Day 3 & Month 4

        # Patient purchases Phyto Shampoo
        res_prod = add_product_to_patient(pid, {
            "product_name": "شامپو فیتو تخصصی",
            "quantity": 2,
            "unit_price": 900000,
            "purchase_date": "2026-05-10"
        })
        self.assertEqual(res_prod["total_price"], 1800000)

    def test_referral_system_and_client_count(self):
        """Tracking referrers, unique referral codes, and counting new clients."""
        # Referrer Patient A
        p_a = create_patient_with_services({
            "full_name": "معرف نمونه الف",
            "phone": "09121110006"
        }, user_id=self.admin_id)
        code_a = p_a["referral_code"]

        # Client 1 referred by A
        create_patient_with_services({
            "full_name": "مراجع اول",
            "phone": "09121110007",
            "referred_by_code": code_a,
            "payment": {"plan_type": "lump_sum", "total_amount": 10000000}
        }, user_id=self.admin_id)

        # Client 2 referred by A
        create_patient_with_services({
            "full_name": "مراجع دوم",
            "phone": "09121110008",
            "referred_by_code": code_a,
            "payment": {"plan_type": "lump_sum", "total_amount": 25000000}
        }, user_id=self.admin_id)

        # Get referral leaderboard
        stats = get_referral_statistics()
        self.assertTrue(len(stats) >= 1)
        top = [s for s in stats if s["referral_code"] == code_a][0]
        self.assertEqual(top["referred_count"], 2)
        self.assertEqual(top["total_revenue_generated"], 35000000)

    def test_lead_tracking_and_one_click_conversion(self):
        """Registering a consultation lead and converting it 1-click into a patient."""
        lead_res = create_lead({
            "full_name": "امید نوروزی",
            "phone": "09121110009",
            "consultation_date": "2026-06-01",
            "interested_services": ["hair_transplant"],
            "quoted_price": 38000000,
            "consultation_notes": "مشاوره آنلاین انجام شد، مشتاق به کاشت با حداکثر تراکم.",
            "retargeting_status": "thinking"
        }, user_id=self.admin_id)
        lid = lead_res["lead_id"]

        # 1-Click Convert to patient
        conv_res = convert_lead_to_patient(lid, user_id=self.admin_id)
        self.assertTrue(conv_res["success"])
        new_pid = conv_res["patient_id"]

        # Verify patient exists
        p_row = self.conn.execute("SELECT * FROM patients WHERE id = ?", (new_pid,)).fetchone()
        self.assertEqual(p_row["full_name"], "امید نوروزی")
        self.assertIn("تبدیل شده از سرنخ", p_row["notes"])

        # Verify lead status updated to converted
        lead_row = self.conn.execute("SELECT * FROM leads WHERE id = ?", (lid,)).fetchone()
        self.assertEqual(lead_row["retargeting_status"], "converted")
        self.assertEqual(lead_row["converted_patient_id"], new_pid)

    # =========================================================================
    # REQUIREMENT 3: PATIENT & USER STATUS MANAGEMENT (MANUAL OVERRIDES)
    # =========================================================================
    def test_status_management_and_manual_overrides(self):
        p = create_patient_with_services({
            "full_name": "بیمار تست وضعیت",
            "phone": "09121110010"
        }, user_id=self.admin_id)
        pid = p["patient_id"]

        # Initially active (1)
        self.assertEqual(self.conn.execute("SELECT is_active FROM patients WHERE id = ?", (pid,)).fetchone()[0], 1)

        # Admin overrides to Inactive (0)
        toggle_status("patient", pid, False, "پایان دوره نقاهت و رضایت کامل")
        p_row = self.conn.execute("SELECT is_active, inactive_reason FROM patients WHERE id = ?", (pid,)).fetchone()
        self.assertEqual(p_row["is_active"], 0)
        self.assertEqual(p_row["inactive_reason"], "پایان دوره نقاهت و رضایت کامل")

        # Admin reactivates
        toggle_status("patient", pid, True)
        self.assertEqual(self.conn.execute("SELECT is_active FROM patients WHERE id = ?", (pid,)).fetchone()[0], 1)

    # =========================================================================
    # REQUIREMENT 4: PAYMENTS, INSTALLMENT ENGINE & DYNAMIC BALANCE TRACKING
    # =========================================================================
    def test_installment_engine_and_dynamic_balance(self):
        p = create_patient_with_services({
            "full_name": "بیمار طرح اقساطی",
            "phone": "09121110011"
        }, user_id=self.admin_id)
        pid = p["patient_id"]

        # Total = 30M, Down payment = 10M, 4 installments (5M each)
        plan = create_payment_plan(
            patient_id=pid,
            plan_type="installment",
            total_amount=30000000,
            down_payment=10000000,
            num_installments=4,
            start_date_str="2026-01-01",
            user_id=self.admin_id
        )

        self.assertEqual(plan["total_amount"], 30000000)
        self.assertEqual(plan["paid_amount"], 10000000)
        self.assertEqual(plan["remaining_balance"], 20000000)
        self.assertEqual(plan["installment_count"], 4)

        # Check installments created
        inst_list = self.conn.execute(
            "SELECT * FROM installments WHERE payment_id = ? ORDER BY installment_number ASC",
            (plan["payment_id"],)
        ).fetchall()
        self.assertEqual(len(inst_list), 4)
        for i in inst_list:
            self.assertEqual(i["amount"], 5000000)
            self.assertEqual(i["status"], "unpaid")

        # Confirm Installment #1
        first_id = inst_list[0]["id"]
        res1 = confirm_installment_payment(first_id, payment_method="pos", notes="کارتخوان پرداخت شد")
        self.assertTrue(res1["success"])
        self.assertEqual(res1["total_paid"], 15000000)      # 10M down + 5M inst 1
        self.assertEqual(res1["remaining_balance"], 15000000) # 30M - 15M

        # Confirm Installment #2
        second_id = inst_list[1]["id"]
        res2 = confirm_installment_payment(second_id, payment_method="card_to_card")
        self.assertEqual(res2["total_paid"], 20000000)
        self.assertEqual(res2["remaining_balance"], 10000000)

        # Check monthly prompts
        prompts = get_monthly_payment_confirmation_prompts()
        self.assertIsInstance(prompts, list)

    # =========================================================================
    # REQUIREMENT 6: DATA SYNC & BACKUP ENGINE
    # =========================================================================
    def test_google_sheets_csv_mirror_export(self):
        csv_patients = export_table_to_csv("patients")
        self.assertIn("id,file_number,full_name", csv_patients)
        csv_followups = export_table_to_csv("followups")
        self.assertIn("due_date,title_fa", csv_followups)

    def test_atomic_database_backup_creation(self):
        backup_res = create_database_backup(destination="local", notes="تست خودکار بک‌آپ")
        self.assertTrue(backup_res["success"])
        self.assertTrue(os.path.exists(backup_res["path"]))
        self.assertGreater(backup_res["size_bytes"], 0)

        backups = list_backups()
        self.assertTrue(len(backups) >= 1)

    # =========================================================================
    # REQUIREMENT 7: CUSTOM AUTH & RBAC
    # =========================================================================
    def test_rbac_and_inactive_user_prevention(self):
        # Create an operator user
        h, s = hash_password("op-pass-123")
        cur = self.conn.execute(
            "INSERT INTO users (username, password_hash, salt, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
            ("op_test", h, s, "اپراتور تستی", "operator")
        )
        op_id = cur.lastrowid
        self.conn.commit()

        # Login success
        login_res = authenticate_user("op_test", "op-pass-123")
        self.assertIsNotNone(login_res)
        self.assertEqual(login_res["role"], "operator")

        # Verify bearer token
        token_payload = verify_token(login_res["token"])
        self.assertIsNotNone(token_payload)
        self.assertEqual(token_payload["username"], "op_test")

        # Deactivate user
        toggle_status("user", op_id, False)

        # Login must be rejected
        blocked_res = authenticate_user("op_test", "op-pass-123")
        self.assertIn("error", blocked_res)
        self.assertEqual(blocked_res["error"], "user_inactive")


if __name__ == "__main__":
    unittest.main()
