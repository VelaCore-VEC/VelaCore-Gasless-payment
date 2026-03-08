export function Badge(props) {
  var status = props.status
  var styleMap = {
    idle:       'bg-slate-700 text-slate-300',
    connecting: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    connected:  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    signing:    'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse',
    sending:    'bg-violet-500/20 text-violet-300 border border-violet-500/40 animate-pulse',
    success:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    error:      'bg-red-500/20 text-red-300 border border-red-500/40',
  }
  var labelMap = {
    idle:       'Ready',
    connecting: 'Connecting...',
    connected:  'Connected',
    signing:    'Awaiting Signature...',
    sending:    'Relaying...',
    success:    'Transfer Complete!',
    error:      'Error',
  }
  var cls   = styleMap[status] || styleMap.idle
  var label = labelMap[status] || 'Ready'
  return (
    <span className={'text-xs px-3 py-1 rounded-full font-semibold ' + cls}>
      {label}
    </span>
  )
}

export function StatCard(props) {
  var colorMap = {
    cyan:    'border-cyan-500/25 from-cyan-500/10 text-cyan-300',
    violet:  'border-violet-500/25 from-violet-500/10 text-violet-300',
    emerald: 'border-emerald-500/25 from-emerald-500/10 text-emerald-300',
    amber:   'border-amber-500/25 from-amber-500/10 text-amber-300',
  }
  var c        = colorMap[props.color] || colorMap.cyan
  var valColor = c.split(' ')[2]
  return (
    <div className={'rounded-xl border bg-gradient-to-br ' + c + ' to-transparent p-4'}>
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{props.label}</p>
      <p className={'text-2xl font-bold ' + valColor}>{props.value}</p>
      {props.sub && (
        <p className="text-xs text-slate-500 mt-1">{props.sub}</p>
      )}
    </div>
  )
}

export function FlowStep(props) {
  var circleClass = 'bg-slate-700 text-slate-400'
  if (props.done)   { circleClass = 'bg-emerald-500 text-white' }
  if (props.active) { circleClass = 'bg-blue-500 text-white animate-pulse' }

  var wrapClass = 'opacity-20'
  if (props.active) { wrapClass = 'opacity-100' }
  if (props.done)   { wrapClass = 'opacity-60' }

  var icon = props.done ? 'OK' : props.num

  return (
    <div className={'flex gap-3 items-start transition-all duration-500 ' + wrapClass}>
      <div className={'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ' + circleClass}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-200">{props.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{props.desc}</p>
      </div>
    </div>
  )
}