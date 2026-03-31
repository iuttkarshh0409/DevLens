# DevLens Backend

GitHub Repository Auditor with Recruiter-style AI analysis.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # venv\Scripts\activate on Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure Environment:
   ```bash
   copy .env.example .env
   ```
   Add your `OPENAI_API_KEY` and `GITHUB_TOKEN` to `.env`.

4. Run the server:
   ```bash
   python app/main.py
   ```

API is available at: http://127.0.0.1:8000
Swagger Docs: http://127.0.0.1:8000/docs
