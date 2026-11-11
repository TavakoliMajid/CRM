# 🏥 CRM Hira — Hair & Aesthetic Clinic Management System

**CRM Hira** is a comprehensive, standalone Customer Relationship Management (CRM) and post-treatment automation software designed specifically for hair transplant, dermatology, and aesthetic clinics.

It features automated follow-up scheduling with smart deduplication for same-day procedures, an installment payment calculation engine, referral code tracking, consultation lead retargeting, Jalali (Solar Hijri) calendar support, 100% offline local resilience, and cloud synchronization with Google Drive and Google Sheets.

---

## 🔐 Security & Access Control Notice

To safeguard patient medical data and ensure repository safety for public hosting on GitHub, **administrative credentials are kept confidential and are not published in this repository**.

* System access is protected by built-in PBKDF2-HMAC-SHA256 password hashing and signed bearer session tokens independent of third-party login providers.
* Once logged in, the Administrator can navigate to **Users & RBAC** to define staff accounts (Doctors, Operators, Accountants), assign roles, view assigned passwords, and grant or revoke access in real time.

---

## 🌟 Key Features

### 1. Post-Treatment Follow-up Automation & Smart Task Merging
* **Hair Transplant:**
  * **Day 3:** Psychological support call (stress control and reassurance)
  * **Day 8:** Appointment for PRP injection and scalp wash
  * **Day 13:** Psychological support call and aftercare guidance (hair shedding phase explanation)
  * **Month 5:** Recommendation for injection sessions, mesotherapy, and Phyto therapy
  * **Month 8:** Follow-up for final result photos
* **Mesotherapy:**
  * **Day 3:** Psychological support call
  * **Day 14:** Appointment for the next injection
* **PRP (Platelet-Rich Plasma):**
  * **Day 3:** Psychological support call
  * **Month 3:** Appointment for the next injection
* **Botox:**
  * **Day 3:** Psychological support call
  * **Month 4:** Appointment for renewal / next injection
* 🛡️ **Intelligent Merge Engine (Deduplication):**
  When a patient undergoes multiple procedures on the same date (e.g. Hair Transplant + PRP), the system merges overlapping events (such as the Day 3 Psychological Support call) into **a single unified follow-up task** labeled with a distinct purple badge to prevent duplicate or annoying calls to the patient.

### 2. Patient Profiles & Ongoing Treatment Management
* **Multi-Service Entry on Intake:** Receptionists can log multiple procedures in a single registration workflow.
* **Ongoing Profile Management:** Open existing patient files at any time to log new treatments or procedures; the system dynamically updates and merges the follow-up timeline immediately.
* **Aftercare Product Purchases:** Track clinic-prescribed shampoos, vitamins, and serums directly inside the patient profile.
* **Lead Tracking & Retargeting:** Register prospective clients who received consultations or price quotes without purchasing. Set retargeting statuses (*Interested, Considering, Price Sensitive*) and convert leads into official patient records with **1 click**.
* **Referral Tracking System:** Each patient receives a unique referral code (e.g., `HIRA-1001`). The system tracks referrers, counts new clients brought in, and calculates total clinic revenue generated per referrer in a dedicated leaderboard.

### 3. Patient & Staff Status Monitoring
* **Visual Monitoring Dashboard:** Dedicated status panel displaying active vs. inactive patients and active vs. inactive system users.
* **Manual Overrides:** Administrators can toggle patient or staff status (*Active / Inactive*) with logged audit reasons.

### 4. Payments, Installment Engine & Dynamic Balance Tracking
* **Flexible Payment Options:** Lump-sum (cash/card/POS) or custom monthly installment payment plans.
* **Installment Engine:** Set down payments, installment counts, and automatic monthly due dates.
* **Monthly Due Prompts:** Automatic alert banner and confirmation table for installments maturing in the current month with 1-click confirmation.
* **Real-time Balance Recalculation:** Outstanding balance updates dynamically upon confirmation of each payment.

### 5. Localization & Dual Calendar Support
* **Interactive Jalali DatePicker:** Solar Hijri (Shamsi) interactive calendar picker for all date fields (procedure dates, birthdays, follow-up schedules, installments).
* **Native RTL & Persian Typography:** Right-to-Left layout with Vazirmatn typography, Persian numerals, and an instant toggle to English (LTR).

