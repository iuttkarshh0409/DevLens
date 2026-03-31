import os
import re
import json
import base64
import httpx
import logging
import asyncio
from groq import AsyncGroq
from typing import Tuple, Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# 1. Configuration & Logging
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("devlens")

app = FastAPI(title="DevLens Analysis API")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://[::1]:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# Secrets
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Initialize Groq Client
client_groq = AsyncGroq(api_key=GROQ_API_KEY)

# 2. Models
class AnalyzeRequest(BaseModel):
    repo_url: str = Field(..., example="https://github.com/user/repo")

# 3. Robust URL Parser
def parse_github_url(url: str) -> Tuple[str, str]:
    """Robustly extracts (owner, repo) from HTTPS, SSH, and path-only GitHub URLs."""
    pattern = r"(?:https?://)?(?:www\.)?github\.com[:/]([^/]+)/([^/\.\s\?#]+)(?:\.git)?(?:/.*)?"
    match = re.search(pattern, url.strip())
    
    if not match:
        logger.warning(f"Failed to parse URL: {url}")
        raise HTTPException(status_code=400, detail="Invalid GitHub URL format.")
    
    return match.group(1), match.group(2)

# 4. GitHub Data Fetching (Reliable)
class GitHubFetcher:
    def __init__(self):
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if GITHUB_TOKEN:
            self.headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    async def fetch(self, owner: str, repo: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                meta_url = f"https://api.github.com/repos/{owner}/{repo}"
                readme_url = f"{meta_url}/readme"
                contents_url = f"{meta_url}/contents"

                tasks = [
                    client.get(meta_url, headers=self.headers),
                    client.get(readme_url, headers=self.headers),
                    client.get(contents_url, headers=self.headers)
                ]
                
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Check Metadata
                meta_res = responses[0]
                if isinstance(meta_res, Exception) or meta_res.status_code == 404:
                    raise HTTPException(status_code=404, detail="Repository not found or private.")
                
                meta = meta_res.json()
                
                # Safe Readme Fetching
                readme = ""
                readme_res = responses[1]
                if not isinstance(readme_res, Exception) and readme_res.status_code == 200:
                    try:
                        readme = base64.b64decode(readme_res.json().get('content', '')).decode('utf-8', errors='ignore')
                    except: readme = "Error decoding README."

                # Safe Structure Fetching
                files = []
                cont_res = responses[2]
                if not isinstance(cont_res, Exception) and cont_res.status_code == 200:
                    data = cont_res.json()
                    files = [f['name'] for f in data] if isinstance(data, list) else []

                return {
                    "name": meta.get("name"),
                    "stars": meta.get("stargazers_count", 0),
                    "last_updated": meta.get("updated_at", ""),
                    "readme": readme[:3500],
                    "files": files[:20]
                }
            except httpx.HTTPError:
                raise HTTPException(status_code=502, detail="Upstream GitHub API failure.")

# 5. LLM Analysis Service (Groq Migration)
class Analyzer:
    SYSTEM_PROMPT = """
    You are a BRUTALLY HONEST Technical Recruiter using a DETERMINISTIC ALGORITHM.
    
    CRITICAL RULE:
    - IF "Automated Tests" AND "CI/CD" are missing from the project files: THE SCORE CANNOT EXCEED 7.0. This is a hard limit.
    
    SCORING CALCULATION (Show math in 'logic_scratchpad'):
    1. BASE: 5.0
    2. MERIT (Apply ONLY if unique/complex):
       - Unique/Innovative Domain (Not a clone): +1.5
       - Professional Architecture (Complex patterns): +1.5
    3. DEDUCTIONS (Must mirror 'readme_audits' booleans exactly):
       - IF License is false: -1.0
       - IF Detailed Setup Guide is false: -1.0
       - IF Visual Demos (Screenshots/GIFs) is false: -1.0
       - IF Generic Tutorial/Clone App: -2.0
    
    DETERMINISM:
    The 'logic_scratchpad' MUST match the 'readme_audits' booleans. If a boolean is False, the deduction MUST be in the scratchpad.
    
    STRICT JSON OUTPUT:
    {
      "logic_scratchpad": "string (5.0 + Merit - Deductions = Score)",
      "score": float (Final score 0.0 to 10.0), 
      "status": "ELITE" (9+) | "STRONG" (7.5-9) | "INTERVIEW" (6-7.5) | "POLISH" (3-6) | "REJECT" (<3), 
      "feedback": "string (Direct, sharp, personalized advice)",
      "wow_insight": {"title": "string", "description": "string"},
      "checklist": [{"title": "string", "impact": "High"|"Medium"|"Low", "hiring_impact": "string"}],
      "readme_audits": [
        {"label": "Project Description", "passed": bool},
        {"label": "Detailed Setup Guide", "passed": bool},
        {"label": "Technology Summary", "passed": bool},
        {"label": "Contribution Guidelines", "passed": bool},
        {"label": "License (MIT/GPL)", "passed": bool},
        {"label": "Architecture Highlights", "passed": bool},
        {"label": "Visual Demos", "passed": bool}
      ]
    }
    """

    @staticmethod
    async def run(repo_data: Dict[str, Any], retries=1) -> Dict[str, Any]:
        for attempt in range(retries + 1):
            try:
                response = await client_groq.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": Analyzer.SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(repo_data)}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                
                content = response.choices[0].message.content
                analysis = json.loads(content)
                
                if "wow_insight" not in analysis:
                    analysis["wow_insight"] = {"title": "Recruiter's Vibe Check", "description": "Analysis is clean, but no specific 'hidden signal' was detected."}

                return analysis

            except Exception as e:
                logger.error(f"Groq LLM Error (Attempt {attempt}): {str(e)}")
                if attempt == retries:
                    return {
                        "score": 0.0, "status": "Audit Failed", "feedback": "Groq analysis engine failed. Please try again.",
                        "wow_insight": {"title": "Failed", "description": "Unable to complete vibe check."},
                        "checklist": [], "readme_audits": []
                    }

# 6. Integrated Endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "DevLens Analysis Engine"}

@app.post("/analyze")
async def analyze_repository(request: AnalyzeRequest):
    logger.info(f"Analyzing: {request.repo_url}")
    owner, repo = parse_github_url(request.repo_url)
    
    fetcher = GitHubFetcher()
    repo_data = await fetcher.fetch(owner, repo)
    
    analysis = await Analyzer.run(repo_data)
    return analysis

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
