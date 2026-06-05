import re

def apply_replacements(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {path}")

replacements = [
    # Remove ambient bg
    ('      {/* Ambient background */}\n      <div className="fixed inset-0 pointer-events-none">\n        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] bg-cyan-500/6" />\n        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full blur-[100px] bg-teal-500/5" />\n        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] bg-cyan-400/3" />\n      </div>\n\n      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 md:px-8">',
     '      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 md:px-8">'),
    # Hero
    ('          <div className="relative rounded-3xl border border-cyan-500/20 bg-black/40 p-6 md:p-10 overflow-hidden backdrop-blur-sm">\n            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/25 via-teal-900/12 to-transparent" />\n            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-[100px] bg-cyan-500/15" />\n            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-[80px] bg-teal-500/10" />\n\n            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">',
     '          <div className="relative zion-panel rounded-3xl md:rounded-[32px] p-6 md:p-10 overflow-hidden border border-white/10 bg-black/60 backdrop-blur-xl">\n            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">'),
    ('<div className="shrink-0 w-20 h-20 rounded-3xl border border-cyan-400/25 bg-cyan-400/8 flex items-center justify-center text-4xl">',
     '<div className="shrink-0 w-20 h-20 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/50 to-black flex items-center justify-center text-4xl">'),
    ('<span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold tracking-[0.3em] text-cyan-400 uppercase">',
     '<span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-[0.3em] text-gray-300 uppercase">'),
    ('<span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-amber-400 uppercase">',
     '<span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-zion-gold uppercase">'),
    ('<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">',
     '<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">'),
    ('<p className="text-lg text-cyan-400 font-medium">',
     '<p className="text-lg text-zion-cyan font-medium">'),
    ('<MapPin className="w-4 h-4 text-cyan-500 shrink-0" />',
     '<MapPin className="w-4 h-4 text-gray-300 shrink-0" />'),
    ('<blockquote className="mt-4 pl-4 border-l-2 border-cyan-500/40 text-sm text-gray-400 italic leading-relaxed max-w-lg">',
     '<blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-gray-400 italic leading-relaxed max-w-lg">'),
    ('className="rounded-2xl border border-cyan-400/12 bg-cyan-400/6 px-3 py-3 backdrop-blur-sm">\n                        <div className="flex items-center gap-2 text-cyan-200">',
     'className="rounded-2xl border border-white/10 bg-black/60 px-3 py-3 backdrop-blur-sm">\n                        <div className="flex items-center gap-2 text-zion-gold">'),
    # Info section
    ('<div className="zion-panel rounded-3xl p-6 md:p-8 border border-cyan-500/15 relative overflow-hidden">\n            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-teal-900/10 to-transparent" />\n            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[80px] bg-cyan-500/12" />\n\n            <div className="relative z-10 grid md:grid-cols-3 gap-6">',
     '<div className="zion-panel rounded-3xl p-6 md:p-8 border border-white/10 relative overflow-hidden">\n            <div className="relative z-10 grid md:grid-cols-3 gap-6">'),
    ('<h3 className="text-lg font-bold text-cyan-400">',
     '<h3 className="text-lg font-bold text-gray-300">'),
    ('className="text-center p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">\n                    <p className="text-cyan-400 font-bold text-xs">',
     'className="text-center p-3 rounded-xl bg-black/60 border border-white/10">\n                    <p className="text-gray-300 font-bold text-xs">'),
    # Polynesian model table header
    ('<div className="p-3 text-cyan-400 border-l border-white/10">{cs ? \'Princip\' : \'Principle\'}</div>\n              <div className="p-3 text-amber-400 border-l border-white/10">ZION</div>',
     '<div className="p-3 text-gray-300 border-l border-white/10">{cs ? \'Princip\' : \'Principle\'}</div>\n              <div className="p-3 text-gray-300 border-l border-white/10">ZION</div>'),
    ('<div className="p-3 text-cyan-300 text-xs">{cs ? row.poly.cs : row.poly.en}</div>',
     '<div className="p-3 text-gray-300 text-xs">{cs ? row.poly.cs : row.poly.en}</div>'),
    ('<div className="p-3 text-amber-300 text-xs border-l border-white/5">{cs ? row.zion.cs : row.zion.en}</div>',
     '<div className="p-3 text-gray-300 text-xs border-l border-white/5">{cs ? row.zion.cs : row.zion.en}</div>'),
    # Features grid
    ('className="relative rounded-2xl border p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"\n                  style={{ borderColor: `rgba(${f.rgb},0.2)`, backgroundColor: `rgba(${f.rgb},0.04)` }}',
     'className="relative rounded-[32px] border border-white/10 bg-black/60 backdrop-blur-xl p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"'),
    ('style={{ backgroundColor: f.color }}',
     ''),
    ('<Icon className="h-5 w-5" style={{ color: f.color }} />',
     '<Icon className="h-5 w-5 text-zion-gold" />'),
    ('<h3 className="font-bold relative z-10" style={{ color: f.color }}>',
     '<h3 className="font-bold text-zion-gold relative z-10">'),
    # Rapa Nui
    ('<div className="zion-panel rounded-3xl p-6 md:p-8 border border-cyan-500/15 relative overflow-hidden">\n            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/15 via-teal-900/10 to-transparent" />\n            <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full blur-[80px] bg-cyan-500/8" />\n\n            <div className="relative z-10 space-y-4">',
     '<div className="zion-panel rounded-3xl p-6 md:p-8 border border-white/10 relative overflow-hidden">\n            <div className="relative z-10 space-y-4">'),
    ('<h3 className="text-lg font-bold text-cyan-400">',
     '<h3 className="text-lg font-bold text-gray-300">'),
    ('<span className="text-amber-500 shrink-0 mt-0.5 font-bold">{i + 1}.</span>',
     '<span className="text-gray-300 shrink-0 mt-0.5 font-bold">{i + 1}.</span>'),
    # Timeline
    ('<div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-cyan-500/40 via-cyan-500/20 to-transparent" />',
     '<div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-zion-gold/40 via-white/10 to-transparent" />'),
    ("borderColor: p.active ? '#F59E0B' : 'rgba(255,255,255,0.15)',\n                      backgroundColor: p.active ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.5)',",
     "borderColor: p.active ? 'rgb(255,215,0)' : 'rgba(255,255,255,0.15)',\n                      backgroundColor: p.active ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.5)',"),
    ('{p.active && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}',
     '{p.active && <div className="w-1.5 h-1.5 rounded-full bg-zion-cyan animate-pulse" />}'),
    ('className="rounded-2xl border p-4 space-y-1"\n                    style={{\n                      borderColor: p.active ? \'rgba(245,158,11,0.2)\' : \'rgba(255,255,255,0.06)\',\n                      backgroundColor: p.active ? \'rgba(245,158,11,0.04)\' : \'rgba(0,0,0,0.3)\',\n                    }}',
     'className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-sm p-4 space-y-1"'),
    ("style={{ color: p.active ? '#F59E0B' : 'rgba(255,255,255,0.3)' }}",
     "style={{ color: p.active ? 'rgb(6,182,212)' : 'rgba(255,255,255,0.3)' }}"),
    ('{p.active && (\n                        <span className="text-yellow-400 text-xs animate-pulse">',
     '{p.active && (\n                        <span className="text-zion-cyan text-xs animate-pulse">'),
    # ZION Integration
    ('<div className="zion-panel rounded-3xl p-6 md:p-8 border border-cyan-500/15 relative overflow-hidden">\n            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-transparent" />\n            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[80px] bg-cyan-500/10" />\n\n            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">',
     '<div className="zion-panel rounded-3xl p-6 md:p-8 border border-white/10 relative overflow-hidden">\n            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">'),
    ('className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 p-3"',
     'className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 p-3"'),
    ('<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/12 bg-cyan-400/8">\n                    <item.icon className="h-4 w-4 text-cyan-300" />',
     '<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">\n                    <item.icon className="h-4 w-4 text-zion-gold" />'),
    # Open Questions
    ('<div className="zion-panel rounded-3xl p-6 md:p-8 border border-cyan-500/15 space-y-4">\n            <h3 className="text-lg font-bold text-cyan-400">',
     '<div className="zion-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-4">\n            <h3 className="text-lg font-bold text-gray-300">'),
    ('className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 text-sm text-cyan-300 transition-all duration-300"',
     'className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-gray-300 transition-all duration-300"'),
    # Bottom nav
    ('className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-cyan-400 transition-colors"',
     'className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"'),
]

apply_replacements('APP&WEB/website-v2.9/src/app/terranova/te-piko-ora/page.tsx', replacements)
