import { useState, useEffect } from 'react';
import axios from 'axios';
import '../assets/Dashboard.css';
import Maps from './Maps';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div
        style={{
          background: '#fff',
          border: '1px solid #dbe2ea',
          padding: '10px 12px',
          borderRadius: '10px',
          boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, color: '#111827' }}>{d.name}</p>
        <p style={{ margin: '4px 0 0 0', color: '#475569' }}>
          출근 하차합: {Number(d.x ?? 0).toLocaleString()}
        </p>
        <p style={{ margin: '2px 0 0 0', color: '#475569' }}>
          퇴근 승차합: {Number(d.y ?? 0).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const Card = () => {
  const [selectedYear, setSelectedYear] = useState(2021);
  const [loading, setLoading] = useState(true);

  const [data, setData] = useState([]);
  const [avg, setAvg] = useState({ x: 0, y: 0 });

  const [kpiData, setKpiData] = useState({
    commute: {
      boarding: null,
      alighting: null,
    },
    weekday: {
      boarding: null,
      alighting: null,
    },
    weekend: {
      am_boarding: null,
      am_alighting: null,
      pm_boarding: null,
      pm_alighting: null,
    },
  });

  const [weekendLines, setWeekendLines] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoverStations, setHoverStations] = useState([]);
  const [hoverLoading, setHoverLoading] = useState(false);

  const fmt = (n) => Number(n ?? 0).toLocaleString();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [kpiRes, scatterRes] = await Promise.all([
          axios.get(`http://localhost:8000/data/kpi?year=${selectedYear}`),
          axios.get(`http://localhost:8000/data/scatter?year=${selectedYear}`),
        ]);

        setKpiData(kpiRes.data);

        const rows = scatterRes.data?.data || [];
        setData(
          rows.map((r) => ({
            x: r.x_value,
            y: r.y_value,
            name: r.역명,
          }))
        );

        if (rows.length > 0) {
          setAvg({
            x: rows[0].avg_x ?? 0,
            y: rows[0].avg_y ?? 0,
          });
        } else {
          setAvg({ x: 0, y: 0 });
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        setData([]);
        setAvg({ x: 0, y: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  useEffect(() => {
    const fetchWeekendLines = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/data/weekend-lines?year=${selectedYear}`);
        setWeekendLines(res.data?.items || []);
      } catch (error) {
        console.error('주말 노선 데이터 로드 실패:', error);
        setWeekendLines([]);
      }
    };

    fetchWeekendLines();
  }, [selectedYear]);

  const handleLineHover = async (line) => {
    try {
      setHoveredLine(line);
      setHoverLoading(true);

      const res = await axios.get(
        `http://localhost:8000/data/weekend-line-stations?year=${selectedYear}&line=${encodeURIComponent(line)}`
      );

      setHoverStations(res.data?.items || []);
    } catch (error) {
      console.error('호선별 역 순위 데이터 로드 실패:', error);
      setHoverStations([]);
    } finally {
      setHoverLoading(false);
    }
  };

  const handleLineLeave = () => {
    setHoveredLine(null);
    setHoverStations([]);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="center-section">
        <select
          className="dropdown"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {Array.from({ length: 2021 - 2008 + 1 }, (_, i) => 2008 + i).map((year) => (
            <option key={year} value={year}>
              {year}년
            </option>
          ))}
        </select>
      </div>

      <div className="kpi-grid-3">
        <div className="box kpi-card">
          <span className="kpi-title">출근시간 최대 승하차</span>
          <div className="kpi-card-body kpi-2col">
            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 승차</span>
              <div className="kpi-value" title={kpiData.commute.boarding?.역명 ?? '-'}>
                {kpiData.commute.boarding?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.commute.boarding?.값)}명</span>
            </div>

            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 하차</span>
              <div className="kpi-value" title={kpiData.commute.alighting?.역명 ?? '-'}>
                {kpiData.commute.alighting?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.commute.alighting?.값)}명</span>
            </div>
          </div>
        </div>

        <div className="box kpi-card">
          <span className="kpi-title">퇴근시간 최대 승하차</span>
          <div className="kpi-card-body kpi-2col">
            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 승차</span>
              <div className="kpi-value" title={kpiData.weekday.boarding?.역명 ?? '-'}>
                {kpiData.weekday.boarding?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.weekday.boarding?.값)}명</span>
            </div>

            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 하차</span>
              <div className="kpi-value" title={kpiData.weekday.alighting?.역명 ?? '-'}>
                {kpiData.weekday.alighting?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.weekday.alighting?.값)}명</span>
            </div>
          </div>
        </div>

        <div className="box kpi-card">
          <span className="kpi-title">주말 최대 승하차</span>
          <div className="kpi-card-body kpi-4col">
            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 오전 승차</span>
              <div className="kpi-value kpi-value-sm" title={kpiData.weekend.am_boarding?.역명 ?? '-'}>
                {kpiData.weekend.am_boarding?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.weekend.am_boarding?.값)}명</span>
            </div>

            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 오전 하차</span>
              <div className="kpi-value kpi-value-sm" title={kpiData.weekend.am_alighting?.역명 ?? '-'}>
                {kpiData.weekend.am_alighting?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.weekend.am_alighting?.값)}명</span>
            </div>

            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 오후 승차</span>
              <div className="kpi-value kpi-value-sm" title={kpiData.weekend.pm_boarding?.역명 ?? '-'}>
                {kpiData.weekend.pm_boarding?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.weekend.pm_boarding?.값)}명</span>
            </div>

            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 오후 하차</span>
              <div className="kpi-value kpi-value-sm" title={kpiData.weekend.pm_alighting?.역명 ?? '-'}>
                {kpiData.weekend.pm_alighting?.역명 ?? '-'}
              </div>
              <span className="kpi-sub">{fmt(kpiData.weekend.pm_alighting?.값)}명</span>
            </div>
          </div>
        </div>
      </div>

      <div className="box map-section">
        <Maps year={selectedYear}>
          {loading && <div className="loading-overlay">데이터 분석 중...</div>}
        </Maps>
      </div>

      <div className="map-info-wrap">
        <div className="analytics-info-bar">
          <div className="info-group">
            <span className="info-label">분석 지표</span>
            <div className="info-content">
              역별 <span className="help-dot" data-tooltip-id="tt-pattern">전체 이용 패턴</span> 대비 성격별
              <span className="norm-text" data-tooltip-id="tt-norm"> 100% 환산 상대적 점유 비중</span>
            </div>
          </div>

          <div className="info-group">
            <span className="info-label">도출 유형</span>
            <div className="type-tags">
              <div className="type-tag">
                <span className="dot focus" />
                <span className="type-name">집중 지역</span>
                <span className="val-sub">1위 비중 50%↑</span>
              </div>

              <div className="type-tag">
                <span className="dot dominant" />
                <span className="type-name">우세 지역</span>
                <span className="val-sub">비중 격차 5~49%</span>
              </div>

              <div className="type-tag">
                <span className="dot mixed" />
                <span className="type-name">복합 지역</span>
                <span className="val-sub">비중 격차 5%↓</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="box ad-plan-container">
        <div className="plan-section">
          <div className="plan-card">
            <h4>(평일) 직장인 타겟 광고</h4>

            <div className="weekday-scatter-wrap">
              <div className="weekday-scatter-title">직장인 이동 패턴 산점도</div>

              <div className="scatter-chart-box">
                <ResponsiveContainer width="100%" height={380}>
                  <ScatterChart margin={{ top: 18, right: 24, bottom: 26, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="x"
                      name="출근 하차"
                      type="number"
                      domain={['auto', 'auto']}
                      tickCount={5}
                      tickFormatter={(v) => Number(v).toLocaleString()}
                      label={{ value: '출근 하차합', position: 'insideBottom', offset: -4 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="y"
                      name="퇴근 승차"
                      width={86}
                      tickFormatter={(v) => Number(v).toLocaleString()}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: '승차합',
                        angle: -90,
                        position: 'insideLeft',
                        offset: 14,
                        style: { textAnchor: 'middle' },
                      }}
                    />
                    <ReferenceLine
                      x={avg.x}
                      stroke="red"
                      strokeDasharray="4 4"
                      label={{ value: '출근평균', position: 'top', fill: '#64748b', fontSize: 12 }}
                    />
                    <ReferenceLine
                      y={avg.y}
                      stroke="blue"
                      strokeDasharray="4 4"
                      label={{ value: '퇴근평균', position: 'right', fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter name="역" data={data} fill="#6366f1" opacity={0.72} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="scatter-info-bar">
                <div className="info-group">
                  <span className="info-label">여기부분 추가해야 해요 설명을</span>
                  <div className="type-tags">
                    <div className="type-tag">
                      <span className="dot focus" />
                      <span className="type-name">집중 지역</span>
                      <span className="val-sub">1위 비중 50%↑</span>
                    </div>
                    <div className="type-tag">
                      <span className="dot dominant" />
                      <span className="type-name">우세 지역</span>
                      <span className="val-sub">비중 격차 5~49%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="plan-section">
          <div className="plan-card">
            <h4>(주말) 여가/쇼핑 타겟 광고</h4>
            <p className="plan-desc">주말/공휴일 13~18시 피크 유동 기준 상위 3개 노선</p>

            <div className="weekend-line-rank">
              {weekendLines.map((item) => {
                const max = weekendLines[0]?.weekend_peak || 1;
                const widthPct = (item.weekend_peak / max) * 100;

                return (
                  <div
                    key={`${item.src_year}-${item.호선}`}
                    className="line-rank-item"
                    onMouseEnter={() => handleLineHover(item.호선)}
                    onMouseLeave={handleLineLeave}
                  >
                    <div className="line-rank-header">
                      <span className="line-rank-title">
                        {item.rn}위 {item.호선}
                      </span>
                      <span className="line-rank-value">최고점 {fmt(item.weekend_peak)}</span>
                    </div>

                    <div className="line-rank-bar-wrap">
                      <div
                        className={`line-rank-bar rank-${item.rn}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>

                    {hoveredLine === item.호선 && (
                      <div className="line-hover-box">
                        <div className="line-hover-title">
                          {selectedYear}년 · {item.호선} 주말 유동 핵심역 TOP5
                        </div>

                        {hoverLoading ? (
                          <div className="line-hover-loading">불러오는 중...</div>
                        ) : hoverStations.length > 0 ? (
                          <ol className="line-hover-list">
                            {hoverStations.map((station, idx) => (
                              <li key={`${station.역명}-${idx}`}>
                                <span className="station-name">
                                  {station.rn}위 {station.역명}
                                </span>
                                <span>{fmt(station.weekend_peak)}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <div className="line-hover-empty">데이터가 없습니다.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ReactTooltip id="tt-pattern" place="top" className="custom-tooltip">
        <div>[주거 지수] (출근 승차 수 + 퇴근 하차 수) / 전체</div>
        <div>[업무 지수] (출근 하차 수 + 퇴근 승차 수) / 전체</div>
        <div>[여가 지수] (평일 오후 하차 수 + 주말 하차 수) / 전체</div>
      </ReactTooltip>

      <ReactTooltip id="tt-norm" place="top" className="custom-tooltip">
        <div>특정 성격 지수 / (주거+업무+여가 지수 합계)</div>
        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
          * 해당 역 정체성의 상대적 지분을 나타냅니다.
        </div>
      </ReactTooltip>
    </div>
  );
};

export default Card;