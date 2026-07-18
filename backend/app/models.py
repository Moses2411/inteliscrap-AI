from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    phone_number = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=True)
    location_hub = Column(String, default="Zaria")
    created_at = Column(DateTime, server_default=func.now())

    scans = relationship("ScrapScan", back_populates="owner", cascade="all, delete-orphan")


class ScrapScan(Base):
    __tablename__ = "scrap_scans"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    material_class = Column(String, nullable=False)
    sub_grade = Column(String, nullable=True)
    weight_est_kg = Column(Float, nullable=True)
    estimated_naira_value = Column(Float, nullable=False)
    confidence_score = Column(Float, default=1.0)
    toxicity_hazards = Column(JSON, nullable=True)
    safety_instructions = Column(String, nullable=True)
    captured_at = Column(DateTime, nullable=False)
    synced_at = Column(DateTime, server_default=func.now())
    is_deleted = Column(Boolean, default=False)

    owner = relationship("User", back_populates="scans")


class PriceMatrix(Base):
    __tablename__ = "price_matrices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    material_class = Column(String, unique=True, index=True, nullable=False)
    price_per_kg_naira = Column(Float, nullable=False)
    last_updated = Column(DateTime, onupdate=func.now(), server_default=func.now())
    updated_by = Column(String, nullable=True)
