<?php
$file = $argv[1] ?? "/home/ssh-685961/public_html/V2/email-templates/presale-confirmation-rasta.html";
$content = file_get_contents($file);

$mnemonicSection = '
                                <!-- 12-word Mnemonic Seed Phrase -->
                                <div style="background: #050505; border-radius: 12px; padding: 20px; margin-bottom: 18px; border: 1px solid rgba(255,215,0,0.3);">
                                    <p style="color: #8a8f94; font-size: 12px; margin: 0 0 10px 0; letter-spacing: 0.5px;">🔑 Obnovovací fráze (12 slov) - BEZPEČNĚ ULOŽIT!</p>
                                    <p style="color: #FFD700; font-size: 14px; font-family: monospace; word-break: break-word; margin: 0; font-weight: 600; line-height: 1.8; background: rgba(255,215,0,0.08); padding: 12px; border-radius: 8px;">{{ZION_MNEMONIC}}</p>
                                </div>
                                
                                <!-- QR Code (if available) -->';

$content = str_replace("<!-- QR Code (if available) -->", $mnemonicSection, $content);
file_put_contents($file, $content);
echo "Mnemonic section added successfully!\n";
