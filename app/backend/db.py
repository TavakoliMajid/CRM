"""
CRM Hira - Database Management Layer
Supports SQLite local storage with WAL mode, foreign keys, and transaction management.
"""

import sqlite3
import os
import json
from pathlib import Path
from datetime import datetime

# Resolve base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "crm_hira.db"


def get_db_connection():
    """Returns a SQLite connection configured with Row factory, foreign keys, and WAL mode."""
    conn = sqlite3.connect(str(DB_PATH), timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def init_db():
    """Initializes database schema if tables do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    -- 1. Users Table (RBAC: admin, doctor, operator, accountant)
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        raw_pwd TEXT,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'operator', 'accountant')),
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 2. Patients Table
    CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_number TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        national_id TEXT,
        phone TEXT NOT NULL,
        secondary_phone TEXT,
        gender TEXT DEFAULT 'male' CHECK(gender IN ('male', 'female')),
        birth_date TEXT,
        referral_code TEXT UNIQUE NOT NULL,
        referred_by_code TEXT,
        medical_history TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        inactive_reason TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 3. Services Catalog
    CREATE TABLE IF NOT EXISTS services_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name_fa TEXT NOT NULL,
        name_en TEXT NOT NULL,
        default_price REAL DEFAULT 0,
        description TEXT,
        is_active INTEGER DEFAULT 1
    );

    -- 4. Patient Treatments (Logged services for patient)
    CREATE TABLE IF NOT EXISTS patient_treatments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        service_code TEXT NOT NULL,
        service_name TEXT NOT NULL,
        treatment_date TEXT NOT NULL,
        performed_by TEXT,
        price REAL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 5. Follow-up Tasks (Merged deduplicated post-treatment schedules)
    CREATE TABLE IF NOT EXISTS followup_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        due_date TEXT NOT NULL,
        event_key TEXT NOT NULL,
        title_fa TEXT NOT NULL,
        title_en TEXT NOT NULL,
        services_involved TEXT NOT NULL, -- JSON array of service names
        treatment_dates TEXT,           -- JSON array of dates
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled', 'rescheduled')),
        notes TEXT,
        completed_at TEXT,
        completed_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 6. Leads (Non-purchasing consultations & retargeting)
    CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        consultation_date TEXT NOT NULL,
        interested_services TEXT,        -- JSON array of service codes
        quoted_price REAL DEFAULT 0,
        consultation_notes TEXT,
        retargeting_status TEXT DEFAULT 'needs_followup' 
            CHECK(retargeting_status IN ('needs_followup', 'interested', 'thinking', 'price_sensitive', 'lost', 'converted')),
        next_followup_date TEXT,
        referred_by_code TEXT,
        assigned_to INTEGER REFERENCES users(id),
        converted_patient_id INTEGER REFERENCES patients(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 7. Patient Purchased Products
    CREATE TABLE IF NOT EXISTS patient_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        purchase_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 8. Payments (Financial plans: lump_sum or installment)
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        plan_type TEXT NOT NULL CHECK(plan_type IN ('lump_sum', 'installment')),
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        remaining_balance REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'partially_paid', 'fully_paid')),
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 9. Installments (Detailed installment schedule)
    CREATE TABLE IF NOT EXISTS installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        installment_number INTEGER NOT NULL,
        total_installments INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'overdue', 'waived')),
        paid_at TEXT,
        payment_method TEXT,
        confirmation_notes TEXT,
        confirmed_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 10. System Settings & Cloud Sync Configuration
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 11. Backup Logs
    CREATE TABLE IF NOT EXISTS backup_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        destination TEXT DEFAULT 'local',
        status TEXT DEFAULT 'success',
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for high performance
    CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
    CREATE INDEX IF NOT EXISTS idx_patients_referral ON patients(referral_code);
    CREATE INDEX IF NOT EXISTS idx_patients_referred_by ON patients(referred_by_code);
    CREATE INDEX IF NOT EXISTS idx_followup_patient_date ON followup_tasks(patient_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_followup_status ON followup_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
    CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
    """)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Database schema successfully initialized at:", DB_PATH)
