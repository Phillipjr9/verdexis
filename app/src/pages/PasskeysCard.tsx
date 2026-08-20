import { useEffect, useState } from 'react'
import { Fingerprint, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  listPasskeys,
  registerPasskey,
  deletePasskey,
  isPasskeySupported,
  type Passkey,
} from '../lib/passkeys'

export default function PasskeysCard() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const supported = isPasskeySupported()

  function load() {
    setLoading(true)
    listPasskeys()
      .then(setPasskeys)
      .catch(() => setPasskeys([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function onRegister() {
    if (!supported) {
      toast.error('Passkeys are not supported in this browser')
      return
    }
    const name = window.prompt('Device name (e.g. MacBook, iPhone)', 'My device') || 'My device'
    setBusy(true)
    try {
      await registerPasskey(name.trim() || 'My device')
      toast.success('Passkey registered')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Remove this passkey?')) return
    setBusy(true)
    try {
      await deletePasskey(id)
      toast.success('Passkey removed')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <div className="flex items-start gap-3">
        <Fingerprint className="w-5 h-5 text-[#0C8B44] mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[#E5E5E5]">Passkeys</p>
          <p className="text-xs text-[#737373] mt-1">
            Sign in with your fingerprint, face, or security key. Passkeys are faster and more secure than passwords.
          </p>

          {!supported && (
            <p className="text-xs text-[#FF9800] mt-2 font-medium">
              Passkeys require a supporting browser and HTTPS (or localhost).
            </p>
          )}

          {loading ? (
            <p className="text-xs text-[#737373] mt-3">Loading…</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {passkeys.map((pk) => (
                <li key={pk.id} className="flex items-center justify-between gap-2 text-xs text-[#E5E5E5] bg-[#0f1619] rounded-lg px-3 py-2 border border-[#ffffff08]">
                  <span>
                    {pk.deviceName}
                    {pk.lastUsedAt && (
                      <span className="text-[#737373] ml-2">
                        · last used {new Date(pk.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(pk.id)}
                    className="text-[#f44336] hover:opacity-80 disabled:opacity-40"
                    aria-label="Remove passkey"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {passkeys.length === 0 && (
                <li className="text-xs text-[#737373]">No passkeys registered yet.</li>
              )}
            </ul>
          )}

          <button
            type="button"
            disabled={busy || !supported}
            onClick={onRegister}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {busy ? 'Working…' : 'Add passkey'}
          </button>
        </div>
      </div>
    </div>
  )
}
