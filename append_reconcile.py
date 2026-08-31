import re

with open('src/services/yookassa.ts', 'r', encoding='utf-8') as f:
    c = f.read()

reconcile_fn = '''
export async function reconcilePayments() {
  const pendingOrders = await prisma.paymentOrder.findMany({
    where: {
      status: { in: ['CREATED', 'PENDING', 'WAITING_FOR_CAPTURE'] },
      providerPaymentId: { not: null },
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }
    }
  });

  let reconciled = 0;
  for (const order of pendingOrders) {
    if (!order.providerPaymentId) continue;
    try {
      const payment = await requestYoo(/payments/);
      
      if (payment.amount?.currency !== 'RUB' || payment.amount.value !== amountValue(order.amount)) {
        continue;
      }
      if (payment.metadata?.order_id !== order.id) {
        continue;
      }

      if (payment.status === 'succeeded' && payment.paid === true) {
        await fulfill(order.id, payment);
        reconciled++;
      } else if (payment.status === 'canceled') {
        await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'CANCELED' } });
        reconciled++;
      }
    } catch (e) {
      console.error(Reconciliation failed for order :, e);
    }
  }
  return reconciled;
}
'''

with open('src/services/yookassa.ts', 'w', encoding='utf-8') as f:
    f.write(c + '\n' + reconcile_fn)

