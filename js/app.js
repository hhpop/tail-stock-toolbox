/**
 * 尾盘选股工具箱 · 主控制器
 */
const App = {
  PER_ROW: 5,
  lastResults: [],
  lastQuotes: [],

  async init() {
    this.bindUI();
    this.updateDate();
    await this.refresh();
    setInterval(() => this.refresh(true), 60_000);
  },

  updateDate() {
    const now = new Date();
    const weekdays = ['日','一','二','三','四','五','六'];
    const str = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} 周${weekdays[now.getDay()]}`;
    document.getElementById('tradeDate').textContent = str;
  },

  bindUI() {
    document.getElementById('ovCountSelect').addEventListener('change', (e) => {
      this.PER_ROW = +e.target.value;
      this.render();
    });
  },

  async refresh(force = false) {
    const statusEl = document.getElementById('cacheStatus');
    statusEl.innerHTML = '正在拉取全市场行情...';

    try {
      const t0 = Date.now();
      let quotes = await DataFetcher.fetchAllQuotes(force);
      const rawCount = quotes.length;

      quotes = RedLineFilters.apply(quotes);
      this.lastQuotes = quotes;

      const results = Strategies.META.map(meta => ({
        ...meta,
        list: Strategies[meta.key](quotes),
      }));
      this.lastResults = results;

      this.render();

      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const sourceTag = DataFetcher.lastSource ? ` · 数据源 ${DataFetcher.lastSource}` : '';
      statusEl.textContent = `✅ 更新于 ${new Date().toLocaleTimeString()} · 全市场 ${rawCount} 只 → 红线过滤后 ${quotes.length} 只 · 耗时 ${elapsed}s${sourceTag}`;

      const upCount = quotes.filter(q => q.pct > 0).length;
      const downCount = quotes.filter(q => q.pct < 0).length;
      document.getElementById('boardStat').textContent =
        `📊 红盘 ${upCount} 只 · 绿盘 ${downCount} 只 · 平盘 ${quotes.length - upCount - downCount} 只`;

    } catch (e) {
      console.error(e);
      statusEl.innerHTML = `❌ 行情拉取失败
        <button id="retryBtn" style="margin-left:12px;padding:4px 12px;background:#238636;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">重试</button>
        <div style="margin-top:8px;font-size:11px;color:#8b949e;white-space:pre-line">${e.message}</div>`;
      const btn = document.getElementById('retryBtn');
      if (btn) btn.addEventListener('click', () => this.refresh(true));
    }
  },

  render() {
    this.renderOverview();
    this.renderAccordion();
  },

  renderOverview() {
    const overview = document.getElementById('overview');
    overview.style.gridTemplateColumns = `repeat(${this.PER_ROW}, minmax(0, 1fr))`;

    const merged = new Map();
    for (const strat of this.lastResults) {
      for (const q of strat.list) {
        const key = q.code;
        const sc = Scoring.compute(q);
        if (!merged.has(key) || merged.get(key).score < sc) {
          merged.set(key, { ...q, score: sc, strategy: strat.name });
        }
      }
    }
    const top = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, this.PER_ROW * 4);

    if (top.length === 0) {
      overview.innerHTML = '<div class="empty">当前无符合策略的个股</div>';
      return;
    }

    overview.innerHTML = top.map(q => `
      <div class="card">
        <h3>
          <span>${q.name}</span>
          <span class="code">${q.code}</span>
        </h3>
        <div class="stock-item"><span class="label">现价</span><span class="value">${q.price ?? '--'}</span></div>
        <div class="stock-item"><span class="label">涨幅</span><span class="value ${q.pct >= 0 ? 'up' : 'down'}">${q.pct >= 0 ? '+' : ''}${q.pct ?? '--'}%</span></div>
        <div class="stock-item"><span class="label">量比</span><span class="value">${q.volumeRatio ?? '--'}</span></div>
        <div class="stock-item"><span class="label">换手</span><span class="value">${q.turnover ?? '--'}%</span></div>
        <div class="stock-item"><span class="label">主力净流入</span><span class="value">${q.netInflow ? (q.netInflow / 10000).toFixed(0) + ' 万' : '--'}</span></div>
        <div class="stock-item"><span class="label">来源</span><span class="value reason">${q.strategy}</span></div>
        <div class="stock-item"><span class="label">综合评分</span><span class="score-tag">${q.score}</span></div>
      </div>
    `).join('');
  },

  renderAccordion() {
    const acc = document.getElementById('accordion');
    acc.innerHTML = this.lastResults.map((strat, idx) => {
      const rows = strat.list.slice(0, 20).map(q => `
        <tr>
          <td>${q.code}</td>
          <td>${q.name}</td>
          <td>${q.price ?? '--'}</td>
          <td class="${q.pct >= 0 ? 'up' : 'down'}">${q.pct >= 0 ? '+' : ''}${q.pct ?? '--'}%</td>
          <td>${q.volumeRatio ?? '--'}</td>
          <td>${q.turnover ?? '--'}%</td>
          <td>${q.netInflow ? (q.netInflow / 10000).toFixed(0) + ' 万' : '--'}</td>
          <td>${Scoring.compute(q)}</td>
          <td class="reason">${q._reason || ''}</td>
        </tr>
      `).join('');
      return `
        <div class="acc-item ${idx === 0 ? 'open' : ''}">
          <div class="acc-header" data-idx="${idx}">
            <span>${idx + 1}. ${strat.name} <span style="color:#6e7681;font-weight:400;font-size:12px;margin-left:8px">${strat.desc}</span></span>
            <span class="count">${strat.list.length} 只</span>
          </div>
          <div class="acc-body">
            ${strat.list.length === 0
              ? '<div class="empty">无符合条件个股</div>'
              : `<table>
                  <thead>
                    <tr>
                      <th>代码</th><th>名称</th><th>现价</th><th>涨幅</th>
                      <th>量比</th><th>换手</th><th>主力净流入</th><th>评分</th><th>入选理由</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>`}
          </div>
        </div>
      `;
    }).join('');

    acc.querySelectorAll('.acc-header').forEach(el => {
      el.addEventListener('click', () => {
        el.parentElement.classList.toggle('open');
      });
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
