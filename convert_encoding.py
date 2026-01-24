import json

with open('products.json', 'r', encoding='utf-16-le') as f:
    content = f.read()

with open('products_utf8.json', 'w', encoding='utf-8') as f:
    f.write(content)
