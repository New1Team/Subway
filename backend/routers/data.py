from db import findAll
from fastapi import APIRouter
from sqlalchemy import create_engine
import pandas as pd

router = APIRouter(
    prefix="/data",
    tags=["data"]
)

# 위도,경도를 통해 지도에서 역의 위치를 알아내는 함수
@router.get('')
def get_data(year: int):
 
    sql=f'''SELECT s.`역명`, c.`위도`, c.`경도` FROM station_timeband_summary AS s 
        JOIN coordinate AS c
        ON (s.역번호 = c.`역번호`)
        WHERE s.src_year = {year};'''
    data = findAll(sql)
    return {'data': data}


#출근시간 최다 승하차, 퇴근시간 최다 승하차,주말 최다 승하차 중 제일 높은 수치를 가져오는 sql문

@router.get('/kpi')
def get_kpi(year: int):
# 내부 함수: 반복되는 Top-1 조회 SQL을 생성하는 헬퍼 함수
# top1 query 함수: 반복되는 sql문을 top1 쿼리로 제일 높은 수치 하나만 가져올수 있게 하는 함수 (col = 컬럼명,label=역명(결과에 표시할 이름),day_cond=요일조건)
    def top1_query(col, label, day_cond):
        return f'''
            WITH ranked AS (
                SELECT src_year, 역명, {col} AS total,
                       ROW_NUMBER() OVER (PARTITION BY src_year ORDER BY {col} DESC) AS rn
                FROM station_timeband_by_name
                WHERE 휴무일구분 {day_cond}
                  AND src_year = {year}
            )
#순위가 1위인 데이터만 가져오기
            SELECT src_year, '{label}' AS kpi, 역명, total AS 값
            FROM ranked WHERE rn = 1;
        '''

    weekday  = "= '평일'"
    weekend  = "IN ('토요일','일요일','공휴일')"
    
    #데이터 조회(평일과 주말로 나눠서 검색(주말에 공휴일 포함))
    data_on             = findAll(top1_query('출근_승차합', '평일 출근 승차 최대역', weekday))
    data_off            = findAll(top1_query('출근_하차합', '평일 출근 하차 최대역', weekday))
    data_work_on        = findAll(top1_query('퇴근_승차합', '평일 퇴근 승차 최대역', weekday))
    data_work_off       = findAll(top1_query('퇴근_하차합', '평일 퇴근 하차 최대역', weekday))
    data_weekend_am_on  = findAll(top1_query('오전_승차합', '주말 오전 승차 최대역', weekend))
    data_weekend_am_off = findAll(top1_query('오전_하차합', '주말 오전 하차 최대역', weekend))
    data_weekend_pm_on  = findAll(top1_query('오후_승차합', '주말 오후 승차 최대역', weekend))
    data_weekend_pm_off = findAll(top1_query('오후_하차합', '주말 오후 하차 최대역', weekend))

    def first(rows):
    # 안전한 데이터 추출을 위한 유틸리티 함수 (결과가 없을 경우 기본값 반환)
        return rows[0] if rows else {"역명": "-", "값": 0}
    # 최종 JSON 결과 구조화
    return {
        # 평일 출근 승차합 데이터
        'commute': {
            'boarding':  first(data_on),
            'alighting': first(data_off),
        },
        #평일 출근 하차합 데이터
        'weekday': {
            'boarding':  first(data_work_on),
            'alighting': first(data_work_off),
        },
        #평일 퇴근 승차,하차 데이터 
        'weekend': {
            'am_boarding':  first(data_weekend_am_on),
            'am_alighting': first(data_weekend_am_off),
            'pm_boarding':  first(data_weekend_pm_on),
            'pm_alighting': first(data_weekend_pm_off),
        },
    }


#3.1 직장인 타겟 광고
#출근시간 하차 합, 퇴근시간 승차 합
@router.get('/scatter')
def get_scatter(year: int):
    sql = f'''
          WITH base AS (
            SELECT
            src_year,
            역명,
            출근_하차합 AS x_value,
            퇴근_승차합 AS y_value
    FROM station_timeband_by_name
    WHERE 휴무일구분 = '평일'
    AND src_year ={year}
),

# 연도별 출퇴근 승차합 평균계산
avg_val AS (
    SELECT
        src_year,
        AVG(x_value) AS avg_x,
        AVG(y_value) AS avg_y
    FROM base
    GROUP BY src_year
),

# 평균 이상만 차트에 나오게 필터링
filtered AS (
    SELECT
        b.src_year,
        b.역명,
        b.x_value,
        b.y_value,
        (b.x_value + b.y_value) AS score,
        a.avg_x,
        a.avg_y
    FROM base b
    JOIN avg_val a
        ON b.src_year = a.src_year
    WHERE b.x_value > a.avg_x
      AND b.y_value > a.avg_y
)
SELECT *
FROM filtered
ORDER BY src_year, score DESC;
'''
    rows = findAll(sql)
    return {"data": rows}

