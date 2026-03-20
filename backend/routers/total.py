import logging
from fastapi import FastAPI
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StructType, StructField, StringType, IntegerType
import pandas as pd
import mariadb
import os
import glob
import traceback

from settings import settings

# =========================
# 0. 로깅 설정 (콘솔 출력 강화)
# =========================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("MetroLoader")

app = FastAPI()
spark = None

# [컬럼 정의 생략 - 기존과 동일]
TIME_COLS = ["05~06", "06~07", "07~08", "08~09", "09~10", "10~11", "11~12", "12~13", "13~14", "14~15", "15~16", "16~17", "17~18", "18~19", "19~20", "20~21", "21~22", "22~23", "23~24", "24~"]
STANDARD_COLS = ["날짜", "호선", "역번호", "역명", "구분"] + TIME_COLS + ["합계"]

METRO_SCHEMA = StructType([
    StructField("날짜", StringType(), True),
    StructField("호선", StringType(), True),
    StructField("역번호", StringType(), True),
    StructField("역명", StringType(), True),
    StructField("구분", StringType(), True),
    *[StructField(c, IntegerType(), True) for c in TIME_COLS],
    StructField("합계", IntegerType(), True),
    StructField("src_year", IntegerType(), True),
])

# =========================
# 2. Spark 시작 / 종료
# =========================
@app.on_event("startup")
def startup_event():
    global spark
    try:
        logger.info("Spark 세션 초기화를 시작합니다...")
        jar_path = settings.jdbc_jar_path.strip().replace("\\", "/")
        jar_uri = f"file:///{jar_path}"
        
        spark = (
            SparkSession.builder
            .appName("MetroIntegratedLoader")
            .master(settings.spark_url)
            .config("spark.jars", jar_uri)
            .config("spark.driver.host", settings.host_ip)
            .getOrCreate()
        )
        # Spark 내부 로그 레벨 조정 (너무 잡다한 로그 방지)
        spark.sparkContext.setLogLevel("WARN")
        logger.info(f"Spark 시작 성공! (Version: {spark.version})")
    except Exception as e:
        logger.error(f"Spark 시작 실패: {e}")
        spark = None

# [read_any_file, normalize_metro_pdf 등은 이전과 동일하게 유지]
def read_any_file(filepath: str) -> pd.DataFrame:
    filename = os.path.basename(filepath)
    ext = os.path.splitext(filepath)[1].lower()
    header_idx = 1 if any(y in filename for y in ["2017", "2018", "2019"]) else 0
    try:
        if ext == ".csv":
            try: return pd.read_csv(filepath, encoding="utf-8", header=header_idx, dtype=str, low_memory=False)
            except: return pd.read_csv(filepath, encoding="cp949", header=header_idx, dtype=str, low_memory=False)
        elif ext == ".xlsx":
            return pd.read_excel(filepath, engine="openpyxl", header=header_idx, dtype=str)
    except Exception as e:
        logger.error(f"파일 읽기 오류 [{filename}]: {e}")
        return pd.DataFrame()

