import subprocess

# Fix postgres password to match backend DATABASE_URL from .env.vps
r = subprocess.run(
    ["docker", "exec", "app4-postgres", "psql", "-U", "clinix", "-d", "clinix_app4", "-c",
     "ALTER USER clinix WITH PASSWORD '9191731';"],
    capture_output=True, text=True
)
print("Password fix:", r.stdout.strip(), r.stderr.strip())

# Re-import backup if /tmp/clinix_utf8.sql exists
import os
if os.path.exists("/tmp/clinix_utf8.sql"):
    r2 = subprocess.run(
        "docker exec -i app4-postgres psql -U clinix -d clinix_app4 < /tmp/clinix_utf8.sql 2>&1 | tail -5",
        shell=True, capture_output=True, text=True
    )
    print("Import:", r2.stdout.strip(), r2.stderr.strip())
else:
    print("Backup file not found at /tmp/clinix_utf8.sql - converting now")
    subprocess.run(
        "iconv -f UTF-16 -t UTF-8 /opt/apps/app4/clinixmax-backup-20260409.sql > /tmp/clinix_utf8.sql",
        shell=True
    )
    r2 = subprocess.run(
        "docker exec -i app4-postgres psql -U clinix -d clinix_app4 < /tmp/clinix_utf8.sql 2>&1 | tail -5",
        shell=True, capture_output=True, text=True
    )
    print("Import:", r2.stdout.strip(), r2.stderr.strip())

# Count users after import
r3 = subprocess.run(
    ["docker", "exec", "app4-postgres", "psql", "-U", "clinix", "-d", "clinix_app4", "-c",
     'select count(*) from "User"'],
    capture_output=True, text=True
)
print("Users after import:", r3.stdout.strip())
