/**
 * Utility function to generate HTML loading pages for App Proxy routes
 */

import { XWANAI_FRONTEND_DOMAIN } from "./sso.server";

/**
 * Generate HTML loading page that auto-submits a form to process SSO server-side
 * This keeps the API call server-side (secure) while showing loading UI
 */
export function generateLoadingPage(
  redirectURL: string,
  processUrl: string
): Response {
  const loadingHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticating...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .loading-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    p {
      color: #666;
      font-size: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="loading-container">
    <div class="spinner"></div>
    <h1>Authenticating...</h1>
    <p>Please wait while we log you into XWAN.AI</p>
  </div>
  <form id="sso-form" method="POST" action="${processUrl}" style="display: none;">
    <input type="hidden" name="redirect_url" value="${redirectURL.replace(/"/g, '&quot;')}">
  </form>
  <script>
    // Auto-submit form to process SSO server-side
    document.getElementById('sso-form').submit();
  </script>
</body>
</html>
  `.trim();

  return new Response(loadingHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
