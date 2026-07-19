function PasskeysCard() {
  return (
    <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <div className="flex items-start gap-3">
        <Fingerprint className="w-5 h-5 text-[#0C8B44] mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[#E5E5E5]">Passkeys</p>
          <p className="text-xs text-[#737373] mt-1">
            Sign in with your fingerprint, face, or security key. Passkeys are faster and more secure than passwords.
          </p>
          <p className="text-xs text-[#FF9800] mt-2 font-medium">
            ⚠️ Passkeys require HTTPS or a production domain. This feature is available when deployed to production.
          </p>
        </div>
      </div>
    </div>
  )
}
