import { useState, useMemo } from 'react'

var FILTERS = [
  { label: '1 Hour',   value: '1h',  ms: 1000 * 60 * 60 },
  { label: '1 Day',    value: '1d',  ms: 1000 * 60 * 60 * 24 },
  { label: '1 Week',   value: '1w',  ms: 1000 * 60 * 60 * 24 * 7 },
  { label: '1 Month',  value: '1m',  ms: 1000 * 60 * 60 * 24 * 30 },
  { label: '6 Months', value: '6m',  ms: 1000 * 60 * 60 * 24 * 180 },
  { label: '1 Year',   value: '1y',  ms: 1000 * 60 * 60 * 24 * 365 },
  { label: 'All Time', value: 'all', ms: null },
]

function timeAgo(ts) {
  var diff = Date.now() - ts
  var s = Math.floor(diff / 1000)
  var m = Math.floor(s / 60)
  var h = Math.floor(m / 60)
  var d = Math.floor(h / 24)
  if (d > 0) return d + 'd ago'
  if (h > 0) return h + 'h ago'
  if (m > 0) return m + 'm ago'
  return 'Just now'
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function shortAddr(a) {
  if (!a) return ''
  return a.slice(0, 6) + '...' + a.slice(-4)
}

function CopyBtn({ text }) {
  var [copied, setCopied] = useState(false)
  function copy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(function() {
      setCopied(true)
      setTimeout(function() { setCopied(false) }, 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className={'text-xs px-2 py-0.5 rounded-md transition-all ' +
        (copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 border border-slate-600/50')}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

function TxRow({ tx }) {
  var [open, setOpen] = useState(false)
  return (
    <div className={'rounded-xl border transition-all overflow-hidden ' + (open ? 'border-cyan-500/20 bg-slate-800/60' : 'border-white/6 bg-slate-800/30 hover:border-white/12')}>
      <div className="flex items-start justify-between p-4 cursor-pointer" onClick={function() { setOpen(function(v) { return !v }) }}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-emerald-400 text-sm font-bold">↑</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-bold text-slate-100">{parseFloat(tx.amount).toFixed(4)} VEC</span>
              <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 rounded-full px-2 py-0.5">Gasless</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-full px-2 py-0.5">✓ Success</span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
              <span>{shortAddr(tx.from)}</span>
              <span className="text-slate-700">→</span>
              <span>{shortAddr(tx.to)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
          <p className="text-sm font-bold text-emerald-400">{parseFloat(tx.net).toFixed(4)}</p>
          <p className="text-xs text-amber-400/70">−{parseFloat(tx.feeVec).toFixed(4)} fee</p>
          <p className="text-xs text-slate-600">{timeAgo(tx.timestamp)}</p>
          <span className="text-xs text-slate-700 mt-0.5">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5 px-4 py-4 bg-slate-900/40 flex flex-col gap-2.5">
          {[
            { label: 'Date & Time', value: formatDate(tx.timestamp), mono: false, copy: null },
            { label: 'From',        value: shortAddr(tx.from),        mono: true,  copy: tx.from },
            { label: 'To',          value: shortAddr(tx.to),          mono: true,  copy: tx.to },
            { label: 'Amount Sent', value: parseFloat(tx.amount).toFixed(8) + ' VEC', mono: true, copy: null },
            { label: 'Net Received',value: parseFloat(tx.net).toFixed(8) + ' VEC',    mono: true, copy: null },
            { label: 'Fee Paid',    value: parseFloat(tx.feeVec).toFixed(8) + ' VEC', mono: true, copy: null },
            { label: 'Gas Cost',    value: '$0.00',                                    mono: false, copy: null },
          ].map(function(row) {
            return (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className={'text-slate-300 ' + (row.mono ? 'font-mono' : '')}>{row.value}</span>
                  {row.copy && <CopyBtn text={row.copy} />}
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2.5">
            <span className="text-slate-500">Tx Hash</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-400">{tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}</span>
              <CopyBtn text={tx.hash} />
            </div>
          </div>
          <a
            href={'https://testnet.bscscan.com/tx/' + tx.hash}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/8 text-cyan-400 hover:bg-cyan-500/15 text-xs font-bold transition-all"
          >
            View on BscScan ↗
          </a>
        </div>
      )}
    </div>
  )
}

function exportCSV(list) {
  var header = 'Date,Hash,From,To,Amount (VEC),Received (VEC),Fee (VEC),Gas Paid'
  var rows = list.map(function(tx) {
    return [formatDate(tx.timestamp), tx.hash, tx.from, tx.to,
      parseFloat(tx.amount).toFixed(8), parseFloat(tx.net).toFixed(8),
      parseFloat(tx.feeVec).toFixed(8), '$0.00'].join(',')
  })
  var blob = new Blob([[header].concat(rows).join('\n')], { type: 'text/csv' })
  var url  = URL.createObjectURL(blob)
  var a    = document.createElement('a')
  a.href = url; a.download = 'velacore_history.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function TransactionHistory(props) {
  var transactions = props.transactions
  var onClose      = props.onClose

  var [activeFilter, setActiveFilter] = useState('30d')
  var [search,       setSearch]       = useState('')

  var filtered = useMemo(function() {
    var now  = Date.now()
    var list = transactions.slice()
    var ms   = 1000 * 60 * 60 * 24 * 30

    if (activeFilter !== '30d') {
      var found = FILTERS.find(function(f) { return f.value === activeFilter })
      if (found && found.ms !== null) ms = found.ms
      if (found && found.ms === null) ms = null
    }

    if (ms !== null) list = list.filter(function(tx) { return now - tx.timestamp <= ms })

    if (search.trim()) {
      var q = search.trim().toLowerCase()
      list = list.filter(function(tx) {
        return tx.hash.toLowerCase().includes(q) || tx.to.toLowerCase().includes(q) || tx.from.toLowerCase().includes(q)
      })
    }

    return list.sort(function(a, b) { return b.timestamp - a.timestamp })
  }, [transactions, activeFilter, search])

  var summaryStats = useMemo(function() {
    return {
      count:   filtered.length,
      sent:    filtered.reduce(function(s, tx) { return s + parseFloat(tx.amount || 0) }, 0).toFixed(2),
      net:     filtered.reduce(function(s, tx) { return s + parseFloat(tx.net    || 0) }, 0).toFixed(2),
      fee:     filtered.reduce(function(s, tx) { return s + parseFloat(tx.feeVec || 0) }, 0).toFixed(4),
      gasSaved: (filtered.length * 0.003).toFixed(3),
    }
  }, [filtered])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-4xl bg-[#0d1117] border border-white/8 rounded-2xl flex flex-col max-h-[90vh]"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-lg font-extrabold">Transaction History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Synced across all devices · {transactions.length} total transactions</p>
          </div>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button
                onClick={function() { exportCSV(filtered) }}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                ↓ Export CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-white/5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={function() { setActiveFilter('30d') }}
              className={'text-xs px-3 py-1.5 rounded-full font-semibold transition-all ' + (activeFilter === '30d' ? 'bg-cyan-500 text-white shadow shadow-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-white/6')}
            >
              30 Days
            </button>
            {FILTERS.map(function(f) {
              return (
                <button
                  key={f.value}
                  onClick={function() { setActiveFilter(f.value) }}
                  className={'text-xs px-3 py-1.5 rounded-full font-semibold transition-all ' + (activeFilter === f.value ? 'bg-cyan-500 text-white shadow shadow-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-white/6')}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <input
            type="text"
            placeholder="Search by wallet address or transaction hash..."
            value={search}
            onChange={function(e) { setSearch(e.target.value) }}
            className="w-full bg-slate-800/60 border border-white/8 focus:border-cyan-500/40 outline-none rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-600 transition-colors"
          />
        </div>

        {/* Summary stats */}
        <div className="px-6 py-3 border-b border-white/5 grid grid-cols-5 gap-3">
          {[
            { label: 'Txs',       value: summaryStats.count,    color: 'text-cyan-400' },
            { label: 'Sent',      value: summaryStats.sent,     color: 'text-slate-200' },
            { label: 'Received',  value: summaryStats.net,      color: 'text-emerald-400' },
            { label: 'Fees',      value: summaryStats.fee,      color: 'text-amber-400' },
            { label: 'Gas Saved', value: '$'+summaryStats.gasSaved, color: 'text-violet-400' },
          ].map(function(s) {
            return (
              <div key={s.label} className="text-center">
                <p className="text-xs text-slate-600 uppercase tracking-widest mb-0.5">{s.label}</p>
                <p className={'text-base font-extrabold ' + s.color}>{s.value}</p>
              </div>
            )
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/6 flex items-center justify-center text-3xl mb-4">📭</div>
              <p className="text-slate-400 font-semibold">No transactions found</p>
              <p className="text-slate-600 text-sm mt-1.5">Try changing the time filter or clearing your search</p>
            </div>
          ) : (
            filtered.map(function(tx) {
              return <TxRow key={tx.hash} tx={tx} />
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-600">Showing {filtered.length} of {transactions.length} transactions</span>
          <span className="text-xs text-emerald-600 font-semibold">$0.00 total gas paid</span>
        </div>
      </div>
    </div>
  )
}