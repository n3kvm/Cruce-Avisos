FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8765
EXPOSE 8765

CMD ["python", "backend_graph.py"]
