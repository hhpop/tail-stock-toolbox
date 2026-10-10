/**
 * 动态评分引擎
 * 综合：涨幅 / 量比 / 资金 / 换手 / 涨速
 */
const Scoring = {
  _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },

  compute(q) {
    const pct       = q.pct || 0;
    const volRatio  = q.volumeRatio || 0;
    const turnover  = q.turnover || 0;
    const speed     = q.speed || 0;
    const netIn     = q.netInflow || 0;
    const amount    = q.amount || 1;
    const ratio     = netIn / amount;

    // 涨幅分（0~100）：1%~6% 区间最优
    let pctScore = 0;
    if (pct > 0) pctScore = this._clamp((pct / 8) * 100, 0, 100);
    if (pct > 7) pctScore = Math.max(0, 100 - (pct - 7) * 20);

    // 量比分（0~100）：1.5~4 最优
    const volScore = this._clamp(((volRatio - 0.5) / 3.5) * 100, 0, 100);

    // 资金分（0~100）：主力净流入占成交额 0~20%
    const flowScore = this._clamp((ratio / 0.2) * 100, 0, 100);

    // 换手分（0~100）：2~15% 最优
    let turnScore = 0;
    if (turnover > 0) {
      turnScore = this._clamp((turnover / 15) * 100, 0, 100);
      if (turnover > 15) turnScore = Math.max(0, 100 - (turnover - 15) * 5);
    }

    // 涨速分（0~100）
    const speedScore = this._clamp((speed / 1.5) * 100, 0, 100);

    const total = Math.round(
      pctScore * 0.30 +
      volScore * 0.20 +
      flowScore * 0.25 +
      turnScore * 0.10 +
      speedScore * 0.15
    );
    return this._clamp(total, 0, 100);
  }
};
