import requests, warnings, sys, json, re, time
import xml.etree.ElementTree as ET
warnings.filterwarnings("ignore")
H={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"}
NS={"a":"http://www.w3.org/2005/Atom","arxiv":"http://arxiv.org/schemas/atom"}

def query(q, max_results=60, sort="submittedDate"):
    url="http://export.arxiv.org/api/query"
    params={"search_query":q,"start":0,"max_results":max_results,"sortBy":sort,"sortOrder":"descending"}
    for attempt in range(3):
        try:
            r=requests.get(url, params=params, headers=H, timeout=40, verify=False)
            if r.status_code==200:
                return r.text
        except Exception as e:
            time.sleep(3)
    return ""

def parse(xml):
    out=[]
    try:
        root=ET.fromstring(xml)
    except Exception:
        return out
    for e in root.findall("a:entry", NS):
        d={}
        d["id"]=e.findtext("a:id",default="",namespaces=NS)
        d["title"]=" ".join(e.findtext("a:title",default="",namespaces=NS).split())
        d["published"]=e.findtext("a:published",default="",namespaces=NS)
        d["updated"]=e.findtext("a:updated",default="",namespaces=NS)
        d["summary"]=" ".join(e.findtext("a:summary",default="",namespaces=NS).split())
        d["authors"]=[a.findtext("a:name",default="",namespaces=NS) for a in e.findall("a:author",NS)]
        d["comment"]=e.findtext("arxiv:comment",default="",namespaces=NS)
        d["journal_ref"]=e.findtext("arxiv:journal_ref",default="",namespaces=NS)
        d["doi"]=e.findtext("arxiv:doi",default="",namespaces=NS)
        d["primary"]=e.find("arxiv:primary_category",NS)
        d["primary"]=d["primary"].get("term") if d["primary"] is not None else ""
        m=re.search(r"abs/([0-9]+\.[0-9]+)", d["id"])
        d["arxivid"]=m.group(1) if m else ""
        out.append(d)
    return out

if __name__=="__main__":
    queries=json.load(open(sys.argv[1]))
    allres={}
    for name,q in queries.items():
        xml=query(q, int(sys.argv[3]) if len(sys.argv)>3 else 60)
        res=parse(xml)
        allres[name]=res
        print(f"=== {name} | {q} | n={len(res)}")
        for d in res:
            y=d["published"][:7]
            print(f"  {d['arxivid']} {d['published'][:10]} | {d['title'][:110]}")
        time.sleep(3)
    json.dump(allres, open(sys.argv[2],"w"), ensure_ascii=False, indent=1)
