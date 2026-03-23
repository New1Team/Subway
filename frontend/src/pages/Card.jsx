import { useState, useEffect } from 'react';
import axios from 'axios';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import '../assets/Dashboard.css';
import Maps from './Maps';

const Card = () => {
  const [selectedYear, setSelectedYear] = useState(2021);
  const [loading, setLoading] = useState(true);

  const [kpiData, setKpiData] = useState({
    commute: { station: "-", count: 0 },
    weekday: { station: "-", count: 0 },
    weekend: { station: "-", count: 0 }
  });

  // 주말 여가/쇼핑 광고용 상태
  const [weekendLines, setWeekendLines] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoverStations, setHoverStations] = useState([]);
  const [hoverLoading, setHoverLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mapRes, kpiRes] = await Promise.all([
          axios.get(`http://localhost:8000/data?year=${selectedYear}`),
          axios.get(`http://localhost:8000/data/kpi?year=${selectedYear}`)
        ]);

        setKpiData(kpiRes.data);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
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
        setWeekendLines(res.data.items || []);
      } catch (error) {
        console.error("주말 노선 데이터 로드 실패:", error);
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

      setHoverStations(res.data.items || []);
    } catch (error) {
      console.error("호선별 역 순위 데이터 로드 실패:", error);
      setHoverStations([]);
    } finally {
      setHoverLoading(false);
    }
  };

  const handleLineLeave = () => {
    setHoveredLine(null);
    setHoverStations([]);
  };

  const fmt = (n) => Number(n ?? 0).toLocaleString();

  return (
    <div className="dashboard-wrapper">
      {/* 1. 연도 선택 */}
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

      {/* 2. KPI 카드 */}
      <div className="kpi-grid-3">
        <div className="box kpi-card">
          <span className="kpi-title">출근시간 최다 승하차</span>
          <div className="kpi-card-body kpi-2col">
            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 승차</span>
              <div className="kpi-value">{kpiData.commute.boarding?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.commute.boarding?.값)}명</span>
            </div>
            <div className="kpi-divider" />
            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 하차</span>
              <div className="kpi-value">{kpiData.commute.alighting?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.commute.alighting?.값)}명</span>
            </div>
          </div>
        </div>

        <div className="box kpi-card">
          <span className="kpi-title">퇴근시간 최다 승하차</span>
          <div className="kpi-card-body kpi-2col">
            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 승차</span>
              <div className="kpi-value">{kpiData.weekday.boarding?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.weekday.boarding?.값)}명</span>
            </div>
            <div className="kpi-divider" />
            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 하차</span>
              <div className="kpi-value">{kpiData.weekday.alighting?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.weekday.alighting?.값)}명</span>
            </div>
          </div>
        </div>

        <div className="box kpi-card">
          <span className="kpi-title">주말 최다 승하차</span>
          <div className="kpi-card-body kpi-4col">
            {[
              { label: '오전 승차', data: kpiData.weekend.am_boarding },
              { label: '오전 하차', data: kpiData.weekend.am_alighting },
              { label: '오후 승차', data: kpiData.weekend.pm_boarding },
              { label: '오후 하차', data: kpiData.weekend.pm_alighting }
            ].map((item, idx) => (
              <div key={idx} className="kpi-section">
                <span className={`kpi-section-label ${item.label.includes('승차') ? 'boarding' : 'alighting'}`}>
                  {item.label.includes('승차') ? '🟢' : '🔴'} {item.label}
                </span>
                <div className="kpi-value kpi-value-sm">{item.data?.역명 ?? '-'}</div>
                <span className="kpi-sub">{fmt(item.data?.값)}명</span>
                {idx < 3 && <div className="kpi-divider-v" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 지도 섹션 */}
      <div className="box map-section">
        <Maps year={selectedYear}>
          {loading && <div className="loading-overlay">데이터 분석 중...</div>}
        </Maps>
      </div>

      {/* 4. 데이터 하단 설명 바 */}
      <div className="box analytics-info-bar">
        <div className="info-group">
          <span className="info-label">분석 지표</span>
          <div className="info-content">
            역별 <span className="help-dot" data-tooltip-id="tt-pattern">전체 이용 패턴</span> 대비 성격별 
            <span className="norm-text" data-tooltip-id="tt-norm"> 100% 환산 상대적 점유 비중</span>
          </div>
        </div>

        <div className="info-divider-h" />

        <div className="info-group">
          <span className="info-label">도출 유형</span>
          <div className="type-tags">
            <div className="type-tag">
              <span className="dot focus" />
              <span className="type-name">집중 지역</span>
              <span className="val">1위 비중 50%↑</span>
            </div>
            <div className="type-tag">
              <span className="dot dominant" />
              <span className="type-name">우세 지역</span>
              <span className="val">비중 격차 5~49%</span>
            </div>
            <div className="type-tag">
              <span className="dot mixed" />
              <span className="type-name">복합 지역</span>
              <span className="val">비중 격차 5%↓</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. 광고 전략 */}
      <div className="box ad-plan-container">
        <div className="plan-section">
          <h4>(평일) 직장인 타겟 광고</h4>
          <ul>
            <li>출근시간-하차 집중역 <span className="highlight">TOP 3</span></li>
            <li>퇴근시간-승차 집중역 <span className="highlight">TOP 3</span></li>
          </ul>
        </div>
        {/* 5.2 관고 전략 (주말) 여가/쇼핑 타겟 광고 */}
        <div className="plan-section">
          <h4>(주말) 여가/쇼핑 타겟 광고</h4>
          <p className="plan-desc">
            주말/공휴일 13~18시 피크 유동 기준 상위 3개 노선
          </p>

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
                      {item.rn}위 {item.호선}호선
                    </span>
                    <span className="line-rank-value">
                      최고점 {fmt(item.weekend_peak)}
                    </span>
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
                        {selectedYear}년 · {item.호선}호선 주말 유동 핵심역 TOP5
                      </div>

                      {hoverLoading ? (
                        <div className="line-hover-loading">불러오는 중...</div>
                      ) : hoverStations.length > 0 ? (
                        <ol className="line-hover-list">
                          {hoverStations.map((station, idx) => (
                            <li key={`${station.역명}-${idx}`}>
                              <span>
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

      {/* 4.1 [개선] 데이터 하단 설명 바를 위한 라이버러리 - Tooltip Content */} 
      <Tooltip id="tt-pattern" place="top" className="custom-tooltip">
        <div>[주거 지수] (출근 승차 수 + 퇴근 하차 수) / 전체</div>
        <div>[업무 지수] (출근 하차 수 + 퇴근 승차 수) / 전체</div>
        <div>[여가 지수] (평일 오후 하차 수 + 주말 하차 수) / 전체</div>
      </Tooltip>

      <Tooltip id="tt-norm" place="top" className="custom-tooltip">
        <div>특정 성격 지수 / (주거+업무+여가 지수 합계)</div>
        <div style={{ fontSize: '11px', color: '#ccc', marginTop: '5px' }}>
          * 해당 역 정체성의 상대적 지분을 나타냅니다.
        </div>
      </Tooltip>
    </div>
  );
};

export default Card;