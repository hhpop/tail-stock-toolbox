/**
 * 行情数据层 · 基于东方财富 JSONP 接口
 * 无需后端，浏览器直接拉取全市场 A 股实时行情
 */
const DataFetcher = {
  cache: {},
  CACHE_TTL: 20000, // 20 秒缓存

  /**
   * JSONP 请求封装
   */
  _jsonp(url, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const cbName = 'em_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      let timer = null;
      const cleanup = () => {
        try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
        const el = document.getElementById(cbName);
        if (el) el.remove();
        if (timer) clearTimeout(timer);
      };
      window[cbName] = (data) => { cleanup(); resolve(data); };
      const script = document.createElement('script');
      script.id = cbName;
      script.src = url + (url.includes('?') ? '&' : '?') + 'cb=' + cbName;
      script.onerror = () => { cleanup(); reject(new Error('JSONP 请求失败')); };
      document.body.appendChild(script);
      timer = setTimeout(() => { cleanup(); reject(new Error('JSONP 超时')); }, timeout);
    });
  },

  _isFresh(key) {
    const e = this.cache[key];
    return e && (Date.now() - e.ts) < this.CACHE_TTL;
  },

  /**
   * 全市场 A 股实时行情
   * 覆盖：沪深主板 + 创业板 + 科创板
   */
  async fetchAllQuotes(forceRefresh = false) {
    const key = 'all_quotes';
    if (!forceRefresh && this._isFresh(key)) return this.cache[key].data;

    const fields = [
      'f12','f14','f2','f3','f4','f5','f6','f7','f8','f9','f10',
      'f15','f16','f17','f18','f20','f21','f22','f23','f62'
    ].join(',');

    const url = 'https://push2.eastmoney.com/api/qt/clist/get'
      + '?pn=1&pz=6000&po=1&np=1&fltt=2&invt=2&fid=f3'
      + '&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23'
      + '&fields=' + fields;

    const res = await this._jsonp(url);
    const diff = (res && res.data && res.data.diff) || [];

    const quotes = diff.map(it => ({
      code: it.f12,
      name: it.f14,
      price: it.f2,
      pct: it.f3,
      change: it.f4,
      volume: it.f5,          // 手
      amount: it.f6,          // 元
      amplitude: it.f7,
      turnover: it.f8,
      pe: it.f9,
      volumeRatio: it.f10,
      high: it.f15,
      low: it.f16,
      open: it.f17,
      preClose: it.f18,
      totalMarketCap: it.f20,
      floatMarketCap: it.f21,
      speed: it.f22,          // 涨速
      pb: it.f23,
      netInflow: it.f62,      // 主力净流入（元）
    })).filter(q => q.code && q.name);

    this.cache[key] = { data: quotes, ts: Date.now() };
    return quotes;
  },

  /** 强制清空缓存 */
  clearCache() {
    this.cache = {};
  }
};
