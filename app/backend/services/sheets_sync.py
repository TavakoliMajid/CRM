"""
CRM Hira - Google Sheets Live Mirror & External Review Sync
Exports clinic data to CSV/Excel-compatible formats, triggers real-time webhooks,
and allows Google Sheets =IMPORTDATA live mirroring.
"""

import csv
import io
import json
import urllib.request
import urllib.error
from app.backend.db import get_db_connection


def export_table_to_csv(table_name: str) -> str:
    """Exports any database table to CSV string with UTF-8 BOM for Persian Excel support."""
    conn = get_db_connection()
    try:
        allowed = {
            "patients": "SELECT id, file_number, full_name, phone, secondary_phone, gender, birth_date, referral_code, referred_by_code, is_active, created_at FROM patients",
            "treatments": "SELECT pt.id, p.full_name as patient_name, p.file_number, pt.service_code, pt.service_name, pt.treatment_date, pt.price, pt.performed_by, pt.notes, pt.created_at FROM patient_treatments pt JOIN patients p ON pt.patient_id = p.id",
            "followups": "SELECT ft.id, p.full_name as patient_name, p.phone as patient_phone, ft.due_date, ft.title_fa, ft.services_involved, ft.status, ft.notes, ft.completed_at FROM followup_tasks ft JOIN patients p ON ft.patient_id = p.id",
            "payments": "SELECT py.id, p.full_name as patient_name, p.file_number, py.plan_type, py.total_amount, py.paid_amount, py.remaining_balance, py.payment_method, py.status, py.created_at FROM payments py JOIN patients p ON py.patient_id = p.id",
            "installments": "SELECT i.id, p.full_name as patient_name, p.phone, i.installment_number, i.total_installments, i.due_date, i.amount, i.status, i.paid_at FROM installments i JOIN patients p ON i.patient_id = p.id",
            "leads": "SELECT id, full_name, phone, consultation_date, interested_services, quoted_price, retargeting_status, next_followup_date, consultation_notes, created_at FROM leads"
        }

        query = allowed.get(table_name)
        if not query:
            return ""

        cursor = conn.execute(query)
        rows = cursor.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)

        if rows:
            headers = list(rows[0].keys())
            writer.writerow(headers)
            for r in rows:
                writer.writerow([r[h] for h in headers])
        elif cursor.description:
            headers = [d[0] for d in cursor.description]
            writer.writerow(headers)

        return output.getvalue()
    finally:
        conn.close()


def dispatch_google_sheets_webhook(event_type: str, payload_data: dict) -> dict:
    """
    Sends an HTTP POST webhook to a configured Google Sheets Apps Script URL
    to automatically mirror new entries live into an external spreadsheet.
    """
    conn = get_db_connection()
    try:
        setting = conn.execute(
            "SELECT value FROM system_settings WHERE key = 'google_sheets_webhook_url'"
        ).fetchone()

        if not setting or not setting["value"]:
            return {"status": "skipped", "message": "Google Sheets webhook URL not configured."}

        webhook_url = setting["value"].strip()
        data = {
            "source": "CRM_Hira",
            "event": event_type,
            "data": payload_data
        }

        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(data, ensure_ascii=False).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )

        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = response.read().decode('utf-8')
            return {"status": "success", "response": res_body}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


def get_google_apps_script_template() -> str:
    """Returns ready-to-use Google Apps Script code to paste into Google Sheets."""
    return """// --- Google Apps Script for CRM Hira Live Mirroring ---
// Paste this into Google Sheets -> Extensions -> Apps Script
// Deploy as Web App (Execute as: Me, Who has access: Anyone)

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var payload = JSON.parse(e.postData.contents);
  var event = payload.event;
  var data = payload.data;
  
  sheet.appendRow([
    new Date(),
    event,
    data.file_number || '',
    data.full_name || '',
    data.phone || '',
    JSON.stringify(data)
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({result: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}
"""
