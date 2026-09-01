/**
 * Company Information Configuration
 * Update this file with your company details for email templates and notifications
 */

export const companyInfo = {
  name: 'Verdexis',
  tagline: 'Intelligent Portfolio Management & Real-Time Trading Analytics',
  
  // Contact Information
  contact: {
    email: 'admin@verdexisgroup.com',
    phone: '+1 (555) 123-4567',
    whatsapp: '+17196798790',
    telegram: 't.me/+17196798790',
  },

  // Physical Address
  address: {
    street: '123 Crypto Boulevard',
    city: 'Digital City',
    state: 'DC',
    zip: '10001',
    country: 'United States',
  },

  // Social Media Links
  social: {
    linkedin: 'https://linkedin.com/company/verdexis',
    twitter: 'https://twitter.com/verdexis',
    facebook: 'https://facebook.com/verdexis',
    instagram: 'https://instagram.com/verdexis',
    youtube: 'https://youtube.com/@verdexis',
  },

  // Important Links
  links: {
    website: 'https://www.verdexisgroup.online',
    dashboard: 'https://app.verdexis.com',
    helpCenter: 'https://help.verdexis.com',
    blog: 'https://blog.verdexis.com',
    terms: 'https://www.verdexisgroup.online/terms',
    privacy: 'https://www.verdexisgroup.online/privacy',
    security: 'https://www.verdexisgroup.online/security',
    contact: 'https://www.verdexisgroup.online/support',
  },

  // Legal Information
  legal: {
    registeredName: 'Verdexis Inc.',
    registrationNumber: '123456789',
    vatNumber: 'US123456789',
    license: 'Financial Services License #FS-2024-001',
  },

  // Compliance & Regulatory
  compliance: {
    regulatedBy: 'Financial Conduct Authority',
    amlPolicy: 'https://verdexis.com/aml-policy',
    kycPolicy: 'https://verdexis.com/kyc-policy',
    riskDisclosure: 'https://verdexis.com/risk-disclosure',
  },

  // Branding
  branding: {
    // Use the public site wordmark to ensure email clients fetch the correct
    // official logo instead of older or redirecting domains.
    logo: 'https://www.verdexisgroup.online/assets/logo-icon-transparent.png',
    logoLight: 'https://www.verdexisgroup.online/assets/logo-icon-transparent.png',
    logoDark: 'https://www.verdexisgroup.online/assets/logo-icon-transparent.png',
    favicon: 'https://www.verdexisgroup.online/favicon.ico',
    primaryColor: '#0077d9',
    secondaryColor: '#0f4c81',
  },

  // Email Footer Template
  getEmailFooter(): string {
    return `
      <strong>${this.name}</strong><br/>
      ${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zip}<br/>
      ${this.contact.phone} | ${this.contact.email}<br/>
      <br/>
      <div style="margin-top: 12px;">
        <a href="${this.links.terms}" style="color: #0077d9; text-decoration: none;">Terms of Service</a> | 
        <a href="${this.links.privacy}" style="color: #0077d9; text-decoration: none;">Privacy Policy</a> | 
        <a href="${this.links.security}" style="color: #0077d9; text-decoration: none;">Security</a> | 
        <a href="${this.links.contact}" style="color: #0077d9; text-decoration: none;">Contact Us</a>
      </div>
      <br/>
      <div style="font-size: 11px; color: #999; margin-top: 12px;">
        <strong>Risk Warning:</strong> Trading cryptocurrencies and financial instruments involves substantial risk of loss. 
        Past performance is not indicative of future results. Please ensure you understand the risks involved.
      </div>
      <br/>
      <div style="font-size: 11px; color: #999;">
        ${this.legal.registeredName} is registered in ${this.address.country}.<br/>
        Registration No: ${this.legal.registrationNumber} | ${this.legal.license}<br/>
        © ${new Date().getFullYear()} ${this.name}. All rights reserved.
      </div>
    `
  },

  // Social Links HTML
  getSocialLinksHtml(): string {
    return `
      <div style="margin: 16px 0;">
        <strong>Follow us:</strong><br/>
        <a href="${this.social.linkedin}" style="color: #0077d9; text-decoration: none; margin-right: 12px;">LinkedIn</a>
        <a href="${this.social.twitter}" style="color: #0077d9; text-decoration: none; margin-right: 12px;">Twitter</a>
        <a href="${this.social.facebook}" style="color: #0077d9; text-decoration: none; margin-right: 12px;">Facebook</a>
      </div>
    `
  },

  // Get formatted address
  getFormattedAddress(): string {
    return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zip}, ${this.address.country}`
  },
}
