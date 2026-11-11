"""
CRM Hira - Multithreaded REST API & Application Server
Runs on standard Python 3 with zero external dependencies.
Serves REST API endpoints, static assets, PWA files, and Google Sheets exports.
"""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import json
import os
import mimetypes
from pathlib import Path
from datetime import datetime

from app.backend.db import get_db_connection, init_db, DB_PATH
from app.backend.auth import authenticate_user, verify_token, hash_password, ROLES
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
from app.backend.services.followup_engine import SERVICE_NAMES_FA, SERVICE_NAMES_EN
from app.backend.services.sheets_sync import (
    export_table_to_csv,
    dispatch_google_sheets_webhook,
    get_google_apps_script_template
)
from app.backend.services.backup_engine import (
    create_database_backup,
    list_backups,
    export_full_database_json,
    restore_database_backup,
    get_gdrive_apps_script_template,
    BACKUP_DIR
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "app" / "frontend"


class CRMRequestHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def _send_csv(self, csv_content, filename="export.csv"):
        # Prepend UTF-8 BOM so Excel and Google Sheets render Persian properly
        body = ('\ufeff' + csv_content).encode('utf-8')
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode('utf-8'))
        except Exception:
            return {}

    def _get_current_user(self):
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            return verify_token(token)
        return None

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API Endpoints
        if path.startswith("/api/"):
            self._handle_api_get(path, query)
            return

        # 2. Static files
        # Normalize index for SPA
        file_path = FRONTEND_DIR / path.lstrip("/")
        if not file_path.exists() or file_path.is_dir():
            file_path = FRONTEND_DIR / "index.html"

        mime, _ = mimetypes.guess_type(str(file_path))
        if not mime:
            mime = "text/html" if file_path.name.endswith(".html") else "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", f"{mime}; charset=utf-8" if "text" in mime or "javascript" in mime else mime)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(404, str(e))

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path.startswith("/api/"):
            self._handle_api_post(path, query)
            return

        self.send_error(404, "Not Found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path.startswith("/api/"):
            self._handle_api_put(path, query)
            return

        self.send_error(404, "Not Found")

    # =========================================================================
    # API ROUTING: GET
    # =========================================================================
    def _handle_api_get(self, path, query):
        conn = get_db_connection()
        try:
            # Public / Current User
            if path == "/api/auth/me":
                user = self._get_current_user()
                if not user:
                    return self._send_json({"authenticated": False}, 401)
                row = conn.execute("SELECT id, username, full_name, role, phone FROM users WHERE id = ?", (user["user_id"],)).fetchone()
                if not row:
                    return self._send_json({"authenticated": False}, 401)
                res = dict(row)
                res["role_title_fa"] = ROLES.get(row["role"], {}).get("title_fa", row["role"])
                return self._send_json({"authenticated": True, "user": res})

            user = self._get_current_user()
            if not user:
                return self._send_json({"error": "Unauthorized"}, 401)

            # Dashboard Statistics & Visual Monitoring
            if path == "/api/dashboard/stats":
                # Patients active / inactive
                p_active = conn.execute("SELECT COUNT(*) FROM patients WHERE is_active = 1").fetchone()[0]
                p_inactive = conn.execute("SELECT COUNT(*) FROM patients WHERE is_active = 0").fetchone()[0]
                
                # Users active / inactive
                u_active = conn.execute("SELECT COUNT(*) FROM users WHERE is_active = 1").fetchone()[0]
                u_inactive = conn.execute("SELECT COUNT(*) FROM users WHERE is_active = 0").fetchone()[0]

                # Financial overview
                fin = conn.execute("""
                    SELECT COALESCE(SUM(total_amount), 0) as total,
                           COALESCE(SUM(paid_amount), 0) as paid,
                           COALESCE(SUM(remaining_balance), 0) as remaining
                    FROM payments
                """).fetchone()

                # Upcoming follow-ups
                today_str = datetime.now().strftime("%Y-%m-%d")
                followups_today = conn.execute(
                    "SELECT COUNT(*) FROM followup_tasks WHERE due_date = ? AND status = 'pending'", (today_str,)
                ).fetchone()[0]
                followups_overdue = conn.execute(
                    "SELECT COUNT(*) FROM followup_tasks WHERE due_date < ? AND status = 'pending'", (today_str,)
                ).fetchone()[0]

                # Active leads
                leads_active = conn.execute(
                    "SELECT COUNT(*) FROM leads WHERE retargeting_status NOT IN ('converted', 'lost')"
                ).fetchone()[0]

                # Unconfirmed installments due this month
                month_prefix = today_str[:7]
                unpaid_inst = conn.execute(
                    "SELECT COUNT(*) FROM installments WHERE status = 'unpaid' AND due_date LIKE ?",
                    (f"{month_prefix}%",)
                ).fetchone()[0]

                return self._send_json({
                    "patients": {"active": p_active, "inactive": p_inactive, "total": p_active + p_inactive},
                    "users": {"active": u_active, "inactive": u_inactive, "total": u_active + u_inactive},
                    "finance": {"total": fin["total"], "paid": fin["paid"], "remaining": fin["remaining"]},
                    "followups": {"today": followups_today, "overdue": followups_overdue},
                    "leads": {"active": leads_active},
                    "installments_due_month": unpaid_inst
                })

            # Patients List
            if path == "/api/patients":
                search = query.get("q", [""])[0].strip()
                status_filter = query.get("status", ["all"])[0]  # all, active, inactive

                sql = "SELECT * FROM patients WHERE 1=1"
                params = []

                if status_filter == "active":
                    sql += " AND is_active = 1"
                elif status_filter == "inactive":
                    sql += " AND is_active = 0"

                if search:
                    sql += " AND (full_name LIKE ? OR phone LIKE ? OR file_number LIKE ? OR referral_code LIKE ?)"
                    p = f"%{search}%"
                    params.extend([p, p, p, p])

                sql += " ORDER BY id DESC"
                rows = conn.execute(sql, params).fetchall()
                return self._send_json([dict(r) for r in rows])

            # Patient Full Details
            if path.startswith("/api/patients/") and not path.endswith("/status"):
                parts = path.strip("/").split("/")
                if len(parts) == 3 and parts[2].isdigit():
                    pid = int(parts[2])
                    patient = conn.execute("SELECT * FROM patients WHERE id = ?", (pid,)).fetchone()
                    if not patient:
                        return self._send_json({"error": "Patient not found"}, 404)

                    treatments = conn.execute(
                        "SELECT * FROM patient_treatments WHERE patient_id = ? ORDER BY treatment_date DESC", (pid,)
                    ).fetchall()
                    followups = conn.execute(
                        "SELECT * FROM followup_tasks WHERE patient_id = ? ORDER BY due_date ASC", (pid,)
                    ).fetchall()
                    products = conn.execute(
                        "SELECT * FROM patient_products WHERE patient_id = ? ORDER BY purchase_date DESC", (pid,)
                    ).fetchall()
                    payments = conn.execute(
                        "SELECT * FROM payments WHERE patient_id = ? ORDER BY id DESC", (pid,)
                    ).fetchall()
                    installments = conn.execute(
                        "SELECT * FROM installments WHERE patient_id = ? ORDER BY due_date ASC", (pid,)
                    ).fetchall()

                    # Referrals brought in by this patient
                    referred_patients = conn.execute(
                        "SELECT id, full_name, file_number, phone, created_at FROM patients WHERE referred_by_code = ?",
                        (patient["referral_code"],)
                    ).fetchall()

                    return self._send_json({
                        "patient": dict(patient),
                        "treatments": [dict(t) for t in treatments],
                        "followups": [dict(f) for f in followups],
                        "products": [dict(p) for p in products],
                        "payments": [dict(py) for py in payments],
                        "installments": [dict(i) for i in installments],
                        "referred_patients": [dict(rp) for rp in referred_patients]
                    })

            # Follow-up Tasks
            if path == "/api/followups":
                status_f = query.get("status", ["all"])[0]
                patient_f = query.get("patient_id", [""])[0]
                today_f = query.get("today", [""])[0]

                sql = """
                    SELECT f.*, p.full_name as patient_name, p.phone as patient_phone, p.file_number
                    FROM followup_tasks f
                    JOIN patients p ON f.patient_id = p.id
                    WHERE 1=1
                """
                params = []
                if status_f != "all":
                    sql += " AND f.status = ?"
                    params.append(status_f)
                if patient_f.isdigit():
                    sql += " AND f.patient_id = ?"
                    params.append(int(patient_f))
                if today_f:
                    sql += " AND f.due_date = ?"
                    params.append(today_f)

                sql += " ORDER BY f.due_date ASC, f.id ASC"
                rows = conn.execute(sql, params).fetchall()
                return self._send_json([dict(r) for r in rows])

            # Leads
            if path == "/api/leads":
                status_f = query.get("status", ["all"])[0]
                sql = "SELECT * FROM leads WHERE 1=1"
                params = []
                if status_f != "all":
                    sql += " AND retargeting_status = ?"
                    params.append(status_f)
                sql += " ORDER BY id DESC"
                rows = conn.execute(sql, params).fetchall()
                return self._send_json([dict(r) for r in rows])

            # Payments & Financial Tracking
            if path == "/api/payments":
                rows = conn.execute("""
                    SELECT py.*, p.full_name as patient_name, p.phone as patient_phone, p.file_number
                    FROM payments py
                    JOIN patients p ON py.patient_id = p.id
                    ORDER BY py.id DESC
                """).fetchall()
                return self._send_json([dict(r) for r in rows])

            # Monthly payment confirmation prompts
            if path == "/api/installments/monthly-prompts":
                prompts = get_monthly_payment_confirmation_prompts()
                return self._send_json(prompts)

            # Referral Leaderboard
            if path == "/api/referrals/stats":
                stats = get_referral_statistics()
                return self._send_json(stats)

            # Services Catalog
            if path == "/api/services":
                rows = conn.execute("SELECT * FROM services_catalog WHERE is_active = 1").fetchall()
                return self._send_json([dict(r) for r in rows])

            # Users (Admin only)
            if path == "/api/users":
                if user["role"] != "admin":
                    return self._send_json({"error": "Forbidden"}, 403)
                rows = conn.execute("SELECT id, username, full_name, role, phone, raw_pwd, is_active, created_at FROM users").fetchall()
                return self._send_json([dict(r) for r in rows])

            # Google Sheets CSV Export
            if path == "/api/sync/sheets/export":
                table = query.get("table", ["patients"])[0]
                csv_str = export_table_to_csv(table)
                return self._send_csv(csv_str, f"{table}_export.csv")

            # Google Sheets Config & Template
            if path == "/api/sync/sheets/config":
                setting = conn.execute("SELECT value FROM system_settings WHERE key = 'google_sheets_webhook_url'").fetchone()
                return self._send_json({
                    "webhook_url": setting["value"] if setting else "",
                    "apps_script_template": get_google_apps_script_template()
                })

            # Backups List
            if path == "/api/backup/list":
                if user["role"] != "admin":
                    return self._send_json({"error": "Forbidden"}, 403)
                return self._send_json(list_backups())

            # Google Drive Config & Template
            if path == "/api/backup/cloud-config":
                if user["role"] != "admin":
                    return self._send_json({"error": "Forbidden"}, 403)
                setting = conn.execute("SELECT value FROM system_settings WHERE key = 'google_drive_webhook_url'").fetchone()
                return self._send_json({
                    "webhook_url": setting["value"] if setting else "",
                    "apps_script_template": get_gdrive_apps_script_template()
                })

            # Download backup file
            if path == "/api/backup/download":
                if user["role"] != "admin":
                    return self._send_json({"error": "Forbidden"}, 403)
                filename = query.get("filename", [""])[0]
                backup_file = BACKUP_DIR / filename
                if not backup_file.exists():
                    return self._send_json({"error": "File not found"}, 404)

                with open(backup_file, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

            self.send_error(404, "Endpoint not found")

        finally:
            conn.close()

    # =========================================================================
    # API ROUTING: POST
    # =========================================================================
    def _handle_api_post(self, path, query):
        body = self._read_json_body()

        # Login
        if path == "/api/auth/login":
            username = body.get("username", "")
            password = body.get("password", "")
            res = authenticate_user(username, password)
            if not res or "error" in res:
                return self._send_json(res or {"error": "نام کاربری یا رمز عبور اشتباه است."}, 401)
            return self._send_json(res)

        # Require authenticated user for all following endpoints
        user = self._get_current_user()
        if not user:
            return self._send_json({"error": "Unauthorized"}, 401)

        # 1. Register Patient with Multi-services & Payment Plan
        if path == "/api/patients":
            res = create_patient_with_services(body, user_id=user["user_id"])
            dispatch_google_sheets_webhook("new_patient", body)
            return self._send_json(res, 201)

        # 2. Add Treatment to Patient (Ongoing Profile Management)
        if path.startswith("/api/patients/") and path.endswith("/treatments"):
            pid = int(path.split("/")[3])
            res = add_treatment_to_patient(pid, body, user_id=user["user_id"])
            dispatch_google_sheets_webhook("new_treatment", {"patient_id": pid, **body})
            return self._send_json(res)

        # 3. Add Purchased Product to Patient
        if path.startswith("/api/patients/") and path.endswith("/products"):
            pid = int(path.split("/")[3])
            res = add_product_to_patient(pid, body)
            return self._send_json(res)

        # 4. Create Consultation Lead
        if path == "/api/leads":
            res = create_lead(body, user_id=user["user_id"])
            dispatch_google_sheets_webhook("new_lead", body)
            return self._send_json(res, 201)

        # 5. Convert Lead to Patient (1-Click)
        if path.startswith("/api/leads/") and path.endswith("/convert"):
            lid = int(path.split("/")[3])
            res = convert_lead_to_patient(lid, user_id=user["user_id"])
            return self._send_json(res)

        # 6. Confirm Installment Payment
        if path.startswith("/api/installments/") and path.endswith("/confirm"):
            iid = int(path.split("/")[3])
            res = confirm_installment_payment(
                installment_id=iid,
                payment_method=body.get("payment_method", "pos"),
                notes=body.get("notes", ""),
                user_id=user["user_id"]
            )
            dispatch_google_sheets_webhook("installment_confirmed", {"installment_id": iid, **res})
            return self._send_json(res)

        # 7. Add Custom Payment / Installment Plan
        if path == "/api/payments":
            res = create_payment_plan(
                patient_id=int(body["patient_id"]),
                plan_type=body.get("plan_type", "lump_sum"),
                total_amount=float(body["total_amount"]),
                down_payment=float(body.get("down_payment", 0)),
                num_installments=int(body.get("num_installments", 1)),
                start_date_str=body.get("start_date"),
                payment_method=body.get("payment_method", "cash"),
                description=body.get("description", ""),
                user_id=user["user_id"]
            )
            return self._send_json(res)

        # 8. Create User (Admin only)
        if path == "/api/users":
            if user["role"] != "admin":
                return self._send_json({"error": "Forbidden"}, 403)
            conn = get_db_connection()
            try:
                username = body.get("username", "").strip()
                pwd = body.get("password", "")
                full_name = body.get("full_name", "").strip()
                role = body.get("role", "operator")
                phone = body.get("phone", "")

                h, s = hash_password(pwd)
                conn.execute("""
                    INSERT INTO users (username, password_hash, salt, raw_pwd, full_name, role, phone, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """, (username, h, s, pwd, full_name, role, phone))
                conn.commit()
                return self._send_json({"success": True, "message": "User created"}, 201)
            except Exception as e:
                return self._send_json({"error": str(e)}, 400)
            finally:
                conn.close()

        # 9. Google Sheets Config Save
        if path == "/api/sync/sheets/config":
            webhook_url = body.get("webhook_url", "").strip()
            conn = get_db_connection()
            try:
                conn.execute("""
                    INSERT INTO system_settings (key, value, updated_at)
                    VALUES ('google_sheets_webhook_url', ?, datetime('now'))
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
                """, (webhook_url,))
                conn.commit()
                return self._send_json({"success": True, "webhook_url": webhook_url})
            finally:
                conn.close()

        # 10. Manual Google Sheets Sync Trigger
        if path == "/api/sync/sheets/sync-now":
            res = dispatch_google_sheets_webhook("manual_sync", {"triggered_by": user["username"], "timestamp": datetime.now().isoformat()})
            return self._send_json(res)

        # 11. Create Database Backup Snapshot
        if path == "/api/backup/create":
            if user["role"] != "admin":
                return self._send_json({"error": "Forbidden"}, 403)
            dest = body.get("destination", "local")
            notes = body.get("notes", "")
            res = create_database_backup(destination=dest, notes=notes)
            return self._send_json(res)

        # 12. Google Drive Cloud Backup Config
        if path == "/api/backup/cloud-config":
            if user["role"] != "admin":
                return self._send_json({"error": "Forbidden"}, 403)
            webhook_url = body.get("webhook_url", "").strip()
            folder_id = body.get("folder_id", "").strip()
            conn = get_db_connection()
            try:
                if webhook_url:
                    conn.execute("""
                        INSERT INTO system_settings (key, value, updated_at)
                        VALUES ('google_drive_webhook_url', ?, datetime('now'))
                        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
                    """, (webhook_url,))
                if folder_id:
                    conn.execute("""
                        INSERT INTO system_settings (key, value, updated_at)
                        VALUES ('google_drive_folder_id', ?, datetime('now'))
                        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
                    """, (folder_id,))
                conn.commit()
                return self._send_json({"success": True, "webhook_url": webhook_url, "folder_id": folder_id})
            finally:
                conn.close()

        # 13. Restore Backup
        if path == "/api/backup/restore":
            if user["role"] != "admin":
                return self._send_json({"error": "Forbidden"}, 403)
            filename = body.get("filename", "")
            target_path = BACKUP_DIR / filename
            res = restore_database_backup(str(target_path))
            return self._send_json(res)

        self.send_error(404, "Endpoint not found")

    # =========================================================================
    # API ROUTING: PUT
    # =========================================================================
    def _handle_api_put(self, path, query):
        body = self._read_json_body()
        user = self._get_current_user()
        if not user:
            return self._send_json({"error": "Unauthorized"}, 401)

        # Update Follow-up Task Status & Notes
        if path.startswith("/api/followups/"):
            fid = int(path.split("/")[3])
            conn = get_db_connection()
            try:
                status = body.get("status", "completed")
                notes = body.get("notes", "")
                completed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if status == "completed" else None
                
                conn.execute("""
                    UPDATE followup_tasks
                    SET status = ?, notes = ?, completed_at = ?, completed_by = ?, updated_at = datetime('now')
                    WHERE id = ?
                """, (status, notes, completed_at, user["user_id"], fid))
                conn.commit()
                return self._send_json({"success": True, "followup_id": fid, "status": status})
            finally:
                conn.close()

        # Manual Status Override (Active vs Inactive)
        if path.startswith("/api/patients/") and path.endswith("/status"):
            pid = int(path.split("/")[3])
            is_active = bool(body.get("is_active", True))
            reason = body.get("reason", "")
            res = toggle_status("patient", pid, is_active, reason)
            return self._send_json(res)

        if path.startswith("/api/users/") and path.endswith("/status"):
            if user["role"] != "admin":
                return self._send_json({"error": "Forbidden: Admin only"}, 403)
            uid = int(path.split("/")[3])
            is_active = bool(body.get("is_active", True))
            res = toggle_status("user", uid, is_active)
            return self._send_json(res)

        # Update Lead
        if path.startswith("/api/leads/"):
            lid = int(path.split("/")[3])
            conn = get_db_connection()
            try:
                conn.execute("""
                    UPDATE leads
                    SET consultation_notes = ?, retargeting_status = ?, next_followup_date = ?, quoted_price = ?, updated_at = datetime('now')
                    WHERE id = ?
                """, (
                    body.get("consultation_notes", ""),
                    body.get("retargeting_status", "needs_followup"),
                    body.get("next_followup_date", ""),
                    float(body.get("quoted_price", 0)),
                    lid
                ))
                conn.commit()
                return self._send_json({"success": True, "lead_id": lid})
            finally:
                conn.close()

        self.send_error(404, "Endpoint not found")


def run_server(port=8080, host="0.0.0.0"):
    init_db()
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, CRMRequestHandler)
    print(f"==================================================")
    print(f" CRM Hira - Hair Clinic CRM Server Running")
    print(f" Address: http://localhost:{port}")
    print(f" Cross-platform: macOS, Windows, Android (PWA)")
    print(f" Press Ctrl+C to terminate server")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port=port)
