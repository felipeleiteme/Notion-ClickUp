import 'dotenv/config';
import { Resend } from 'resend';
import { teams } from '../clients/teams';

const resend = new Resend(process.env.RESEND_API_KEY);

interface NotificationData {
  taskId: string;
  taskName: string;
  action: 'created' | 'updated';
}

const RECIPIENT_EMAILS = {
  felipe: process.env.EMAIL_FELIPE,
  andreia: process.env.EMAIL_ANDREIA,
  gisele: process.env.EMAIL_GISELE,
};

async function sendTeamsNotification(data: NotificationData): Promise<void> {
  if (!process.env.TEAMS_WEBHOOK_URL) {
    console.warn('TEAMS_WEBHOOK_URL não configurado. Notificação para Teams não será enviada.');
    return;
  }

  const actionText = data.action === 'created' ? 'criada' : 'atualizada';
  const actionColor = data.action === 'created' ? '00FF00' : 'FFA500';
  const clickupUrl = `https://app.clickup.com/t/${data.taskId}`;

  const card = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: `Tarefa ${actionText} no ClickUp`,
    themeColor: actionColor,
    title: `✅ Tarefa ${actionText} no ClickUp`,
    sections: [
      {
        activityTitle: data.taskName,
        facts: [
          {
            name: 'ID da Tarefa:',
            value: data.taskId,
          },
          {
            name: 'Ação:',
            value: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          },
        ],
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'Ver no ClickUp',
        targets: [
          {
            os: 'default',
            uri: clickupUrl,
          },
        ],
      },
    ],
  };

  try {
    await teams.post('', card);
    console.log('Notificação enviada para Teams com sucesso');
  } catch (error) {
    console.error('Erro ao enviar notificação para Teams:', error);
  }
}

async function sendEmailNotification(
  recipient: string,
  data: NotificationData,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY não configurado. Notificação por email não será enviada.');
    return;
  }

  const actionText = data.action === 'created' ? 'criada' : 'atualizada';
  const subject = `Tarefa ${actionText} no ClickUp: ${data.taskName}`;
  const clickupUrl = `https://app.clickup.com/t/${data.taskId}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Tarefa ${actionText} no ClickUp</h2>
      <p><strong>Nome da tarefa:</strong> ${data.taskName}</p>
      <p><strong>ID da tarefa:</strong> ${data.taskId}</p>
      <p><strong>Ação:</strong> ${actionText}</p>
      <p><a href="${clickupUrl}" style="background-color: #7B68EE; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver tarefa no ClickUp</a></p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Esta é uma notificação automática da integração Notion-ClickUp.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Notion-ClickUp <onboarding@resend.dev>',
      to: recipient,
      subject,
      html,
    });

    console.log(`Email de notificação enviado para ${recipient}`);
  } catch (error) {
    console.error(`Erro ao enviar email para ${recipient}:`, error);
  }
}

export async function sendNotifications(
  tasks: Array<NotificationData>,
): Promise<void> {
  if (tasks.length === 0) {
    return;
  }

  console.log(`Enviando notificações sobre ${tasks.length} tarefa(s)...`);

  for (const task of tasks) {
    await sendTeamsNotification(task);

    if (RECIPIENT_EMAILS.felipe) {
      await sendEmailNotification(RECIPIENT_EMAILS.felipe, task);
    }

    if (RECIPIENT_EMAILS.andreia) {
      await sendEmailNotification(RECIPIENT_EMAILS.andreia, task);
    }

    if (RECIPIENT_EMAILS.gisele) {
      await sendEmailNotification(RECIPIENT_EMAILS.gisele, task);
    }
  }

  console.log('Todas as notificações foram enviadas.');
}
