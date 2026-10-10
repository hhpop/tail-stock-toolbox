/**
 * 红线淘汰规则
 * 命中任意一条即从候选池剔除
 */
const RedLineFilters = {
  RULES: [
    { name: 'ST/*ST',        test: q => /ST|\*ST/i.test(q.name) },
    { name: '跌停附近',       test: q => q.pct <= -9.5 },
    { name: '涨停封板',       test: q => q.pct >= 9.9 },
    { name: '流动性不足',     test: q => (q.amount || 0) < 2000_0000 },        // 成交额 < 2000 万
    { name: '换手异常',       test: q => (q.turnover || 0) > 35 },
    { name: '市值过小',       test: q => (q.floatMarketCap || 0) < 20_0000_0000 }, // 流通市值 < 20 亿
    { name: '价格异常',       test: q => !q.price || q.price <= 0 },
    { name: '停牌',          test: q => !q.volume || q.volume <= 0 },
  ],

  apply(quotes) {
    const passed = [];
    const stats = { total: quotes.length, filtered: {} };
    for (const q of quotes) {
      let killed = false;
      for (const rule of this.RULES) {
        if (rule.test(q)) {
          q._redline = rule.name;
          stats.filtered[rule.name] = (stats.filtered[rule.name] || 0) + 1;
          killed = true;
          break;
        }
      }
      if (!killed) passed.push(q);
    }
    stats.passed = passed.length;
    this.lastStats = stats;
    return passed;
  }
};
