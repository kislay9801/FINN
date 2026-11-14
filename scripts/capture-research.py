"""Expand the offline primary library using Screener for discovery only."""
import sys,urllib.request,urllib.parse,re,json,hashlib,io,datetime,concurrent.futures
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'.tools'))
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1]/'src/data';now=datetime.datetime.now(datetime.timezone.utc).isoformat()
def get(u):return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 FINN primary-source research'}),timeout=25).read()
def capture(ticker):
    docs=[]
    try:
        base=f'https://www.screener.in/company/{ticker}/consolidated/'
        html=get(base).decode(); html=html[html.find('id="documents"'):]
        links=[(urllib.parse.urljoin(base,m[0].replace('&amp;','&')),re.sub('<[^>]*>',' ',m[1]).strip()) for m in re.findall(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>([\s\S]*?)</a>',html)]
        annual=[x for x in links if re.search(r'Annual Report 2026',x[1],re.I)][:1]
        calls=[x for x in links if x[1]=='Transcript'][:1]
        for url,title in annual+calls:
            if urllib.parse.urlparse(url).hostname not in ['www.bseindia.com','nsearchives.nseindia.com']:continue
            choices=[url]
            if 'AnnPdfOpen.aspx?Pname=' in url:
                filename=urllib.parse.parse_qs(urllib.parse.urlparse(url).query)['Pname'][0]
                choices=[f'https://www.bseindia.com/xml-data/corpfiling/AttachHis/{filename}',f'https://www.bseindia.com/xml-data/corpfiling/AttachLive/{filename}',url]
            for candidate in choices:
                try:
                    raw=get(candidate)
                    if not raw.startswith(b'%PDF'):continue
                    reader=PdfReader(io.BytesIO(raw));pages=[{'page':i+1,'text':p.extract_text()} for i,p in enumerate(reader.pages)]
                    h=hashlib.sha256(raw).hexdigest()
                    docs.append({'id':h[:20],'ticker':ticker,'title':ticker+' · '+title,'kind':'annual' if 'Annual' in title else 'transcript','period':'FY26' if 'Annual' in title else 'Latest captured transcript · see document','url':candidate,'retrievedAt':now,'hash':h,'pages':pages,'discoveryUrl':base})
                    print(ticker,title,len(pages),'pages',flush=True);break
                except Exception as e: print(ticker,'source unavailable',str(e),flush=True)
    except Exception as e:print(ticker,'discovery failed',str(e),flush=True)
    return docs
with concurrent.futures.ThreadPoolExecutor(2) as pool: result=list(pool.map(capture,['ASIANPAINT','PIDILITIND','DMART','BAJFINANCE','WIPRO']))
existing=json.loads((root/'documents.json').read_text(encoding='utf8'))
merged={d['id']:d for d in existing+sum(result,[])}
(root/'documents.json').write_text(json.dumps(list(merged.values()),ensure_ascii=False),encoding='utf8')
print('Total actual primary documents',len(merged))
