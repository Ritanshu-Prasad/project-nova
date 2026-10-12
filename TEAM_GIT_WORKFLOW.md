# 🚀 Project NOVA — Team Git Workflow Guide

Welcome aboard! This guide explains how to safely and quickly contribute to the codebase without breaking the live Vercel demo or fighting merge conflicts.

---

## ⚡ The 30-Second Summary
1. You can push directly to `main` — no mandatory PR approval delays needed!
2. Your push will automatically be verified by GitHub Actions.
3. Clean code automatically deploys to the live demo (`stable` branch). Broken code is safely quarantined.

---

## 🛠️ Step 1: One-Time Local Setup (Do This Once)

To enable the local safety guard that stops broken builds before they leave your laptop, run this once:

```bash
cd frontend
npm run setup-hooks
```
*What this does:* It activates `.githooks/pre-push`. Every time you push, Git will quickly run a 5-second build check on your machine to ensure no TypeScript syntax errors slip through.

---

## 💻 Step 2: Everyday Workflow

Follow this cycle every time you work on a feature or fix:

### 1. Always start by pulling the latest changes
```bash
git pull origin main
```

### 2. Make your changes and test them locally
* Run the frontend dev server:
  ```bash
  cd frontend
  npm run dev
  ```
* Run the backend (if modifying Python endpoints):
  ```bash
  uvicorn backend.main:app --reload --port 8000
  ```

### 3. Verify that your code compiles cleanly
Before committing, do a quick sanity check:
```bash
cd frontend
npm run build
```
*(If this succeeds with 0 errors, you are 100% good to push!)*

### 4. Stage, commit, and push
```bash
git add .
git commit -m "feat: add your feature description"
git push origin main
```

---

## 🔍 Step 3: What Happens After You Push?

Behind the scenes, our two-layer safety net protects the live demo:

```
Your Push to main
       │
       ▼
 [Pre-Push Hook] ───❌ Failed───► Push rejected on your machine with exact error line.
       │
       ✅ Passed
       │
       ▼
 GitHub Actions CI
       │
       ├─► ❌ Build Failed ──► Flagged with Red ❌. 
       │                       Live site remains 100% SAFE and untouched.
       │
       └─► ✅ Build Passed ──► Automatically promoted to `stable` branch.
                               Vercel live demo updates seamlessly!
```

---

## 🚨 Troubleshooting: "My Push Was Blocked! What Do I Do?"

If your push is rejected by the pre-push guard or fails in GitHub Actions:

1. **Don't panic!** The live demo was not affected.
2. **Read the error message:** Git will output the exact file and line number:
   ```
   src/ui/lounge/StudyMode.tsx(42,10): error TS2304: Cannot find name 'myVariable'.
   ```
3. **Fix the error** in that file.
4. **Test it:** Run `npm run build` inside `frontend`.
5. **Commit the fix and push again:**
   ```bash
   git add .
   git commit -m "fix: resolve import error in StudyMode"
   git push origin main
   ```

---

## 🛡️ The 3 Golden Rules
1. **Never use `git push --no-verify`** unless you have coordinated with the team lead. Bypassing checks can deploy broken code.
2. **Never commit `.env` files** containing private API keys (e.g. Nebius keys, Google OAuth secrets).
3. **Always run `git pull origin main`** before starting work to avoid merge conflicts.

---
*Happy coding, pilots! Let's win this hackathon.* 🌌
