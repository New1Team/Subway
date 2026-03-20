import { useState, useEffect } from 'react';
import axios from 'axios';
import '../assets/Dashboard.css';
import Maps from './Maps';

const Card = () => {
  // --- 상태 관리 ---
  const [selectedYear, setSelectedYear] = useState(2021);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    commute: { station: "-", count: 0 },
    weekday: { station: "-", count: 0 },
    weekend: { station: "-", count: 0 }
  });

  // --- 데이터 호출: 연도가 바뀔 때마다 실행 ---
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
 
  const fmt = (n) => Number(n ?? 0).toLocaleString();

  return (
    <div className="dashboard-wrapper">
      {/* 1. 연도 선택 드롭다운 */}
      <div className="center-section">
        <select 
          className="dropdown" 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {Array.from({ length: 2021 - 2008 + 1 }, (_, i) => 2008 + i).map((year) => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
      </div>

      {/* 2. 핵심 지표 (KPI) 카드 섹션 */}
       <div className="kpi-grid-3">

        {/* 출근시간 — 2섹션 (승차 | 하차) */}
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

        {/* 퇴근시간 — 2섹션 (승차 | 하차) */}
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

        {/* 주말 — 4섹션 (오전 승차 | 오전 하차 | 오후 승차 | 오후 하차) */}
        <div className="box kpi-card">
          <span className="kpi-title">주말 최다 승하차</span>
          <div className="kpi-card-body kpi-4col">

            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 오전 승차</span>
              <div className="kpi-value kpi-value-sm">{kpiData.weekend.am_boarding?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.weekend.am_boarding?.값)}명</span>
            </div>
            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 오전 하차</span>
              <div className="kpi-value kpi-value-sm">{kpiData.weekend.am_alighting?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.weekend.am_alighting?.값)}명</span>
            </div>
            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label boarding">🟢 오후 승차</span>
              <div className="kpi-value kpi-value-sm">{kpiData.weekend.pm_boarding?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.weekend.pm_boarding?.값)}명</span>
            </div>
            <div className="kpi-divider" />

            <div className="kpi-section">
              <span className="kpi-section-label alighting">🔴 오후 하차</span>
              <div className="kpi-value kpi-value-sm">{kpiData.weekend.pm_alighting?.역명 ?? '-'}</div>
              <span className="kpi-sub">{fmt(kpiData.weekend.pm_alighting?.값)}명</span>
            </div>

          </div>
        </div>

      </div>

      {/* 3. 지도 시각화 섹션 */}
      <div className="box map-section">
        <Maps year={selectedYear}>
        {loading && <div className="loading-overlay">데이터 분석 중...</div>}
        </Maps>
      </div>

      {/* 4. 데이터 하단 설명 바 */}
      <div className="box description-bar">
        정보: 주거지 | 업무지구 | 여가지역 분석 (Spark ETL 기반 데이터)
      </div>

      {/* 5. 비즈니스 광고 전략 가이드 */}
      <div className="box ad-plan-container">
        <div className="plan-section">
          <h4>(평일) 직장인 타겟 광고</h4>
          <ul>
            <li>출근시간-하차 집중역 <span className="highlight">TOP 3</span></li>
            <li>퇴근시간-승차 집중역 <span className="highlight">TOP 3</span></li>
          </ul>
        </div>
        <div className="plan-section">
          <h4>(주말) 여가/쇼핑 타겟 광고</h4>
          <ul>
            <li>유동인구 최고점 <span className="highlight">상위 3개 노선</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Card;