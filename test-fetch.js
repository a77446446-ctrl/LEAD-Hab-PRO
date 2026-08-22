fetch('http://localhost:3000/api/admin/parser/sync', { method: 'POST' })
  .then(async res => {
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  })
  .catch(console.error);
