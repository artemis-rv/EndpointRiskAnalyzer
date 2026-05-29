FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY analysis/ ./analysis/

EXPOSE 8000

CMD [ "uvicorn", "backend.db.main:app", "--host", "0.0.0.0", "--port", "8000"]