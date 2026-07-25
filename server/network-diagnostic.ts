import { createConnection } from 'net'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const diagnoseNetworkIssues = async () => {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║           SMTP NETWORK DIAGNOSTIC TOOL                         ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  const smtpServers = [
    { name: 'Atlantic Broadband', host: 'smtp.atlanticbb.net', port: 587 },
    { name: 'Atlantic Broadband (Port 25)', host: 'smtp.atlanticbb.net', port: 25 },
    { name: 'Google (Gmail)', host: 'smtp.gmail.com', port: 587 },
    { name: 'Ethereal (Test)', host: 'smtp.ethereal.email', port: 587 },
  ]

  console.log('🔍 TEST 1: CHECKING NETWORK CONNECTIVITY\n')

  // Test DNS resolution
  console.log('Testing DNS resolution...')
  for (const server of smtpServers) {
    try {
      const { stdout } = await execAsync(`nslookup ${server.host}`)
      if (stdout.includes('Address')) {
        console.log(`   ✅ ${server.name} (${server.host}): DNS resolves`)
      }
    } catch (err) {
      console.log(`   ❌ ${server.name} (${server.host}): DNS resolution failed`)
    }
  }

  console.log('\n🔍 TEST 2: CHECKING PORT CONNECTIVITY\n')

  // Test port connectivity
  for (const server of smtpServers) {
    await testPortConnection(server.host, server.port, server.name)
  }

  console.log('\n🔍 TEST 3: CHECKING FIREWALL STATUS\n')

  try {
    const { stdout } = await execAsync('netsh advfirewall show allprofiles')
    if (stdout.includes('State                                 : on')) {
      console.log('   ⚠️  Windows Firewall is ENABLED')
      console.log('   This may be blocking SMTP ports\n')
    } else {
      console.log('   ✅ Windows Firewall is DISABLED or not blocking\n')
    }
  } catch (err) {
    console.log('   ⚠️  Could not check firewall status\n')
  }

  console.log('🔍 TEST 4: CHECKING OPEN PORTS\n')

  try {
    const { stdout } = await execAsync('netstat -an | findstr LISTENING')
    console.log('   Open listening ports on your machine:')
    const lines = stdout.split('\n').slice(0, 5)
    lines.forEach(line => {
      if (line.trim()) console.log(`   ${line.trim()}`)
    })
    console.log()
  } catch (err) {
    console.log('   Could not retrieve port information\n')
  }

  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                    DIAGNOSIS RESULTS                           ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  console.log('📋 POSSIBLE CAUSES & FIXES:\n')

  console.log('CAUSE 1: ISP/Network Blocking SMTP Ports')
  console.log('   Symptoms:')
  console.log('   • All SMTP servers timeout (587, 25)')
  console.log('   • Gmail and Ethereal also fail')
  console.log('   Fix:')
  console.log('   • Use a VPN (ExpressVPN, NordVPN, etc.)')
  console.log('   • Use mobile hotspot to test')
  console.log('   • Contact your ISP about SMTP blocking\n')

  console.log('CAUSE 2: Windows Firewall Blocking')
  console.log('   Symptoms:')
  console.log('   • Firewall is enabled')
  console.log('   • Only your network is affected')
  console.log('   Fix:')
  console.log('   • Open Windows Defender Firewall')
  console.log('   • Click "Allow an app through firewall"')
  console.log('   • Add your Node.js application\n')

  console.log('CAUSE 3: Third-Party Antivirus/Security Software')
  console.log('   Symptoms:')
  console.log('   • Firewall is disabled but still timing out')
  console.log('   • You have Norton, McAfee, Kaspersky, etc.')
  console.log('   Fix:')
  console.log('   • Temporarily disable antivirus')
  console.log('   • Check antivirus firewall settings')
  console.log('   • Add Node.js to antivirus whitelist\n')

  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                    QUICK FIXES TO TRY                          ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  console.log('1️⃣  DISABLE WINDOWS FIREWALL (Temporary Test)')
  console.log('   • Press Win + R')
  console.log('   • Type: wf.msc')
  console.log('   • Click "Windows Defender Firewall Properties"')
  console.log('   • Set all profiles to "Off"')
  console.log('   • Test SMTP again\n')

  console.log('2️⃣  USE A VPN')
  console.log('   • Download free VPN: ProtonVPN, Windscribe')
  console.log('   • Connect to VPN')
  console.log('   • Test SMTP again\n')

  console.log('3️⃣  USE MOBILE HOTSPOT')
  console.log('   • Enable hotspot on your phone')
  console.log('   • Connect your computer to it')
  console.log('   • Test SMTP again\n')

  console.log('4️⃣  USE CLOUD-BASED SMTP (Recommended)')
  console.log('   • SendGrid (cloud-based, rarely blocked)')
  console.log('   • Mailgun (cloud-based, rarely blocked)')
  console.log('   • AWS SES (cloud-based, rarely blocked)\n')

  console.log('5️⃣  CHECK ANTIVIRUS SETTINGS')
  console.log('   • Open your antivirus software')
  console.log('   • Look for "Firewall" or "Network Protection"')
  console.log('   • Add Node.js to whitelist\n')
}

function testPortConnection(host: string, port: number, name: string): Promise<void> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 5000 })

    socket.on('connect', () => {
      console.log(`   ✅ ${name} (${host}:${port}): Port is OPEN`)
      socket.destroy()
      resolve()
    })

    socket.on('timeout', () => {
      console.log(`   ❌ ${name} (${host}:${port}): TIMEOUT (likely blocked)`)
      socket.destroy()
      resolve()
    })

    socket.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED') {
        console.log(`   ❌ ${name} (${host}:${port}): Connection refused`)
      } else if (err.code === 'ETIMEDOUT') {
        console.log(`   ❌ ${name} (${host}:${port}): TIMEOUT (likely blocked)`)
      } else {
        console.log(`   ❌ ${name} (${host}:${port}): ${err.code}`)
      }
      resolve()
    })
  })
}

diagnoseNetworkIssues()
