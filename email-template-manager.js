/**
 * Email Template Manager - Utility functions for managing Verdexis email templates
 * 
 * Usage:
 * const emailManager = new EmailTemplateManager();
 * const html = emailManager.render('welcome', { USER_NAME: 'John' });
 */

class EmailTemplateManager {
  constructor(templateDirectory = './') {
    this.templateDirectory = templateDirectory;
    this.templates = {};
    this.globalVariables = {};
  }

  /**
   * Load a template file
   */
  loadTemplate(templateName, templatePath) {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(`${this.templateDirectory}${templatePath}`, 'utf8');
      this.templates[templateName] = content;
      return true;
    } catch (error) {
      console.error(`Failed to load template ${templateName}:`, error.message);
      return false;
    }
  }

  /**
   * Load all templates at once
   */
  loadAllTemplates() {
    const templates = {
      welcome: 'email_welcome.html',
      transaction: 'email_transaction_confirmation.html',
      portfolio_alert: 'email_portfolio_alert.html',
      security: 'email_security.html',
      error: 'email_error_notification.html'
    };

    Object.entries(templates).forEach(([name, path]) => {
      this.loadTemplate(name, path);
    });
  }

  /**
   * Set global variables that apply to all templates
   */
  setGlobalVariables(variables) {
    this.globalVariables = {
      ...this.globalVariables,
      ...variables,
      YEAR: new Date().getFullYear().toString()
    };
  }

  /**
   * Merge global and specific variables
   */
  mergeVariables(variables) {
    return { ...this.globalVariables, ...variables };
  }

  /**
   * Replace all template variables
   */
  replaceVariables(template, variables) {
    return Object.entries(variables).reduce((result, [key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      return result.replace(regex, String(value || ''));
    }, template);
  }

  /**
   * Validate required variables exist
   */
  validateVariables(variables, required) {
    const missing = required.filter(key => !variables[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required variables: ${missing.join(', ')}`);
    }
    return true;
  }

  /**
   * Render a template with variables
   */
  render(templateName, variables = {}) {
    if (!this.templates[templateName]) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const merged = this.mergeVariables(variables);
    return this.replaceVariables(this.templates[templateName], merged);
  }

  /**
   * Get template names
   */
  getAvailableTemplates() {
    return Object.keys(this.templates);
  }
}

/**
 * Email Template Validator - Validates email templates and content
 */
class EmailTemplateValidator {
  /**
   * Check for broken variables
   */
  static findUnreplacedVariables(html) {
    const regex = /{{[A-Z_]+}}/g;
    const matches = html.match(regex) || [];
    return [...new Set(matches)];
  }

  /**
   * Check for broken links
   */
  static findLinks(html) {
    const regex = /href=["']([^"']+)["']/g;
    const links = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      links.push(match[1]);
    }
    return links;
  }

  /**
   * Validate email structure
   */
  static validate(html) {
    const issues = [];

    // Check for required structure
    if (!html.includes('<table') || !html.includes('email-container')) {
      issues.push('Missing email container structure');
    }

    // Check for unscoped CSS
    if (!html.includes('<style>')) {
      issues.push('Missing scoped CSS');
    }

    // Check for accessibility
    if (!html.includes('role="presentation"')) {
      issues.push('Missing accessibility role');
    }

    // Check for mobile viewport
    if (!html.includes('viewport')) {
      issues.push('Missing viewport meta tag');
    }

    // Check for unreplaced variables
    const unreplaced = this.findUnreplacedVariables(html);
    if (unreplaced.length > 0) {
      issues.push(`Unreplaced variables: ${unreplaced.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get template statistics
   */
  static getStats(html) {
    return {
      size: `${(html.length / 1024).toFixed(2)} KB`,
      lineCount: html.split('\n').length,
      variableCount: (html.match(/{{[A-Z_]+}}/g) || []).length,
      linkCount: (html.match(/href=/g) || []).length,
      imageCount: (html.match(/<img/g) || []).length
    };
  }
}

/**
 * Email Template Builder - Build custom templates
 */
class EmailTemplateBuilder {
  constructor() {
    this.content = this.getBaseTemplate();
  }

  /**
   * Get base template structure
   */
  getBaseTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f4f6f8; font-family: 'Segoe UI', Verdana, sans-serif; }
    .email-container { width: 100%; max-width: 680px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 0 20px rgba(0,0,0,0.08); }
    .header { padding: 24px; background: linear-gradient(135deg, #0f4c81 0%, #0077d9 100%); color: #fff; text-align: center; }
    .content { padding: 28px 32px; }
    .footer { padding: 24px 32px; background: #f4f6f8; color: #777; font-size: 13px; border-top: 1px solid #e0e6ed; }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 24px 0; background: #eef2f7;">
        <div class="email-container">
          <div class="header">
            <h1>{{TITLE}}</h1>
          </div>
          <div class="content">
            {{BODY}}
          </div>
          <div class="footer">
            <p>© {{YEAR}} Verdexis. All rights reserved.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Set header
   */
  setHeader(title, subtitle = '') {
    const headerHtml = `<h1 style="margin: 0;">${title}</h1>${subtitle ? `<p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">${subtitle}</p>` : ''}`;
    this.content = this.content.replace('{{TITLE}}', headerHtml);
    return this;
  }

  /**
   * Add body content
   */
  addBody(content) {
    this.content = this.content.replace('{{BODY}}', content);
    return this;
  }

  /**
   * Add alert box
   */
  addAlert(message, type = 'info') {
    const colors = {
      success: { bg: '#e8f5e9', border: '#4caf50', color: '#2e7d32' },
      warning: { bg: '#fff3e0', border: '#ff9800', color: '#e65100' },
      error: { bg: '#ffebee', border: '#f44336', color: '#c62828' },
      info: { bg: '#e3f2fd', border: '#2196f3', color: '#1565c0' }
    };
    const style = colors[type] || colors.info;
    return `<div style="padding: 16px; border-radius: 8px; border-left: 4px solid ${style.border}; background: ${style.bg}; color: ${style.color}; margin: 16px 0;">${message}</div>`;
  }

  /**
   * Add button
   */
  addButton(text, url, type = 'primary') {
    const styles = {
      primary: 'background: #0077d9; color: #fff;',
      secondary: 'background: #f4f6f8; color: #0077d9; border: 1px solid #0077d9;',
      danger: 'background: #f44336; color: #fff;'
    };
    return `<a href="${url}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; ${styles[type] || styles.primary} text-decoration: none; border-radius: 8px; font-weight: bold;">${text}</a>`;
  }

  /**
   * Build final HTML
   */
  build() {
    return this.content;
  }
}

// ============================================
// EXAMPLE USAGE
// ============================================

/*
// Initialize and load templates
const manager = new EmailTemplateManager('./templates/');
manager.setGlobalVariables({
  COMPANY_NAME: 'Verdexis',
  COMPANY_ADDRESS: '123 Finance Way, New York, NY 10001',
  PRIVACY_LINK: 'https://verdexis.com/privacy',
  TERMS_LINK: 'https://verdexis.com/terms'
});

manager.loadAllTemplates();

// Render welcome email
const welcomeHtml = manager.render('welcome', {
  USER_NAME: 'John Doe',
  ONBOARDING_URL: 'https://verdexis.com/setup',
  HELP_CENTER_URL: 'https://verdexis.com/help'
});

// Validate template
const validation = EmailTemplateValidator.validate(welcomeHtml);
console.log('Valid:', validation.valid);
console.log('Issues:', validation.issues);

// Get stats
const stats = EmailTemplateValidator.getStats(welcomeHtml);
console.log('Stats:', stats);

// Build custom template
const builder = new EmailTemplateBuilder();
const customHtml = builder
  .setHeader('Special Offer!', 'Limited Time Only')
  .addBody('<p>Get 50% off premium features for 3 months!</p>')
  .build();
*/

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EmailTemplateManager,
    EmailTemplateValidator,
    EmailTemplateBuilder
  };
}

// Export for ES6 modules
if (typeof export !== 'undefined') {
  export { EmailTemplateManager, EmailTemplateValidator, EmailTemplateBuilder };
}
