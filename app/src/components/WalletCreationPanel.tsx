import { useState } from 'react'
import { Copy, Eye, EyeOff, Wallet, Download, AlertTriangle, CheckCircle2, Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  maskPrivateKey,
  maskMnemonic,
  saveWalletToStorage,
  loadWalletFromStorage,
  clearWalletFromStorage,
  hasSavedWallet,
  getSavedWalletAddress,
  type WalletCreationResult,
  type ImportedWallet,
} from '../lib/walletCreation'

export function WalletCreationPanel() {
  const [activeTab, setActiveTab] = useState<'create' | 'import' | 'unlock'>('create')
  const [wallet, setWallet] = useState<WalletCreationResult | ImportedWallet | null>(null)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Import states
  const [importMnemonic, setImportMnemonic] = useState('')
  const [importPrivateKey, setImportPrivateKey] = useState('')
  
  // Security states
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [savedWalletExists, setSavedWalletExists] = useState(hasSavedWallet())
  const [savedAddress, setSavedAddress] = useState(getSavedWalletAddress())

  const handleGenerateWallet = async () => {
    try {
      setLoading(true)
      const newWallet = generateWallet()
      setWallet(newWallet)
      toast.success('Wallet created successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleImportMnemonic = async () => {
    try {
      setLoading(true)
      const imported = importFromMnemonic(importMnemonic)
      setWallet(imported)
      setImportMnemonic('')
      toast.success('Wallet imported from mnemonic!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleImportPrivateKey = async () => {
    try {
      setLoading(true)
      const imported = importFromPrivateKey(importPrivateKey)
      setWallet(imported)
      setImportPrivateKey('')
      toast.success('Wallet imported from private key!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWallet = async () => {
    if (!wallet) return
    
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      await saveWalletToStorage(wallet.privateKey, password)
      setSavedWalletExists(true)
      setSavedAddress(wallet.address)
      setPassword('')
      setConfirmPassword('')
      toast.success('Wallet saved securely!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockWallet = async () => {
    try {
      setLoading(true)
      const unlockedWallet = await loadWalletFromStorage(unlockPassword)
      setWallet(unlockedWallet)
      setUnlockPassword('')
      toast.success('Wallet unlocked!')
      setActiveTab('create')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unlock wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleClearWallet = () => {
    if (confirm('Are you sure you want to delete your saved wallet? This cannot be undone unless you have backed up your recovery phrase.')) {
      clearWalletFromStorage()
      setSavedWalletExists(false)
      setSavedAddress(null)
      setWallet(null)
      toast.success('Wallet cleared from storage')
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  const downloadBackup = () => {
    if (!wallet || !('mnemonic' in wallet)) return
    
    const backup = {
      address: wallet.address,
      mnemonic: wallet.mnemonic,
      createdAt: new Date().toISOString(),
      warning: 'KEEP THIS FILE SECURE - Anyone with this mnemonic can access your funds!',
    }
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verdexis-wallet-${wallet.address.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup file downloaded')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[#E5E5E5]">Create Your Wallet</h1>
        <p className="text-[#737373]">
          Generate a new Ethereum wallet or import an existing one
        </p>
      </div>

      {savedWalletExists && !wallet && (
        <Card className="p-4 bg-[#0C8B44]/10 border-[#0C8B44]/30">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#0C8B44]" />
            <div className="flex-1">
              <p className="font-medium text-[#E5E5E5]">Saved Wallet Found</p>
              <p className="text-sm text-[#737373]">{savedAddress}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('unlock')}>
              Unlock
            </Button>
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Create New</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="unlock" disabled={!savedWalletExists}>
            Unlock Saved
          </TabsTrigger>
        </TabsList>

        {/* CREATE TAB */}
        <TabsContent value="create" className="space-y-6">
          {!wallet ? (
            <Card className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-[#ff9800]/10 border border-[#ff9800]/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-[#ff9800] shrink-0 mt-0.5" />
                <div className="text-sm text-[#E5E5E5]">
                  <p className="font-medium mb-1">Security Warning</p>
                  <p className="text-[#737373]">
                    Your recovery phrase is the ONLY way to restore your wallet. Write it down and store it
                    securely offline. Never share it with anyone.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleGenerateWallet}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                <Wallet className="w-5 h-5 mr-2" />
                {loading ? 'Generating...' : 'Generate New Wallet'}
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Address */}
              <Card className="p-4">
                <Label className="text-sm text-[#A0A0A0]">Wallet Address</Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm font-mono text-[#E5E5E5] break-all">
                    {wallet.address}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(wallet.address, 'Address')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </Card>

              {/* Mnemonic (only for generated wallets) */}
              {'mnemonic' in wallet && (
                <Card className="p-4 bg-[#f44336]/10 border-[#f44336]/30">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-[#E5E5E5] font-medium">
                      Recovery Phrase (12 words)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMnemonic(!showMnemonic)}
                      >
                        {showMnemonic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={downloadBackup}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-[#1a1a1a] border border-[#f44336]/40 rounded-lg">
                    <code className="text-sm font-mono text-[#ff8a80] break-all">
                      {showMnemonic ? wallet.mnemonic : maskMnemonic(wallet.mnemonic)}
                    </code>
                  </div>
                  {showMnemonic && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => copyToClipboard(wallet.mnemonic, 'Mnemonic')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Recovery Phrase
                    </Button>
                  )}
                </Card>
              )}

              {/* Private Key */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-[#A0A0A0]">Private Key</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="px-3 py-2 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg">
                  <code className="text-sm font-mono text-[#737373] break-all">
                    {showPrivateKey ? wallet.privateKey : maskPrivateKey(wallet.privateKey)}
                  </code>
                </div>
              </Card>

              {/* Save to Storage */}
              {!savedWalletExists && (
                <Card className="p-4 bg-[#0C8B44]/10 border-[#0C8B44]/30">
                  <Label className="text-sm text-[#E5E5E5] font-medium mb-3 block">
                    Save Wallet (Optional)
                  </Label>
                  <p className="text-xs text-[#737373] mb-4">
                    Encrypt and save your wallet locally. You'll need a password to unlock it.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Input
                        type="password"
                        placeholder="Enter password (min 8 characters)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSaveWallet}
                      disabled={loading || !password || password !== confirmPassword}
                      className="w-full"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Save Wallet Securely
                    </Button>
                  </div>
                </Card>
              )}

              {savedWalletExists && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-[#4caf50]" />
                    <span className="text-sm font-medium text-[#E5E5E5]">Wallet Saved</span>
                  </div>
                  <p className="text-xs text-[#737373] mb-3">
                    Your wallet is encrypted and saved to your browser's local storage.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearWallet}
                    className="w-full"
                  >
                    Clear Saved Wallet
                  </Button>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* IMPORT TAB */}
        <TabsContent value="import" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div>
              <Label className="text-sm text-[#E5E5E5] mb-2 block">
                Import from Recovery Phrase
              </Label>
              <textarea
                placeholder="Enter your 12 or 24 word recovery phrase"
                value={importMnemonic}
                onChange={(e) => setImportMnemonic(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-[#E5E5E5] placeholder-[#737373] focus:border-[#0C8B44] outline-none transition-colors min-h-[100px]"
              />
              <Button
                onClick={handleImportMnemonic}
                disabled={loading || !importMnemonic.trim()}
                className="w-full mt-3"
              >
                Import from Mnemonic
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#ffffff10]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0a0a0a] px-2 text-[#737373]">Or</span>
              </div>
            </div>

            <div>
              <Label className="text-sm text-[#E5E5E5] mb-2 block">
                Import from Private Key
              </Label>
              <Input
                type="password"
                placeholder="0x..."
                value={importPrivateKey}
                onChange={(e) => setImportPrivateKey(e.target.value)}
              />
              <Button
                onClick={handleImportPrivateKey}
                disabled={loading || !importPrivateKey.trim()}
                className="w-full mt-3"
              >
                Import from Private Key
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* UNLOCK TAB */}
        <TabsContent value="unlock" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="text-center space-y-2 mb-4">
              <Unlock className="w-12 h-12 mx-auto text-[#0C8B44]" />
              <h3 className="font-medium text-[#E5E5E5]">Unlock Your Wallet</h3>
              <p className="text-sm text-[#737373]">
                Enter your password to unlock: {savedAddress}
              </p>
            </div>

            <div>
              <Input
                type="password"
                placeholder="Enter wallet password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUnlockWallet()}
              />
            </div>

            <Button
              onClick={handleUnlockWallet}
              disabled={loading || !unlockPassword}
              className="w-full"
            >
              <Unlock className="w-4 h-4 mr-2" />
              {loading ? 'Unlocking...' : 'Unlock Wallet'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearWallet}
              className="w-full text-[#f44336] hover:text-[#ff8a80]"
            >
              Forget This Wallet
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
