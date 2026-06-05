import os
import re
import json
import zipfile
import tempfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
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
from app.services.llm import get_llm_client_and_model, get_discipline_llm, get_discipline_llm_candidates

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

class DailyReportRequest(BaseModel):
    weight: Optional[float] = None
    step_count: Optional[int] = None
    active_energy: Optional[float] = None
    diet_text: Optional[str] = None
    diet_image_url: Optional[str] = None
    fitness_text: Optional[str] = None
    fitness_image_url: Optional[str] = None
    intake_calories: Optional[int] = None
    burned_calories: Optional[int] = None

class DailyReportResponse(BaseModel):
    report: str

class ShortcutSyncRequest(BaseModel):
    date: Optional[str] = Field(None, description="打卡日期 (YYYY-MM-DD)，若为空默认为今天")
    steps: Optional[int] = Field(None, description="步数")
    active_energy: Optional[float] = Field(None, description="活动消耗能量 (kcal)")
    weight: Optional[float] = Field(None, description="体重 (kg)")

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

@router.get("/shortcut-token")
def get_shortcut_token(
    current_user: User = Depends(require_discipline)
):
    from jose import jwt
    from app.config import settings
    from datetime import UTC
    # Create a 365-day access token for shortcuts sync
    expire = datetime.now(UTC) + timedelta(days=365)
    to_encode = {
        "sub": str(current_user.id),
        "type": "access",
        "is_root": current_user.is_root,
        "exp": expire,
    }
    token = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return {"token": token}

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
            intake_calories=1800, # 新建打卡且未填摄入时默认 1800
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
    elif not log.diet_text and not log.diet_image_url and log.intake_calories == 0:
        # 如果当天没有任何饮食文字或图片打卡内容，且摄入原本是 0（表示用户未填写饮食），默认将其提升为 1800
        log.intake_calories = 1800
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
        candidates = get_discipline_llm_candidates(db, task_type="vision" if req.image_url else "text")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 AI 服务端配置失败: {str(e)}")

    if not candidates:
        raise HTTPException(status_code=500, detail="AI 服务端未正确配置：没有可用的 AI 服务商。")

    # Construct messages payload
    prompt = (
        "你是一个专业的营养师。请仔细分析用户提供的打卡饮食图文信息：\n"
        f"饮食文字描述: {req.text or '未提供'}\n\n"
        "请识别出其中所有的食物，估算每种食物的卡路里（kcal）以及总摄入热量。\n"
        "最终请返回一个符合以下 JSON 格式的字符串，不要包含 markdown 格式标记（如 ```json 等）：\n"
        '{"calories": 估算的整餐总卡路里数值(必须为整数), "analysis": "分项估算详情及分析点评(200字以内)"}'
    )

    last_error = None
    for client, model_name, provider_name in candidates:
        try:
            print(f"Trying diet analysis using provider: {provider_name}, model: {model_name}")
            if req.image_url:
                urls = [u.strip() for u in req.image_url.split(",") if u.strip()]
                content_list = [{"type": "text", "text": prompt}]
                for url in urls:
                    content_list.append({"type": "image_url", "image_url": {"url": url}})
                messages = [
                    {
                        "role": "user",
                        "content": content_list
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
            print(f"Diet analysis failed for provider {provider_name}: {e}")
            last_error = e
            continue

    # Fallback simple estimation if all LLMs failed
    return AIAnalysisResponse(
        calories=350,
        analysis=f"AI 分析出现偏差，所有服务商均请求失败。最新详情: {str(last_error)}"
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
        candidates = get_discipline_llm_candidates(db, task_type="vision" if req.image_url else "text")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 AI 服务端配置失败: {str(e)}")

    if not candidates:
        raise HTTPException(status_code=500, detail="AI 服务端未正确配置：没有可用的 AI 服务商。")

    prompt = (
        "你是一个专业的健身教练。请仔细分析用户提供的打卡运动图文信息：\n"
        f"运动描述: {req.text or '未提供'}\n\n"
        "请评估并估算出该次运动所消耗的卡路里（kcal）热量。\n"
        "最终请返回一个符合以下 JSON 格式的字符串，不要包含 markdown 格式标记：\n"
        '{"calories": 估算的运动消耗卡路里数值(整数), "analysis": "分项说明与运动指导(200字以内)"}'
    )

    last_error = None
    for client, model_name, provider_name in candidates:
        try:
            print(f"Trying fitness analysis using provider: {provider_name}, model: {model_name}")
            if req.image_url:
                urls = [u.strip() for u in req.image_url.split(",") if u.strip()]
                content_list = [{"type": "text", "text": prompt}]
                for url in urls:
                    content_list.append({"type": "image_url", "image_url": {"url": url}})
                messages = [
                    {
                        "role": "user",
                        "content": content_list
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
            print(f"Fitness analysis failed for provider {provider_name}: {e}")
            last_error = e
            continue

    # Fallback simple estimation if all LLMs failed
    return AIAnalysisResponse(
        calories=200,
        analysis=f"AI 分析运动卡路里出现偏差，所有服务商均请求失败。最新详情: {str(last_error)}"
    )

@router.post("/import-apple-health")
async def import_apple_health(
    file: UploadFile = File(...),
    range_days: int = Query(0, description="导入范围天数，0代表全部"),
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
    temp_path = None
    xml_path = None

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
                    raise HTTPException(status_code=400, detail="Zip 压缩包内未找到有效的健康数据 XML 文件。")
                
                # Extract export.xml to a temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".xml") as xml_temp:
                    xml_temp.write(zip_ref.read(xml_filename))
                    xml_path = xml_temp.name
        else:
            xml_path = temp_path

        limit_date = None
        if range_days > 0:
            limit_date = (datetime.now() - timedelta(days=range_days)).date()

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
                            day_date = datetime.strptime(day, "%Y-%m-%d").date()
                            
                            # Filter based on range_days if specified
                            if limit_date and day_date < limit_date:
                                elem.clear()
                                continue
                                
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

            # Calculate BMR for this specific day using its weight if available
            day_weight = weight if weight is not None else (log.weight if log and log.weight is not None else base_weight)
            day_bmr = calculate_bmr(base_height, day_weight)

            if not log:
                # If new, automatically calculate BMR as baseline burned calories
                log = DailyDisciplineLog(
                    user_id=current_user.id,
                    log_date=log_date,
                    step_count=steps,
                    active_energy=energy,
                    weight=weight,
                    intake_calories=1800, # 默认取 1800
                    burned_calories=int(day_bmr + energy)
                )
                log.calorie_gap = log.burned_calories - 1800
                db.add(log)
            else:
                log.step_count = steps
                log.active_energy = energy
                if weight is not None:
                    log.weight = weight
                # 如果用户此前未写过饮食文案/上传饮食图片，且摄入卡路里为0，同步修正为默认1800
                if not log.diet_text and not log.diet_image_url and log.intake_calories == 0:
                    log.intake_calories = 1800
                # Re-calculate burned and calorie gap
                log.burned_calories = int(day_bmr + energy)
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
    finally:
        # Ensure temporary files are deleted from the disk
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception as unlink_err:
                print(f"Failed to unlink temp_path {temp_path}: {unlink_err}")
        if xml_path and xml_path != temp_path and os.path.exists(xml_path):
            try:
                os.unlink(xml_path)
            except Exception as unlink_err:
                print(f"Failed to unlink xml_path {xml_path}: {unlink_err}")

@router.post("/shortcut-sync", response_model=DailyLogResponse)
def shortcut_sync(
    req: ShortcutSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    if req.date:
        try:
            target_date = datetime.strptime(req.date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式必须为 YYYY-MM-DD")
    else:
        target_date = datetime.now().date()

    # Fetch User profile to get BMR calculation info
    profile = db.scalar(
        select(UserHealthProfile).where(UserHealthProfile.user_id == current_user.id)
    )
    
    base_height = profile.height if profile else 170.0
    base_weight = profile.initial_weight if profile else 65.0

    log = db.scalar(
        select(DailyDisciplineLog)
        .where(
            and_(
                DailyDisciplineLog.user_id == current_user.id,
                DailyDisciplineLog.log_date == target_date
            )
        )
    )

    # Calculate BMR for this specific day using its weight if available
    day_weight = req.weight
    if day_weight is None:
        day_weight = log.weight if log and log.weight is not None else base_weight
    
    day_bmr = calculate_bmr(base_height, day_weight)

    if not log:
        log = DailyDisciplineLog(
            user_id=current_user.id,
            log_date=target_date,
            intake_calories=1800, # 新建打卡且未填摄入时默认 1800
        )
        db.add(log)

    if req.steps is not None:
        log.step_count = req.steps
    if req.active_energy is not None:
        log.active_energy = req.active_energy
    if req.weight is not None:
        log.weight = req.weight

    # 如果没有写任何饮食，且摄入卡路里原本是0，自动设为默认1800
    if not log.diet_text and not log.diet_image_url and log.intake_calories == 0:
        log.intake_calories = 1800

    # Auto calculate burned calories
    act_energy = log.active_energy if log.active_energy else 0.0
    log.burned_calories = int(day_bmr + act_energy)
    log.calorie_gap = log.burned_calories - log.intake_calories

    db.commit()
    db.refresh(log)
    return log


@router.post("/logs/{log_date}/report", response_model=DailyReportResponse)
def generate_daily_report(
    log_date: str,
    req: DailyReportRequest,
    force: bool = Query(False, description="是否强制重新生成"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_discipline)
):
    try:
        target_date = datetime.strptime(log_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式必须为 YYYY-MM-DD")

    # If not force refresh, check if we already have it in the database
    log = db.scalar(
        select(DailyDisciplineLog)
        .where(
            and_(
                DailyDisciplineLog.user_id == current_user.id,
                DailyDisciplineLog.log_date == target_date
            )
        )
    )
    
    if not force and log and log.ai_analysis:
        return DailyReportResponse(report=log.ai_analysis)

    # Resolve BMR parameters
    profile = db.scalar(
        select(UserHealthProfile).where(UserHealthProfile.user_id == current_user.id)
    )
    base_height = profile.height if profile else 170.0
    
    # Use weight from request, then DB, then profile default
    weight = req.weight
    if weight is None:
        weight = log.weight if log and log.weight is not None else (profile.initial_weight if profile else 65.0)
        
    bmr = calculate_bmr(base_height, weight)
    
    # Calculate BMI
    bmi = weight / ((base_height / 100) ** 2) if base_height > 0 else 22.0
    bmi_status = "正常"
    if bmi < 18.5:
        bmi_status = "偏瘦"
    elif bmi < 24.0:
        bmi_status = "正常"
    elif bmi < 28.0:
        bmi_status = "超重"
    else:
        bmi_status = "肥胖"

    # Total intake and burned
    intake = req.intake_calories if req.intake_calories is not None else (log.intake_calories if log else 1800)
    act_energy = req.active_energy if req.active_energy is not None else (log.active_energy if log and log.active_energy is not None else 0.0)
    burned = req.burned_calories if req.burned_calories is not None else (log.burned_calories if log else int(bmr + act_energy))
    gap = burned - intake

    # Construct prompt
    prompt = (
        "你是一个专业的私人健康、运动与营养顾问。请根据用户今天（或该日期）的自律打卡数据，生成一份简明扼要、有针对性、充满鼓励性的每日健康分析点评报告。\n\n"
        "【打卡数据】\n"
        f"日期: {log_date}\n"
        f"体重: {weight} kg (BMI: {bmi:.1f}, 状态: {bmi_status})\n"
        f"今日步数: {req.step_count if req.step_count is not None else (log.step_count if log else '未记录')} 步\n"
        f"饮食摄入热量: {intake} kcal\n"
        f"饮食描述: {req.diet_text or (log.diet_text if log else '无')}\n"
        f"运动/日常能耗: {act_energy} kcal\n"
        f"健身描述: {req.fitness_text or (log.fitness_text if log else '无')}\n"
        f"BMR基础代谢: {int(bmr)} kcal\n"
        f"总消耗热量: {burned} kcal\n"
        f"热量赤字缺口: {gap} kcal (正值表示消耗大于摄入，有利于减重；负值表示盈余)\n\n"
        "【报告要求】\n"
        "1. 点评今天热量赤字缺口是否达标，饮食和运动是否合理；\n"
        "2. 提供一条针对性的改善建议（如增加饮水、调整碳水、补充蛋白质或建议有氧/力量训练组合）；\n"
        "3. 字数控制在 250 字以内，语气亲切专业；\n"
        "4. 直接输出报告正文，不要包含任何前导词或 markdown 标记。"
    )

    try:
        candidates = get_discipline_llm_candidates(db, task_type="text")
    except Exception as e:
        candidates = []

    report_text = None
    last_error = None
    for client, model_name, provider_name in candidates:
        try:
            print(f"Trying daily report generation using provider: {provider_name}, model: {model_name}")
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=400
            )
            report_text = response.choices[0].message.content.strip()
            break
        except Exception as e:
            print(f"Daily report generation failed for provider {provider_name}: {e}")
            last_error = e
            continue

    if not report_text:
        # Fallback if all candidates failed
        report_text = (
            f"今日健康分析：您今天摄入了 {intake} kcal，消耗了 {burned} kcal，"
            f"热量赤字为 {gap} kcal。当前 BMI 为 {bmi:.1f} ({bmi_status})。"
            f"所有配置的 AI 服务均暂时不可用 (最新错误: {str(last_error)})。请继续保持健康的饮食和运动习惯！"
        )

    # Save to DB (create default log if not exists)
    if not log:
        log = DailyDisciplineLog(
            user_id=current_user.id,
            log_date=target_date,
            weight=weight,
            step_count=req.step_count if req.step_count is not None else 0,
            active_energy=act_energy,
            intake_calories=intake,
            burned_calories=burned,
            calorie_gap=gap,
            ai_analysis=report_text
        )
        db.add(log)
    else:
        log.ai_analysis = report_text
    db.commit()
        
    return DailyReportResponse(report=report_text)

