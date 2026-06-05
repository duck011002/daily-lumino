import os
import re
import json
import zipfile
import tempfile
import xml.etree.ElementTree as ET
from datetime import date, datetime
from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, extract
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_root
from app.models.user import User
from app.models.discipline import UserHealthProfile, DailyDisciplineLog
from app.services.llm import get_llm_client_and_model

router = APIRouter(prefix="/api/discipline", tags=["discipline"])

# ---------- DEPENDENCY ----------
def require_discipline(current_user: User = Depends(get_current_user)):
    if not current_user.is_root and not current_user.is_discipline_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您尚未获得自律记录功能的授权，请联系超级管理员开通权限。"
        )
    return current_user

# ---------- SCHEMAS ----------
class HealthProfileCreate(BaseModel):
    height: float = Field(..., ge=50.0, le=250.0, description="身高 (cm)")
    initial_weight: float = Field(..., ge=20.0, le=300.0, description="初始体重 (kg)")
    target_weight: Optional[float] = Field(None, ge=20.0, le=300.0, description="目标体重 (kg)")

class HealthProfileResponse(BaseModel):
    height: float
    initial_weight: float
    target_weight: Optional[float]
    bmi: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DailyLogCreate(BaseModel):
    log_date: str = Field(..., description="打卡日期 (YYYY-MM-DD)")
    weight: Optional[float] = Field(None, description="当天体重 (kg)")
    step_count: Optional[int] = Field(None, description="步数")
    active_energy: Optional[float] = Field(None, description="活动消耗能量 (kcal)")
    diet_text: Optional[str] = Field(None, description="饮食文本打卡")
    diet_image_url: Optional[str] = Field(None, description="饮食图片地址")
    fitness_text: Optional[str] = Field(None, description="健身打卡内容")
    fitness_image_url: Optional[str] = Field(None, description="健身图片地址")
    intake_calories: Optional[int] = Field(None, description="手动设置的摄入卡路里")
    burned_calories: Optional[int] = Field(None, description="手动设置的消耗卡路里")

class DailyLogResponse(BaseModel):
    id: int
    log_date: date
    weight: Optional[float]
    step_count: Optional[int]
    active_energy: Optional[float]
    diet_text: Optional[str]
    diet_image_url: Optional[str]
    fitness_text: Optional[str]
    fitness_image_url: Optional[str]
    intake_calories: int
    burned_calories: int
    calorie_gap: int
    ai_analysis: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AIAnalysisRequest(BaseModel):
    image_url: Optional[str] = None
    text: Optional[str] = None

class AIAnalysisResponse(BaseModel):
    calories: int
    analysis: str

# ---------- HELPERS ----------
def calculate_bmr(height: float, weight: float) -> float:
    # Classically simple Mifflin-St Jeor equation assuming general averages:
    # 10 * weight (kg) + 6.25 * height (cm) - 5 * age + 5
    # Since age is unknown, we assume a median age of 25.
    return 10.0 * weight + 6.25 * height - 5 * 25 + 5

def calculate_bmi(height: float, weight: float) -> float:
    height_m = height / 100.0
    return round(weight / (height_m * height_m), 2)

# ---------- ROUTERS ----------

@router.get("/profile", response_model=Optional[HealthProfileResponse])
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    profile = db.scalar(
        select(UserHealthProfile).where(UserHealthProfile.user_id == current_user.id)
    )
    return profile

