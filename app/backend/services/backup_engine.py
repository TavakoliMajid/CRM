"""
CRM Hira - Automated Cloud & Google Drive Backup Engine
Generates point-in-time database snapshots, handles Google Drive backup sync
using free personal Gmail Google Drive storage (15GB), and provides safe database restoration.
"""

import shutil
import os
import json
import sqlite3
import base64
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime
from app.backend.db import get_db_connection, DB_PATH, BASE_DIR

BACKUP_DIR = BASE_DIR / "data" / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def create_database_backup(destination="local", notes="") -> dict:
    """
    Creates an atomic SQLite database backup using SQLite online backup API
    to prevent corruptions during active transactions.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"crm_hira_backup_{timestamp}.db"
    dest_path = BACKUP_DIR / backup_filename

    src_conn = get_db_connection()
    try:
        dest_conn = sqlite3.connect(str(dest_path))
        src_conn.backup(dest_conn)
        dest_conn.close()

        file_size = os.path.getsize(str(dest_path))

        # Check if Google Drive webhook is configured
        gdrive_setting = src_conn.execute(
            "SELECT value FROM system_settings WHERE key = 'google_drive_webhook_url'"
        ).fetchone()

        status_msg = "ذخیره در حافظه محلی سرور"
        if destination == "google_drive" or (gdrive_setting and gdrive_setting["value"]):
            if gdrive_setting and gdrive_setting["value"]:
                upload_res = upload_backup_to_gdrive(dest_path, gdrive_setting["value"])
                status_msg = f"آپلود شده در Google Drive ({upload_res.get('message', 'موفق')})"
                destination = "google_drive"

        # Log backup in database
        src_conn.execute("""
            INSERT INTO backup_logs (backup_name, file_path, file_size, destination, status, details)
            VALUES (?, ?, ?, ?, 'success', ?)
        """, (backup_filename, str(dest_path), file_size, destination, f"{notes} | {status_msg}".strip(" | ")))
        src_conn.commit()

        return {
            "success": True,
            "filename": backup_filename,
            "path": str(dest_path),
            "size_bytes": file_size,
            "timestamp": timestamp,
            "status": status_msg
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        src_conn.close()


def upload_backup_to_gdrive(file_path: Path, webhook_url: str) -> dict:
    """
    Uploads backup snapshot to user's personal Gmail Google Drive (15GB free storage)
    via lightweight Google Apps Script Web App.
    """
    try:
        with open(file_path, "rb") as f:
            file_b64 = base64.b64encode(f.read()).decode('utf-8')

        payload = {
            "filename": file_path.name,
            "mimeType": "application/x-sqlite3",
            "fileBase64": file_b64,
            "timestamp": datetime.now().isoformat()
        }

        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )

        with urllib.request.urlopen(req, timeout=15) as res:
            res_data = res.read().decode('utf-8')
            return {"status": "success", "message": "بک‌آپ در درایو جیمیل ذخیره شد", "response": res_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_gdrive_apps_script_template() -> str:
    """
    Returns a ready-to-copy Google Apps Script for the user's personal Gmail account.
    Takes 2 minutes to deploy at script.google.com and saves backups into their free 15GB Drive.
    """
    return """// --- Google Apps Script: Backup Uploader for Gmail Google Drive (Free 15GB) ---
// 1. Open https://script.google.com in your Gmail account.
// 2. Click "New project", paste this entire script, and click Save.
// 3. Click "Deploy" > "New deployment".
// 4. Select type: "Web app".
//    - Description: CRM Hira Backup
//    - Execute as: Me (<your-gmail>@gmail.com)
//    - Who has access: Anyone
// 5. Click "Deploy", copy the Web App URL, and paste it into CRM Hira settings!

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderName = "CRM_Hira_Backups";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    var decoded = Utilities.base64Decode(data.fileBase64);
    var blob = Utilities.newBlob(decoded, data.mimeType, data.filename);
    var file = folder.createFile(blob);
    
    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
"""


def export_full_database_json() -> dict:
    """Exports entire clinic database as a structured JSON object for cloud sync."""
    conn = get_db_connection()
    try:
        tables = ["users", "patients", "services_catalog", "patient_treatments", 
                  "followup_tasks", "leads", "patient_products", "payments", "installments"]
        dump = {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "tables": {}
        }
        for table in tables:
            rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            dump["tables"][table] = [dict(r) for r in rows]
        return dump
    finally:
        conn.close()


def list_backups() -> list[dict]:
    """Returns list of all available backups."""
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT * FROM backup_logs ORDER BY id DESC").fetchall()
        result = []
        for r in rows:
            item = dict(r)
            item["exists_on_disk"] = os.path.exists(item["file_path"])
            result.append(item)
        return result
    finally:
        conn.close()


def restore_database_backup(backup_file_path: str) -> dict:
    """
    Restores database from a given backup file.
    Creates a pre-restore safety snapshot before replacing.
    """
    if not os.path.exists(backup_file_path):
        return {"success": False, "error": "Backup file not found on server"}

    try:
        safety_name = f"pre_restore_safety_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        shutil.copy2(str(DB_PATH), str(BACKUP_DIR / safety_name))
        shutil.copy2(backup_file_path, str(DB_PATH))
        return {"success": True, "message": "پایگاه داده با موفقیت بازیابی شد.", "safety_backup": safety_name}
    except Exception as e:
        return {"success": False, "error": str(e)}
