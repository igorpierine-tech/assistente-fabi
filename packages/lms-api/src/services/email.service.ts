import { Resend } from "resend";
import { env } from "../config/env";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!env.resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(env.resendApiKey);
  }
  return _resend;
}

const FROM = env.emailFrom;

export async function sendVerificationEmail(to: string, firstName: string, token: string) {
  const link = `${env.webUrl}/auth/verify-email?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Confirme seu e-mail — Líder Áurea",
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a2e18;">
        <div style="background: #1a2e18; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #d9b268; font-size: 24px; margin: 0; font-family: 'Playfair Display', Georgia, serif;">
            Líder Áurea
          </h1>
        </div>
        <div style="background: #f4ede0; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin-bottom: 8px;">Olá, <strong>${firstName}</strong>!</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Obrigado por se cadastrar na plataforma de formação executiva Líder Áurea.
            Para ativar sua conta, confirme seu e-mail clicando no botão abaixo:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${link}"
               style="display: inline-block; background: #b8873a; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Confirmar E-mail
            </a>
          </div>
          <p style="font-size: 12px; color: #888; line-height: 1.5;">
            Se você não criou esta conta, ignore este e-mail.
            O link expira em 24 horas.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, firstName: string, token: string) {
  const link = `${env.webUrl}/auth/reset-password?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Redefinição de senha — Líder Áurea",
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a2e18;">
        <div style="background: #1a2e18; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #d9b268; font-size: 24px; margin: 0; font-family: 'Playfair Display', Georgia, serif;">
            Líder Áurea
          </h1>
        </div>
        <div style="background: #f4ede0; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin-bottom: 8px;">Olá, <strong>${firstName}</strong>!</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Recebemos um pedido para redefinir a senha da sua conta.
            Clique no botão abaixo para criar uma nova senha:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${link}"
               style="display: inline-block; background: #b8873a; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Redefinir Senha
            </a>
          </div>
          <p style="font-size: 12px; color: #888; line-height: 1.5;">
            Se você não solicitou essa alteração, ignore este e-mail.
            O link expira em 1 hora.
          </p>
        </div>
      </div>
    `,
  });
}
