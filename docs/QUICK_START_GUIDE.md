# Mangalm Sales Assistant - Quick Start Guide

## 🚀 First-Time Setup Instructions

This guide will get you up and running with the Mangalm Sales Assistant in **30 minutes**.

---

## Step 1: System Requirements Check

### Minimum Requirements
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 10GB free space
- **CPU**: 4+ cores recommended

---

## Step 2: Install Required Software

### 2.1 Install Node.js (Required)

1. **Download Node.js LTS**
   - Go to: https://nodejs.org/
   - Download version 18.x or higher (LTS recommended)
   - Run the installer as Administrator

2. **Verify Installation**
   ```cmd
   node --version
   npm --version
   ```
   You should see version numbers (e.g., `v18.17.0` and `9.6.7`)

### 2.2 Install PostgreSQL (Required)

1. **Download PostgreSQL**
   - Go to: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 14 or higher
   - Run the installer as Administrator

2. **Installation Settings**
   - **Password**: Set password as `postgres` (or remember your choice)
   - **Port**: Keep default `5432`
   - **Locale**: Keep default
   - **Components**: Install all (PostgreSQL Server, pgAdmin, Stack Builder)

3. **If you're having password issues** (you never set a password or don't remember it):
   
   First, modify your pg_hba.conf file to allow passwordless connections:
   
   ```powershell
   # Find the pg_hba.conf file (usually in C:\Program Files\PostgreSQL\[version]\data)
   # Open it with an editor (run as administrator)
   notepad "C:\Program Files\PostgreSQL\[version]\data\pg_hba.conf"
   
   # Change all authentication methods from "scram-sha-256" to "trust"
   # Your file should look like this:
   # TYPE  DATABASE        USER            ADDRESS                 METHOD
   # "local" is for Unix domain socket connections only
   local   all             all                                     trust
   # IPv4 local connections:
   host    all             all             127.0.0.1/32            trust
   # IPv6 local connections:
   host    all             all             ::1/128                 trust
   # Allow replication connections from localhost, by a user with the
   # replication privilege.
   local   replication     all                                     trust
   host    replication     all             127.0.0.1/32            trust
   host    replication     all             ::1/128                 trust
   
   # Restart PostgreSQL service (try one of these methods)
   
   # Method 1: Check if PostgreSQL is already running (RECOMMENDED - No admin required)
   Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"}
   # If you see "Running" status, PostgreSQL is already working - no restart needed!
   
   # Method 2: Using Windows Services GUI (If restart is actually needed)
   # 1. Press Win+R, type "services.msc" and press Enter
   # 2. Find the PostgreSQL service in the list (e.g., "postgresql-x64-17")
   # 3. Right-click on it and select "Restart"
   
   # Method 3: Only if Methods 1-2 don't work (requires admin privileges)
   # Open PowerShell as Administrator and run:
   # Restart-Service -Name "postgresql-x64-17"
   
   # Most likely, PostgreSQL is already running and you can skip the restart entirely
   ```

4. **Create database and user for Mangalm:**
   ```powershell
   # Connect to PostgreSQL using psql (replace [version] with your version, e.g., 17)
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres
   
   # In the psql prompt, run these commands:
   CREATE DATABASE mangalm_sales;
   CREATE USER mangalm WITH PASSWORD 'mangalm_secure_2024';
   GRANT ALL PRIVILEGES ON DATABASE mangalm_sales TO mangalm;
   
   # Exit psql
   \q
   ```
   
   **Then enable required extensions:**
   ```powershell
   # Connect to the new database with the mangalm user
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U mangalm -h localhost -d mangalm_sales
   
   # Enable extensions (enter password: mangalm_secure_2024 when prompted)
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   
   # Exit psql
   \q
   ```

5. **Verify Installation**
   ```powershell
   # Method 1: Using full path (replace [version] with your PostgreSQL version)
   & 'C:\Program Files\PostgreSQL\17\bin\pg_config.exe' --version
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' --version
   
   # Method 2: Check if PostgreSQL service is running (easier verification)
   Get-Service postgresql*
   
   # Method 3: Test database connection (most reliable verification)
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -c "SELECT version();"
   ```

### 2.3 Install Git (Required)

1. **Download Git**
   - Go to: https://git-scm.com/download/win
   - Download and run installer

