# ✅ VERDEXIS Deployment Checklist

Print this and check off as you go!

---

## 📦 Pre-Deployment (5 min)

- [ ] All code committed to GitHub
- [ ] `amplify.yml` exists in root
- [ ] `server/.env.example` reviewed
- [ ] `app/.env.example` reviewed

---

## 🚂 Railway Backend (15 min)

- [ ] Signed up at railway.app
- [ ] Created new project from GitHub
- [ ] Set Root Directory to `server`
- [ ] Added PostgreSQL database
- [ ] Set environment variables:
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_SECRET=<generated>`
  - [ ] `ADMIN_EMAILS=<your-email>`
  - [ ] `DATABASE_URL` (auto-created)
- [ ] Generated public domain
- [ ] Ran database migration
- [ ] Tested `/api/health` endpoint
- [ ] **Backend URL**: _______________________________

---

## ☁️ AWS Amplify Frontend (10 min)

- [ ] Signed into AWS Console
- [ ] Connected GitHub repo to Amplify
- [ ] Selected `main` branch
- [ ] Confirmed `amplify.yml` detected
- [ ] Set Root Directory to `app`
- [ ] Added environment variables:
  - [ ] `VITE_API_URL=<railway-url>`
- [ ] Started deployment
- [ ] Waited for build (3-5 min)
- [ ] Copied Amplify URL
- [ ] **Frontend URL**: _______________________________

---

## 🔗 Connect Frontend & Backend (5 min)

- [ ] Updated Railway `CORS_ORIGIN` with Amplify URL
- [ ] Updated Railway `APP_BASE_URL` with Amplify URL
- [ ] Waited for auto-redeploy (30 sec)
- [ ] Refreshed frontend

---

## ✨ Final Testing (5 min)

- [ ] Homepage loads
- [ ] Can sign up new account
- [ ] Can login
- [ ] Admin dashboard works (if admin email set)
- [ ] Can view Markets page
- [ ] Can make a test trade
- [ ] Wallet balance updates
- [ ] Dashboard shows holdings

---

## 🎉 Launch!

- [ ] Share URL with team
- [ ] Set up custom domain (optional)
- [ ] Configure email service (optional)
- [ ] Celebrate 🍾

---

## 📞 Emergency Contacts

**Backend issues**: Check Railway logs
**Frontend issues**: Check Amplify build logs
**Database issues**: Railway PostgreSQL status

**Quick fixes**:
- CORS error → Update `CORS_ORIGIN` in Railway
- Build error → Check `amplify.yml` indentation
- API 503 → Check Railway deployment status

---

**Estimated total time**: 30-40 minutes

**Monthly cost**: ~$5-10 (Railway $5 free credit covers most of it)

**You got this!** 💪
