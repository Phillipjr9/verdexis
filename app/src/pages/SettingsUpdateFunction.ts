  const update = <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    localStorage.setItem('verdexis_prefs', JSON.stringify(next))
    if (key === 'name' || key === 'email' || key === 'username') {
      const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
      localStorage.setItem('verdexis_auth', JSON.stringify({ ...auth, [key]: value }))
      window.dispatchEvent(new Event('verdexis:profile'))
    }
    if (key === 'theme') {
      applyTheme(value as UserPrefs['theme'])
      window.dispatchEvent(new Event('verdexis:prefs'))
    }
    if (key === 'reducedMotion') document.documentElement.classList.toggle('reduce-motion', !!value)
    if (key === 'compactDensity') document.documentElement.classList.toggle('compact-ui', !!value)
    if (key === 'hideBalances') document.documentElement.classList.toggle('hide-balances', !!value)
    
    // Sync to API
    if (getToken()) {
      const patch: Record<string, unknown> = {}
      if (key === 'name') patch.name = value
      else if (key === 'username') patch.username = (value as string).trim().toLowerCase() || null
      else if (key === 'twoFactorEnabled') patch.twoFactor = value
      else patch.prefs = next
      
      api.patchProfile(patch)
        .then(() => {
          if (key !== 'username') toast.success('Saved')
        })
        .catch((err) => {
          if (key === 'username') toast.error((err as { error?: string }).error || 'Username unavailable')
          else toast.error('Failed to save preference')
        })
    } else {
      if (key !== 'username') toast.success('Saved locally')
    }
  }