# 3.2 (주말) 여가/쇼핑 타겟 광고_주말 유동인구 호선 순위
@router.get('/weekend-lines')
def get_weekend_lines(year: int):
    sql = f"""
        WITH line_base AS (
            SELECT s.src_year, s.`호선`,
                SUM(IFNULL(s.`13~14`,0) + IFNULL(s.`14~15`,0) + IFNULL(s.`15~16`,0) + 
                IFNULL(s.`16~17`,0) + IFNULL(s.`17~18`,0)) AS weekend_peak
            FROM subway_total s
            JOIN holiday_check h
                ON s.`날짜` = h.`날짜`
            WHERE h.`휴무일구분` IN ('주말', '공휴일')
              AND s.src_year = {year}
            GROUP BY s.src_year, s.`호선`
        ),
        ranked AS (
            SELECT src_year, `호선`, weekend_peak,
                RANK() OVER (
                    PARTITION BY src_year
                    ORDER BY weekend_peak DESC
                ) AS rn
            FROM line_base
        )
        SELECT
            src_year, `호선`, weekend_peak, rn
        FROM ranked
        WHERE rn <= 3
        ORDER BY rn;
    """
    data = findAll(sql)
    return {"year": year, "items": data}

# 3.2 (주말) 여가/쇼핑 타겟 광고_주말 유동인구 호선 순위
@router.get('/weekend-line-stations')
def get_weekend_line_stations(year: int, line: str):
    sql = f"""
        WITH station_base AS (
            SELECT s.src_year,s.`호선`, s.`역명`,
                SUM(
                    IFNULL(s.`13~14`,0) +
                    IFNULL(s.`14~15`,0) +
                    IFNULL(s.`15~16`,0) +
                    IFNULL(s.`16~17`,0) +
                    IFNULL(s.`17~18`,0)
                ) AS weekend_peak
            FROM subway_total s
            JOIN holiday_check h
                ON s.`날짜` = h.`날짜`
            WHERE h.`휴무일구분` IN ('주말', '공휴일')
              AND s.src_year = {year}
              AND s.`호선` = '{line}'
            GROUP BY s.src_year, s.`호선`, s.`역명`
        ),
        ranked AS (
            SELECT src_year, `호선`, `역명`, weekend_peak,
                RANK() OVER (
                    ORDER BY weekend_peak DESC
                ) AS rn
            FROM station_base
        )
        SELECT src_year, `호선`, `역명`, weekend_peak, rn
        FROM ranked
        WHERE rn <= 5
        ORDER BY rn;
    """
    data = findAll(sql)
    return {"year": year, "line": line, "items": data}

@router.get('/map')
def get_map(year: int, category: str):
    sql = f'''
        SELECT *
        FROM view_광고전략_지도데이터
        WHERE src_year = {year}
          AND 기본_분류 = '{category}'
    '''
    data = findAll(sql)
    return {'data': data}
 



# @app.get("/api/metro_seoul/coordinate")
# async def get_coordinate():
#     # 여기에 DB(MariaDB)에서 데이터를 가져오는 로직이 들어가야 합니다.
#     return [
#         {"station_nm": "서울역", "lat": 37.5547, "lng": 126.9706},
#         {"station_nm": "시청역", "lat": 37.5657, "lng": 126.9769}
#     ]

# @app.get("/api/stations")
# def get_stations():
#     try:
#         # SQLAlechemy engine을 사용하여 MariaDB에서 데이터를 읽어옵니다.
#         # 테이블명이 'coordinate'라고 가정했습니다.
#         query = "SELECT * FROM coordinate"
#         df = pd.read_sql(query, engine_mariadb)
        
#         # DataFrame을 리액트가 읽기 쉬운 JSON(배열) 형태로 변환하여 반환
#         return df.to_dict(orient="records")
#     except Exception as e:
#         return {"error": str(e)}

# @app.get("/api/get_map_data")
# def get_map_data():
#     try:
#         # engine_mariadb는 이미 상단에 선언되어 있으므로 그대로 사용
#         query = "SELECT * FROM coordinate"
#         df = pd.read_sql(query, engine_mariadb)
        
#         # 데이터를 리스트 형태로 변환
#         return df.to_dict(orient="records")
#     except Exception as e:
#         return {"error": str(e)}