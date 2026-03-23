from db import findAll
from fastapi import APIRouter

router = APIRouter(
    prefix="/data",
    tags=["data"]
)

@router.get('')
def get_data(year: int):
  sql=f'''SELECT s.`역명`, c.`위도`, c.`경도` FROM station_timeband_summary AS s 
        JOIN coordinate AS c
        ON (s.역번호 = c.`역번호`)
        WHERE s.src_year = {year};'''
  data = findAll(sql)
  return {'data': data}



@router.get('/kpi')
def get_kpi(year: int):

    def top1_query(col, label, day_cond):
        return f'''
            WITH ranked AS (
                SELECT src_year, 역명, {col} AS total,
                       ROW_NUMBER() OVER (PARTITION BY src_year ORDER BY {col} DESC) AS rn
                FROM station_timeband_by_name
                WHERE 휴무일구분 {day_cond}
                  AND src_year = {year}
            )
            SELECT src_year, '{label}' AS kpi, 역명, total AS 값
            FROM ranked WHERE rn = 1;
        '''

    weekday  = "= '평일'"
    weekend  = "IN ('토요일','일요일','공휴일')"
    

    # data_on             = findAll(top1_query('출근_승차합', '평일 출근 승차 최대역', weekday))
    # data_off            = findAll(top1_query('출근_하차합', '평일 출근 하차 최대역', weekday))
    # data_work_on        = findAll(top1_query('퇴근_승차합', '평일 퇴근 승차 최대역', weekday))
    # data_work_off       = findAll(top1_query('퇴근_하차합', '평일 퇴근 하차 최대역', weekday))
    # data_weekend_am_on  = findAll(top1_query('오전_승차합', '주말 오전 승차 최대역', weekend))
    # data_weekend_am_off = findAll(top1_query('오전_하차합', '주말 오전 하차 최대역', weekend))
    # data_weekend_pm_on  = findAll(top1_query('오후_승차합', '주말 오후 승차 최대역', weekend))
    # data_weekend_pm_off = findAll(top1_query('오후_하차합', '주말 오후 하차 최대역', weekend))

    def first(rows):
        return rows[0] if rows else {"역명": "-", "값": 0}

    return {
        'commute': {
            'boarding':  first(data_on),
            'alighting': first(data_off),
        },
        'weekday': {
            'boarding':  first(data_work_on),
            'alighting': first(data_work_off),
        },
        'weekend': {
            'am_boarding':  first(data_weekend_am_on),
            'am_alighting': first(data_weekend_am_off),
            'pm_boarding':  first(data_weekend_pm_on),
            'pm_alighting': first(data_weekend_pm_off),
        },
    }

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