@router.post("/profile", response_model=HealthProfileResponse)
def create_or_update_profile(
    profile_in: HealthProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    bmi = calculate_bmi(profile_in.height, profile_in.initial_weight)
    
    profile = db.scalar(
        select(UserHealthProfile).where(UserHealthProfile.user_id == current_user.id)
    )
    if not profile:
        profile = UserHealthProfile(
            user_id=current_user.id,
            height=profile_in.height,
            initial_weight=profile_in.initial_weight,
            target_weight=profile_in.target_weight,
            bmi=bmi
        )
        db.add(profile)
    else:
        profile.height = profile_in.height
        profile.initial_weight = profile_in.initial_weight
        profile.target_weight = profile_in.target_weight
        profile.bmi = bmi
        
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/logs", response_model=List[DailyLogResponse])
def get_logs(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    logs = db.scalars(
        select(DailyDisciplineLog)
        .where(
            and_(
                DailyDisciplineLog.user_id == current_user.id,
                extract("year", DailyDisciplineLog.log_date) == year,
                extract("month", DailyDisciplineLog.log_date) == month
            )
        )
        .order_by(DailyDisciplineLog.log_date.asc())
    ).all()
    return logs

@router.post("/log", response_model=DailyLogResponse)
def create_or_update_log(
    log_in: DailyLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    try:
        target_date = datetime.strptime(log_in.log_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式必须为 YYYY-MM-DD")

    # Fetch User profile to get BMR calculation info
    profile = db.scalar(
        select(UserHealthProfile).where(UserHealthProfile.user_id == current_user.id)
    )
    
    # Determine base parameters for BMR
    base_height = profile.height if profile else 170.0
    base_weight = log_in.weight if log_in.weight else (profile.initial_weight if profile else 65.0)
    bmr = calculate_bmr(base_height, base_weight)

    log = db.scalar(
        select(DailyDisciplineLog)
        .where(
            and_(
                DailyDisciplineLog.user_id == current_user.id,
                DailyDisciplineLog.log_date == target_date
            )
        )
    )

    is_new = False
    if not log:
        is_new = True
        log = DailyDisciplineLog(
            user_id=current_user.id,
            log_date=target_date,
            weight=log_in.weight,
            step_count=log_in.step_count,
            active_energy=log_in.active_energy,
            diet_text=log_in.diet_text,
            diet_image_url=log_in.diet_image_url,
            fitness_text=log_in.fitness_text,
            fitness_image_url=log_in.fitness_image_url,
        )
        db.add(log)
    else:
        if log_in.weight is not None:
            log.weight = log_in.weight
        if log_in.step_count is not None:
            log.step_count = log_in.step_count
        if log_in.active_energy is not None:
            log.active_energy = log_in.active_energy
        if log_in.diet_text is not None:
            log.diet_text = log_in.diet_text
        if log_in.diet_image_url is not None:
            log.diet_image_url = log_in.diet_image_url
        if log_in.fitness_text is not None:
            log.fitness_text = log_in.fitness_text
        if log_in.fitness_image_url is not None:
            log.fitness_image_url = log_in.fitness_image_url

    # Save intake/burned calories if provided manually
    if log_in.intake_calories is not None:
        log.intake_calories = log_in.intake_calories
    if log_in.burned_calories is not None:
        log.burned_calories = log_in.burned_calories
    else:
        # Auto calculate burned calories
        # Total burned = BMR + Active energy burned
        act_energy = log.active_energy if log.active_energy else 0.0
        log.burned_calories = int(bmr + act_energy)

    # Recalculate Calorie Gap: Burned (Output) - Intake (Input)
    # A positive calorie gap means calorie deficit (good for weight loss)
    log.calorie_gap = log.burned_calories - log.intake_calories

    db.commit()
    db.refresh(log)
    return log

@router.post("/analyze-diet", response_model=AIAnalysisResponse)
def analyze_diet(
    req: AIAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    if not req.image_url and not req.text:
        raise HTTPException(status_code=400, detail="请输入食物图片 URL 或文本描述。")

    try:
        client, model_name = get_llm_client_and_model(db, "qwen:qwen-vl-max")
    except Exception as e:
        # Fallback to general qwen client
        try:
            client, model_name = get_llm_client_and_model(db, "qwen")
        except Exception:
            raise HTTPException(status_code=500, detail="AI 服务端未正确配置，请联系管理员。")

    # Construct messages payload
    prompt = (
        "你是一个专业的营养师。请仔细分析用户提供的打卡饮食图文信息：\n"
        f"饮食文字描述: {req.text or '未提供'}\n\n"
        "请识别出其中所有的食物，估算每种食物的卡路里（kcal）以及总摄入热量。\n"
        "最终请返回一个符合以下 JSON 格式的字符串，不要包含 markdown 格式标记（如 ```json 等）：\n"
        '{"calories": 估算的整餐总卡路里数值(必须为整数), "analysis": "分项估算详情及分析点评(200字以内)"}'
    )

    try:
        if req.image_url:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": req.image_url}}
                    ]
                }
            ]
        else:
            messages = [
                {"role": "user", "content": prompt}
            ]

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=400
        )
        
        reply = response.choices[0].message.content.strip()
        # Clean reply from possible markdown ```json block
        if reply.startswith("```"):
            reply = re.sub(r"^```[a-zA-Z]*\n", "", reply)
            reply = re.sub(r"\n```$", "", reply)
            reply = reply.strip()
            
        data = json.loads(reply)
        return AIAnalysisResponse(
            calories=int(data.get("calories", 0)),
            analysis=str(data.get("analysis", "未识别到具体卡路里。"))
        )
    except Exception as e:
        print(f"AI diet analysis failed: {e}")
        # Fallback simple estimation if LLM failed
        return AIAnalysisResponse(
            calories=350,
            analysis=f"AI 分析出现偏差，默认按平均简餐估算。详情: {str(e)}"
        )

@router.post("/analyze-fitness", response_model=AIAnalysisResponse)
def analyze_fitness(
    req: AIAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    if not req.image_url and not req.text:
        raise HTTPException(status_code=400, detail="请提供运动描述或运动截图。")

    try:
        client, model_name = get_llm_client_and_model(db, "qwen:qwen-vl-max")
    except Exception:
        try:
            client, model_name = get_llm_client_and_model(db, "qwen")
        except Exception:
            raise HTTPException(status_code=500, detail="AI 服务端未正确配置。")

    prompt = (
        "你是一个专业的健身教练。请仔细分析用户提供的打卡运动图文信息：\n"
        f"运动描述: {req.text or '未提供'}\n\n"
        "请评估并估算出该次运动所消耗的卡路里（kcal）热量。\n"
        "最终请返回一个符合以下 JSON 格式的字符串，不要包含 markdown 格式标记：\n"
        '{"calories": 估算的运动消耗卡路里数值(整数), "analysis": "分项说明与运动指导(200字以内)"}'
    )

    try:
        if req.image_url:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": req.image_url}}
                    ]
                }
            ]
        else:
            messages = [
                {"role": "user", "content": prompt}
            ]

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=400
        )
        
        reply = response.choices[0].message.content.strip()
        if reply.startswith("```"):
            reply = re.sub(r"^```[a-zA-Z]*\n", "", reply)
            reply = re.sub(r"\n```$", "", reply)
            reply = reply.strip()

        data = json.loads(reply)
        return AIAnalysisResponse(
            calories=int(data.get("calories", 0)),
            analysis=str(data.get("analysis", ""))
        )
    except Exception as e:
        print(f"AI fitness analysis failed: {e}")
        return AIAnalysisResponse(
            calories=200,
            analysis=f"AI 分析运动卡路里出现偏差。详情: {str(e)}"
        )

