# GitHub Deployment Guide

## 🚀 Quick Deploy to GitHub Pages

1. **Create Repository** on GitHub.com named "svk-blueprint"

2. **Upload Files**
   ```bash
   git clone https://github.com/YOUR-USERNAME/svk-blueprint.git
   cd svk-blueprint
   # Copy all files here
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Enable Pages**
   - Settings → Pages
   - Source: main branch → Save

4. **Generate Icons** (Required)
   - Visit https://realfavicongenerator.net/
   - Upload icons/icon-base.svg
   - Download and place in icons/

5. **Visit:** https://YOUR-USERNAME.github.io/svk-blueprint

## ✅ Pre-Deployment Checklist

- [ ] All files uploaded
- [ ] Icons generated (8 sizes)
- [ ] HTTPS enabled
- [ ] Service worker registers
- [ ] PWA installs
- [ ] Offline mode works

## 🔧 Alternative Deployments

**Vercel:** Import GitHub repo → Auto-deploy
**Netlify:** Drag & drop folder → Deploy
**Traditional:** Upload via FTP, enable SSL

## 📝 Required Files

- index.html, styles.css, app.js
- service-worker.js, manifest.json
- icons/ (with 8 PNG files)
- .htaccess (for Apache)

**Icon Sizes:** 72, 96, 128, 144, 152, 192*, 384, 512*
(*required for PWA)

See README.md for full documentation.
