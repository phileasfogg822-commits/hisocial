path = '/opt/apps/app4/client/vite.config.ts'
c = open(path).read()
c = c.replace(
    '  preview: {\n    port: 8002,\n    host: true\n  },',
    '  preview: {\n    port: 8002,\n    host: true,\n    allowedHosts: ["ezclinic360.com", "www.ezclinic360.com"],\n  },'
)
open(path, 'w').write(c)
print('Done')
print(open(path).read())
