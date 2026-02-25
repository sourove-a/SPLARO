# SPLARO | INSTITUTIONAL DEPLOYMENT MANIFEST

This manifest outlines the mission-critical protocols for deploying the **Splaro Boutique Archive** to production environments (GitHub & Hostinger).

---

## 1. SOURCE CONTROL ARCHIVE (GITHUB)

To archive your discovery terminal on GitHub, execute the following tactical commands:

### Initial Archiving
1. **Initialize Protocol**:
   ```bash
   git init
   ```
2. **Stage Assets**:
   ```bash
   git add .
   ```
3. **Commit Manifest**:
   ```bash
   git commit -m "Initialize Institutional Boutique Archive"
   ```
4. **Create Remote Connection**:
   * Create a new repository on [GitHub](https://github.com/new).
   * Link the archive:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/splaro-boutique.git
   ```
5. **Sync Archive**:
   ```bash
   git branch -M main
   git push -u origin main
   ```

---

## 2. PRODUCTION REVEAL (HOSTINGER.COM)

Hostinger supports high-performance web discovery. Follow these protocols to host your archive.

### Fast Fix for `403 Forbidden`
If your domain shows `403 Forbidden - Access to this resource on the server is denied`, your `public_html` likely does not contain the built app entry files.

From this repository root run:

```bash
./scripts/prepare-public-html.sh
```

Then upload the full contents of `public_html/` to Hostinger `public_html` (overwrite existing files).

### Admin Subdomain Protocol (`admin.splaro.co`)
Target path: `/home/u134578371/domains/splaro.co/public_html/admin`

1. In Hostinger hPanel, set the subdomain document root to:
   `/home/u134578371/domains/splaro.co/public_html/admin`
2. Build and package admin deployment files:
   ```bash
   npm run build:admin:hostinger
   ```
3. Upload full contents of local `public_html/admin/` to server folder:
   `/home/u134578371/domains/splaro.co/public_html/admin`
4. Confirm these files exist on server:
   - `index.html`
   - `index.php`
   - `.htaccess`
   - `api/index.php`
5. Verify:
   - `https://admin.splaro.co/` loads admin login/dashboard
   - `https://admin.splaro.co/api/index.php?action=health` returns JSON (with admin auth)

### Protocol A: Institutional Build
Before deployment, you must generate the static production reveal:
```bash
npm run build
```
This manifests a `dist/` directory containing the optimized institutional code.

### Protocol B: Deployment via File Manager
1. **Access Portal**: Log in to your [Hostinger hPanel](https://hpanel.hostinger.com).
2. **Target Directory**: Navigate to **File Manager** -> `public_html`.
3. **Asset Transfer**:
   * Upload the entire contents of your local `dist/` directory (not the folder itself, but its contents) to `public_html`.
4. **Router Stability (Critical)**:
   Since this is a Single Page Application (SPA), you must ensure the server routes all requests to `index.html`.
   * Create a mission-critical `.htaccess` file in `public_html`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

### Protocol C: Automated Deployment (GitHub Actions)
For elite synchronization:
1. Go to Hostinger **Websites** -> **Manage** -> **Git**.
2. Link your GitHub repository.
3. Enable **Auto Deployment**.

---

## 3. BACKEND & ARCHIVAL SQL (HOSTINGER)

To activate permanent data persistence and automated SMTP signaling:

### Protocol D: MariaDB Orchestration
1. **Database Genesis**: In hPanel, navigate to **Databases** -> **MySQL Databases**.
2. **Create Registry**: Manifest a new database (e.g., `splaro_db`).
3. **Identity Handshake**: Open **phpMyAdmin**.
4. **Import Manifest**: Select your database and click **Import**. Upload `api/schema.sql` from the project archive.
5. **API Configuration**:
   * Open `api/config.php` in the Hostinger File Manager.
   * Replace `DB_NAME`, `DB_USER`, and `DB_PASS` with your newly created credentials.

### Protocol E: Institutional SMTP Handshake
1. **Email Provisioning**: In hPanel, go to **Emails** -> **Email Accounts**.
2. **Create Terminal**: Setup `admin@splaro.co`.
3. **Signal Calibration**:
   * In `api/config.php`, ensure `SMTP_PASS` matches your email password.
   * Protocol will automatically trigger email alerts for every New Acquisition.

---

## 4. TECHNICAL SPECIFICATIONS

*   **Runtime**: Vite / React 18 / PHP 8.x
*   **Database**: MySQL / MariaDB (Hostinger)
*   **Styling**: Institutional Tailwind CSS
*   **Animations**: Framer Motion High-Fidelity Sync
*   **Persistence**: Dual-Layer (SQL Matrix + Local Archival)

**DEPLOYMENT TERMINAL READY. PROCEED TO REVEAL.**