def normalize_metro_pdf(pdf: pd.DataFrame, year: int) -> pd.DataFrame:
    pdf = pdf.copy()
    logger.info(f"[{year}년] 원본 컬럼: {pdf.columns.tolist()}")
    
    # 컬럼명 공백 제거
    pdf.columns = [str(c).strip() for c in pdf.columns]

    # 1. 승하차(구분) 추출
    target_in_out_col = None
    for col in pdf.columns:
        if pdf[col].astype(str).str.contains("승차|하차").any():
            target_in_out_col = col
            break
    
    if target_in_out_col:
        pdf["구분"] = pdf[target_in_out_col].astype(str).str.strip()
    else:
        if "구분" not in pdf.columns: pdf["구분"] = "정보없음"

    # 2. 날짜, 호선, 역번호 등 필수 컬럼 매핑 (공백에 유연하게)
    rename_map = {
        "사용일자": "날짜", "역번호(호선별)": "역번호", "역번호(호선별기준)": "역번호",
        "06시 이전": "05~06", "06시이전": "05~06",
        "24시 이후": "24~", "24시이후": "24~",
        "00시 이후": "24~", "00시이후": "24~",
        "00:00 이후": "24~"
    }
    pdf.rename(columns=rename_map, inplace=True)
    
    # 3. 시간대 컬럼 유연 매핑 (강화된 방식)
    new_colnames = {}
    for col in pdf.columns:
        # A. 모든 공백 제거
        cleaned_col = col.replace(' ', '')
        # B. ':00' 제거
        cleaned_col = cleaned_col.replace(':00', '')
        # C. '시' 제거
        cleaned_col = cleaned_col.replace('시', '')
        # D. '-'를 '~'로 변경
        cleaned_col = cleaned_col.replace('-', '~')
        
        if cleaned_col in TIME_COLS:
            new_colnames[col] = cleaned_col
            
    pdf.rename(columns=new_colnames, inplace=True)
    logger.info(f"[{year}년] 정규화 후 컬럼: {pdf.columns.tolist()}")

    # 4. 누락 컬럼 강제 생성
    if "호선" not in pdf.columns: pdf["호선"] = None
    if "날짜" not in pdf.columns: pdf["날짜"] = None
    if "역번호" not in pdf.columns: pdf["역번호"] = None
    if "역명" not in pdf.columns: pdf["역명"] = ""

    # 4a. 역명 정제 (괄호 및 공백 제거)
    if "역명" in pdf.columns:
        pdf["역명"] = pdf["역명"].astype(str).str.replace(r"\([^)]+\)", "", regex=True).str.replace(r"\s+", "", regex=True)

    # 5. 시간대 데이터 숫자 변환 및 합계 계산
    for col in TIME_COLS:
        if col not in pdf.columns:
            logger.warning(f"[{year}년] 표준 시간대 컬럼 '{col}'이(가) 없어 0으로 채웁니다.")
            pdf[col] = "0"
        pdf[col] = pd.to_numeric(pdf[col].astype(str).str.replace(",", ""), errors="coerce").fillna(0).astype(int)

    pdf["합계"] = pdf[TIME_COLS].sum(axis=1)
    
    # 6. src_year 컬럼 생성
    pdf["src_year"] = int(year)

    # 7. 날짜 기호 정제
    pdf["날짜"] = pdf["날짜"].astype(str).str.replace("-", "").str.replace("/", "").str.strip()
    
    return pdf[STANDARD_COLS + ["src_year"]]


# =========================
# 5. 데이터 통일 함수
# =========================
def unify_by_station_number(df: DataFrame) -> DataFrame:
    """
    (전면 수정) 역번호를 마스터 키로 사용하여 역명과 호선을 최신 데이터 기준으로 통일합니다.
    """
    logger.info("역번호 기준 데이터 통일 작업을 시작합니다.")

    # 1. Join Key 정제: 역번호를 정수형으로 변환
    df_cleaned = df.withColumn("역번호_clean", F.trim(F.col("역번호")).cast("int"))

    # 2. 참조 테이블(마스터 데이터) 생성
    # - 2016년 이후 데이터에서 역번호별로 가장 많이 사용된(mode) 역명과 호선을 표준으로 삼는다.
    ref_df = df_cleaned.filter((F.col("src_year") >= 2016) & F.col("역번호_clean").isNotNull())

    # Window를 사용해 역번호별로 가장 빈도가 높은 (역명, 호선) 조합을 찾음
    window_spec = Window.partitionBy("역번호_clean").orderBy(F.desc("count"))
    
    ref_map = (
        ref_df.groupBy("역번호_clean", "역명", "호선").count()
        .withColumn("rank", F.row_number().over(window_spec))
        .filter(F.col("rank") == 1)
        .select(
            F.col("역번호_clean"),
            F.col("역명").alias("canonical_역명"),
            F.regexp_replace(F.col("호선"), "호선", "").alias("canonical_호선") # '1호선' -> '1'
        )
    )
    logger.info(f"역번호 기준 마스터 테이블 생성 완료 (기준 역번호 개수: {ref_map.count()})")
    ref_map.show(20, truncate=False)

    # 3. 전체 데이터에 마스터 테이블을 Join하여 역명과 호선을 덮어쓰기
    result_df = (
        df_cleaned.join(ref_map, on="역번호_clean", how="left_outer")
        .drop("역명", "호선") # 원본 역명/호선 삭제
        .withColumnRenamed("canonical_역명", "역명")
        .withColumnRenamed("canonical_호선", "호선")
    )
    
    # 4. 누락된 항목 확인
    unfilled_count = result_df.filter(F.col("호선").isNull() | F.col("역명").isNull()).count()
    if unfilled_count > 0:
        logger.warning(f"역번호 기준으로 통일한 후에도 역명/호선이 누락된 데이터가 {unfilled_count:,}건 있습니다.")
        result_df.filter(F.col("호선").isNull() | F.col("역명").isNull()) \
                 .select("src_year", "역번호", "역번호_clean") \
                 .distinct() \
                 .show(20)
    
    # 원본 컬럼 순서 유지
    final_cols = STANDARD_COLS + ["src_year"]
    return result_df.select(*final_cols)


