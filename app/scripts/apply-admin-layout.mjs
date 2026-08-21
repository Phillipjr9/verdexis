#!/usr/bin/env node
/**
 * One-shot: wrap remaining admin pages in AdminLayout.
 * Run from repo root (or app/):
 *   node scripts/apply-admin-layout.mjs
 * Then review git diff and fix any JSX balance issues.
 */
const fs = require('fs')
const path = require('path')

const pages = {
  'AdminUsers.tsx': { title: 'Users', subtitle: 'Search, filter, and manage accounts' },
  'AdminDeposits.tsx': { title: 'Deposit settings', subtitle: 'Fiat and platform deposit configuration' },
  'AdminSettings.tsx': { title: 'Platform settings', subtitle: 'Fees, bank details, and system config' },
  'AdminTransfer.tsx': { title: 'Transfer funds', subtitle: 'Move balances between accounts' },
  'AdminReferrals.tsx': { title: 'Referrals', subtitle: 'Referral program management' },
  'AdminSignupBonus.tsx': { title: 'Signup bonus', subtitle: 'New-user bonus configuration' },
  'AdminAnalytics.tsx': { title: 'Analytics', subtitle: 'Extended charts and time ranges' },
  'AdminDepositAddresses.tsx': { title: 'Deposit addresses', subtitle: 'Per-user wire, ACH, and crypto destinations' },
}

const dir = path.join(__dirname, '..', 'src', 'pages')

for (const [file, meta] of Object.entries(pages)) {
  const fp = path.join(dir, file)
  if (!fs.existsSync(fp)) {
    console.warn('skip missing', file)
    continue
  }
  let t = fs.readFileSync(fp, 'utf8')
  if (t.includes("from '../components/AdminLayout'")) {
    console.log('already done', file)
    continue
  }
  if (!t.includes("from '../components/Navigation'")) {
    console.warn('no Navigation import', file)
    continue
  }
  t = t.replace(
    "import Navigation from '../components/Navigation'",
    "import AdminLayout from '../components/AdminLayout'",
  )
  t = t.replace(/\s*<Link to="\/admin"[^>]*>[\s\S]*?<\/Link>\s*/g, '\n')

  const shellRe = /return \(\s*<div className="min-h-screen[^"]*">\s*<Navigation \/>\s*/
  if (shellRe.test(t)) {
    t = t.replace(
      shellRe,
      `return (\n    <AdminLayout\n      title="${meta.title}"\n      subtitle="${meta.subtitle}"\n    >\n`,
    )
  } else {
    t = t.replace(
      /<div className="min-h-screen[^"]*">\s*<Navigation \/>/g,
      `<AdminLayout title="${meta.title}" subtitle="${meta.subtitle}">`,
    )
  }

  t = t.replace(/<Navigation \/>\n?/g, '')

  // Prefer closing AdminLayout before CreateUserModal / helper functions
  const marker = t.indexOf('\nfunction ', t.indexOf('export default function'))
  if (marker !== -1) {
    let head = t.slice(0, marker)
    const tail = t.slice(marker)
    if (head.includes('AdminLayout') && !head.includes('</AdminLayout>')) {
      head = head.replace(/\n    <\/div>\n  \)\n\}?\s*$/, '\n    </AdminLayout>\n  )\n}\n')
      if (!head.includes('</AdminLayout>')) {
        head = head.replace(/\n  \)\n\}\s*$/, '\n    </AdminLayout>\n  )\n}\n')
      }
    }
    t = head + tail
  }

  fs.writeFileSync(fp, t)
  console.log('updated', file)
}

console.log('Done. Review: git diff app/src/pages')
