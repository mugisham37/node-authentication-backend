import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../infrastructure/logging/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RenderEmailOptions {
  templateName: string;
  data: Record<string, unknown>;
  subject: string;
  showUnsubscribe?: boolean;
}

export interface RenderSMSOptions {
  templateName: string;
  data: Record<string, unknown>;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export class TemplateService {
  private emailTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private smsTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private baseLayout: HandlebarsTemplateDelegate | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.registerHelpers();
    this.loadTemplates();
  }

  private registerHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date | string, format?: string) => {
      const d = typeof date === 'string' ? new Date(date) : date;

      if (format === 'short') {
        return d.toLocaleDateString();
      } else if (format === 'long') {
        return d.toLocaleString();
      } else if (format === 'time') {
        return d.toLocaleTimeString();
      }

      return d.toLocaleString();
    });

    // Conditional helper
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => {
      return a === b;
    });

    Handlebars.registerHelper('ne', (a: unknown, b: unknown) => {
      return a !== b;
    });

    Handlebars.registerHelper('gt', (a: number, b: number) => {
      return a > b;
    });

    Handlebars.registerHelper('lt', (a: number, b: number) => {
      return a < b;
    });

    // String helpers
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    Handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });

    // Current year helper
    Handlebars.registerHelper('year', () => {
      return new Date().getFullYear();
    });

    logger.info('Handlebars helpers registered');
  }

  private loadTemplates(): void {
    const templatesDir = join(__dirname, '../../infrastructure/mail/templates');

    // Load base layout
    try {
      const layoutPath = join(templatesDir, 'layouts', 'email-base.hbs');
      const layoutSource = readFileSync(layoutPath, 'utf-8');
      this.baseLayout = Handlebars.compile(layoutSource);
      logger.info('Base email layout loaded');
    } catch (error) {
      logger.error('Failed to load base email layout', error as Error);
    }

    // Load email templates
    const emailTemplateFiles = {
      welcome: 'welcome.hbs',
      'email-verification': 'email-verification.hbs',
      'verification-email': 'verification-email.hbs', // Alias for backward compatibility
      'password-reset': 'password-reset.hbs',
      'password-changed': 'password-changed.hbs',
      'mfa-enabled': 'mfa-enabled.hbs',
      'mfa-disabled': 'mfa-disabled.hbs',
      'new-device-login': 'new-device-login.hbs',
      'account-locked': 'account-locked.hbs',
      'account-unlocked': 'account-unlocked.hbs',
      'security-alert': 'security-alert.hbs',
    };

    for (const [name, file] of Object.entries(emailTemplateFiles)) {
      try {
        const templatePath = join(templatesDir, file);
        const templateSource = readFileSync(templatePath, 'utf-8');
        this.emailTemplates.set(name, Handlebars.compile(templateSource));
        logger.debug(`Email template loaded: ${name}`);
      } catch (error) {
        logger.warn(`Failed to load email template ${name}`, { error });
      }
    }

    // Load SMS templates
    const smsTemplateFiles = {
      'verification-code': 'sms/verification-code.txt',
      'mfa-code': 'sms/mfa-code.txt',
      'security-alert': 'sms/security-alert.txt',
    };

    for (const [name, file] of Object.entries(smsTemplateFiles)) {
      try {
        const templatePath = join(templatesDir, file);
        const templateSource = readFileSync(templatePath, 'utf-8');
        this.smsTemplates.set(name, Handlebars.compile(templateSource));
        logger.debug(`SMS template loaded: ${name}`);
      } catch (error) {
        logger.warn(`Failed to load SMS template ${name}`, { error });
      }
    }

    logger.info('Templates loaded', {
      emailTemplates: this.emailTemplates.size,
      smsTemplates: this.smsTemplates.size,
    });
  }

  renderEmail(options: RenderEmailOptions): RenderedEmail {
    const template = this.emailTemplates.get(options.templateName);
    if (!template) {
      throw new Error(`Email template ${options.templateName} not found`);
    }

    // Render the template body
    const body = template({
      ...options.data,
      baseUrl: this.baseUrl,
    });

    // Wrap in base layout if available
    let html: string;
    if (this.baseLayout) {
      html = this.baseLayout({
        body,
        subject: options.subject,
        baseUrl: this.baseUrl,
        showUnsubscribe: options.showUnsubscribe ?? false,
        unsubscribeUrl: `${this.baseUrl}/unsubscribe`,
        year: new Date().getFullYear(),
      });
    } else {
      // Fallback if base layout is not available
      html = body;
    }

    // Convert HTML to plain text
    const text = this.htmlToText(html);

    return {
      html,
      text,
      subject: options.subject,
    };
  }

  renderSMS(options: RenderSMSOptions): string {
    const template = this.smsTemplates.get(options.templateName);
    if (!template) {
      throw new Error(`SMS template ${options.templateName} not found`);
    }

    return template({
      ...options.data,
      baseUrl: this.baseUrl,
    });
  }

  htmlToText(html: string): string {
    // Remove style and script tags with their content
    let text = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '');

    // Convert common HTML elements to text equivalents
    text = text
      // Convert links to text with URL
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      // Convert headings to uppercase with line breaks
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n\n')
      // Convert paragraphs to text with line breaks
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      // Convert line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Convert list items
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      // Convert divs to line breaks
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      // Convert horizontal rules
      .replace(/<hr[^>]*>/gi, '\n---\n');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean up whitespace
    text = text
      // Replace multiple spaces with single space
      .replace(/ +/g, ' ')
      // Replace multiple line breaks with maximum two
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Trim the whole text
      .trim();

    return text;
  }

  // Method to reload templates (useful for development)
  reloadTemplates(): void {
    this.emailTemplates.clear();
    this.smsTemplates.clear();
    this.loadTemplates();
    logger.info('Templates reloaded');
  }

  // Method to check if a template exists
  hasEmailTemplate(name: string): boolean {
    return this.emailTemplates.has(name);
  }

  hasSMSTemplate(name: string): boolean {
    return this.smsTemplates.has(name);
  }

  // Method to get list of available templates
  getAvailableEmailTemplates(): string[] {
    return Array.from(this.emailTemplates.keys());
  }

  getAvailableSMSTemplates(): string[] {
    return Array.from(this.smsTemplates.keys());
  }
}
