import { useState, useEffect } from 'react';
import axios from 'axios';
import '../assets/Dashboard.css';
import Maps from './Maps'; // 지도 시각화 컴포넌트
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"; // 차트 라이브러리
import { Tooltip as ReactTooltip } from 'react-tooltip'; // 일반 UI 툴팁 라이브러리

/**
 * [Sub-Component] CustomTooltip
 * 산점도(ScatterChart)의 각 점에 마우스를 올렸을 때 나타나는 커스텀 툴팁
 */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div style={{ background: "#fff", border: "1px solid #ccc", padding: "8px", borderRadius: "6px" }}>
        <p style={{ margin: 0, fontWeight: "bold" }}>{d.name}</p>
        <p style={{ margin: 0 }}>출근 하차 전체합: {d.x.toLocaleString()}</p>
        <p style={{ margin: 0 }}>퇴근 승차 전체합: {d.y.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const Card = () => {
  // --- 1. 상태 관리 (State Management) ---
  const [selectedYear, setSelectedYear] = useState(2021); // 선택된 조회 연도
  const [loading, setLoading] = useState(true);          // 메인 데이터 로딩 상태
  const [data, setData] = useState([]);                  // 산점도용 역별 데이터
  const [avg, setAvg] = useState({ x: 0, y: 0 });        // 산점도 기준선(평균값)
  
  // KPI 데이터: 출근/퇴근/주말 최다 이용 역 정보
  const [kpiData, setKpiData] = useState({
    commute: { station: "-", count: 0 },
    weekday: { station: "-", count: 0 },
    weekend: { station: "-", count: 0 }
  });

  // 주말 노선 관련 상태
  const [weekendLines, setWeekendLines] = useState([]);  // 주말 유동인구 상위 노선 목록
  const [hoveredLine, setHoveredLine] = useState(null);  // 현재 마우스 오버된 노선 번호
  const [hoverStations, setHoverStations] = useState([]); // 특정 노선 호버 시 나타나는 역 순위 데이터
  const [hoverLoading, setHoverLoading] = useState(false); // 노선별 역 데이터 로딩 상태

  // --- 2. 데이터 호출 (Data Fetching) ---

  // [Effect] 연도 변경 시 메인 KPI 및 산점도 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // KPI 데이터와 산점도 데이터를 병렬로 호출
        const [kpiRes, scatterRes] = await Promise.all([
          axios.get(`http://localhost:8000/data/kpi?year=${selectedYear}`),
          axios.get(`http://localhost:8000/data/scatter?year=${selectedYear}`),
        ]);

        setKpiData(kpiRes.data);

        // 산점도 데이터 형식 변환 (Chart 전용 객체 배열로 매핑)
        const rows = scatterRes.data.data;
        setData(rows.map((r) => ({ x: r.x_value, y: r.y_value, name: r.역명 })));
        
        // 데이터가 있을 경우 첫 번째 로우에 포함된 평균값을 State에 저장 (ReferenceLine용)
        if (rows.length > 0) setAvg({ x: rows[0].avg_x, y: rows[0].avg_y });

      } catch (error) {
        console.error("데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  // [Effect] 연도 변경 시 주말 노선 순위 데이터 로드
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

  // --- 3. 이벤트 핸들러 (Event Handlers) ---

  // 주말 노선 바(Bar)에 마우스 올렸을 때 해당 노선의 TOP 5 역 정보 호출
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

  // 마우스가 노선 영역을 벗어날 때 상태 초기화
  const handleLineLeave = () => {
    setHoveredLine(null);
    setHoverStations([]);
  };

  // 천 단위 콤마 포맷 함수
  const fmt = (n) => Number(n ?? 0).toLocaleString();

  return (
    <div className="dashboard-wrapper">
      
      {/* 1. 상단 연도 선택 드롭다운 */}
      <div className="center-section">
        <select 
          className="dropdown" 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {/* 2008년부터 2021년까지 옵션 생성 */}
          {Array.from({ length: 2021 - 2008 + 1 }, (_, i) => 2008 + i).map((year) => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
      </div>

      {/* 2. 핵심 지표 (KPI) 카드 섹션: 주요 시간대별 1위 역 표시 */}
      <div className="kpi-grid-3">
        {/* 출근시간 KPI */}
        <div className="box kpi-card">
          <span className="kpi-title">출근시간 최다 승하차</span>
          <div className="kpi-card-body kpi-2col"> {/*출근/퇴근 카드의 2열(승차/하차) 레이아웃 */}
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

        {/* 퇴근시간 KPI (코드상 필드명은 weekday로 되어 있음) */}
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

        {/* 주말 KPI: 오전/오후 승하차 분리 표시 */}
        <div className="box kpi-card">
          <span className="kpi-title">주말 최다 승하차</span>
          {/* 주말 카드의 4열(오전·오후 승차/하차) 레이아웃 */}
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
            {/* ... 오후 섹션 생략 ... */}
          </div>
        </div>
      </div>

      {/* 3. 지도 시각화 섹션 */}
      <div className="box map-section">
        <Maps year={selectedYear}>
          {/* 지도 위에 표시되는 "데이터 분석 중..." 오버레이 */}
          {loading && <div className="loading-overlay">데이터 분석 중...</div>}
        </Maps>
      </div>

       {/* 4. 산점도 차트: 직장인 타겟팅 분석 (X:출근하차, Y:퇴근승차)  */}
       {/* 산점도 차트를 감싸는 box 섹션 padding 조정용 */}
      <div className="box description-bar">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" name="출근 하차" type="number" domain={['auto','auto']} tickCount={5} tickFormatter={(v) => v.toLocaleString()} label={{ value: "출근 하차합", position: "insideBottom", offset: -10 }} />
            <YAxis dataKey="y" name="퇴근 승차" tickFormatter={(v) => v.toLocaleString()} label={{ value: "퇴근 승차합", angle: 0, position: "insideLeft", offset : -90, style:{textAnchor: "middle"} }} />
            
            {/* 평균선: 업무 지구/주거 지구를 구분하는 기준선 */}
            <ReferenceLine x={avg.x} stroke="red" strokeDasharray="4 4" label={{value :"출근평균"}} />
            <ReferenceLine y={avg.y} stroke="blue" strokeDasharray="4 4" label={{ value:"퇴근평균", position: "insideBottom", offset:-20, fill:"black", font_size:12 }} />
            
            <Tooltip content={<CustomTooltip />} />
            <Scatter name="역" data={data} fill="#6366f1" opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>

        {/* 데이터 도출 기준 안내 바 */}
        <div className="box analytics-info-bar">
          <div className="info-group">
            <span className="info-label">분석 지표</span>
            <div className="info-content">
              역별 <span className="help-dot" data-tooltip-id="tt-pattern">전체 이용 패턴</span> 대비 성격별 
              <span className="norm-text" data-tooltip-id="tt-norm"> 100% 환산 상대적 점유 비중</span>
            </div>
          </div>
          {/* ... 유형 태그(집중, 우세, 복합) 생략 ... */}
        </div>
      </div>

      {/* 5. 광고 전략 섹션 */}
      <div className="box ad-plan-container">
        {/* 평일 타겟 */}
        <div className="plan-section">
          <h4>(평일) 직장인 타겟 광고</h4>
          <ul>
            <li>출근시간-하차 집중역 <span className="highlight">TOP 3</span></li>
            <li>퇴근시간-승차 집중역 <span className="highlight">TOP 3</span></li>
          </ul>
        </div>

        {/* 주말 타겟: 호선별 랭킹 및 호버 시 역 정보 표시 */}
        <div className="plan-section">
          <h4>(주말) 여가/쇼핑 타겟 광고</h4>
          <p className="plan-desc">주말/공휴일 13~18시 피크 유동 기준 상위 3개 노선</p>

          <div className="weekend-line-rank">
            {weekendLines.map((item) => {
              const max = weekendLines[0]?.weekend_peak || 1;
              const widthPct = (item.weekend_peak / max) * 100; // 최대값 대비 비율 계산(Bar 너비)

              return (
                <div
                  key={`${item.src_year}-${item.호선}`}
                  className="line-rank-item"
                  onMouseEnter={() => handleLineHover(item.호선)} // 마우스 진입 시 API 호출
                  onMouseLeave={handleLineLeave}
                >
                  <div className="line-rank-header">
                    <span className="line-rank-title">{item.rn}위 {item.호선}호선</span>
                    <span className="line-rank-value">최고점 {fmt(item.weekend_peak)}</span>
                  </div>

                  <div className="line-rank-bar-wrap">
                    <div className={`line-rank-bar rank-${item.rn}`} style={{ width: `${widthPct}%` }} />
                  </div>

                  {/* 노선 호버 시 보여주는 팝업 상자 */}
                  {hoveredLine === item.호선 && (
                    <div className="line-hover-box">
                      <div className="line-hover-title">{selectedYear}년 · {item.호선}호선 주말 유동 핵심역 TOP5</div>
                      {hoverLoading ? (
                        <div className="line-hover-loading">불러오는 중...</div>
                      ) : (
                        //  노선 호버 팝업 내 "불러오는 중..." 로딩 텍스트
                        <ol className="line-hover-list">
                          {hoverStations.map((station, idx) => (
                            <li key={`${station.역명}-${idx}`}>
                              <span>{station.rn}위 {station.역명}</span>
                              <span>{fmt(station.weekend_peak)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. 외부 도움말 툴팁 정의 */}
      <ReactTooltip id="tt-pattern" place="top" className="custom-tooltip">
        <div>[주거 지수] (출근 승차 수 + 퇴근 하차 수) / 전체</div>
        <div>[업무 지수] (출근 하차 수 + 퇴근 승차 수) / 전체</div>
        <div>[여가 지수] (평일 오후 하차 수 + 주말 하차 수) / 전체</div>
      </ReactTooltip>

      <ReactTooltip id="tt-norm" place="top" className="custom-tooltip">
        <div>특정 성격 지수 / (주거+업무+여가 지수 합계)</div>
        <div style={{ fontSize: '11px', color: '#ccc', marginTop: '5px' }}>
          * 해당 역 정체성의 상대적 지분을 나타냅니다.
        </div>
      </ReactTooltip>
    </div>
  );
};

export default Card;