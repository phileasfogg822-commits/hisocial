import subprocess

r = subprocess.run(
    ["docker", "exec", "app4-postgres", "psql", "-U", "clinix", "-d", "clinix_app4", "-c",
     'select email, role, password from "User"'],
    capture_output=True, text=True
)
print(r.stdout)
