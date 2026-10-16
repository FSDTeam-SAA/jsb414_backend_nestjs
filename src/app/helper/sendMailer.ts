import nodemailer from 'nodemailer';
import config from '../config';

const sendMailer = async (email: string, subject?: string, html?: string) => {
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: Number(config.email.port),
    secure: Number(config.email.port) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: config.email.address,
      pass: config.email.pass,
    },
  });
  await transporter.sendMail({
    from: config.email.from,
    to: email,
    subject,
    html,
  });
};

export default sendMailer;