2. **Installation Options**
   - Use default settings
   - Choose "Git from the command line and also from 3rd-party software"

3. **Verify Installation**
   ```cmd
   git --version
   ```

### 2.4 Install Redis (Optional but Recommended)

**Option A: Docker (Easier)**
```cmd
docker run -d -p 6379:6379 --name mangalm-redis redis:alpine
```

**Option B: Windows Installation**
1. **Download Redis**
   - Go to: https://github.com/microsoftarchive/redis/releases
   - Download Redis-x64-3.0.504.msi
   - Run the installer as Administrator

2. **Start Redis Service**
   ```powershell
   # Method 1: Using Windows Services GUI (RECOMMENDED)
   # 1. Press Win+R, type "services.msc" and press Enter
   # 2. Find "Redis" in the service list
   # 3. Right-click and select "Start"
   
   # Method 2: Using PowerShell (requires admin privileges)
   Start-Service Redis
   
   # Method 3: Using Command Prompt (requires admin privileges)
   net start Redis
   ```

3. **Verify Redis is Running**
   ```powershell
   # Check Redis service status
   Get-Service Redis
   
   # Test Redis connection (if redis-cli is in PATH)
   redis-cli ping
   # Should return "PONG"
   ```

4. **If Redis doesn't start automatically after installation:**
   ```powershell
   # Set Redis to start automatically
   # 1. Open services.msc
   # 2. Find Redis service
   # 3. Right-click → Properties
   # 4. Set "Startup type" to "Automatic"
   # 5. Click "Start" if not already running
   ```

---

## Step 3: Get the Application Code

### 3.1 Clone Repository
```cmd
# Navigate to your desired directory
cd C:\
mkdir projects
cd projects

# Clone the repository (or extract from provided files)
git clone <repository-url> mangalm
cd mangalm
```

### 3.2 Verify File Structure
You should see:
```
mangalm/
├── services/
├── database/
├── scripts/
├── docs/
└── package.json
```

---

## Step 4: Database Setup

### 4.1 Create Database and User

1. **Open PowerShell as Administrator**

2. **Run Database Setup Script**
   ```powershell
   cd C:\projects\mangalm\scripts\windows
   .\setup-database.bat
   ```

3. **If Script Fails (PostgreSQL not in PATH), Manual Setup:**

   **Step 3a: Check if PostgreSQL is running**
   ```powershell
   # Check PostgreSQL service status
   Get-Service postgresql*
   
   # If not running, start it using services.msc (recommended)
   # Press Win+R, type "services.msc", find PostgreSQL service, right-click → Start
   ```

   **Step 3b: Create database and user manually**
   ```powershell
   # Replace [version] with your PostgreSQL version (e.g., 17, 16, 15)
   # Connect to PostgreSQL using full path
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost
   
   # Enter postgres password when prompted
   # Then run these SQL commands:
   CREATE DATABASE mangalm_sales;
   CREATE USER mangalm WITH PASSWORD 'mangalm_secure_2024';
   GRANT ALL PRIVILEGES ON DATABASE mangalm_sales TO mangalm;
   \q
   ```

   **Step 3c: Enable required extensions**
   ```powershell
   # Connect to the new database and enable extensions
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U mangalm -h localhost -d mangalm_sales
   
   # Run these commands in psql:
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   \q
   ```

### 4.2 Verify Database Connection

**Test the connection that the application will use:**
```powershell
# Replace [version] with your PostgreSQL version
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U mangalm -h localhost -d mangalm_sales

# Enter password: mangalm_secure_2024
# If connected successfully, you should see:
# psql (17.4)
# WARNING: Console code page (437) differs from Windows code page (1252)
#          8-bit characters might not work correctly...
# Type "help" for help.
# mangalm_sales=>

# Type \q to exit
\q
```

**Quick verification test:**
```powershell
# Test with a simple query
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U mangalm -h localhost -d mangalm_sales -c "SELECT version();"

# Should return PostgreSQL version information
```

### 4.3 Troubleshooting Database Setup

**Issue: "psql: error: connection to server failed: FATAL: role 'mangalm' does not exist"**

This means the database user wasn't created properly. Follow Step 3b above to create it manually.

**Issue: "psql: command not found" or "The term 'psql' is not recognized"**

PostgreSQL is not in your system PATH. Use the full path to psql.exe as shown in the examples above.

