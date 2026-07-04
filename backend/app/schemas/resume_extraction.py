from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.categories import JobCategory


class Location(BaseModel):
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class Links(BaseModel):
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None


class PersonalInfo(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    location: Location = Field(default_factory=Location)
    links: Links = Field(default_factory=Links)


class Skills(BaseModel):
    languages: List[str] = Field(default_factory=list)
    frameworks_tools: List[str] = Field(default_factory=list)
    cloud_platforms: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)


class WorkExperience(BaseModel):
    company: Optional[str] = None
    job_title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    description: List[str] = Field(default_factory=list)
    skills_used: List[str] = Field(default_factory=list)


class Education(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    major: Optional[str] = None
    graduation_year: Optional[str] = None
    gpa: Optional[str] = None


class Project(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    technologies_used: List[str] = Field(default_factory=list)
    link: Optional[str] = None


class Certification(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    date_obtained: Optional[str] = None


class ResumeExtraction(BaseModel):
    """Top-level structured output requested from the LLM for a resume."""
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: Optional[str] = None
    skills: Skills = Field(default_factory=Skills)
    work_experience: List[WorkExperience] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    certifications: List[Certification] = Field(default_factory=list)
    categories: List[JobCategory] = Field(
        default_factory=list,
        description="1-3 categories that best describe this candidate's primary domain(s)",
    )