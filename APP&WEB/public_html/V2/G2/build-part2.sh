#!/bin/bash
# Extract header (lines 1-116)
head -n 116 part-2.html > part-2-new.html

# Add opening main tag
echo '  <!-- ========== READING CONTAINER ========== -->' >> part-2-new.html
echo '  <main class="reading-container">' >> part-2-new.html
echo '' >> part-2-new.html

# Extract chapters 5-9 + epilog from genesis-2.html (lines 230-960 approximately)
sed -n '230,960p' ../genesis-2.html | sed 's/class="chapter-section"/class="chapter-article"/g' | sed 's/class="rasta-divider"/class="chapter-icon-divider"/g' | sed 's/<div class="line"><\/div><span class="icon">/✧/g' | sed 's/<\/span><div class="line"><\/div>//g' >> part-2-new.html

# Add closing main tag
echo '' >> part-2-new.html
echo '  </main>' >> part-2-new.html

# Extract footer (last 50 lines from part-2.html)
tail -n 50 part-2.html >> part-2-new.html

# Replace old with new
mv part-2-new.html part-2.html
echo "Done!"
