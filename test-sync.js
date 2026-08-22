const { maxParser } = require('./src/services/max-parser');

async function test() {
  try {
    const res = await maxParser.sync();
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
test();
