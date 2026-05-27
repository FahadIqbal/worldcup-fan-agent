#!/bin/bash
# deploy-now.sh — streamlined Cloud Run deploy for worldcup-fan-agent
# Usage: bash deploy-now.sh
set -e

PROJECT_ID="worldcup-fan-agent"
REGION="us-central1"
SERVICE_NAME="worldcup-fan-agent"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"
SA_EMAIL="worldcup-agent-sa@$PROJECT_ID.iam.gserviceaccount.com"

echo "═══════════════════════════════════════════════"
echo "  ⚽  WorldCup Fan Command Center — Deploy"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Image   : $IMAGE"
echo "═══════════════════════════════════════════════"

gcloud config set project $PROJECT_ID

# ── 1. Enable APIs ────────────────────────────────
echo "▶ Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  cloudscheduler.googleapis.com \
  --project=$PROJECT_ID --quiet

# ── 2. Service account ────────────────────────────
if ! gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID &>/dev/null; then
  echo "▶ Creating service account..."
  gcloud iam service-accounts create worldcup-agent-sa \
    --display-name="WorldCup Agent SA" --project=$PROJECT_ID
  for ROLE in roles/aiplatform.user roles/secretmanager.secretAccessor roles/run.invoker; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SA_EMAIL" --role=$ROLE --quiet
  done
else
  echo "▶ Service account exists: $SA_EMAIL"
fi

# ── 3. Push secrets (skip placeholder values) ────
echo "▶ Storing secrets in Secret Manager..."
store_secret() {
  local KEY=$1 VALUE=$2
  [[ "$VALUE" == REPLACE_* || -z "$VALUE" ]] && return
  local NAME=$(echo "$KEY" | tr '[:upper:]_' '[:lower:]-')
  if gcloud secrets describe "$NAME" --project=$PROJECT_ID &>/dev/null; then
    echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- --project=$PROJECT_ID --quiet
  else
    echo -n "$VALUE" | gcloud secrets create "$NAME" \
      --data-file=- --replication-policy=automatic --project=$PROJECT_ID --quiet
  fi
  echo "  ✓ $NAME"
}

store_secret GCP_PROJECT_ID       "$PROJECT_ID"
store_secret GEMINI_MODEL         "gemini-1.5-pro-002"
store_secret TAVILY_API_KEY       "$(grep TAVILY_API_KEY .env.local | cut -d= -f2-)"
store_secret NEON_DATABASE_URL    "$(grep NEON_DATABASE_URL .env.local | cut -d= -f2-)"
store_secret BROWSERBASE_API_KEY  "$(grep BROWSERBASE_API_KEY .env.local | cut -d= -f2-)"
store_secret BROWSERBASE_PROJECT_ID "$(grep BROWSERBASE_PROJECT_ID .env.local | cut -d= -f2-)"
store_secret SCHEDULER_SECRET     "$(grep SCHEDULER_SECRET .env.local | cut -d= -f2-)"

# ── 4. Build & push Docker image via Cloud Build ─
echo "▶ Building Docker image (Cloud Build)..."
gcloud builds submit . \
  --tag="$IMAGE" \
  --project=$PROJECT_ID \
  --timeout=15m

# ── 5. Deploy to Cloud Run ────────────────────────
echo "▶ Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=$SA_EMAIL \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300 \
  --cpu=1 \
  --memory=1Gi \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GCP_REGION=$REGION,GEMINI_MODEL=gemini-1.5-pro-002,GEMINI_MAX_OUTPUT_TOKENS=4096,GEMINI_TEMPERATURE=0.3" \
  --set-secrets="TAVILY_API_KEY=tavily-api-key:latest,NEON_DATABASE_URL=neon-database-url:latest,BROWSERBASE_API_KEY=browserbase-api-key:latest,BROWSERBASE_PROJECT_ID=browserbase-project-id:latest,SCHEDULER_SECRET=scheduler-secret:latest" \
  --project=$PROJECT_ID

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION --project=$PROJECT_ID --format='value(status.url)')

# ── 6. Cloud Scheduler for price alerts ──────────
echo "▶ Setting up Cloud Scheduler (price-check every 6h)..."
if ! gcloud scheduler jobs describe worldcup-price-check \
  --location=$REGION --project=$PROJECT_ID &>/dev/null; then
  gcloud scheduler jobs create http worldcup-price-check \
    --location=$REGION \
    --schedule="0 */6 * * *" \
    --uri="$SERVICE_URL/api/jobs/price-check" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body="{\"source\":\"scheduler\"}" \
    --oidc-service-account-email=$SA_EMAIL \
    --oidc-token-audience="$SERVICE_URL/api/jobs/price-check" \
    --project=$PROJECT_ID
else
  gcloud scheduler jobs update http worldcup-price-check \
    --location=$REGION \
    --uri="$SERVICE_URL/api/jobs/price-check" \
    --project=$PROJECT_ID
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅  Deploy complete!"
echo "  🌐  $SERVICE_URL"
echo "  ⏰  Price alerts run every 6 hours"
echo "═══════════════════════════════════════════════"
