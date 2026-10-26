import subprocess

def run(sql):
    r = subprocess.run(
        ["docker", "exec", "app4-postgres", "psql", "-U", "clinix", "-d", "clinix_app4", "-c", sql],
        capture_output=True, text=True
    )
    print(r.stdout)
    if r.stderr:
        print("STDERR:", r.stderr)

print("=== User count ===")
run('select count(*) from "User"')

print("=== Users (email + role) ===")
run('select email, role from "User" limit 10')

print("=== Clinic count ===")
run('select count(*) from "Clinic"')
