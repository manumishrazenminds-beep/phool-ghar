# Phool Ghar

Phool Ghar is a React and Vite flower ecommerce application. The application source is in [`web/`](./web).

## Deploy to Vercel

The repository includes a root [`vercel.json`](./vercel.json) configured for the `web` application directory.

1. Import the repository in Vercel.
2. Keep the project root directory set to the repository root; the checked-in configuration handles the `web` directory.
3. Add the required environment variables in the Vercel project settings:
   - `VITE_DATA_PROVIDER`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SITE_URL`
   - Optional integration variables such as `VITE_RAZORPAY_KEY_ID`, `VITE_WHATSAPP_NUMBER`, and `VITE_SPLINE_SCENE`
4. Deploy the `main` branch.

Use [`web/.env.example`](./web/.env.example) as a reference for the available variables.

## Local development

```bash
cd web
npm install
npm run dev
```

## Production build

```bash
cd web
npm run build
```
