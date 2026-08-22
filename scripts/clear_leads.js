const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearLeads() {
  try {
    // Сначала удаляем связанные записи (покупки), чтобы не было ошибки внешнего ключа
    await prisma.purchase.deleteMany({});
    console.log('Покупки очищены.');
    
    // Теперь удаляем все лиды
    const deleted = await prisma.lead.deleteMany({});
    console.log(`Успешно удалено лидов: ${deleted.count}`);
    
    // Сбрасываем счетчики в настройках чатов (чтобы в админке было [0])
    const setting = await prisma.setting.findUnique({ where: { key: 'maks_parsing_chats' } });
    if (setting && setting.value) {
      let chats = JSON.parse(setting.value);
      chats = chats.map(c => ({ ...c, count: 0 }));
      await prisma.setting.update({
        where: { key: 'maks_parsing_chats' },
        data: { value: JSON.stringify(chats) }
      });
      console.log('Счетчики чатов сброшены на 0.');
    }
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearLeads();
