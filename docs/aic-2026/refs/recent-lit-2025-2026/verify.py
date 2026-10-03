import requests, warnings, re, sys, json, time, html
import xml.etree.ElementTree as ET
warnings.filterwarnings("ignore")
H={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"}
NS={"a":"http://www.w3.org/2005/Atom","arxiv":"http://arxiv.org/schemas/atom"}

def meta(txt, name):
    m=re.search(r'<meta\s+name="%s"\s+content="(.*?)"'%name, txt, re.S|re.I)
    if not m:
        m=re.search(r'<meta\s+content="(.*?)"\s+name="%s"'%name, txt, re.S|re.I)
    return html.unescape(m.group(1)).strip() if m else ""

def fetch_abs(aid):
    url="https://arxiv.org/abs/"+aid
    r=requests.get(url, headers=H, timeout=40, verify=False)
    return r.status_code, r.text

def api_batch(ids):
    url="http://export.arxiv.org/api/query"
    params={"id_list":",".join(ids),"max_results":len(ids)}
    r=requests.get(url, params=params, headers=H, timeout=60, verify=False)
    root=ET.fromstring(r.text)
    out={}
    for e in root.findall("a:entry", NS):
        d={}
        d["title"]=" ".join(e.findtext("a:title",default="",namespaces=NS).split())
        d["published"]=e.findtext("a:published",default="",namespaces=NS)[:10]
        d["updated"]=e.findtext("a:updated",default="",namespaces=NS)[:10]
        d["authors"]=[a.findtext("a:name",default="",namespaces=NS) for a in e.findall("a:author",NS)]
        d["comment"]=" ".join(e.findtext("arxiv:comment",default="",namespaces=NS).split())
        d["journal_ref"]=" ".join(e.findtext("arxiv:journal_ref",default="",namespaces=NS).split())
        d["doi"]=e.findtext("arxiv:doi",default="",namespaces=NS)
        d["summary"]=" ".join(e.findtext("a:summary",default="",namespaces=NS).split())
        m=re.search(r"abs/([0-9]+\.[0-9]+)", e.findtext("a:id",default="",namespaces=NS))
        out[m.group(1) if m else "?"]=d
    return out

if __name__=="__main__":
    ids=[l.strip() for l in open(sys.argv[1]) if l.strip() and not l.startswith("#")]
    res={}
    # page-based verification
    for i in ids:
        try:
            code, txt = fetch_abs(i)
        except Exception as ex:
            print(f"!! {i} FETCH ERROR {ex}"); continue
        d={"http":code,
           "citation_title":meta(txt,"citation_title"),
           "citation_authors":re.findall(r'<meta\s+name="citation_author"\s+content="(.*?)"', txt, re.S|re.I),
           "citation_date":meta(txt,"citation_date"),
           "citation_doi":meta(txt,"citation_doi"),
           "citation_arxiv_id":meta(txt,"citation_arxiv_id"),
           "citation_journal_title":meta(txt,"citation_journal_title"),
           "og_desc":meta(txt,"og:description")}
        m=re.search(r'<td class="tablecell comments[^"]*">(.*?)</td>', txt, re.S)
        d["comments_td"]=html.unescape(re.sub(r"<[^>]+>","",m.group(1))).strip() if m else ""
        m2=re.search(r'<td class="tablecell jref">(.*?)</td>', txt, re.S)
        d["jref_td"]=html.unescape(re.sub(r"<[^>]+>","",m2.group(1))).strip() if m2 else ""
        m3=re.search(r'<td class="tablecell doi">(.*?)</td>', txt, re.S)
        d["doi_td"]=html.unescape(re.sub(r"<[^>]+>","",m3.group(1))).strip() if m3 else ""
        m4=re.search(r'<blockquote class="abstract[^"]*">(.*?)</blockquote>', txt, re.S)
        d["abstract_page"]=" ".join(html.unescape(re.sub(r"<[^>]+>"," ",m4.group(1))).split()) if m4 else ""
        res[i]=d
        print(f"[{code}] {i} | {d['citation_title'][:80]} | {d['citation_date']} | authors={len(d['citation_authors'])} | comments={d['comments_td'][:80]}")
        time.sleep(2)
    json.dump(res, open(sys.argv[2],"w"), ensure_ascii=False, indent=1)
    print("--- cross-check via API ---")
    api=api_batch(ids)
    json.dump(api, open(sys.argv[2].replace(".json","_api.json"),"w"), ensure_ascii=False, indent=1)
    for k,v in api.items():
        print(f"API {k} | pub={v['published']} upd={v['updated']} | auth={', '.join(v['authors'][:4])} | comment={v['comment'][:70]} | jref={v['journal_ref'][:50]}")
