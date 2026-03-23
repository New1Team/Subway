import { useEffect, useMemo, useState } from "react";
import { Map, MapMarker, CustomOverlayMap } from "react-kakao-maps-sdk";
import { api } from "@utils/network.js";

const Maps = ({ year }) => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [hoveredMarkerId, setHoveredMarkerId] = useState(null);
  const [currCategory, setCurrCategory] = useState("주거지");

  useEffect(() => {
    if (!year) {
      setMarkers([]);
      return;
    }

    const fetchMapData = async () => {
      try {
        const res = await api.get("/data/map", {
          params: {
            year,
            category: currCategory,
          },
        });

        const mapData = Array.isArray(res.data?.data) ? res.data.data : [];

        const formatted = mapData
          .map((item, index) => {
            const lat = Number(item["위도"]);
            const lng = Number(item["경도"]);

            return {
              id: `station-${index}`,
              stationNo: item["대표역번호"],
              title: item["역명"],
              lat,
              lng,
              category: item["기본_분류"],
              strategy: item["광고_집행_전략"],
              homeRatio: Number(item["주거_비중"]),
              workRatio: Number(item["산업_비중"]),
              cultureRatio: Number(item["문화_비중"]),
              year: item["src_year"],
            };
          })
          .filter(
            (item) =>
              Number.isFinite(item.lat) &&
              Number.isFinite(item.lng)
          );

        setMarkers(formatted);
      } catch (error) {
        console.error("지도 데이터 로드 실패:", error);
        setMarkers([]);
      }
    };

    fetchMapData();
  }, [year, currCategory]);

  const handleCategoryClick = (category) => {
    setHoveredMarkerId(null);
    setCurrCategory(category);
  };

  const center = useMemo(() => {
    if (markers.length > 0) {
      return {
        lat: markers[0].lat,
        lng: markers[0].lng,
      };
    }
    return { lat: 37.5547, lng: 126.9708 };
  }, [markers]);

  const getMarkerImage = (category) => {
    if (category === "주거지") {
      return {
        src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
        size: { width: 40, height: 42 },
      };
    }

    if (category === "산업지") {
      return {
        src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png",
        size: { width: 40, height: 42 },
      };
    }

    return {
      src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
      size: { width: 24, height: 35 },
    };
  };

  return (
    <div
      className="kakaoMap"
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <Map
        center={center}
        style={{ width: "100%", height: "100%" }}
        level={5}
        onCreate={setMap}
      >
        {markers.map((marker) => (
          <div key={marker.id}>
            <MapMarker
              position={{ lat: marker.lat, lng: marker.lng }}
              image={getMarkerImage(marker.category)}
              onMouseOver={() => setHoveredMarkerId(marker.id)}
              onMouseOut={() => setHoveredMarkerId(null)}
            />

            {hoveredMarkerId === marker.id && (
              <CustomOverlayMap
                position={{ lat: marker.lat, lng: marker.lng }}
                yAnchor={1.6}
              >
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    minWidth: "180px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                    {marker.title}
                  </div>
                  <div>기본 분류: {marker.category}</div>
                  <div>전략: {marker.strategy}</div>
                  <div>주거 비중: {marker.homeRatio.toFixed(3)}</div>
                  <div>산업 비중: {marker.workRatio.toFixed(3)}</div>
                  <div>문화 비중: {marker.cultureRatio.toFixed(3)}</div>
                </div>
              </CustomOverlayMap>
            )}
          </div>
        ))}
      </Map>

      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 10,
          display: "flex",
          gap: "6px",
        }}
      >
        {["주거지", "산업지", "문화권"].map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            style={{
              padding: "6px 12px",
              backgroundColor: currCategory === cat ? "#2563eb" : "#fff",
              color: currCategory === cat ? "#fff" : "#111",
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Maps;