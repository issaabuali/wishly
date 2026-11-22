import re
r=lambda p:open(p).read()
css=r('../public/styles.css'); i18n=r('../public/i18n.js'); app=r('../public/app.js'); bundle=r('bundle.js')
page=f'''<title>Wishly Demo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&family=Noto+Sans:wght@400;600;800&display=swap" rel="stylesheet">
<style>{css}
body{{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
.top,main,.foot{{padding-left:0;padding-right:0}}
.demo{{background:#fff7e6;border:1px solid #ecd9a8;color:#6b5a2a;border-radius:10px;padding:8px 12px;font-size:13px;max-width:720px;margin:6px auto}}
</style>
<div class="demo">Demo mode: everything runs in your browser. Orders are stored on this device only. Admin: <b>#/admin</b> · token <b>wishly-dev-admin</b></div>
<header class="top"><a class="logo" href="#/">wishly<span>.</span></a><button id="lang" class="pill" aria-label="Language">العربية</button></header>
<main id="app" aria-live="polite"></main>
<footer class="foot" id="foot"></footer>
<script>{bundle}</script>
<script>{i18n}</script>
<script>{app}</script>
'''
open('/tmp/claude-0/-home-user/66175356-fce5-5e69-9eba-caa22f40e730/scratchpad/wishly-demo.html','w').write(page)
