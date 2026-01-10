/**
 * Utility function to generate HTML error pages for App Proxy routes
 */

export interface ErrorPageOptions {
  title: string;
  message: string;
  errorCode: string;
  shopDomain?: string;
  accountUrl?: string;
  statusCode?: number;
  icon?: string;
}

/**
 * Generate HTML error page
 */
export function generateErrorPage({
  title,
  message,
  errorCode,
  shopDomain,
  accountUrl,
  statusCode = 400,
  icon = "⚠️",
}: ErrorPageOptions): Response {
  const shopAccountUrl =
    accountUrl || (shopDomain ? `https://${escapeUrl(shopDomain)}/account` : "#");
  const shopLoginUrl = shopDomain
    ? `https://${escapeUrl(shopDomain)}/account/login`
    : "#";

  const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
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
    .error-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: #fee;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    .error-icon.auth {
      background: #e3f2fd;
    }
    .error-title {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
    }
    .error-message {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .error-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
      width: 100%;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background: #5568d3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .btn-secondary {
      background: #f5f5f5;
      color: #333;
    }
    .btn-secondary:hover {
      background: #e5e5e5;
    }
    .error-code {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
    @media (max-width: 600px) {
      .error-container {
        padding: 24px;
      }
      .error-title {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon ${errorCode === 'missing_customer' || errorCode === 'invalid_customer_token' ? 'auth' : ''}">${icon}</div>
    <h1 class="error-title">${escapeHtml(title)}</h1>
    <p class="error-message">${escapeHtml(message)}</p>
    <div class="error-actions">
      ${shopDomain && errorCode !== 'missing_customer' ? `<a href="${shopAccountUrl}" class="btn btn-primary">Go to Account</a>` : ''}
      ${shopDomain && errorCode === 'missing_customer' ? `<a href="${shopLoginUrl}" class="btn btn-primary">Log In to Continue</a>` : ''}
      <button onclick="window.history.back()" class="btn btn-secondary">Go Back</button>
    </div>
    ${errorCode ? `<div class="error-code">Error Code: ${escapeHtml(errorCode)}</div>` : ''}
  </div>
</body>
</html>
  `;

  return new Response(errorHtml, {
    status: statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Escape URL to prevent XSS in href attributes
 */
function escapeUrl(url: string): string {
  // Basic URL validation - just escape special characters
  return url.replace(/[<>"']/g, "");
}

/**
 * Get shop domain from shop parameter
 */
export function getShopDomain(shop: string | null): string {
  if (!shop) return "";
  return shop.includes(".") ? shop : `${shop}.myshopify.com`;
}
