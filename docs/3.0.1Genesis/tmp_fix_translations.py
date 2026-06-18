import re

path = r"C:\Users\yosef\Desktop\Zion\2.9.6-main\APP&WEB\website-v2.9\src\lib\translations.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix numeric keys: key starting with digit before colon
content = re.sub(r"^([ \t]+)(\d[^:\s]*):", r"\1'\2':", content, flags=re.MULTILINE)

# Fix unfinished New Year's Eve strings
content = content.replace(
    "en: 'V3 Mainnet is in preparation — target launch 31 December 2026 (New Year\\' }",
    'en: "V3 Mainnet is in preparation — target launch 31 December 2026 (New Year\'s Eve). Core + Edge topology is in testing, mining test active, bridge in preparation on Base Mainnet." }'
)
content = content.replace(
    "en: 'Target: 31 December 2026 (New Year\\' }",
    'en: "Target: 31 December 2026 (New Year\'s Eve)" }'
)

# Fix what's next string
content = content.replace(
    "what: { cs: 'Co dal', en: 'What\\' }",
    'what: { cs: "Co dalsiho", en: "What\'s next" }'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
