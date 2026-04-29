# Use official lightweight Python image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir python-multipart uvicorn

# Copy project into a backend directory to act as a package
COPY . /app/backend/

# Set Python path to ensure 'backend' and its internal modules can be imported
ENV PYTHONPATH=/app:/app/backend

# Expose port
EXPOSE 8000

# Run commands
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
