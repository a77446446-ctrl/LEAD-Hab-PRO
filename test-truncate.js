
const text = 'This is a long string that has a phone number 89991234567 and a link https://t.me/qwe and more text at the end';
const combinedRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|@[a-zA-Z0-9_]+|(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b)/g;
const parts = text.split(combinedRegex);
let currentLength = 0;
let truncateAt = 60;
const result = [];
for (let i = 0; i < parts.length; i++) {
  const part = parts[i];
  if (!part) continue;
  let charsToAdd = part.length;
  let node = part;
  if (part.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|@[a-zA-Z0-9_]+)/)) {
    charsToAdd = 15; node = '<LINK>';
  } else if (part.match(/(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b/)) {
    charsToAdd = 15; node = '<PHONE>';
  } else {
    if (currentLength + charsToAdd > truncateAt) {
      node = part.substring(0, truncateAt - currentLength) + '...';
      result.push(node);
      break;
    }
  }
  result.push(node);
  currentLength += charsToAdd;
  if (currentLength >= truncateAt) {
    if (i < parts.length - 1) result.push('...');
    break;
  }
}
console.log(result.join(''));

