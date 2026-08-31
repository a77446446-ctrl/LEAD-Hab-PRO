import re

with open('src/app/api/admin/leads/route.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# I will find the DELETE function and rewrite it
# It looks like:
# export async function DELETE(request: Request) { ... }
# I will use a simple split and replace

part1, part2 = c.split('export async function DELETE(request: Request) {')

new_delete = '''export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // Soft delete purchases
    await prisma.purchase.updateMany({
      where: { leadId: id },
      data: { deletedAt: new Date() }
    });

    // Soft delete lead
    await prisma.lead.update({
      where: { id },
      data: { status: 'ARCHIVED', deletedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete lead:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}'''

with open('src/app/api/admin/leads/route.ts', 'w', encoding='utf-8') as f:
    f.write(part1 + new_delete)
