import { Logger } from "./Logger";
import { Loglevel } from "./enums";

var sgMail;

try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID);

} catch (error) {
    Logger(Loglevel.VERBOSE, 'Mailer', '@sendgrid/mail not installed, sendMail not available')
}

export const sendEmail = async (from: string, to: string, subject: string, text: string, html: string) => {
    const msg = { to, from, subject, text, html };

    if (!sgMail) {
        Logger(Loglevel.WARNING, 'Mailer', `@sendgrid/mail not installed cant send email to <${to}> with subject <${subject}>`)
        return;
    }

    try {
        const response = await sgMail.send(msg);
        return response;
    } catch (error) {
        throw error;
    }
};