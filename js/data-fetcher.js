/**
 * 行情数据层 · 多数据源自动回退
 * 主方案：CORS 代理 + fetch（绕过东方财富的 Referer 检查）
 * 备选：JSONP
 */
const DataFetcher = {
  cache: {},
  CACHE_TTL: 20000,
  lastSource: null,

  /** 东方财富全市场 A 股接口 URL */
  _buildEastmoneyUrl() {
    const fields = [
      'f12','f14','f2','f3','f4','f5','f6','f7','f8','f9','f10',
      'f15','f16','f17','f18','f20','f21','f22','f23','f62'
    ].join(',');
    return 'https://push2.eastmoney.com/api/qt/clist/get'
      + '?pn=1&pz=6000&po=1&np=1&fltt=2&invt=2&fid=f3'
      + '&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23'
      + '&fields=' + fields;
  },

  /** 公共 CORS 代理列表（按优先级尝试） */
  _proxies: [
    {
      name: 'allorigins',
      fn: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    },
    {
      name: 'codetabs',
      fn: u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
    },
    {
      name: 'corsproxy',
      fn: u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    },
    {
      name: 'thingproxy',
      fn: u => 'https://thingproxy.freeboard.io/fetch/' + u,
    },
  ],

  /** 通过代理 fetch */
  async _fetchWithProxy(targetUrl) {
    const errors = [];
    for (const proxy of this._proxies) {
      try {
        const proxiedUrl = proxy.fn(targetUrl);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(proxiedUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json, text/plain, */*' },
        });
        clearTimeout(timer);

        if (!res.ok) throw new Error('HTTP ' + res.status);

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          // 有些代理会包裹成 JSONP 格式，尝试提取 JSON 主体
          const match = text.match(/\{[\s\S]*\}/);
          if (match) data = JSON.parse(match[0]);
          else throw new Error('响应不是有效 JSON');
        }

        if (data && data.data && data.data.diff) {
          this.lastSource = proxy.name;
          console.log(`[DataFetcher] ✅ 通过 ${proxy.name} 获取成功，${data.data.diff.length} 条`);
          return data;
        }
        throw new Error('返回数据格式异常');
      } catch (e) {
        console.warn(`[DataFetcher] ❌ 代理 ${proxy.name} 失败:`, e.message);
        errors.push(`${proxy.name} → ${e.message}`);
      }
    }
    throw new Error('所有 CORS 代理均失败：\n' + errors.join('\n'));
  },

  /** JSONP 兜底（部分接口在某些网络环境下仍可用） */
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

  /** 主入口：拉取全市场行情 */
  async fetchAllQuotes(forceRefresh = false) {
    const key = 'all_quotes';
    if (!forceRefresh && this._isFresh(key)) return this.cache[key].data;

    const targetUrl = this._buildEastmoneyUrl();
    let raw = null;

    // 1. 尝试 CORS 代理
    try {
      raw = await this._fetchWithProxy(targetUrl);
    } catch (e1) {
      console.warn('[DataFetcher] 代理模式失败，尝试 JSONP...');
      // 2. 尝试 JSONP
      try {
        raw = await this._jsonp(targetUrl);
        this.lastSource = 'jsonp';
      } catch (e2) {
        throw new Error(
          '行情拉取失败。可能原因：\n' +
          '1. 网络被限制或代理服务不可用\n' +
          '2. 东方财富接口临时限流\n' +
          '请刷新页面重试，或稍后再试。'
        );
      }
    }

    const diff = (raw && raw.data && raw.data.diff) || [];
    if (diff.length === 0) throw new Error('接口返回空数据');

    const quotes = diff.map(it => ({
      code: it.f12,
      name: it.f14,
      price: it.f2,
      pct: it.f3,
      change: it.f4,
      volume: it.f5,
      amount: it.f6,
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
      speed: it.f22,
      pb: it.f23,
      netInflow: it.f62,
    })).filter(q => q.code && q.name);

    this.cache[key] = { data: quotes, ts: Date.now() };
    return quotes;
  },

  clearCache() {
    this.cache = {};
  }
};
