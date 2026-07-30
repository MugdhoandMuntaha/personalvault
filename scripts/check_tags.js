const fs = require('fs');
const content = fs.readFileSync('app/page.tsx', 'utf8');

const lines = content.split('\n');
const tagStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Very basic regex to find XML/HTML tags
  // Matches tags like <div>, <form className="...">, </button>, but ignores self-closing ones like <Key className="..." /> or comments
  const tagRegex = /<(\/?[a-zA-Z0-9:-]+)(?:\s+[^>]*[^\/]>|>)/g;
  let match;
  
  while ((match = tagRegex.exec(line)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    
    // Ignore self-closing tags matched by mistake (if any)
    if (fullTag.endsWith('/>')) continue;
    
    if (tagName.startsWith('/')) {
      const closingName = tagName.substring(1);
      if (tagStack.length === 0) {
        console.log(`Line ${i + 1}: Found closing tag </${closingName}> with empty stack`);
      } else {
        const lastOpen = tagStack.pop();
        if (lastOpen.name !== closingName) {
          console.log(`Line ${i + 1}: Tag mismatch! Expected </${lastOpen.name}> (opened on line ${lastOpen.line}), but found </${closingName}>`);
        }
      }
    } else {
      tagStack.push({ name: tagName, line: i + 1 });
    }
  }
}

if (tagStack.length > 0) {
  console.log("Unclosed tags remaining in stack:");
  tagStack.forEach(t => {
    console.log(`- <${t.name}> opened on line ${t.line}`);
  });
} else {
  console.log("All tags matched successfully!");
}
