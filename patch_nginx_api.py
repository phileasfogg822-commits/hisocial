import subprocess, os

nginx_path = '/opt/apps/app1/nginx.conf'

# Read current config
content = open(nginx_path).read()

# Old location block (frontend only)
old = '''    location / {
        proxy_pass http://172.17.0.1:6002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}'''

# New: add /api block routing to backend port 6001
new = '''    location /api {
        proxy_pass http://172.17.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        proxy_pass http://172.17.0.1:6002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}'''

if old in content:
    content = content.replace(old, new)
    open(nginx_path, 'w').write(content)
    print('nginx.conf patched OK')
else:
    print('ERROR: pattern not found - no changes made')

# Also update .env.vps VITE_API_URL
env_path = '/opt/apps/app4/.env.vps'
env = open(env_path).read()
env = env.replace('VITE_API_URL=http://72.61.115.120:6001', 'VITE_API_URL=https://www.ezclinic360.com')
open(env_path, 'w').write(env)
print('env.vps updated:', 'VITE_API_URL=https://www.ezclinic360.com')
print('Done - now reload nginx and rebuild frontend')
