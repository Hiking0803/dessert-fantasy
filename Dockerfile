FROM python:3.11-slim

WORKDIR /app

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Railway 使用 PORT 环境变量，默认 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
