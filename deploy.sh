#!/bin/bash
# deploy.sh — One-command deploy to Google Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
set -e

PROJECT_ID=${1:-$(gcloud config get-value project)}
REGION=${2:-us-central1}
SERVICE_NAME="worldcup-fan-agent"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "═══════════════════════════════════════════════"
echo "  ⚽  WorldCup Fan Command Center — Deploy"
echo "═══════════════════════════════════════════════"
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Service:  $SERVICE_NAME"
echo "═══════════════════════════════════════════════"

# 1. Enable required APIs
echo "▶ Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  --project=$PROJECT_ID

# 2. Create service account if needed
SA_EMAIL="worldcup-agent-sa@$PROJECT_ID.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID &>/dev/null; then
  echo "▶ Creating service account..."
  gcloud iam service-accounts create worldcup-agent-sa \
    --display-name="WorldCup Agent SA" \
    --project=$PROJECT_ID

  # Grant required roles
  for ROLE in \
    roles/aiplatform.user \
    roles/secretmanager.secretAccessor \
    roles/cloudscheduler.jobRunner; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SA_EMAIL" \
      --role=$ROLE \
      --quiet
  done
fi

# 3. Store secrets in Secret Manager
echo "▶ Loading secrets from .env.local..."
if [ -f ".env.local" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    value="${value%%#*}"   # strip inline comments
    value="${value//\"/}" # strip quotes
    value="${value// /}"  # strip spaces
    SECRET_NAME=$(echo "$key" | tr '[:upper:]_' '[:lower:]-')
    
    # Create or update secret
    if ! gcloud secrets describe "$SECRET_NAME" --project=$PROJECT_ID &>/dev/null; then
      echo "  Creating secret: $SECRET_NAME"
      echo -n "$value" | gcloud secrets create "$SECRET_NAME" \
        --data-file=- \
        --project=$PROJECT_ID \
        --replication-policy=automatic
    else
      echo "  Updating secret: $SECRET_NAME"
      echo -n "$value" | gcloud secrets versions add "$SECRET_NAME" \
        --data-file=- \
        --project=$PROJECT_ID
    fi
  done < .env.local
fi

# 4. Build and push Docker image
echo "▶ Building Docker image..."
gcloud builds submit \
  --tag=$IMAGE \
  --project=$PROJECT_ID \
  --timeout=10m

# 5. Deploy to Cloud Run
echo "▶ Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=$SA_EMAIL \
  --min-instances=1 \
  --max-instances=20 \
  --concurrency=80 \
  --timeout=300 \
  --cpu=2 \
  --memory=2Gi \
  --project=$PROJECT_ID

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

# 6. Set up Cloud Scheduler for price alerts
echo "▶ Setting up Cloud Scheduler..."
SCHEDULER_SA="$SA_EMAIL"

if ! gcloud scheduler jobs describe worldcup-price-check \
  --location=$REGION --project=$PROJECT_ID &>/dev/null; then
  gcloud scheduler jobs create http worldcup-price-check \
    --location=$REGION \
    --schedule="0 */6 * * *" \
    --uri="$SERVICE_URL/api/jobs/price-check" \
    --http-method=POST \
    --oidc-service-account-email=$SCHEDULER_SA \
    --oidc-token-audience="$SERVICE_URL/api/jobs/price-check" \
    --project=$PROJECT_ID
else
  gcloud scheduler jobs update http worldcup-price-check \
    --location=$REGION \
    --uri="$SERVICE_URL/api/jobs/price-check" \
    --project=$PROJECT_ID
fi

# 7. Run DB migration
echo "▶ Running database migration..."
npm run db:migrate

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅  Deploy complete!"
echo "  🌐  URL: $SERVICE_URL"
echo "  ⏰  Price alerts: every 6 hours via Cloud Scheduler"
echo "═══════════════════════════════════════════════"
