# ZION Security Keys Backup

**Created:** November 10, 2025  
**Location:** `~/ZION_KEYS/`  
**Permissions:** `700` (directory), `600` (files)

## 📁 Contents

### 1. OpenAI API Key
- **File:** `OPENAI_API_KEY.txt`
- **Purpose:** OpenAI GPT-4 API access for AI features
- **Usage:** Set as `OPENAI_API_KEY` environment variable
- **Original Location:** `/Users/yeshuae/Desktop/ZION/public_html/ai.key`

### 2. GitHub Personal Access Token
- **File:** `GITHUB_TOKEN.txt`
- **Purpose:** GitHub repository access (Zion-2.9, Universal-Miner)
- **User:** Yose144
- **Permissions:** repo, workflow, write:packages
- **Usage:** `git push` authentication, GitHub API calls
- **Original Location:** `/Users/yeshuae/Desktop/ZION/public_html/git.key`

### 3. SSH Keys Information
- **File:** `SSH_KEYS_INFO.txt`
- **Purpose:** Complete SSH configuration and deployment commands
- **Includes:**
  - ZION Deployment Key (`~/.ssh/zion_deployment_key`)
  - SSH config for production server (91.98.122.165)
  - Deployment commands (rsync)
  - Server access commands

## 🔐 Security

- **Directory permissions:** `drwx------` (700) - Owner only
- **File permissions:** `-rw-------` (600) - Owner read/write only
- **Location:** Outside of git repositories
- **Backup:** Keep secure offline backup

## 🚀 Usage Examples

### Deploy Website
\`\`\`bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9/website-v2.8.9
npm run build
rsync -avz --delete -e "ssh -i ~/.ssh/zion_deployment_key" out/ root@91.98.122.165:/var/www/zionterranova.com/
ssh -i ~/.ssh/zion_deployment_key root@91.98.122.165 "systemctl restart nginx"
\`\`\`

### Git Push with Token
\`\`\`bash
export GITHUB_TOKEN=$(cat ~/ZION_KEYS/GITHUB_TOKEN.txt | head -1)
git push https://Yose144:$GITHUB_TOKEN@github.com/Yose144/Zion-2.9.git main
\`\`\`

### OpenAI API Usage
\`\`\`bash
export OPENAI_API_KEY=$(grep OPENAI_API_KEY ~/ZION_KEYS/OPENAI_API_KEY.txt | cut -d'=' -f2)
\`\`\`

## 📌 Important Notes

1. **Never commit these files to git**
2. **Keep backup on secure external drive**
3. **Rotate keys periodically (every 3-6 months)**
4. **Revoke immediately if compromised**

## 🔄 Key Rotation Checklist

- [ ] Generate new GitHub Personal Access Token
- [ ] Update deployment scripts
- [ ] Test authentication
- [ ] Revoke old token
- [ ] Update backup

## 🆘 Emergency Contacts

- **GitHub Account:** Yose144
- **Server IP:** 91.98.122.165
- **Domain:** www.zionterranova.com
- **OpenAI Account:** (linked to account email)

---

**Last Updated:** November 10, 2025  
**Next Review:** February 10, 2026
