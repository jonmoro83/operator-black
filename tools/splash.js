import subprocess, os, sys
# (logical width, logical height, dpr) for the iPhones this is likely to run on
SIZES=[(440,956,3),(430,932,3),(402,874,3),(393,852,3),(390,844,3),(375,812,3),
       (414,896,3),(414,896,2),(375,667,2),(414,736,3)]
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
tpl='''<!doctype html><html><head><meta charset=utf8><style>
html,body{margin:0;height:100%%;background:#131916}
.w{height:100%%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:%(gap)spx;font-family:-apple-system,system-ui,sans-serif}
svg{width:%(icon)spx;height:%(icon)spx}
.t{color:#e5ebe7;font-size:%(fs)spx;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.t b{color:#7d9cff}
</style></head><body><div class="w">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="22" width="7" height="20" rx="2" fill="#b92f27"/><rect x="16" y="18" width="7" height="28" rx="2" fill="#1b45c2"/><rect x="23" y="30" width="18" height="4" fill="#e5ebe7"/><rect x="41" y="18" width="7" height="28" rx="2" fill="#1b45c2"/><rect x="49" y="22" width="7" height="20" rx="2" fill="#b92f27"/></svg>
<div class="t">Operator <b>+</b> Black</div></div></body></html>'''
for w,h,dpr in SIZES:
    icon=int(w*0.34); fs=max(11,int(w*0.042)); gap=int(w*0.05)
    open('/tmp/_sp.html','w').write(tpl % {'icon':icon,'fs':fs,'gap':gap})
    out='public/brand/splash/%dx%d@%d.png'%(w,h,dpr)
    subprocess.run([CHROME,'--headless=new','--disable-gpu','--hide-scrollbars',
        '--force-device-scale-factor=%d'%dpr,'--window-size=%d,%d'%(w,h),
        '--screenshot='+out,'file:///tmp/_sp.html'],capture_output=True)
    print(out, os.path.getsize(out)//1024, 'KB')
