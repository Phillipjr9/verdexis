import { useEffect, useState, useRef } from 'react'
import Navigation from '../components/Navigation'
import { aiService, PERSONAS, type AIInsight, type ChatMessage, type PersonaId } from '../lib/aiService'
import { computeTradeStats, computeStats } from '../lib/aiBrain'
import { portfolioStore } from '../lib/portfolioStore'
import { api, newIdempotencyKey } from '../lib/api'
import { Toaster, toast } from 'sonner'
import {
  Bot,
  User,
  Send,
  Sparkles,
  Zap,
  AlertTriangle,
  BrainCircuit,
  RefreshCw,
  Target,
  PanelLeftOpen,
  X,
  Copy,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  CheckCircle,
} from 'lucide-react'

const quickPrompts = [
  'Best markets to buy right now',
  'Risk advisory for my portfolio',
  'Buy 0.01 BTC',
  'Sell 50% of my ETH',
  'Swap BTC for SOL',
  'Market sentiment analysis',
]

interface PendingAction {
  type: 'BUY' | 'SELL' | 'SWAP'
  symbol: string
  name: string
  quantity: number
  price: number
  total: number
  fromCurrency?: string
  toCurrency?: string
  fromAmount?: number
  toAmount?: number
  rate?: number
  msgIndex: number
}