### 6. Storage, Google Sheets Sync & Automated Cloud Backup
* **Local Offline SQLite Database (WAL Mode):** Operates 100% offline inside the clinic with zero reliance on external internet connections.
* **Live Google Sheets Mirroring:**
  * Direct `=IMPORTDATA(...)` formula endpoints for live Excel / Google Sheets review without third-party plugins.
  * Real-time webhook notifications for external spreadsheet sync.
* **Automated Cloud Backup (Google Drive):**
  * Point-in-time atomic SQLite snapshots saved locally and uploaded directly to personal Gmail Google Drive (utilizing the free 15GB quota).
  * Safe 1-click database restoration with automatic pre-restore safety backups.

---

## 🚀 Quick Start & Installation

### Option A: Windows (1-Click)
1. Extract `CRM_Hira.zip`.
2. Double-click **`install.bat`** for initial setup.
3. Launch the application anytime using **`start.bat`**.
4. The clinic software will open in its dedicated desktop window at **`http://localhost:8080`**.

### Option B: macOS & Linux (1-Click)
1. Extract `CRM_Hira.zip` and open Terminal in the folder:
```bash
chmod +x install.sh start.sh installer.py
./install.sh
```
2. Start the application:
```bash
./start.sh
```

### Option C: Android Tablets & Smartphones (PWA)
1. Ensure the server is running on the clinic's central computer.
2. Open the clinic URL in Chrome on your Android tablet or phone (e.g. `http://192.168.1.50:8080`).
3. Tap the browser menu (three dots) and select **"Add to Home screen"** or **"Install App"**.
4. CRM Hira will install as a standalone native app icon with a full-screen, touch-optimized interface.

---

## 🌐 Multi-User Clinic Network Setup (LAN / Wi-Fi)

To allow multiple clinic staff members (receptionists, doctors, accountants) on different computers and tablets to share the same database simultaneously:

1. Run the CRM server on one central clinic computer.
2. Find the local IP address of that computer:
   * **Windows:** Open Command Prompt and type `ipconfig` (look for `IPv4 Address`, e.g., `192.168.1.50`).
   * **macOS:** Open Terminal and type `ipconfig getifaddr en0`.
3. Other devices connected to the clinic Wi-Fi can access the system by opening:
   👉 **`http://<CENTRAL-COMPUTER-IP>:8080`** (e.g., `http://192.168.1.50:8080`)
4. All actions and entries sync to the central SQLite database in real time.

---

## 📧 Automated Google Drive Backup via Personal Gmail (Free 15GB)

Every personal `@gmail.com` account comes with 15GB of free Google Drive storage. To back up your database to your personal Gmail Google Drive:

1. Open **[script.google.com](https://script.google.com)** while logged into your Gmail account.
2. Click **"New project"**.
3. In the CRM Hira dashboard (**Google Sheets Sync & Backup** tab), copy the provided 15-line Google Apps Script template, paste it into the editor, and click **Save**.
4. Click **Deploy > New deployment**:
   * Type: **Web app**
   * Execute as: **Me** (`your-email@gmail.com`)
   * Who has access: **Anyone**
5. Copy the generated Web App URL and paste it into the Google Drive settings input in CRM Hira.
6. Now, clicking **"Backup to Google Drive"** will automatically archive compressed database snapshots into a `CRM_Hira_Backups` folder in your personal Google Drive.

---

## 📊 Live Google Sheets Formulas (`=IMPORTDATA`)

Mirror clinic tables live into any Google Sheet or Excel file by placing the following formulas in cell `A1`:
* **Patient Records:** `=IMPORTDATA("http://localhost:8080/api/sync/sheets/export?table=patients")`
* **Procedures & Treatments:** `=IMPORTDATA("http://localhost:8080/api/sync/sheets/export?table=treatments")`
* **Follow-up Calendar:** `=IMPORTDATA("http://localhost:8080/api/sync/sheets/export?table=followups")`
* **Financial Ledger & Installments:** `=IMPORTDATA("http://localhost:8080/api/sync/sheets/export?table=payments")`
* **Consultation Leads:** `=IMPORTDATA("http://localhost:8080/api/sync/sheets/export?table=leads")`

---

## 🧪 Automated Test Suite

CRM Hira includes a comprehensive test suite validating follow-up deduplication, the installment engine, referral calculations, and RBAC authentication:
```bash
python3 tests/test_crm.py
```
Output:
```text
Ran 12 tests in 0.315s
OK
```

---

## 📄 License
Proprietary software developed for clinical use. All rights reserved.
