import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { ArrowLeft, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { Toaster, toast } from 'sonner'

interface AdvancedOrder {
  id: string
  symbol: string
  type: 'limit' | 'stop'
  side: 'buy' | 'sell'
  quantity: number
  triggerPrice: number
  limitPrice?: number
  createdAt: Date
  status: 'pending' | 'triggered' | 'filled' | 'cancelled'
}

export default function AdvancedOrders() {
  const [orders, setOrders] = useState<AdvancedOrder[]>([])
  const [orderType, setOrderType] = useState<'limit' | 'stop'>('limit')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [symbol, setSymbol] = useState('BTC')
  const [quantity, setQuantity] = useState('')
  const [triggerPrice, setTriggerPrice] = useState('')
  const [limitPrice, setLimitPrice] = useState('')

  const handleCreateOrder = () => {
    if (!quantity || !triggerPrice) {
      toast.error('Please fill in all required fields')
      return
    }

    const newOrder: AdvancedOrder = {
      id: Math.random().toString(36).substring(7),
      symbol,
      type: orderType,
      side,
      quantity: parseFloat(quantity),
      triggerPrice: parseFloat(triggerPrice),
      limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
      createdAt: new Date(),
      status: 'pending',
    }

    setOrders([newOrder, ...orders])
    toast.success(`${orderType} order created for ${quantity} ${symbol}`)
    setQuantity('')
    setTriggerPrice('')
    setLimitPrice('')
  }

  const handleCancelOrder = (id: string) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
    toast.success('Order cancelled')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <Toaster position="top-right" theme="dark" richColors />

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/trading" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to trading
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5]">Advanced Orders</h1>
            <p className="text-xs text-[#737373]">Create limit and stop orders</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Order Form */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-4">
              <h2 className="text-lg font-medium text-[#E5E5E5]">New Order</h2>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Order Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['limit', 'stop'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setOrderType(t as 'limit' | 'stop')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                        orderType === t
                          ? 'bg-[#0C8B44] text-white'
                          : 'bg-[#1a1a1a] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Side</label>
                <div className="grid grid-cols-2 gap-2">
                  {['buy', 'sell'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s as 'buy' | 'sell')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                        side === s
                          ? `text-white ${s === 'buy' ? 'bg-[#0C8B44]' : 'bg-[#f44336]'}`
                          : 'bg-[#1a1a1a] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                      }`}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                  placeholder="BTC"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Trigger Price (USD) *</label>
                <input
                  type="number"
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                  placeholder="0.00"
                />
              </div>

              {orderType === 'limit' && (
                <div>
                  <label className="text-xs uppercase tracking-wider text-[#737373] mb-2 block">Limit Price (USD)</label>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                    placeholder="0.00"
                  />
                </div>
              )}

              <button
                onClick={handleCreateOrder}
                className="w-full px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors"
              >
                Create Order
              </button>
            </div>
          </div>

          {/* Active Orders */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
              <div className="p-6 border-b border-[#ffffff08]">
                <h2 className="text-lg font-medium text-[#E5E5E5]">Active Orders</h2>
              </div>

              {orders.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-10 h-10 text-[#737373] mx-auto mb-3" />
                  <p className="text-sm text-[#A0A0A0]">No advanced orders yet</p>
                  <p className="text-xs text-[#737373] mt-1">Create one above to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-[#ffffff05]">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 flex items-center justify-between hover:bg-[#ffffff05] transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#E5E5E5]">
                            {order.side === 'buy' ? '🟢' : '🔴'} {order.type.toUpperCase()} {order.side.toUpperCase()}
                          </span>
                          <span className="text-xs text-[#737373]">{order.symbol}</span>
                        </div>
                        <div className="text-xs text-[#A0A0A0] space-y-0.5">
                          <div>Qty: {order.quantity} @ ${order.triggerPrice.toFixed(2)} trigger</div>
                          {order.limitPrice && <div>Limit: ${order.limitPrice.toFixed(2)}</div>}
                          <div className={`text-[11px] ${order.status === 'pending' ? 'text-[#F57C00]' : 'text-[#0C8B44]'}`}>
                            Status: {order.status}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={order.status !== 'pending'}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#f44336]/10 text-[#f44336] hover:bg-[#f44336]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/30 p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-[#0C8B44] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#E5E5E5]">How Advanced Orders Work</p>
              <p className="text-xs text-[#A0A0A0] mt-1">
                <span className="text-[#0C8B44] font-medium">Limit orders:</span> Execute when price reaches your trigger, but only at your specified limit price or better.
              </p>
              <p className="text-xs text-[#A0A0A0] mt-1">
                <span className="text-[#0C8B44] font-medium">Stop orders:</span> Convert to market orders when price reaches your trigger, ensuring execution but potentially at any price.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