def finalize_types(df: DataFrame) -> DataFrame:
    """
    최종 데이터프레임의 컬럼 타입을 정리합니다.
    """
    logger.info("데이터 타입 및 날짜 포맷을 최종 정리합니다.")
    df = df.withColumn("날짜", F.to_date(F.col("날짜"), "yyyyMMdd"))
    
    for col_name in TIME_COLS + ["합계", "src_year"]:
        df = df.withColumn(col_name, F.col(col_name).cast(IntegerType()))

    df = df.withColumn("호선", F.col("호선").cast(IntegerType()))
    return df


# =========================
# 6. 실행 및 저장 API (로그 강화)
# =========================
@app.get("/build-all")
def build_all():
    if not spark:
        logger.error("Spark 세션이 없습니다.")
        return {"status": False, "error": "Spark not initialized"}

    try:
        logger.info("데이터 적재 프로세스를 시작합니다.")
        all_files = sorted(glob.glob(os.path.join(settings.data_dir, "*")))
        metro_files = [f for f in all_files if "승하차인원" in os.path.basename(f) and not os.path.basename(f).startswith("~$")]
        
        logger.info(f"발견된 승하차 파일 개수: {len(metro_files)}개")

        dfs = []
        for filepath in metro_files:
            filename = os.path.basename(filepath)
            year = next((y for y in range(2008, 2026) if str(y) in filename), None)
            
            if not year:
                logger.warning(f"연도 식별 불가, 스킵함: {filename}")
                continue

            logger.info(f"[{year}년] 파일 처리 중: {filename}...")
            
            pdf = read_any_file(filepath)
            if pdf.empty:
                logger.warning(f"[{year}년] 데이터가 비어있습니다.")
                continue
            
            pdf = normalize_metro_pdf(pdf, year)
            sdf = spark.createDataFrame(pdf, schema=METRO_SCHEMA)
            dfs.append(sdf)
            logger.info(f"[{year}년] 완료 (건수: {len(pdf):,})")

        if not dfs:
            logger.error("처리된 데이터프레임이 없습니다.")
            return {"status": False, "message": "No data processed"}

        # 통합
        logger.info("모든 연도 데이터를 통합(Union) 중입니다...")
        df_total = dfs[0]
        for d in dfs[1:]:
            df_total = df_total.unionByName(d)

        # [수정] 역번호 기준 데이터 통일 -> 최종 타입 변환
        logger.info("데이터 통일 및 최종 타입 변환 프로세스를 시작합니다.")
        df_total = unify_by_station_number(df_total)
        df_total = finalize_types(df_total)
        
        # MariaDB 저장
        logger.info(f"MariaDB에 최종 적재 중입니다... (Table: {settings.mariadb_table})")
        jdbc_url = f"jdbc:mariadb://{settings.mariadb_host}:{settings.mariadb_port}/{settings.mariadb_database}?characterEncoding=UTF-8&sessionVariables=sql_mode=ANSI_QUOTES"
        df_total.write.jdbc(
            url=jdbc_url,
            table=settings.mariadb_table,
            mode="overwrite",
            properties={"user": settings.mariadb_user, "password": settings.mariadb_password, "driver": "org.mariadb.jdbc.Driver"}
        )
        
        final_count = df_total.count()
        logger.info(f"✅ 모든 작업 성공! 총 {final_count:,}건 적재 완료.")
        
        return {"status": True, "message": "Success", "total_count": final_count}

    except Exception as e:
        error_msg = traceback.format_exc()
        logger.error(f"❌ 작업 중 오류 발생:\n{error_msg}")
        return {"status": False, "error": str(e)}