**Issue: "psql: error: connection to server failed: could not connect to server"**

PostgreSQL service is not running. Start it using:
- Method 1: Press Win+R, type "services.msc", find PostgreSQL service, right-click → Start
- Method 2: PowerShell as Admin: `Start-Service postgresql-x64-17` (replace with your service name)

**Issue: Password authentication failed**

If you're having password issues with the postgres user, see the PostgreSQL password troubleshooting section in the Common Issues below.

---

## Step 5: Environment Configuration

### 5.1 Create Environment File

1. **Run Environment Setup**
   ```cmd
   cd C:\projects\mangalm\scripts\windows
   setup-environment.bat
   ```

2. **Or Manual Setup:**
   ```cmd
   cd C:\projects\mangalm
   copy .env.example .env
   ```

3. **Edit .env File**
   Open `.env` in notepad and update:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mangalm_sales
   DB_USER=mangalm
   DB_PASSWORD=mangalm_secure_2024
   
   # Application Configuration
   NODE_ENV=production
   JWT_SECRET=change-this-in-production-very-long-secret-key
   
   # Service Ports
   API_GATEWAY_PORT=3007
   FRONTEND_PORT=3000
   AI_SERVICE_PORT=3001
   PM_SERVICE_PORT=3002
   ZOHO_SERVICE_PORT=3003
   
   # Optional: Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Optional: Email Configuration (for notifications)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

---

## Step 6: Install Application Dependencies

### 6.1 Install All Dependencies
```cmd
cd C:\projects\mangalm\scripts\windows
install-dependencies.bat
```

This script will:
- Install root dependencies
- Install shared library dependencies
- Build shared libraries
- Install dependencies for all services

**Wait for completion** (this may take 5-10 minutes)

---

## Step 7: Database Schema Setup

### 7.1 Run Database Migrations
```cmd
cd C:\projects\mangalm\scripts\windows
run-migrations.bat
```

This will create all necessary tables and initial data.

---

## Step 8: Start the Application

### 8.1 Start All Services
```cmd
cd C:\projects\mangalm\scripts\windows
start-all.bat
```

You should see multiple command windows opening for each service:
- API Gateway (Port 3007)
- AI Service (Port 3001)
- PM Orchestrator (Port 3002)
- Zoho Integration (Port 3003)
- Frontend (Port 3000)

### 8.2 Wait for Startup
Wait for all services to show "Server running on port XXXX" messages.

---

## Step 9: Access the Application

### 9.1 Open Your Browser
Navigate to: **http://localhost:3000**

### 9.2 First Login
```
Username: admin
Password: admin123
```

### 9.3 Verify Services
Check that all services are running by visiting:
- Frontend: http://localhost:3000
- API Health: http://localhost:3007/health
- API Docs: http://localhost:3007/api-docs

---

## Step 10: Post-Setup Tasks

### 10.1 Change Default Password
1. Log in with admin/admin123
2. Go to User Profile
3. Change password to something secure

### 10.2 Add Sample Data (Optional)
```cmd
cd C:\projects\mangalm\scripts\windows
# If you have sample data files
# load-sample-data.bat
```

### 10.3 Configure Integrations (Optional)
- **Zoho CRM**: Add your Zoho credentials in settings
- **Email**: Configure SMTP settings for notifications
- **SMS**: Configure SMS provider if needed

---

## 🎉 Success! Your System is Ready

You should now see:
- ✅ Dashboard with sample widgets
- ✅ Store management section
- ✅ Order management
- ✅ Prediction capabilities
- ✅ User management (admin only)

---

## Quick Health Check

### Verify Everything is Working:

1. **Services Health Check**
   ```cmd
   cd C:\projects\mangalm\scripts\windows
   health-check.bat
   ```

2. **Database Check**
   ```cmd
   psql -U mangalm -h localhost -d mangalm_sales -c "SELECT COUNT(*) FROM users;"
   ```
   Should return at least 1 (admin user)

3. **Web Interface Check**
   - Visit http://localhost:3000
   - Log in successfully
   - Navigate to different sections

---

## Common First-Time Issues

### Issue 1: "Port already in use"
**Solution:**
```cmd
cd scripts\windows
stop-all.bat
start-all.bat
```

