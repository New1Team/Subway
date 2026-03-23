import { useState, useEffect, use } from 'react';
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
} from "recharts";



const Card = () => {
  // --- 상태 관리 ---
  const [selectedYear, setSelectedYear] = useState(2021);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    commute: { station: "-", count: 0 },
    weekday: { station: "-", count: 0 },
    weekend: { station: "-", count: 0 }
  })
  const [data, setData] = useState([]);
  const [avg, setAvg] = useState({x:0, y:0});

  

  // --- 데이터 호출: 연도가 바뀔 때마다 실행 ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mapRes, kpiRes,scatterRes] = await Promise.all([
          axios.get(`http://localhost:8000/data?year=${selectedYear}`),
          axios.get(`http://localhost:8000/data/kpi?year=${selectedYear}`),
          axios.get(`http://localhost:8000/data/scatter?year=${selectedYear}`),
        ]);
          
      setKpiData(kpiRes.data);
     
         
  
     // --- 산점도 데이터 로팅(scatter plot)// 
     //차트를 가져올수 있게 형식 변환
    const rows = scatterRes.data.data;
    //전체 평균값을 State에 저장
        setData(rows.map((r) => ({ x: r.x_value, y: r.y_value, name: r.역명 })));
        if (rows.length > 0) setAvg({ x: rows[0].avg_x, y: rows[0].avg_y });

      } catch (error) {
        console.error("데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

     fetchData();
  },[selectedYear]);
 
  const fmt = (n) => Number(n ?? 0).toLocaleString();

  
    //툴팁 : 출근 하차 , 퇴근 승차 전체합을 보여주주는 툴팁// 
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

      {/* 3.1 산점도, 직장인 타겟광고 */}
      {/* x축에 출근 승차합,y축에 퇴근 승차합*/}
{/* tickFormatter={(v) => (v.toLocaleString())} 를 이용해 숫자에 콤마 추가  tick count로 하차 합 단위조절, 차트에 나오는 점 범위들도 같이 조절됨*/}
      <div className="box description-bar">
         <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" />
        {/* x축은 출근 하차 인원수, y축은 퇴근 승차 합을 보여주는  */}
        <XAxis dataKey="x" name="출근 하차" type ="number" domain={['auto','auto']} tickCount={5} tickFormatter={(v) => (v.toLocaleString())} label={{ value: "출근 하차합", position: "insideBottom", offset: -10 }} />
        <YAxis dataKey="y" name="퇴근 승차" tickFormatter={(v) => v.toLocaleString()} label={{ value: "퇴근 승차합", angle: 0, position: "insideLeft", offset : -90, style:{textAnchor: "middle"} }} />
        {/* 평균선, db에서 뽑은 퇴근 평균 승차,출근 평균 승차를 내서 평균점을 잡음 */}
        <ReferenceLine x={avg.x} stroke="red" strokeDasharray="4 4" label={{value :"출근평균"}} />
        <ReferenceLine y={avg.y} stroke="blue" strokeDasharray="4 4" label={{ value:"퇴근평균",position: "insideBottom", offset:-20,fill:"black", font_size:12,}} />
        <Tooltip content={<CustomTooltip />} />
        <Scatter name="역" data={data} fill="#6366f1" opacity={0.7} />
      </ScatterChart>
      </ResponsiveContainer>
          

        {/* 정보: 주거지 | 업무지구 | 여가지역 분석 (Spark ETL 기반 데이터) */}
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
};

export default Card;