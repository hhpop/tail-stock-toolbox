/**
 * 10 大尾盘策略
 * 每个策略返回：{ key, name, desc, list }
 * list 中的每项包含 _score（策略内评分）与 _reason（入选理由）
 */
const Strategies = {
  // 1. 尾盘主力净流入
  tailMainInflow(quotes) {
    return quotes
      .filter(q => {
        const ratio = (q.netInflow || 0) / (q.amount || 1);
        return ratio > 0.05 && q.pct > 1.5 && q.pct < 7.5;
      })
      .map(q => ({
        ...q,
        _score: ((q.netInflow / (q.amount || 1)) * 100 * 3 + q.pct).toFixed(1),
        _reason: '主力净流入占比 ' + ((q.netInflow / (q.amount || 1)) * 100).toFixed(1) + '%',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 2. 尾盘放量突破
  tailVolumeBreakout(quotes) {
    return quotes
      .filter(q => q.volumeRatio > 2 && q.pct > 1 && q.pct < 6.5)
      .map(q => ({
        ...q,
        _score: (q.volumeRatio * 10 + q.pct * 3).toFixed(1),
        _reason: '量比 ' + q.volumeRatio + '，涨幅 ' + q.pct + '%',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 3. 尾盘温和上涨
  tailGentleRise(quotes) {
    return quotes
      .filter(q => q.pct >= 1 && q.pct <= 4 && q.turnover >= 1 && q.turnover <= 8 && q.amount > 5000_0000)
      .map(q => ({
        ...q,
        _score: (q.pct * 5 + q.volumeRatio * 5).toFixed(1),
        _reason: '温和上涨 ' + q.pct + '%，换手 ' + q.turnover + '%',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 4. 尾盘资金驱动
  tailCapitalDriven(quotes) {
    return quotes
      .filter(q => {
        const ratio = (q.netInflow || 0) / (q.amount || 1);
        return ratio > 0.10 && q.pct > 0 && q.pct < 8;
      })
      .map(q => ({
        ...q,
        _score: ((q.netInflow / (q.amount || 1)) * 100 * 4).toFixed(1),
        _reason: '资金驱动占比 ' + ((q.netInflow / (q.amount || 1)) * 100).toFixed(1) + '%',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 5. 尾盘抢筹（涨速快）
  tailGrab(quotes) {
    return quotes
      .filter(q => q.speed > 0.5 && q.netInflow > 0 && q.pct > 1)
      .map(q => ({
        ...q,
        _score: (q.speed * 20 + q.pct * 2).toFixed(1),
        _reason: '涨速 ' + q.speed + '%，资金净流入',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 6. 尾盘量价齐升
  tailVolPriceRise(quotes) {
    return quotes
      .filter(q => q.volumeRatio > 1.5 && q.netInflow > 0 && q.pct > 2 && q.pct < 7)
      .map(q => ({
        ...q,
        _score: (q.volumeRatio * 8 + q.pct * 4).toFixed(1),
        _reason: '量比 ' + q.volumeRatio + ' + 资金流入',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 7. 尾盘低换手强势
  tailLowTurnoverStrong(quotes) {
    return quotes
      .filter(q => q.turnover > 0 && q.turnover < 5 && q.pct > 2 && q.pct < 8)
      .map(q => ({
        ...q,
        _score: (q.pct * 10 - q.turnover * 2).toFixed(1),
        _reason: '低换手 ' + q.turnover + '%，涨幅 ' + q.pct + '%',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 8. 尾盘中小市值活跃
  tailMidSmallActive(quotes) {
    return quotes
      .filter(q => {
        const cap = q.floatMarketCap || 0;
        return cap >= 50_0000_0000 && cap <= 200_0000_0000 && q.pct > 2 && q.volumeRatio > 1.3;
      })
      .map(q => ({
        ...q,
        _score: (q.pct * 5 + q.volumeRatio * 8).toFixed(1),
        _reason: '中小市值活跃',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 9. 尾盘低振幅蓄势
  tailLowAmpAccumulate(quotes) {
    return quotes
      .filter(q => q.amplitude > 0 && q.amplitude < 4 && q.pct > 0.5 && q.pct < 3.5)
      .map(q => ({
        ...q,
        _score: (100 - q.amplitude * 10 + q.pct * 5).toFixed(1),
        _reason: '低振幅 ' + q.amplitude + '%，蓄势中',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },

  // 10. 尾盘冲高试盘
  tailTestHigh(quotes) {
    return quotes
      .filter(q => q.speed > 0.3 && q.pct > 3 && q.pct < 8 && q.volumeRatio > 1.2)
      .map(q => ({
        ...q,
        _score: (q.speed * 15 + q.pct * 4 + q.volumeRatio * 3).toFixed(1),
        _reason: '涨速 ' + q.speed + '%，试盘信号',
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);
  },
};

/** 策略元数据，用于 UI 展示 */
Strategies.META = [
  { key: 'tailMainInflow',         name: '尾盘主力净流入',   desc: '尾盘主力资金净流入占比 > 5%' },
  { key: 'tailVolumeBreakout',     name: '尾盘放量突破',     desc: '量比 > 2，涨幅 1%~6.5%' },
  { key: 'tailGentleRise',         name: '尾盘温和上涨',     desc: '涨幅 1%~4%，换手 1%~8%' },
  { key: 'tailCapitalDriven',      name: '尾盘资金驱动',     desc: '主力净流入占成交额 > 10%' },
  { key: 'tailGrab',               name: '尾盘抢筹',         desc: '涨速 > 0.5%，资金净流入' },
  { key: 'tailVolPriceRise',       name: '尾盘量价齐升',     desc: '量比 > 1.5 + 资金流入' },
  { key: 'tailLowTurnoverStrong',  name: '尾盘低换手强势',   desc: '换手 < 5%，涨幅 2%~8%' },
  { key: 'tailMidSmallActive',     name: '尾盘中小市值活跃', desc: '流通市值 50~200 亿' },
  { key: 'tailLowAmpAccumulate',   name: '尾盘低振幅蓄势',   desc: '振幅 < 4%，微涨 0.5%~3.5%' },
  { key: 'tailTestHigh',           name: '尾盘冲高试盘',     desc: '涨速 > 0.3%，涨幅 3%~8%' },
];
