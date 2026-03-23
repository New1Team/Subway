# sql/queries.py

def get_weekend_lines_sql(year: int):
    """3.1 주말 유동인구 호선 순위 (Top 3)"""
    return f"""
        WITH line_base AS (
            SELECT s.src_year, s.`호선`,
                SUM(IFNULL(s.`13~14`,0) + IFNULL(s.`14~15`,0) + IFNULL(s.`15~16`,0) + 
                IFNULL(s.`16~17`,0) + IFNULL(s.`17~18`,0)) AS weekend_peak
            FROM subway_total s
            JOIN holiday_check h 
                ON REPLACE(s.`날짜`, '-', '') = REPLACE(h.`날짜`, '-', '')
            WHERE (h.`휴무일구분` LIKE '%주말%' OR h.`휴무일구분` LIKE '%토요일%' OR h.`휴무일구분` LIKE '%일요일%' OR h.`휴무일구분` LIKE '%공휴일%')
              AND s.src_year = {year}
            GROUP BY s.src_year, s.`호선`
        ),
        ranked AS (
            SELECT src_year, `호선`, weekend_peak,
                RANK() OVER (ORDER BY weekend_peak DESC) AS rn
            FROM line_base
        )
        SELECT 
            `호선` AS line, 
            weekend_peak AS value, 
            rn AS rank
        FROM ranked
        WHERE rn <= 3
        ORDER BY rn;
    """

def get_weekend_stations_sql(year: int, line: str):
    """3.2 특정 호선의 주말 유동인구 역 순위 (Top 5)"""
    return f"""
        WITH station_base AS (
            SELECT s.src_year, s.`호선`, s.`역명`,
                SUM(IFNULL(s.`13~14`,0) + IFNULL(s.`14~15`,0) + IFNULL(s.`15~16`,0) + 
                IFNULL(s.`16~17`,0) + IFNULL(s.`17~18`,0)) AS weekend_peak
            FROM subway_total s
            JOIN holiday_check h 
                ON REPLACE(s.`날짜`, '-', '') = REPLACE(h.`날짜`, '-', '')
            WHERE (h.`휴무일구분` LIKE '%주말%' OR h.`휴무일구분` LIKE '%토요일%' OR h.`휴무일구분` LIKE '%일요일%' OR h.`휴무일구분` LIKE '%공휴일%')
              AND s.src_year = {year}
              AND s.`호선` = '{line}'
            GROUP BY s.src_year, s.`호선`, s.`역명`
        ),
        ranked AS (
            SELECT src_year, `호선`, `역명`, weekend_peak,
                RANK() OVER (ORDER BY weekend_peak DESC) AS rn
            FROM station_base
        )
        SELECT 
            `역명` AS station, 
            weekend_peak AS value, 
            rn AS rank
        FROM ranked
        WHERE rn <= 5
        ORDER BY rn;
    """