### Issue 2: "Database connection failed"
**Solution:**
```cmd
# Check PostgreSQL service
sc query postgresql-x64-14
# If not running:
net start postgresql-x64-14
```

### Issue 3: "Module not found"
**Solution:**
```cmd
cd scripts\windows
install-dependencies.bat
```

### Issue 4: "Permission denied"
**Solution:**
- Run Command Prompt as Administrator
- Ensure PostgreSQL service is running
- Check Windows Firewall settings

### Issue 5: PostgreSQL Password Problems

If you're prompted for a PostgreSQL password that you never set or don't remember:

**Method 1 - Reset using pg_hba.conf:**
```powershell
# Find the pg_hba.conf file (usually in C:\Program Files\PostgreSQL\[version]\data)
# Open it with an editor (run as administrator)
notepad "C:\Program Files\PostgreSQL\[version]\data\pg_hba.conf"

# Change the authentication method from "scram-sha-256" to "trust" for local connections
# Find lines like:
# host    all             all             127.0.0.1/32            scram-sha-256
# local   all             all                                     scram-sha-256
# Change "scram-sha-256" to "trust" for all lines

# Restart PostgreSQL service
Restart-Service postgresql*

# Now you can connect without a password
& 'C:\Program Files\PostgreSQL\[version]\bin\psql.exe' -U postgres

# Set a new password
ALTER USER postgres WITH PASSWORD 'your_new_password';

# Exit psql
\q

# Change the authentication method back to "scram-sha-256" in pg_hba.conf
# Restart PostgreSQL service again
```

**Method 2 - Using pgAdmin:**
- Open pgAdmin (installed with PostgreSQL)
- Right-click on the server and select "Connect Server"
- If prompted for a password, try leaving it blank or using "postgres"
- If you can connect, right-click on "Login/Group Roles" > "postgres" > "Properties"
- Go to the "Definition" tab and set a new password

**Method 3 - Bypass password for local development:**
Edit your `.env` file to use a connection string without a password:
```env
DATABASE_URL="postgresql://postgres@localhost:5432/mangalm_sales"
```
This works only if you've set the authentication method to "trust" in pg_hba.conf

### Issue 6: Database Connection Issues

If you encounter database connection issues, verify:

1. **PostgreSQL service is running:**
   ```powershell
   Get-Service postgresql*
   ```

2. **Start PostgreSQL if not running:**
   ```powershell
   # Method 1: Using PowerShell (REQUIRES ADMINISTRATOR PRIVILEGES)
   # You must run PowerShell as Administrator for this to work
   Start-Service -Name "postgresql-x64-17"
   
   # Method 2: Using Windows Services GUI (RECOMMENDED - No admin required)
   # 1. Press Win+R, type "services.msc" and press Enter
   # 2. Find the PostgreSQL service in the list
   # 3. Right-click on it and select "Start"
   
   # Method 3: Using net start command (requires admin privileges)
   # Open PowerShell as Administrator and run:
   net start postgresql-x64-17
   
   # If you get "Cannot open service" errors, use Method 2 (services.msc)
   ```

### Issue 9: PowerShell Permission Errors

If you encounter "Cannot open service" or "PermissionDenied" errors when using PowerShell commands:

**Problem**: The PowerShell service commands are trying to manage system services, but there are better non-admin approaches.

**Recommended Solutions (No Admin Required)**:
1. **Use Windows Services GUI** (services.msc) - Press Win+R, type "services.msc", find PostgreSQL service, right-click to start/restart
2. **Use Task Manager** - Go to Services tab, find PostgreSQL service, right-click to start/stop
3. **Check if PostgreSQL is already running** - The service might already be running and doesn't need to be restarted

**Alternative PowerShell Approach (No Admin)**:
```powershell
# Instead of trying to restart the service, just check if it's running
Get-Service postgresql* | Where-Object {$_.Status -eq "Running"}

# If PostgreSQL is already running, you don't need to restart it
# Just proceed with connecting to the database
```

**Example of the error you might see:**
```
Restart-Service: Service 'postgresql-x64-17' cannot be stopped due to the following error: Cannot open 'postgresql-x64-17' service on computer '.'.
```

**Key Insight**: Most of the time, PostgreSQL is already running after installation, so you don't actually need to restart it. The error suggests the service management approach isn't necessary for normal operation.