@router.post("/import-apple-health")
async def import_apple_health(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    filename = file.filename.lower()
    if not filename.endswith(".zip") and not filename.endswith(".xml"):
        raise HTTPException(status_code=400, detail="仅支持上传苹果健康导出的 .zip 压缩包或 .xml 文件。")

    # Read profile for BMR estimation
    profile = db.scalar(
        select(UserHealthProfile).where(UserHealthProfile.user_id == current_user.id)
    )
    base_height = profile.height if profile else 170.0
    base_weight = profile.initial_weight if profile else 65.0
    bmr = calculate_bmr(base_height, base_weight)

    daily_data = {}

    try:
        # Create temporary file to save uploaded zip/xml
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            temp_file.write(await file.read())
            temp_path = temp_file.name

        if filename.endswith(".zip"):
            print("Extracting export.xml from Apple Health zip...")
            with zipfile.ZipFile(temp_path, 'r') as zip_ref:
                xml_filename = None
                for f in zip_ref.namelist():
                    # Support localized filename (like 导出.xml) and ignore export_cda.xml
                    if f.lower().endswith(".xml") and "export_cda.xml" not in f.lower():
                        xml_filename = f
                        break
                if not xml_filename:
                    os.unlink(temp_path)
                    raise HTTPException(status_code=400, detail="Zip 压缩包内未找到有效的健康数据 XML 文件。")
                
                # Extract export.xml to a temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".xml") as xml_temp:
                    xml_temp.write(zip_ref.read(xml_filename))
                    xml_path = xml_temp.name
            # Delete zip temp file
            os.unlink(temp_path)
        else:
            xml_path = temp_path

        print("Parsing Apple Health XML via stream reader...")
        # Stream parse to prevent OutOfMemory on huge XML files
        context = ET.iterparse(xml_path, events=("end",))
        for event, elem in context:
            if elem.tag == "Record":
                rec_type = elem.get("type")
                if rec_type in ("HKQuantityTypeIdentifierStepCount", "HKQuantityTypeIdentifierActiveEnergyBurned", "HKQuantityTypeIdentifierBodyMass"):
                    val_str = elem.get("value")
                    date_str = elem.get("startDate")
                    if val_str and date_str:
                        try:
                            val = float(val_str)
                            day = date_str.split(" ")[0] # extract "YYYY-MM-DD"
                            
                            if day not in daily_data:
                                daily_data[day] = {"steps": 0.0, "energy": 0.0, "weight": None}
                                
                            if rec_type == "HKQuantityTypeIdentifierStepCount":
                                daily_data[day]["steps"] += val
                            elif rec_type == "HKQuantityTypeIdentifierActiveEnergyBurned":
                                daily_data[day]["energy"] += val
                            elif rec_type == "HKQuantityTypeIdentifierBodyMass":
                                daily_data[day]["weight"] = val
                        except ValueError:
                            pass
                # Crucial to release parsed elements to keep memory usage minimal
                elem.clear()

        # Delete XML temp file
        os.unlink(xml_path)

        print(f"Extraction complete. Found {len(daily_data)} days of record data. Committing to DB...")
        
        # Batch write/update to database
        records_updated = 0
        for day_str, health_val in daily_data.items():
            try:
                log_date = datetime.strptime(day_str, "%Y-%m-%d").date()
            except ValueError:
                continue

            steps = int(health_val.get("steps", 0))
            energy = round(health_val.get("energy", 0.0), 1)
            weight = health_val.get("weight")

            if steps == 0 and energy == 0.0 and weight is None:
                continue

            log = db.scalar(
                select(DailyDisciplineLog)
                .where(
                    and_(
                        DailyDisciplineLog.user_id == current_user.id,
                        DailyDisciplineLog.log_date == log_date
                    )
                )
            )

            if not log:
                # If new, automatically calculate BMR as baseline burned calories
                log = DailyDisciplineLog(
                    user_id=current_user.id,
                    log_date=log_date,
                    step_count=steps,
                    active_energy=energy,
                    weight=weight,
                    burned_calories=int(bmr + energy),
                    calorie_gap=int(bmr + energy) # burned - 0 intake
                )
                db.add(log)
            else:
                log.step_count = steps
                log.active_energy = energy
                if weight is not None:
                    log.weight = weight
                # Re-calculate burned and calorie gap
                log.burned_calories = int(bmr + energy)
                log.calorie_gap = log.burned_calories - log.intake_calories
            
            records_updated += 1

        db.commit()
        return {
            "status": "ok",
            "message": f"成功导入苹果健康数据！解析并更新了 {records_updated} 天的健康日志。",
            "days_found": len(daily_data)
        }

    except Exception as e:
        print(f"Error during Apple Health import: {e}")
        raise HTTPException(status_code=500, detail=f"导入解析失败: {str(e)}")
