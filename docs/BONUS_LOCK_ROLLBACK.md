# Bonus lock rollback

Use this if the unified bonus-lock change needs to come off production.

## What to roll back

These two commits on `main`:

| Order | SHA | Message |
|---|---|---|
| 1 | `43710e14f0c8041418e1f3349a8357e848a1d429` | Unify bonus withdrawal lock so grant, withdraw, and admin unlock stay in sync |
| 2 | `912af47d4a13bac4b9b08f0e159cd45d9e3be461` | Sync admin bonus grant/unlock with unified bonusLocked flags |

Safe restore point (state immediately before those commits):

`e90552322c39c6b0f74af5b4fc9ece67e93b4567`

Files those commits touched:

- `server/src/services/bonusLock.ts` (added)
- `server/src/services/signupBonus.ts`
- `server/src/routes/walletTransactions.ts`
- `server/src/routes/adminBonus.ts`

## GitHub (do this first)

From a clean checkout of `main`:

```bash
git fetch origin
git checkout main
git pull origin main

# Preferred: revert the two commits, newest first, without rewriting history
git revert --no-edit 912af47d4a13bac4b9b08f0e159cd45d9e3be461
git revert --no-edit 43710e14f0c8041418e1f3349a8357e848a1d429

git push origin main
```

GitHub website path if you do not want the CLI:

1. Open https://github.com/Phillipjr9/verdexis/commit/912af47d4a13bac4b9b08f0e159cd45d9e3be461
2. Click **Revert** and merge that revert PR / commit to `main`
3. Repeat for https://github.com/Phillipjr9/verdexis/commit/43710e14f0c8041418e1f3349a8357e848a1d429

Do **not** use `git reset --hard` on `main` unless you are sure no later commits must stay. Reset rewrites history and will fight Vercel / GitLab remotes.

Hard reset only if `main` has nothing after `912af47d` that you need:

```bash
git reset --hard e90552322c39c6b0f74af5b4fc9ece67e93b4567
git push --force origin main   # last resort only
```

## GitLab mirror (after GitHub)

Same commit must land on https://gitlab.com/phillipjr9-group/verdexis

```bash
git push gitlab main
# or, if GitLab is a second remote named gitlab:
git push gitlab main:main
```

If GitLab already pulled the bonus-lock commits and you used revert on GitHub, push those new revert commits. Do not force-push GitLab unless GitHub was force-pushed too.

## Vercel

A push to GitHub `main` should redeploy. If it does not:

1. Vercel → project → Deployments
2. Open the deployment built from `e90552322c39c6b0f74af5b4fc9ece67e93b4567`
3. **Promote to Production**

Or redeploy the latest `main` after the revert commits exist.

## After rollback: user lock flags

Rolling back code does **not** rewrite user `prefs` already saved in the database.

A user may still have:

- `prefs.bonusLocked = true`
- `prefs.bonusLock.active = true`

To clear one user without waiting for the new unlock path:

```js
const u = await prisma.user.findUnique({ where: { id: USER_ID } })
const prefs = JSON.parse(u.prefs || '{}')
delete prefs.bonusLocked
delete prefs.bonusLockedAmountUsd
delete prefs.bonusLockedAt
delete prefs.bonusLock
prefs.bonusUnlockedAt = new Date().toISOString()
await prisma.user.update({ where: { id: u.id }, data: { prefs: JSON.stringify(prefs) } })
```

Admin UI path while the new code is still live: **Admin → Users → [user] → Contact & signup bonus → Unlock bonus withdrawals**.

Ledger lock (`signup-bonus-unlock:{userId}` financial events / `accountBalance.lockedMinorUnits`) is separate. Reverting code does not un-credit or re-lock USD on its own.
