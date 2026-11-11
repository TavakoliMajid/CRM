"""
CRM Hira - Seed Initial Data
Seeds only the primary Administrator and standard clinic services catalog.
No test patients, leads, or secondary users are pre-seeded, ensuring a clean production state.
"""

from app.backend.db import init_db, get_db_connection
from app.backend.auth import hash_password


def seed_all():
    init_db()
    conn = get_db_connection()

    print("Checking existing data...")
    user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if user_count > 0:
        print("Database already contains user accounts. Skipping seed.")
        conn.close()
        return

    print("Seeding primary Administrator account...")
    admin_pwd = "ID982usr!@"
    pwd_hash, salt = hash_password(admin_pwd)
    conn.execute("""
        INSERT INTO users (username, password_hash, salt, raw_pwd, full_name, role, phone, is_active)
        VALUES ('TheOne', ?, ?, ?, 'مدیر کل سیستم', 'admin', '09120000000', 1)
    """, (pwd_hash, salt, admin_pwd))

    print("Seeding clinic services catalog...")
    services = [
        ("hair_transplant", "کاشت مو (Micro FIT / SUT)", "Hair Transplant (Micro FIT/SUT)", 38000000, "کاشت تخصصی موی طبیعی با بالاترین تراکم"),
        ("mesotherapy", "مزوتراپی تخصصی سر و ابرو", "Specialized Mesotherapy", 3500000, "کوکتل تقویتی فیتو و بیوتین جهت رشد مو"),
        ("prp", "پی‌آرپی تقویت ریشه (PRP کیت سوئیسی)", "PRP Follicle Therapy", 4500000, "پلاسمای غنی از پلاکت با کیت استاندارد سلولی"),
        ("botox", "بوتاکس مصپورت / دیسپورت", "Botox Injection", 2800000, "رفع چین و چروک پیشانی، خط اخم و پنجه‌کلاغی"),
    ]

    for code, name_fa, name_en, price, desc in services:
        conn.execute("""
            INSERT INTO services_catalog (code, name_fa, name_en, default_price, description, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (code, name_fa, name_en, price, desc))

    conn.commit()
    conn.close()
    print("Initial clean setup completed successfully!")


if __name__ == "__main__":
    seed_all()
