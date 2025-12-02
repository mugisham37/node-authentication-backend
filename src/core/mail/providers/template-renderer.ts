import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TemplateRenderer {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    const templatesDir = join(__dirname, '../templates');

    const templateFiles = {
      'verification-email': 'verification-email.hbs',
      'password-reset': 'password-reset.hbs',
      'security-alert': 'security-alert.hbs',
      welcome: 'welcome.hbs',
    };

    for (const [name, file] of Object.entries(templateFiles)) {
      try {
        const templatePath = join(templatesDir, file);
        const templateSource = readFileSync(templatePath, 'utf-8');
        this.templates.set(name, Handlebars.compile(templateSource));
      } catch (error) {
        console.error(`Failed to load template ${name}:`, error);
      }
    }
  }

  render(templateName: string, data: Record<string, unknown>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    return template(data);
  }

  renderToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
