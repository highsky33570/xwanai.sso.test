/**
 * Utility function to generate HTML loading pages for App Proxy routes
 */

import { XWANAI_FRONTEND_DOMAIN } from "./sso.server";

/**
 * Generate HTML loading page with embedded data for client-side processing
 */
export function generateLoadingPage(redirectURL: string): Response {
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
    .loading-icon {
      font-size: 48px;
      margin-bottom: 20px;
      animation: spin 1s linear infinite;
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
    .error-message {
      display: none;
      color: #d32f2f;
      font-size: 14px;
      margin-top: 20px;
      padding: 12px;
      background: #ffebee;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="loading-container">
    <div class="spinner"></div>
    <h1>Authenticating...</h1>
    <p>Please wait while we log you into XWAN.AI</p>
    <div id="error-message" class="error-message"></div>
  </div>
  <script>
    (function() {
      const redirectURL = ${JSON.stringify(redirectURL)};
      const errorDiv = document.getElementById('error-message');
      
      // Fetch from backend API
      fetch(redirectURL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to authenticate: ' + response.status + ' ' + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        // Extract tokens from response
        const accessToken = data.session?.access_token || data.access_token;
        const refreshToken = data.session?.refresh_token || data.refresh_token;
        const redirectTo = data.redirect_to || '/';
        const frontendDomain = ${JSON.stringify(XWANAI_FRONTEND_DOMAIN)};
        
        if (!accessToken) {
          throw new Error('No access token received');
        }
        
        // Build redirect URL
        const redirectUrl = new URL(frontendDomain);
        redirectUrl.searchParams.set('access_token', accessToken);
        if (refreshToken) {
          redirectUrl.searchParams.set('refresh_token', refreshToken);
        }
        redirectUrl.searchParams.set('redirect_to', redirectTo);
        
        // Redirect to frontend
        window.location.href = redirectUrl.toString();
      })
      .catch(error => {
        console.error('Authentication error:', error);
        errorDiv.textContent = 'Authentication failed: ' + error.message + '. Please try again.';
        errorDiv.style.display = 'block';
        document.querySelector('.spinner').style.display = 'none';
        document.querySelector('h1').textContent = 'Authentication Failed';
        document.querySelector('p').textContent = '';
      });
    })();
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
