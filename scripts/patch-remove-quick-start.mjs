/**
 * Build-time: remove the "Quick start" card above Total Balance on Wallet.
 * Safe no-op if the block is already gone.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TARGET = path.join(__dirname, '..', 'app/src/pages/Wallet.tsx')

const BLOCK =
  '          <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-4 sm:p-5 mb-6">\n' +
  '            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">\n' +
  '              <div>\n' +
  '                <p className="text-[11px] uppercase tracking-[0.16em] text-[#737373]">Quick start</p>\n' +
  '                <h2 className="text-base font-medium text-[#E5E5E5] mt-1">Move money in and out without losing context</h2>\n' +
  '                <p className="text-sm text-[#A0A0A0] mt-1">Use the shortcuts below to fund your account, move assets, or review incoming income.</p>\n' +
  '              </div>\n' +
  '              <div className="flex flex-wrap gap-2">\n' +
  '                {[\n' +
  "                  { label: 'Deposit', tab: 'deposit' as TabType, hint: 'Add cash or crypto' },\n" +
  "                  { label: 'Transfer', tab: 'transfer' as TabType, hint: 'Move between wallets' },\n" +
  "                  { label: 'Income', tab: 'income' as TabType, hint: 'View dividends and interest' },\n" +
  '                ].map((action, i) => (\n' +
  '                  <button key={`wallet-quick-${action.label}-${i}`} onClick={() => setActiveTab(action.tab)} className="rounded-full border border-[#ffffff08] bg-[#1a1a1a]/70 px-3 py-2 text-left transition-colors hover:border-[#0C8B44]/30 hover:bg-[#0C8B44]/10">\n' +
  '                    <p className="text-sm font-medium text-[#E5E5E5]">{action.label}</p>\n' +
  '                    <p className="text-xs text-[#737373]">{action.hint}</p>\n' +
  '                  </button>\n' +
  '                ))}\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </div>\n\n'

function main() {
  if (!fs.existsSync(TARGET)) {
    console.log('Wallet.tsx missing — skip quick-start patch')
    return
  }
  let src = fs.readFileSync(TARGET, 'utf8')
  if (!src.includes('Quick start')) {
    console.log('Quick start already removed — skip')
    return
  }
  if (!src.includes(BLOCK)) {
    const next = src.replace(
      /\n          <div className="rounded-2xl border border-\[#ffffff08\] bg-\[#0f1619\]\/50 p-4 sm:p-5 mb-6">[\s\S]*?Quick start[\s\S]*?<\/div>\s*<\/div>\s*\n\n/,
      '\n\n',
    )
    if (next === src || next.includes('Quick start')) {
      console.warn('Quick start patch: pattern not matched; leaving file unchanged')
      return
    }
    src = next
  } else {
    src = src.replace(BLOCK, '')
  }
  fs.writeFileSync(TARGET, src)
  console.log('Removed Quick start card from Wallet.tsx')
}

main()
