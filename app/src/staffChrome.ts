function currentRole() {
  try {
    const raw = localStorage.getItem('verdexis_auth')
    return raw ? String((JSON.parse(raw) as { role?: string }).role || 'user') : 'user'
  } catch {
    return 'user'
  }
}

function ensureBar() {
  const role = currentRole()
  const staff = role === 'admin' || role === 'subadmin'
  let bar = document.getElementById('verdexis-staff-chrome')
  if (!staff) {
    bar?.remove()
    return
  }
  if (!bar) {
    bar = document.createElement('a')
    bar.id = 'verdexis-staff-chrome'
    bar.href = '/admin'
    bar.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:200;background:#0C8B44;color:#fff;padding:10px 14px;border-radius:10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.35)'
    document.body.appendChild(bar)
  }
  bar.textContent = role === 'admin' ? 'Admin console' : 'Sub-admin console'
}

window.addEventListener('storage', ensureBar)
window.addEventListener('verdexis:profile', ensureBar)
setInterval(ensureBar, 4000)
if (document.readyState === 'complete') ensureBar()
else window.addEventListener('load', ensureBar)
