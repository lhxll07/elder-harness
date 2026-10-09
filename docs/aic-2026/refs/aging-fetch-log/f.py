import requests, re, sys, warnings, hashlib, os, json
warnings.filterwarnings("ignore")
H={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
   "Accept-Language":"zh-CN,zh;q=0.9"}
from pathlib import Path

CACHE=str(Path(__file__).resolve().parent / "cache")
os.makedirs(CACHE,exist_ok=True)
def raw(url, timeout=40):
    key=hashlib.md5(url.encode()).hexdigest()
    p=os.path.join(CACHE,key+".html")
    if os.path.exists(p):
        return open(p,encoding="utf-8",errors="ignore").read()
    r=requests.get(url,headers=H,timeout=timeout,verify=False)
    if not r.encoding or r.encoding.lower() in ("iso-8859-1",):
        r.encoding=r.apparent_encoding or "utf-8"
    t=r.text
    open(p,"w",encoding="utf-8").write(t)
    print("[HTTP]",r.status_code,len(t),"final:",r.url,file=sys.stderr)
    return t
def text(url, timeout=40):
    t=raw(url,timeout)
    t=re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>"," ",t)
    t=re.sub(r"(?s)<[^>]+>"," ",t)
    t=re.sub(r"&nbsp;?"," ",t)
    t=re.sub(r"&amp;","&",t)
    t=re.sub(r"&lt;","<",t); t=re.sub(r"&gt;",">",t)
    t=re.sub(r"&quot;",'"',t)
    t=re.sub(r"[ \t\r\f\v]+"," ",t)
    t=re.sub(r"\n\s*\n+","\n",t)
    return t.strip()
if __name__=="__main__":
    u=sys.argv[1]
    n=int(sys.argv[2]) if len(sys.argv)>2 else 5000
    s=sys.argv[3] if len(sys.argv)>3 else None
    tx=text(u)
    if s:
        for m in re.finditer(s,tx):
            a=max(0,m.start()-600); b=min(len(tx),m.end()+900)
            print("=====",m.group(0),"=====")
            print(tx[a:b])
            print()
    else:
        print(tx[:n])
