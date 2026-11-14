"""Capture actual provider responses. Never generates market observations."""
import concurrent.futures, csv, io, json, sys, urllib.request, datetime, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / '.tools'))
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[1] / 'src/data'
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()
def get(url):
    req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 FINN research prototype','Accept':'*/*'})
    return urllib.request.urlopen(req,timeout=30).read()
def save(name, value): (ROOT/name).write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
def companies():
    url='https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv'
    rows=list(csv.DictReader(io.StringIO(get(url).decode('utf-8-sig'))))
    save('nse-companies.json',{'sourceUrl':url,'retrievedAt':NOW,'companies':[{'ticker':r['SYMBOL'].strip(),'name':r['NAME OF COMPANY'].strip(),'sector':'Listed equity'} for r in rows if r.get(' SERIES','').strip()=='EQ']})
    return 'NSE directory: '+str(len(rows))
def prices():
    tickers='RELIANCE HDFCBANK ICICIBANK INFY TCS HCLTECH ITC HINDUNILVR BHARTIARTL SUNPHARMA DRREDDY LT NTPC MARUTI TITAN CDSL DIXON TRENT'.split()
    def one(t):
        url=f'https://query1.finance.yahoo.com/v8/finance/chart/{t}.NS?range=3mo&interval=1d'
        try:
            raw=json.loads(get(url)); r=raw['chart']['result'][0]; q=r['indicators']['quote'][0]
            rows=[{'date':datetime.datetime.fromtimestamp(ts,datetime.timezone.utc).isoformat(),'close':q['close'][i],'volume':q['volume'][i]} for i,ts in enumerate(r['timestamp']) if q['close'][i] is not None and q['volume'][i] is not None]
            return {'ticker':t,'sourceUrl':url,'retrievedAt':NOW,'sessions':rows}
        except Exception as e: print(t,str(e)); return None
    rows=list(concurrent.futures.ThreadPoolExecutor(3).map(one,tickers))
    save('prices.json',[r for r in rows if r]); return 'Price series: '+str(len([r for r in rows if r]))
def docs():
    records=[]
    paths=[('2026-2027','q2'),('2026-2027','q1'),('2025-2026','q4'),('2025-2026','q3'),('2025-2026','q2')]
    for year,q in paths:
        for kind,file in [('results','fact-sheet.pdf'),('transcript','transcripts/earningscall.pdf'),('release','ifrs-inr-press-release.pdf')]:
            url=f'https://www.infosys.com/investors/reports-filings/quarterly-results/{year}/{q}/documents/{file}'
            try:
                raw=get(url); reader=PdfReader(io.BytesIO(raw)); pages=[{'page':i+1,'text':p.extract_text()} for i,p in enumerate(reader.pages)]
                records.append({'id':hashlib.sha256(raw).hexdigest()[:20],'ticker':'INFY','title':f'Infosys {q.upper()} FY{year[-2:]} {kind}','kind':kind,'period':q.upper()+' FY'+year[-2:],'url':url,'retrievedAt':NOW,'hash':hashlib.sha256(raw).hexdigest(),'pages':pages})
                print('Captured',q,year,kind,len(pages))
            except Exception as e: print('Document unavailable',url,str(e))
    url='https://www.infosys.com/investors/reports-filings/annual-report/annual/documents/infosys-ar-26.pdf'
    try:
        raw=get(url); pages=[{'page':i+1,'text':p.extract_text()} for i,p in enumerate(PdfReader(io.BytesIO(raw)).pages)]
        records.append({'id':hashlib.sha256(raw).hexdigest()[:20],'ticker':'INFY','title':'Infosys Integrated Annual Report 2025–26','kind':'annual','period':'FY26','url':url,'retrievedAt':NOW,'hash':hashlib.sha256(raw).hexdigest(),'pages':pages})
    except Exception as e: print('Annual report',str(e))
    save('documents.json',records); return 'Documents: '+str(len(records))
def announcements():
    url='https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml'
    try:
        raw=get(url).decode(); (ROOT/'announcements.xml').write_text(raw,encoding='utf8'); save('feed-provenance.json',{'url':url,'retrievedAt':NOW}); return 'RSS captured'
    except Exception as e: return 'RSS unavailable '+str(e)
with concurrent.futures.ThreadPoolExecutor(4) as pool:
    for f in [pool.submit(fn) for fn in [companies,prices,docs,announcements]]:
        try: print(f.result())
        except Exception as e: print('Provider failure',e)
