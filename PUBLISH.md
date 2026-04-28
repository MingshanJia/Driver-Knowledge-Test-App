# Publish the DKT Webapp Online

The app is static-hosting ready. It only needs these files/folders online:

- `index.html`
- `src/`
- `public/`
- `.nojekyll`

## Fastest: Netlify Drop

1. Open https://app.netlify.com/drop
2. Drag the `online-dist` folder onto the page.
3. Netlify will give you a public URL.

No build command is needed.

## GitHub Pages

1. Create a new public GitHub repository.
2. Upload the contents of `online-dist`.
3. In the repository, open `Settings` > `Pages`.
4. Set source to `Deploy from a branch`.
5. Choose the `main` branch and `/root`.
6. Save. GitHub will show the public site URL after it deploys.

## Vercel

1. Create a new Vercel project.
2. Import or upload the app folder.
3. Leave build command blank.
4. Use `.` as the output directory if asked.

No server is required online.
