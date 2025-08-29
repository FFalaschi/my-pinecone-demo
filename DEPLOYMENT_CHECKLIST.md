# Vercel Deployment Checklist

## Required Environment Variables

You need to add these environment variables in your Vercel project settings:

1. Go to: https://vercel.com/businessdesignventures/my-pinecone-demo/settings/environment-variables
2. Add the following variables for **Production**, **Preview**, and **Development**:

### PINECONE_API_KEY
```
[Your Pinecone API key - starts with pcsk_]
```

### PINECONE_HOST  
```
[Your Pinecone host URL - e.g. https://prod-1-data.ke.pinecone.io]
```

### PINECONE_INDEX
```
[Your Pinecone index name]
```

### OPENAI_API_KEY
```
[Your OpenAI API key - starts with sk-proj-]
```

## How to Add:

1. Click "Add Variable"
2. Enter the Key (e.g., `PINECONE_API_KEY`)
3. Enter the Value (paste from above)
4. Select all environments: Production ✓, Preview ✓, Development ✓
5. Click "Save"
6. Repeat for all 4 variables

## After Adding Variables:

1. Go to Deployments tab
2. Click the three dots on the latest deployment
3. Select "Redeploy"
4. Wait for deployment to complete

## Testing:

Visit: https://my-pinecone-demo.vercel.app

The chat should now work properly!