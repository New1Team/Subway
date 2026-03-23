import { useEffect, useMemo, useState } from "react";
import { Map, CustomOverlayMap } from "react-kakao-maps-sdk";
import { api } from "@utils/network.js";


const Maps = ({ year }) => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [hoveredMarkerId, setHoveredMarkerId] = useState(null);
  const [currCategory, setCurrCategory] = useState("주거지");

  const avgData = { home: 0.352, work: 0.285, culture: 0.363 };

  useEffect(() => {
    if (!year) {
      setMarkers([]);
      return;
    }

    const fetchMapData = async () => {
      try {
        const res = await api.get("/data/map", {
          params: { year, category: currCategory },
        });

        const mapData = Array.isArray(res.data?.data) ? res.data.data : [];

        const formatted = mapData
          .map((item, index) => ({
            id: `station-${index}`,
            title: item["역명"],
            lat: Number(item["위도"]),
            lng: Number(item["경도"]),
            category: item["기본_분류"],
            strategy: item["광고_집행_전략"] || "",
            homeRatio: Number(item["주거_비중"]),
            workRatio: Number(item["산업_비중"]),
            cultureRatio: Number(item["문화_비중"]),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.lat) &&
              Number.isFinite(item.lng) &&
              item.title
          );

        setMarkers(formatted);
      } catch (error) {
        setMarkers([]);
      }
    };

    fetchMapData();
  }, [year, currCategory]);

  const center = { lat: 37.5547, lng: 126.9707 };

  const getAnchor = (markerLat) => {
    if (!map) return 1.2;

    const bounds = map.getBounds();
    const ne = bounds.getNorthEast().getLat();
    const sw = bounds.getSouthWest().getLat();
    const threshold = ne - (ne - sw) * 0.5;

    return markerLat > threshold ? -0.1 : 1.2;
  };

  const getStrategyClass = (strategy = "") => {
    if (strategy.includes("집중")) return "focus";
    if (strategy.includes("우세")) return "dominant";
    return "mixed";
  };

  const workTopStations = useMemo(() => {
    return [...markers]
      .sort((a, b) => b.workRatio - a.workRatio)
      .slice(0, 5);
  }, [markers]);

  const cultureTopStations = useMemo(() => {
    return [...markers]
      .sort((a, b) => b.cultureRatio - a.cultureRatio)
      .slice(0, 5);
  }, [markers]);

  const workAverage = useMemo(() => {
    if (!markers.length) return 0;
    return (
      markers.reduce((acc, cur) => acc + (Number(cur.workRatio) || 0), 0) /
      markers.length
    );
  }, [markers]);

  const cultureAverage = useMemo(() => {
    if (!markers.length) return 0;
    return (
      markers.reduce((acc, cur) => acc + (Number(cur.cultureRatio) || 0), 0) /
      markers.length
    );
  }, [markers]);

  return (
    <div className="center-section">
      <div className="map-section">
        <div className="map-category-buttons">
          {["주거지", "산업지", "문화권"].map((cat) => (
            <button
              key={cat}
              className={`map-category-btn ${currCategory === cat ? "active" : ""}`}
              onClick={() => {
                setHoveredMarkerId(null);
                setCurrCategory(cat);
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <Map
          center={center}
          style={{ width: "100%", height: "100%" }}
          level={8}
          onCreate={setMap}
        >
          {markers.map((marker) => {
            const isHovered = hoveredMarkerId === marker.id;
            const strategyClass = getStrategyClass(marker.strategy);

            return (
              <div key={marker.id}>
                <CustomOverlayMap
                  position={{ lat: marker.lat, lng: marker.lng }}
                  yAnchor={0.5}
                >
                  <div
                    className="map-marker-wrap"
                    onMouseEnter={() => setHoveredMarkerId(marker.id)}
                    onMouseLeave={() => setHoveredMarkerId(null)}
                  >
                    <div className={`map-marker-dot ${strategyClass}`} />
                  </div>
                </CustomOverlayMap>

                {isHovered && (
                  <CustomOverlayMap
                    position={{ lat: marker.lat, lng: marker.lng }}
                    yAnchor={getAnchor(marker.lat)}
                    zIndex={1000}
                  >
                    <div className="map-hover-box">
                      <div className="map-hover-title">{marker.title}</div>
                      <div className="map-hover-subtitle">
                        {marker.category} | {marker.strategy}
                      </div>

                      <div className="map-hover-chart-container">
                        {[
                          {
                            label: "주거",
                            my: marker.homeRatio,
                            avg: avgData.home,
                          },
                          {
                            label: "산업",
                            my: marker.workRatio,
                            avg: avgData.work,
                          },
                          {
                            label: "문화",
                            my: marker.cultureRatio,
                            avg: avgData.culture,
                          },
                        ].map((d) => (
                          <div className="bar-group" key={d.label}>
                            <div className="bar-stack">
                              <div className="bar-column">
                                <span className="v-tip my">
                                  {(d.my * 100).toFixed(1)}
                                </span>
                                <div
                                  className="bar-item my"
                                  style={{ height: `${d.my * 100}%` }}
                                />
                              </div>
                              <div className="bar-column">
                                <span className="v-tip avg">
                                  {(d.avg * 100).toFixed(1)}
                                </span>
                                <div
                                  className="bar-item avg"
                                  style={{ height: `${d.avg * 100}%` }}
                                />
                              </div>
                            </div>
                            <div className="bar-label">{d.label}</div>
                          </div>
                        ))}
                      </div>

                      <div className="chart-legend">
                        <div className="legend-item">
                          <div className="legend-dot my" />
                          해당역(%)
                        </div>
                        <div className="legend-item">
                          <div className="legend-dot avg" />
                          평균(%)
                        </div>
                      </div>
                    </div>
                  </CustomOverlayMap>
                )}
              </div>
            );
          })}
        </Map>
      </div>

      <div className="analytics-info-bar">
        <div className="info-group">
          <span className="info-label">분석 지표</span>
          <span className="info-content">
            역별 <span className="blue-text">전체 이용 패턴</span> 대비 성격별{" "}
            <span className="blue-text">100% 환산</span> 상대적 점유 비중
          </span>
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

      <div className="ad-plan-container">
        <div className="plan-section">
          <div className="plan-card">
            <div className="plan-main-title">(평일) 직장인 타겟 광고</div>
            <div className="plan-desc">
              산업 비중이 높은 역을 기준으로 출퇴근 및 업무 생활권 타겟 노출 우선순위를
              정리했습니다.
            </div>

            <div className="plan-summary-row">
              <div className="plan-summary-box">
                <span className="plan-summary-label">평균 산업 비중</span>
                <span className="plan-summary-value">
                  {(workAverage * 100).toFixed(1)}%
                </span>
              </div>
              <div className="plan-summary-box">
                <span className="plan-summary-label">추천 대상</span>
                <span className="plan-summary-value">오피스/직장인</span>
              </div>
            </div>

            <h4>상위 산업 비중 역</h4>
            <ul>
              {workTopStations.map((station, index) => (
                <li key={station.id}>
                  <div className="plan-list-left">
                    <span className="plan-rank">{index + 1}</span>
                    <span className="station-name">{station.title}</span>
                  </div>
                  <span>{(station.workRatio * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="plan-section">
          <div className="plan-card">
            <div className="plan-main-title">(주말) 여가/쇼핑 타겟 광고</div>
            <div className="plan-desc">
              문화 비중이 높은 역을 기준으로 여가·쇼핑 수요 중심의 주말 광고 집행
              우선순위를 정리했습니다.
            </div>

            <div className="plan-summary-row">
              <div className="plan-summary-box">
                <span className="plan-summary-label">평균 문화 비중</span>
                <span className="plan-summary-value">
                  {(cultureAverage * 100).toFixed(1)}%
                </span>
              </div>
              <div className="plan-summary-box">
                <span className="plan-summary-label">추천 대상</span>
                <span className="plan-summary-value">여가/쇼핑</span>
              </div>
            </div>

            <h4>상위 문화 비중 역</h4>
            <ul>
              {cultureTopStations.map((station, index) => (
                <li key={station.id}>
                  <div className="plan-list-left">
                    <span className="plan-rank">{index + 1}</span>
                    <span className="station-name">{station.title}</span>
                  </div>
                  <span>{(station.cultureRatio * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maps;