3. **Test connection manually:**
   ```powershell
   & 'C:\Program Files\PostgreSQL\[version]\bin\psql.exe' -U postgres -d mangalm_sales
   ```

### Issue 7: Node.js Dependency Errors

If you encounter Node.js errors related to missing dependencies:

```powershell
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install --force
```

### Issue 8: PostgreSQL Commands Not Found

If you get "The term 'pg_config' is not recognized" or similar errors:

**Problem**: PostgreSQL bin directory is not in your Windows PATH.

**Solutions**:
1. **Use full path to PostgreSQL commands:**
   ```powershell
   # Replace [version] with your PostgreSQL version (e.g., 17, 16, 15)
   & 'C:\Program Files\PostgreSQL\[version]\bin\psql.exe' -U postgres
   & 'C:\Program Files\PostgreSQL\[version]\bin\pg_config.exe' --version
   ```

2. **Add PostgreSQL to PATH (optional):**
   ```powershell
   # Add to current session PATH
   $env:PATH += ";C:\Program Files\PostgreSQL\17\bin"
   
   # Now you can use psql directly
   psql --version
   ```

3. **Use pgAdmin instead** - It's installed with PostgreSQL and provides a GUI interface

### Issue 9: File Path Issues

Windows uses backslashes (`\`) for file paths, but many Node.js applications expect forward slashes (`/`). Most libraries handle this automatically, but if you encounter path-related issues, try using forward slashes in your configurations.

---

## Running the Application After Initial Setup

If you've already completed the initial setup and need to run the application again later, follow these steps:

### 1. Ensure PostgreSQL Service is Running

First, check if the PostgreSQL service is running:

```powershell
Get-Service postgresql*
```

If it's not running, start it:

```powershell
# Method 1: Using PowerShell (replace with your actual service name)
Start-Service -Name "postgresql-x64-17"

# Method 2: Using Windows Services GUI
# 1. Press Win+R, type "services.msc" and press Enter
# 2. Find the PostgreSQL service in the list
# 3. Right-click on it and select "Start"

# Method 3: Using net start command (requires admin privileges)
# Open PowerShell as Administrator and run:
net start postgresql-x64-17
```

### 2. Navigate to Project Directory

```powershell
cd C:\projects\mangalm
```

### 3. Start the Development Server

```powershell
cd scripts\windows
start-all.bat
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

### 4. Common Quick Start Issues

#### Database Connection Errors

If you encounter database connection issues:

1. Verify your PostgreSQL service is running (see step 1)
2. Check that your `.env` file has the correct database connection string
3. Ensure no other application is using the PostgreSQL port (default: 5432)

#### Service Port Conflicts

If you get "port already in use" errors:

```powershell
cd scripts\windows
stop-all.bat
# Wait a few seconds
start-all.bat
```

---

## Next Steps

After successful setup:

1. **Read the User Manual**: `docs/USER_MANUAL.md`
2. **Configure Integrations**: Set up Zoho CRM sync
3. **Add Real Data**: Import your store and product data
4. **Train the Model**: Let the system learn from your historical data
5. **Set Up Monitoring**: Configure alerts and dashboards

---

## Need Help?

### Documentation
- **User Manual**: `docs/USER_MANUAL.md`
- **API Documentation**: `docs/API_DOCUMENTATION.md`
- **Troubleshooting**: `docs/TROUBLESHOOTING_GUIDE.md`

### Quick Diagnostic
```cmd
cd scripts\windows
troubleshoot.bat
```

### Support
- Check logs: `scripts\windows\view-logs.bat`
- Run diagnostics: `scripts\windows\troubleshoot.bat`
- Review documentation in `docs/` folder

---

## Summary Checklist

- [ ] Node.js installed and verified
- [ ] PostgreSQL installed and running
- [ ] Git installed
- [ ] Repository cloned/extracted
- [ ] Database created and user configured
- [ ] Environment file configured
- [ ] Dependencies installed
- [ ] Database migrations completed
- [ ] All services started
- [ ] Application accessible at http://localhost:3000
- [ ] Logged in successfully
- [ ] Default password changed

**🎉 Congratulations! Mangalm Sales Assistant is now running.**

---

*Quick Start Guide Version: 1.0.0*  
*Last Updated: 2025-08-10*  
*Estimated Setup Time: 30 minutes*
