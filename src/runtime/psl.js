// Compact public-suffix heuristics: the multi-label suffixes that cover the vast majority of
// real traffic, plus private suffixes for common hosting platforms. Single-label TLDs are
// handled generically.
const MULTI = new Set(`
ac.uk co.uk gov.uk ltd.uk me.uk net.uk nhs.uk org.uk plc.uk police.uk sch.uk
com.au net.au org.au edu.au gov.au asn.au id.au co.nz net.nz org.nz govt.nz ac.nz
co.jp ne.jp or.jp ac.jp go.jp gr.jp ed.jp lg.jp co.kr or.kr ne.kr go.kr ac.kr re.kr
com.br net.br org.br gov.br edu.br com.mx org.mx gob.mx edu.mx com.ar gob.ar com.co gov.co com.pe
com.cn net.cn org.cn gov.cn edu.cn ac.cn com.hk org.hk gov.hk edu.hk com.tw org.tw gov.tw edu.tw idv.tw
com.sg edu.sg gov.sg org.sg com.my gov.my edu.my co.id or.id go.id ac.id co.th go.th ac.th in.th
co.in net.in org.in gov.in ac.in edu.in res.in firm.in gen.in ind.in com.pk gov.pk edu.pk com.bd
co.za org.za gov.za ac.za com.ng gov.ng com.eg gov.eg co.ke or.ke ac.ke co.il org.il gov.il ac.il
com.tr gov.tr edu.tr org.tr com.sa gov.sa com.ua gov.ua org.ua com.ru gov.ru net.ru org.ru
co.at or.at gv.at com.pl net.pl org.pl gov.pl com.es org.es gob.es com.pt gov.pt com.gr
github.io gitlab.io pages.dev workers.dev vercel.app netlify.app herokuapp.com web.app firebaseapp.com
appspot.com blogspot.com azurewebsites.net cloudfront.net amazonaws.com s3.amazonaws.com fly.dev
onrender.com glitch.me repl.co surge.sh now.sh ngrok.io ngrok-free.app github.dev codesandbox.io
`.split(/\s+/).filter(Boolean));

export function isIp(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

/** The public suffix of a host (e.g. "co.uk" for "a.b.co.uk"). */
export function publicSuffix(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!host || isIp(host) || !host.includes('.')) return '';
  const labels = host.split('.');
  for (let n = Math.min(3, labels.length - 1); n >= 2; n--) {
    const s = labels.slice(-n).join('.');
    if (MULTI.has(s)) return s;
  }
  return labels[labels.length - 1];
}

/** eTLD+1, e.g. "example.co.uk" for "www.example.co.uk"; the host itself for IPs/localhost. */
export function registrableDomain(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  const suffix = publicSuffix(host);
  if (!suffix || host === suffix) return host;
  const rest = host.slice(0, -suffix.length - 1).split('.');
  return rest[rest.length - 1] + '.' + suffix;
}
