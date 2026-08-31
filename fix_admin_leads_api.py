import re

with open('src/app/api/admin/leads/route.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace hard delete with soft delete
# The original has:
#       await prisma.purchase.deleteMany({
#         where: { leadId: id }
#       });
#       await prisma.lead.delete({
#         where: { id },
#       });

c = c.replace(
    'await prisma.purchase.deleteMany({',
    'await prisma.purchase.updateMany({'
)
c = c.replace(
    'where: { leadId: id }\n      });',
    'where: { leadId: id },\n        data: { deletedAt: new Date() }\n      });'
)
c = c.replace(
    'await prisma.lead.delete({',
    'await prisma.lead.update({'
)
c = c.replace(
    'where: { id },\n      });',
    'where: { id },\n        data: { deletedAt: new Date(), status: \'ARCHIVED\' }\n      });'
)

with open('src/app/api/admin/leads/route.ts', 'w', encoding='utf-8') as f:
    f.write(c)
