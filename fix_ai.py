import re

with open('src/services/ai.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Add import
if 'redactContactInfo' not in c:
    c = "import { redactContactInfo } from '@/lib/redact-contact';\n" + c

# Add AbortController and masking
# Replace:
#             const response = await fetch(apiUrl, {
#               method: 'POST',

# With:
#             const controller = new AbortController();
#             const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
#             const response = await fetch(apiUrl, {
#               method: 'POST',
#               signal: controller.signal,

c = c.replace(
    'const response = await fetch(apiUrl, {',
    '''const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(apiUrl, {
              signal: controller.signal,'''
)

# Fix clear timeout and validation
# Replace:
#             const data = await response.json();
#             let content = data.choices[0].message.content;
#             
#             if (content.includes('`json')) {
#               content = content.replace(/`json/g, '').replace(/`/g, '').trim();
#             }
#             
#             const result = JSON.parse(content);
#             
#             return {

replacement = '''
            clearTimeout(timeoutId);
            const data = await response.json();
            if (!data?.choices?.[0]?.message?.content) {
                throw new Error("Invalid AI response format");
            }
            let content = data.choices[0].message.content;
            
            if (content.includes('`json')) {
              content = content.replace(/`json/g, '').replace(/`/g, '').trim();
            }
            
            const result = JSON.parse(content);
            if (typeof result !== 'object' || result === null) {
                throw new Error("AI did not return a valid JSON object");
            }
            
            return {
'''
c = c.replace(
    "const data = await response.json();\n            let content = data.choices[0].message.content;\n            \n            if (content.includes('`json')) {\n              content = content.replace(/`json/g, '').replace(/`/g, '').trim();\n            }\n            \n            const result = JSON.parse(content);\n            \n            return {",
    replacement
)

# Also replace rawText in AI user message with redactContactInfo(rawText)
c = c.replace(
    "role: 'user',\n                    content: rawText\n                  }",
    "role: 'user',\n                    content: redactContactInfo(rawText)\n                  }"
)


with open('src/services/ai.ts', 'w', encoding='utf-8') as f:
    f.write(c)