const PERSONA_KEY = 'verdexis_persona'

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your AI financial analyst. I can scan the market for the best buy opportunities, alert you when your holdings are at risk, and execute trades, sells & swaps. Try **\"best markets to buy right now\"** or **\"risk advisory\"** to get started.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [persona, setPersona] = useState<PersonaId>(() => (typeof window !== 'undefined' ? (localStorage.getItem(PERSONA_KEY) as PersonaId | null) || 'verdexis' : 'verdexis'))
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [executing, setExecuting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem(PERSONA_KEY, persona) }, [persona])

  useEffect(() => {
    loadInsights()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadInsights = async () => {
    setInsightsLoading(true)
    const data = await aiService.getPortfolioInsights()
    setInsights(data)
    setInsightsLoading(false)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await aiService.processQuery(userMessage.content, persona)
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        persona,
      }
      setMessages((prev) => {
        const next = [...prev, assistantMessage]
        // Parse __ACTION:...__ token embedded by the AI handler
        const actionMatch = response.match(/__ACTION:(BUY|SELL|SWAP)\|([^_]+)__/)
        if (actionMatch) {
          const parts = actionMatch[2].split('|')
          const actionType = actionMatch[1] as 'BUY' | 'SELL' | 'SWAP'
          if (actionType === 'SWAP') {
            setPendingAction({
              type: 'SWAP',
              symbol: parts[0], name: parts[0],
              quantity: 0, price: 0, total: 0,
              fromCurrency: parts[0], toCurrency: parts[1],
              fromAmount: parseFloat(parts[2]), toAmount: parseFloat(parts[3]),
              rate: parseFloat(parts[4]),
              msgIndex: next.length - 1,
            })
          } else {
            setPendingAction({
              type: actionType,
              symbol: parts[0], name: parts[1],
              quantity: parseFloat(parts[2]),
              price: parseFloat(parts[3]),
              total: parseFloat(parts[4]),
              msgIndex: next.length - 1,
            })
          }
        }
        return next
      })
    } catch (err) {
      // Surface the failure in-line so the user sees something went wrong
      // instead of a frozen "thinking..." state. Don't throw - keep the input usable.
      const detail = err instanceof Error ? err.message : 'Unknown error'
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Sorry, I couldn’t process that request: ${detail}. Please try again.`,
        timestamp: new Date(),
        persona,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    // Auto-send after a tick so the input state is committed
    setTimeout(() => {
      setInput('')
      if (loading) return
      const userMessage: ChatMessage = { role: 'user', content: prompt, timestamp: new Date() }
      setMessages((prev) => [...prev, userMessage])
      setLoading(true)
      aiService.processQuery(prompt, persona).then((response) => {
        const assistantMessage: ChatMessage = { role: 'assistant', content: response, timestamp: new Date(), persona }
        setMessages((prev) => {
          const next = [...prev, assistantMessage]
          const actionMatch = response.match(/__ACTION:(BUY|SELL|SWAP)\|([^_]+)__/)
          if (actionMatch) {
            const parts = actionMatch[2].split('|')
            const actionType = actionMatch[1] as 'BUY' | 'SELL' | 'SWAP'
            if (actionType === 'SWAP') {
              setPendingAction({ type: 'SWAP', symbol: parts[0], name: parts[0], quantity: 0, price: 0, total: 0, fromCurrency: parts[0], toCurrency: parts[1], fromAmount: parseFloat(parts[2]), toAmount: parseFloat(parts[3]), rate: parseFloat(parts[4]), msgIndex: next.length - 1 })
            } else {
              setPendingAction({ type: actionType, symbol: parts[0], name: parts[1], quantity: parseFloat(parts[2]), price: parseFloat(parts[3]), total: parseFloat(parts[4]), msgIndex: next.length - 1 })
            }
          }
          return next
        })
      }).catch((err) => {
        const detail = err instanceof Error ? err.message : 'Unknown error'
        setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I couldn't process that request: ${detail}. Please try again.`, timestamp: new Date(), persona }])
      }).finally(() => setLoading(false))
    }, 0)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleClearChat = () => {
    setMessages([{
      role: 'assistant',
      content: "Hello! I'm your AI financial analyst. I can scan the market for the best buy opportunities, alert you when your holdings are at risk, and execute trades, sells & swaps. Try **\"best markets to buy right now\"** or **\"risk advisory\"** to get started.",
      timestamp: new Date(),
    }])
    aiService.resetMemory()
    setPendingAction(null)
  }

  const handleExecuteAction = async () => {
    if (!pendingAction || executing) return
    setExecuting(true)
    try {
      if (pendingAction.type === 'BUY') {
        const key = newIdempotencyKey()
        portfolioStore.executeTrade(
          pendingAction.symbol, pendingAction.name, 'buy',
          pendingAction.price, pendingAction.quantity, 'crypto', key,
        )
        toast.success(`Bought ${pendingAction.quantity.toFixed(6)} ${pendingAction.symbol}`)
      } else if (pendingAction.type === 'SELL') {
        const key = newIdempotencyKey()
        portfolioStore.executeTrade(
          pendingAction.symbol, pendingAction.name, 'sell',
          pendingAction.price, pendingAction.quantity, 'crypto', key,
        )
        toast.success(`Sold ${pendingAction.quantity.toFixed(6)} ${pendingAction.symbol}`)
      } else if (pendingAction.type === 'SWAP') {
        const { fromCurrency, toCurrency, fromAmount, toAmount } = pendingAction
        if (!fromCurrency || !toCurrency || !fromAmount || !toAmount) throw new Error('Invalid swap params')
        await api.swap({ fromCurrency, toCurrency, amount: fromAmount })
          .then(() => portfolioStore.hydrate(true))
          .catch(() => {
            // Fallback: local convert
            portfolioStore.convert(fromCurrency, fromAmount, toCurrency, toAmount,
              `Swap ${fromCurrency} → ${toCurrency}`, newIdempotencyKey())
          })
        toast.success(`Swapped ${fromAmount.toFixed(6)} ${fromCurrency} → ${toAmount.toFixed(6)} ${toCurrency}`)
      }
      // Append confirmation message
      const confirmMsg: ChatMessage = {
        role: 'assistant',
        content: pendingAction.type === 'SWAP'
          ? `✅ Swap executed: **${(pendingAction.fromAmount ?? 0).toFixed(6)} ${pendingAction.fromCurrency}** → **${(pendingAction.toAmount ?? 0).toFixed(6)} ${pendingAction.toCurrency}**. Your wallet has been updated.`
          : `✅ ${pendingAction.type === 'BUY' ? 'Buy' : 'Sell'} order executed: **${pendingAction.quantity.toFixed(6)} ${pendingAction.symbol} @ $${pendingAction.price.toLocaleString()}**. Portfolio updated.`,
        timestamp: new Date(),
        persona,
      }
      setMessages(prev => [...prev, confirmMsg])
      setPendingAction(null)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Execution failed: ${detail}`)
    } finally {
      setExecuting(false)
    }
  }

  // Render markdown: **bold**, *italic*, `code`, numbered lists, bullet lists, blockquotes
  const renderMarkdown = (text: string) => {
    const clean = text.replace(/__ACTION:[^_]+__/g, '').trimEnd()
    return clean.split('\n').map((line, i) => {
      // Numbered list: "1. ..."
      const numMatch = line.match(/^(\d+)\.\s+(.*)/)
      // Bullet list: "• ...", "- ...", "* ..."
      const bulletMatch = line.match(/^([•\-*])\s+(.*)/)
      // Blockquote: "> ..."
      const quoteMatch = line.match(/^>\s+(.*)/)

      const content = numMatch ? numMatch[2] : bulletMatch ? bulletMatch[2] : quoteMatch ? quoteMatch[1] : line

      const inlineRender = (raw: string) =>
        raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={`ai-part-${j}`}>{part.slice(2, -2)}</strong>
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={`ai-part-${j}`}>{part.slice(1, -1)}</em>
          if (part.startsWith('`') && part.endsWith('`')) return <code key={`ai-part-${j}`} className="px-1 py-0.5 rounded bg-[#ffffff10] text-[#00E676] text-xs font-mono">{part.slice(1, -1)}</code>
          return <span key={`ai-part-${j}`}>{part}</span>
        })

      if (numMatch) {
        return (
          <span key={`ai-inline-${i}`} className="flex gap-2 block">
            <span className="text-[#0C8B44] font-medium shrink-0">{numMatch[1]}.</span>
            <span>{inlineRender(content)}</span>
          </span>
        )
      }
      if (bulletMatch) {
        return (
          <span key={`ai-inline2-${i}`} className="flex gap-2 block">
            <span className="text-[#0C8B44] shrink-0 mt-0.5">•</span>
            <span>{inlineRender(content)}</span>
          </span>
        )
      }
      if (quoteMatch) {
        return (
          <span key={`ai-block-${i}`} className="block border-l-2 border-[#0C8B44]/50 pl-3 text-[#A0A0A0] italic">
            {inlineRender(content)}
          </span>
        )
      }
      return <span key={`ai-inline-render-${i}`} className="block">{inlineRender(content)}</span>
    })
  }

  return (
    <div className="h-screen overflow-hidden bg-[#070C0E] flex flex-col">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="flex-1 overflow-hidden py-2 lg:py-4">
        <div className="max-w-[1440px] mx-auto px-2 sm:px-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Left Sidebar - Insights (drawer on mobile, fixed on desktop) */}
            <div
              className={`${
                insightsOpen
                  ? 'fixed inset-0 z-40 bg-[#070C0E]/95 backdrop-blur-md p-4 pt-20 flex'
                  : 'hidden'
              } lg:static lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:p-0 lg:pt-0 lg:flex lg:col-span-3`}
            >
            <div className="glass-card overflow-hidden flex flex-col w-full h-full">
              <div className="p-4 border-b border-[#ffffff08]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center">
                      <BrainCircuit className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E5E5E5]">AI Insights</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
                        <span className="text-xs text-[#737373]">Live</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={loadInsights}
                      className="p-2 rounded-lg text-[#737373] hover:text-[#0C8B44] transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setInsightsOpen(false)}
                      className="lg:hidden p-2 rounded-lg text-[#737373] hover:text-[#E5E5E5] transition-colors"
                      aria-label="Close insights"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
                {insightsLoading ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <div key={`ai-pulse-${i}`} className="p-4 rounded-xl bg-[#1a1a1a]/50 animate-pulse">
                      <div className="h-4 bg-[#ffffff08] rounded w-3/4 mb-2" />
                      <div className="h-3 bg-[#ffffff08] rounded w-full mb-1" />
                      <div className="h-3 bg-[#ffffff08] rounded w-2/3" />
                    </div>
                  ))
                ) : (
                  insights.map((insight, i) => (
                    <div
                      key={`ai-key-${i}`}
                      className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/20 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {insight.type === 'recommendation' && (
                          <div className="w-8 h-8 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-[#0C8B44]" />
                          </div>
                        )}
                        {insight.type === 'alert' && (
                          <div className="w-8 h-8 rounded-lg bg-[#F57C00]/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-[#F57C00]" />
                          </div>
                        )}
                        {insight.type === 'analysis' && (
                          <div className="w-8 h-8 rounded-lg bg-[#2196F3]/20 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-[#2196F3]" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-[#E5E5E5]">{insight.title}</p>
                          <p className="text-xs text-[#A0A0A0] mt-1 leading-relaxed">
                            {insight.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${insight.confidence}%`,
                                  background: insight.type === 'alert'
                                    ? 'linear-gradient(to right, #F57C00, #FF9800)'
                                    : insight.type === 'analysis'
                                    ? 'linear-gradient(to right, #1565C0, #2196F3)'
                                    : 'linear-gradient(to right, #0C8B44, #00E676)',
                                }}
                              />
                            </div>
                            <span className="text-xs text-[#737373]">{insight.confidence}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Stats — computed from real trade data */}
              <div className="p-4 border-t border-[#ffffff08]">
                {(() => {
                  const trades = portfolioStore.getTrades()
                  const holdings = portfolioStore.getHoldings()
                  const tradeStats = computeTradeStats(trades, holdings)
                  const s = computeStats(holdings, portfolioStore.getWalletValueUsd(), portfolioStore.getTransactions(), trades)
                  const winRate = tradeStats.sells > 0 ? `${tradeStats.winRate.toFixed(0)}%` : '—'
                  const roi = s.netDeposited > 0 ? `${(s.netWorth / s.netDeposited).toFixed(2)}x` : '—'
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-[#1a1a1a]/50 text-center">
                        <p className="text-lg font-light text-[#0C8B44]">{winRate}</p>
                        <p className="text-xs text-[#737373]">Win Rate</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#1a1a1a]/50 text-center">
                        <p className="text-lg font-light text-[#2196F3]">{roi}</p>
                        <p className="text-xs text-[#737373]">ROI</p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
            </div>

            {/* Main Chat Area */}
            <div className="lg:col-span-9 glass-card overflow-hidden flex flex-col min-h-0">
              {/* Chat Header */}
              <div className="p-3 sm:p-4 border-b border-[#ffffff08]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      onClick={() => setInsightsOpen(true)}
                      className="lg:hidden p-2 rounded-lg text-[#A0A0A0] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10 transition-colors shrink-0"
                      aria-label="Open insights"
                    >
                      <PanelLeftOpen className="w-5 h-5" />
                    </button>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#E5E5E5] truncate">VERDEXIS AI</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse shrink-0" />
                        <span className="text-[11px] sm:text-xs text-[#737373] truncate">{PERSONAS.find(p => p.id === persona)?.title} • Online</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <select
                      value={persona}
                      onChange={(e) => setPersona(e.target.value as PersonaId)}
                      className="px-2 sm:px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]/40 max-w-[120px] sm:max-w-none"
                      title="Switch investor persona"
                    >
                      {PERSONAS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="hidden sm:flex px-3 py-1.5 rounded-lg bg-[#0C8B44]/20 text-xs text-[#0C8B44] items-center gap-1.5">
                      <Target className="w-3 h-3" />
                      Pro Mode
                    </div>
                    <button
                      onClick={handleClearChat}
                      title="Clear chat"
                      className="p-2 rounded-lg text-[#737373] hover:text-[#f44336] hover:bg-[#f44336]/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-[#737373] italic line-clamp-2">"{PERSONAS.find(p => p.id === persona)?.philosophy}"</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-hide p-3 sm:p-4 space-y-4 min-h-0 pb-28">
                {messages.map((msg, i) => (
                  <div
                    key={`ai-key2-${i}`}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'assistant'
                          ? 'bg-gradient-to-br from-[#0C8B44] to-[#00E676]'
                          : 'bg-[#1a1a1a] border border-[#ffffff10]'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <Bot className="w-4 h-4 text-white" />
                      ) : (
                        <User className="w-4 h-4 text-[#A0A0A0]" />
                      )}
                    </div>
                    <div
                      className={`group relative max-w-[85%] sm:max-w-[70%] p-3 sm:p-4 rounded-2xl ${
                        msg.role === 'assistant'
                          ? 'bg-[#0C8B44]/10 border border-[#0C8B44]/20 text-[#E5E5E5] rounded-tl-sm'
                          : 'bg-[#1a1a1a] text-[#E5E5E5] rounded-tr-sm'
                      }`}
                    >
                      <div className="text-sm leading-relaxed">{renderMarkdown(msg.content)}</div>
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <p className="text-xs text-[#737373]">{formatTime(msg.timestamp)}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied', { duration: 1500 }) }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#737373] hover:text-[#0C8B44] transition-all"
                          title="Copy message"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="p-4 rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 rounded-tl-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#0C8B44] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#0C8B44] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#0C8B44] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Action Confirmation Card */}
              {pendingAction && (
                <div className="mx-3 sm:mx-4 mb-2 p-4 rounded-xl border border-[#0C8B44]/40 bg-[#0C8B44]/10">
                  <div className="flex items-center gap-2 mb-3">
                    {pendingAction.type === 'BUY' && <TrendingUp className="w-4 h-4 text-[#0C8B44]" />}
                    {pendingAction.type === 'SELL' && <TrendingDown className="w-4 h-4 text-[#F57C00]" />}
                    {pendingAction.type === 'SWAP' && <ArrowLeftRight className="w-4 h-4 text-[#2196F3]" />}
                    <span className="text-sm font-medium text-[#E5E5E5]">
                      Confirm {pendingAction.type === 'BUY' ? 'Buy' : pendingAction.type === 'SELL' ? 'Sell' : 'Swap'}
                    </span>
                    <button onClick={() => setPendingAction(null)} className="ml-auto text-[#737373] hover:text-[#E5E5E5]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-[#A0A0A0] mb-3 space-y-1">
                    {pendingAction.type === 'SWAP' ? (
                      <>
                        <p>From: <strong className="text-[#E5E5E5]">{(pendingAction.fromAmount ?? 0).toFixed(6)} {pendingAction.fromCurrency}</strong></p>
                        <p>To: <strong className="text-[#E5E5E5]">{(pendingAction.toAmount ?? 0).toFixed(6)} {pendingAction.toCurrency}</strong></p>
                        <p>Rate: <strong className="text-[#E5E5E5]">1 {pendingAction.fromCurrency} ≈ {(pendingAction.rate ?? 0).toFixed(4)} {pendingAction.toCurrency}</strong></p>
                      </>
                    ) : (
                      <>
                        <p>Asset: <strong className="text-[#E5E5E5]">{pendingAction.symbol}</strong></p>
                        <p>Quantity: <strong className="text-[#E5E5E5]">{pendingAction.quantity.toFixed(6)}</strong></p>
                        <p>Price: <strong className="text-[#E5E5E5]">${pendingAction.price.toLocaleString()}</strong></p>
                        <p>Total: <strong className="text-[#E5E5E5]">${pendingAction.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExecuteAction}
                      disabled={executing}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#0C8B44] text-white text-sm font-medium hover:bg-[#0a7539] transition-colors disabled:opacity-50"
                    >
                      {executing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {executing ? 'Executing…' : 'Confirm & Execute'}
                    </button>
                    <button
                      onClick={() => setPendingAction(null)}
                      className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-sm text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Prompts — persona-aware, shown until 3rd message */}
              {messages.length <= 2 && (() => {
                const personaObj = PERSONAS.find(p => p.id === persona)
                const prompts = personaObj?.prompts ?? quickPrompts
                return (
                  <div className="px-3 sm:px-4 pb-2">
                    <p className="text-xs text-[#737373] mb-2">Try with <span style={{ color: personaObj?.color }}>{personaObj?.name}</span>:</p>
                    <div className="flex flex-wrap gap-2">
                      {prompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleQuickPrompt(prompt)}
                          className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#ffffff08] text-xs text-[#A0A0A0] hover:text-[#0C8B44] hover:border-[#0C8B44]/30 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Input Area */}
              <div className="p-3 sm:p-4 border-t border-[#ffffff08] bg-[#070C0E] fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[1440px] sm:relative sm:bg-transparent sm:border-none sm:mx-0 sm:inset-auto sm:bottom-auto">
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask anything about your portfolio…"
                    className="flex-1 min-w-0 px-3 sm:px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="w-10 h-10 rounded-xl bg-[#0C8B44] flex items-center justify-center hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
