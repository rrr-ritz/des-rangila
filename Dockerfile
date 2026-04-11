FROM python:3.11-slim

WORKDIR /app

# Build dependencies for InsightFace Cython extension
RUN apt-get update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements-daemon.txt .
RUN pip install --no-cache-dir -r requirements-daemon.txt

# Pre-download InsightFace buffalo_l model (~300MB) during build
# so the daemon starts instantly at runtime
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])"

# Copy daemon script
COPY scripts/match-daemon.py scripts/

# Service account key is NOT baked in — mount at runtime:
#   docker run -e GOOGLE_APPLICATION_CREDENTIALS=/creds/sa.json \
#              -v /path/to/serviceAccountKey.json:/creds/sa.json \
#              face-daemon

CMD ["python", "scripts/match-daemon.py"]
