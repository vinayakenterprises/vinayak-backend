import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import transporter from '../config/mailer.js';

// __dirname doesn't exist in ES modules, so recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadTemplate = (templateName, replacements) => {
  const filePath = path.join(__dirname, '../templates', `${templateName}.html`);
  let html = fs.readFileSync(filePath, 'utf-8');

  Object.entries(replacements).forEach(([key, val]) => {
    html = html.replaceAll(`{{${key}}}`, val);
  });

  return html;
};

export const sendMail = async ({ to, subject, templateName, replacements = {}, text }) => {
  const html = templateName ? loadTemplate(templateName, replacements) : undefined;

  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  return await transporter.sendMail(mailOptions);
};