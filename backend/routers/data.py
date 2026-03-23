from db import findAll
from fastapi import APIRouter

router = APIRouter(
    prefix="/data",
    tags=["data"]
)


# 1. 지도용 기본 역 위치 데이터
@router.get("/")
def get_data(year: int):
    sql = f"""
        SELECT
            s.`역명`,
            c.`위도`,
            c.`경도`
        FROM station_timeband_summary AS s
        JOIN coordinate AS c
            ON s.`역번호` = c.`역번호`
        WHERE s.`src_year` = {year}
    """
    data = findAll(sql)
    return {"data": data}


# 2. KPI 데이터
# - 출근시간 최다 승/하차
# - 퇴근시간 최다 승/하차
# - 주말 오전/오후 최다 승/하차
@router.get("/kpi")
def get_kpi(year: int):
    def top1_query(col, label, day_cond):
        return f"""
            WITH ranked AS (
                SELECT
                    src_year,
                    역명,
                    {col} AS total,
                    ROW_NUMBER() OVER (
                        PARTITION BY src_year
                        ORDER BY {col} DESC
                    ) AS rn
                FROM station_timeband_by_name
                WHERE 휴무일구분 {day_cond}
                  AND src_year = {year}
            )
            SELECT
                src_year,
                '{label}' AS kpi,
                역명,
                total AS 값
            FROM ranked
            WHERE rn = 1
        """

    weekday = "= '평일'"
    weekend = "IN ('주말', '공휴일')"

    data_on = findAll(top1_query("출근_승차합", "평일 출근 승차 최대역", weekday))
    data_off = findAll(top1_query("출근_하차합", "평일 출근 하차 최대역", weekday))

    data_work_on = findAll(top1_query("퇴근_승차합", "평일 퇴근 승차 최대역", weekday))
    data_work_off = findAll(top1_query("퇴근_하차합", "평일 퇴근 하차 최대역", weekday))

    data_weekend_am_on = findAll(top1_query("오전_승차합", "주말 오전 승차 최대역", weekend))
    data_weekend_am_off = findAll(top1_query("오전_하차합", "주말 오전 하차 최대역", weekend))
    data_weekend_pm_on = findAll(top1_query("오후_승차합", "주말 오후 승차 최대역", weekend))
    data_weekend_pm_off = findAll(top1_query("오후_하차합", "주말 오후 하차 최대역", weekend))

    def first(rows):
        return rows[0] if rows else {"역명": "-", "값": 0}

    return {
        "commute": {
            "boarding": first(data_on),
            "alighting": first(data_off),
        },
        "weekday": {
            "boarding": first(data_work_on),
            "alighting": first(data_work_off),
        },
        "weekend": {
            "am_boarding": first(data_weekend_am_on),
            "am_alighting": first(data_weekend_am_off),
            "pm_boarding": first(data_weekend_pm_on),
            "pm_alighting": first(data_weekend_pm_off),
        },
    }


# 3.1 직장인 타겟 광고용 산점도 데이터
# X축 = 출근 하차합
# Y축 = 퇴근 승차합
@router.get("/scatter")
def get_scatter(year: int):
    sql = f"""
        WITH base AS (
            SELECT
                src_year,
                역명,
                출근_하차합 AS x_value,
                퇴근_승차합 AS y_value
            FROM station_timeband_by_name
            WHERE 휴무일구분 = '평일'
              AND src_year = {year}
        ),
        avg_val AS (
            SELECT
                src_year,
                AVG(x_value) AS avg_x,
                AVG(y_value) AS avg_y
            FROM base
            GROUP BY src_year
        ),
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
        SELECT
            src_year,
            역명,
            x_value,
            y_value,
            score,
            avg_x,
            avg_y
        FROM filtered
        ORDER BY src_year, score DESC
    """
    rows = findAll(sql)
    return {"data": rows}


# 3.2 주말/공휴일 13~18시 피크 기준 상위 호선 TOP3
@router.get("/weekend-lines")
def get_weekend_lines(year: int):
    sql = f"""
        WITH line_base AS (
            SELECT
                s.src_year,
                s.`호선`,
                SUM(
                    IFNULL(s.`13~14`, 0) +
                    IFNULL(s.`14~15`, 0) +
                    IFNULL(s.`15~16`, 0) +
                    IFNULL(s.`16~17`, 0) +
                    IFNULL(s.`17~18`, 0)
                ) AS weekend_peak
            FROM subway_total s
            JOIN holiday_check h
                ON s.`날짜` = h.`날짜`
            WHERE h.`휴무일구분` IN ('주말', '공휴일')
              AND s.src_year = {year}
            GROUP BY s.src_year, s.`호선`
        ),
        ranked AS (
            SELECT
                src_year,
                `호선`,
                weekend_peak,
                RANK() OVER (
                    PARTITION BY src_year
                    ORDER BY weekend_peak DESC
                ) AS rn
            FROM line_base
        )
        SELECT
            src_year,
            `호선`,
            weekend_peak,
            rn
        FROM ranked
        WHERE rn <= 3
        ORDER BY rn
    """
    data = findAll(sql)
    return {"year": year, "items": data}


# 3.2 주말/공휴일 13~18시 피크 기준 특정 호선 핵심역 TOP5
@router.get("/weekend-line-stations")
def get_weekend_line_stations(year: int, line: str):
    sql = f"""
        WITH station_base AS (
            SELECT
                s.src_year,
                s.`호선`,
                s.`역명`,
                SUM(
                    IFNULL(s.`13~14`, 0) +
                    IFNULL(s.`14~15`, 0) +
                    IFNULL(s.`15~16`, 0) +
                    IFNULL(s.`16~17`, 0) +
                    IFNULL(s.`17~18`, 0)
                ) AS weekend_peak
            FROM subway_total s
            JOIN holiday_check h
                ON s.`날짜` = h.`날짜`
            WHERE h.`휴무일구분` IN ('주말', '공휴일')
              AND s.src_year = {year}
              AND s.`호선` = '{line}'
            GROUP BY
                s.src_year,
                s.`호선`,
                s.`역명`
        ),
        ranked AS (
            SELECT
                src_year,
                `호선`,
                `역명`,
                weekend_peak,
                RANK() OVER (
                    ORDER BY weekend_peak DESC
                ) AS rn
            FROM station_base
        )
        SELECT
            src_year,
            `호선`,
            `역명`,
            weekend_peak,
            rn
        FROM ranked
        WHERE rn <= 5
        ORDER BY rn
    """
    data = findAll(sql)
    return {"year": year, "line": line, "items": data}


# 4. 지도 마커용 광고 전략 데이터
# category:
# - 주거지
# - 산업지
# - 문화권
# category 없으면 전체 반환
@router.get("/map")
def get_map(year: int, category: str = None):
    sql = f"""
        SELECT
            `대표역번호`,
            `역명`,
            `위도`,
            `경도`,
            `기본_분류`,
            `광고_집행_전략`,
            `주거_비중`,
            `산업_비중`,
            `문화_비중`,
            `src_year`
        FROM view_광고전략_지도데이터
        WHERE `src_year` = {year}
    """

    if category in ["주거지", "산업지", "문화권"]:
        sql += f" AND TRIM(`기본_분류`) = '{category}'"

    sql += " ORDER BY `역명`"

    data = findAll(sql)
    return {"data": data}