import requests, re, sys, json, time, warnings
warnings.filterwarnings("ignore")
H={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"}
def detail(aid):
    url=f"https://arxiv.org/abs/{aid}"
    try:
        r=requests.get(url,headers=H,timeout=40,verify=False)
    except Exception as e:
        return {"id":aid,"error":str(e)}
    t=r.text
    d={"id":aid,"status":r.status_code}
    def g(name, attr="content"):
        m=re.search(r'<meta[^>]*name=["\']%s["\'][^>]*%s=["\']([^"\']*)["\']'%(name,attr), t)
        if not m:
            m=re.search(r'<meta[^>]*%s=["\']([^"\']*)["\'][^>]*name=["\']%s["\']'%(attr,name), t)
        return m.group(1) if m else ""
    d["title"]=g("citation_title")
    d["date"]=g("citation_date")
    d["doi"]=g("citation_doi")
    d["journal"]=g("citation_journal_title")
    d["authors"]=re.findall(r'<meta[^>]*name=["\']citation_author["\'][^>]*content=["\']([^"\']*)["\']', t) or re.findall(r'<meta[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']citation_author["\']', t)
    # abstract
    m=re.search(r'(?s)<blockquote class="abstract[^"]*">(.*?)</blockquote>', t)
    ab=""
    if m:
        ab=re.sub(r'(?s)<[^>]+>',' ',m.group(1))
        ab=re.sub(r'\s+',' ',ab).strip()
        ab=re.sub(r'^Abstract:?\s*','',ab)
    d["abstract"]=ab
    # comments + journal ref from extra_info table
    ci=re.search(r'(?s)Comments:</td>\s*<td[^>]*>(.*?)</td>', t)
    d["comments"]=re.sub(r'\s+',' ',re.sub(r'(?s)<[^>]+>',' ',ci.group(1))).strip() if ci else ""
    jr=re.search(r'(?s)Journal ref:</td>\s*<td[^>]*>(.*?)</td>', t)
    d["journal_ref"]=re.sub(r'\s+',' ',re.sub(r'(?s)<[^>]+>',' ',jr.group(1))).strip() if jr else ""
    do=re.search(r'(?s)DOI:</td>\s*<td[^>]*>(.*?)</td>', t)
    d["doi_info"]=re.sub(r'\s+',' ',re.sub(r'(?s)<[^>]+>',' ',do.group(1))).strip() if do else ""
    return d
ids=[l.strip() for l in open(sys.argv[1]) if l.strip()]
out=[]
for i,aid in enumerate(ids):
    d=detail(aid)
    out.append(d)
    print("="*90)
    print(d.get("id"), "|", d.get("status"), "|", d.get("title"))
    print("DATE:", d.get("date"), "| DOI:", d.get("doi"), "| JOURNAL:", d.get("journal"))
    print("AUTHORS:", "; ".join(d.get("authors",[])))
    print("COMMENTS:", d.get("comments"))
    print("JOURNAL-REF:", d.get("journal_ref"), "| DOI-INFO:", d.get("doi_info"))
    print("ABSTRACT:", d.get("abstract"))
    time.sleep(1)
json.dump(out, open(sys.argv[2],"w"), ensure_ascii=False, indent=1)
